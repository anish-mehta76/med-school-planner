import { useSyncExternalStore } from 'react';
import type { AppState } from '../types';
import { backupOf, defaultState, getState, normalize, onLocalEdit, replaceFromSync } from '../store/useStore';

/**
 * Keeps this browser's data in step with one JSON file in your private GitHub repo,
 * so the Mac and the phone see the same planner. The token lives only under SYNC_KEY
 * in this browser; it is never part of the planner data or a backup file.
 */
export const SYNC_KEY = 'med-school-planner:sync';
export const DATA_PATH = 'planner.json';
const API = 'https://api.github.com';
const PUSH_DELAY_MS = 3000;

export interface SyncConfig {
  owner: string;
  repo: string;
  token: string;
  /** Git blob sha of planner.json as this browser last saw it. */
  lastSha?: string;
  lastSyncedAt?: string;
  /** This browser has edits GitHub doesn't have yet. */
  dirty: boolean;
  /** When those edits were made. */
  localAt?: string;
}

/** What planner.json holds. */
interface Payload {
  format: 1;
  updatedAt: string;
  device: string;
  data: AppState;
}

interface Remote {
  sha: string;
  payload: Payload;
}

export type SyncStatus =
  | { kind: 'off' }
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'error'; message: string }
  | { kind: 'conflict'; remoteAt?: string; remoteDevice?: string; localAt?: string };

class SyncError extends Error {}

// ── Config and status ────────────────────────────────────────────────────────

export function getConfig(): SyncConfig | undefined {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    return raw ? (JSON.parse(raw) as SyncConfig) : undefined;
  } catch {
    return undefined;
  }
}

function saveConfig(c: SyncConfig | undefined) {
  try {
    if (c) localStorage.setItem(SYNC_KEY, JSON.stringify(c));
    else localStorage.removeItem(SYNC_KEY);
  } catch {
    // Storage blocked: sync works for this session only.
  }
}

function patchConfig(p: Partial<SyncConfig>) {
  const c = getConfig();
  if (c) saveConfig({ ...c, ...p });
}

let status: SyncStatus = getConfig() ? { kind: 'idle' } : { kind: 'off' };
let conflictRemote: Remote | undefined;
const listeners = new Set<() => void>();

function setStatus(s: SyncStatus) {
  status = s;
  listeners.forEach((l) => l());
}

export function getSyncStatus() {
  return status;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

// ── GitHub ───────────────────────────────────────────────────────────────────

/** Base64 of the UTF-8 bytes (btoa alone breaks on Hindi, Catalan accents, curly quotes…). */
export function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64(b64: string) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function gh(c: Pick<SyncConfig, 'owner' | 'repo' | 'token'>, path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}${path}`, {
      ...init,
      // GitHub's API responses are cacheable for 60 s; a cached copy would hide the other device's changes.
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${c.token}`, ...init.headers },
    });
  } catch {
    throw new SyncError("Couldn't reach GitHub. Your changes are saved on this device and will sync when you're back online.");
  }
  if (res.status === 401) throw new SyncError("GitHub didn't accept the token. It may be mistyped, expired or revoked.");
  if (res.status === 403) throw new SyncError(`The token can't write to ${c.repo}. Give it Contents: Read and write on that repo.`);
  return res;
}

async function fetchRemote(c: SyncConfig): Promise<Remote | null> {
  const res = await gh(c, `/contents/${DATA_PATH}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new SyncError(`GitHub returned an error (${res.status}). Try again in a minute.`);
  const meta = (await res.json()) as { sha: string; content?: string; encoding?: string };
  let text: string;
  if (meta.content && meta.encoding === 'base64') {
    text = fromBase64(meta.content);
  } else {
    // Files over 1 MB come without content; ask for the raw file instead.
    const raw = await gh(c, `/contents/${DATA_PATH}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
    if (!raw.ok) throw new SyncError(`GitHub returned an error (${raw.status}). Try again in a minute.`);
    text = await raw.text();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SyncError(`${DATA_PATH} in ${c.repo} isn't valid JSON. Fix or delete it on GitHub, then sync again.`);
  }
  const p = parsed as Partial<Payload>;
  // Also accepts a plain backup file dropped into the repo by hand.
  const payload: Payload = p.format === 1 && p.data ? (p as Payload) : { format: 1, updatedAt: '', device: 'a backup file', data: parsed as AppState };
  return { sha: meta.sha, payload };
}

function deviceName() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'computer';
}

// ── Sync steps ───────────────────────────────────────────────────────────────

/** Bumped on every local edit, so a push that raced an edit leaves the data marked unsynced. */
let editSeq = 0;
let chain: Promise<void> = Promise.resolve();
let pushTimer: ReturnType<typeof setTimeout> | undefined;

/** Runs sync steps one at a time. */
function serial(step: () => Promise<void>): Promise<void> {
  const run = async () => {
    setStatus({ kind: 'syncing' });
    try {
      await step();
      if (status.kind === 'syncing') setStatus({ kind: 'idle' });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof SyncError ? e.message : 'Sync failed. Try again.' });
    }
  };
  chain = chain.then(run, run);
  return chain;
}

function apply(remote: Remote) {
  replaceFromSync(normalize(remote.payload.data));
  patchConfig({ lastSha: remote.sha, dirty: false, localAt: undefined, lastSyncedAt: new Date().toISOString() });
}

function enterConflict(remote: Remote) {
  conflictRemote = remote;
  setStatus({ kind: 'conflict', remoteAt: remote.payload.updatedAt || undefined, remoteDevice: remote.payload.device, localAt: getConfig()?.localAt });
}

async function pullStep() {
  const c = getConfig();
  if (!c) return;
  const remote = await fetchRemote(c);
  if (!remote) {
    // Nothing on GitHub yet (or the file was deleted there): this device's copy becomes the synced one.
    patchConfig({ lastSha: undefined, dirty: true });
    return pushStep();
  }
  if (remote.sha === c.lastSha) return c.dirty ? pushStep() : undefined;
  if (!c.dirty) return apply(remote);
  enterConflict(remote);
}

async function pushStep() {
  const c = getConfig();
  if (!c || !c.dirty) return;
  const seq = editSeq;
  const device = deviceName();
  const payload: Payload = { format: 1, updatedAt: c.localAt ?? new Date().toISOString(), device, data: backupOf(getState()) };
  const res = await gh(c, `/contents/${DATA_PATH}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Sync from ${device}`,
      content: toBase64(JSON.stringify(payload)),
      ...(c.lastSha ? { sha: c.lastSha } : {}),
    }),
  });
  if (res.status === 409 || res.status === 422) {
    // The other device saved first. Look at its copy instead of overwriting it.
    const remote = await fetchRemote(c);
    if (!remote) {
      patchConfig({ lastSha: undefined });
      throw new SyncError('Sync got out of step. Tap Sync now to try again.');
    }
    if (remote.sha === c.lastSha) throw new SyncError(`GitHub refused the update (${res.status}). Try again in a minute.`);
    return enterConflict(remote);
  }
  if (!res.ok) throw new SyncError(`GitHub returned an error (${res.status}). Try again in a minute.`);
  const out = (await res.json()) as { content: { sha: string } };
  const stillClean = seq === editSeq;
  patchConfig({ lastSha: out.content.sha, lastSyncedAt: new Date().toISOString(), ...(stillClean ? { dirty: false, localAt: undefined } : {}) });
  if (!stillClean) schedulePush();
}

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void syncNow(), PUSH_DELAY_MS);
}

// ── Public actions ───────────────────────────────────────────────────────────

/** Pulls the other device's changes, then pushes this device's. */
export function syncNow(): Promise<void> {
  clearTimeout(pushTimer);
  if (!getConfig() || status.kind === 'conflict') return Promise.resolve();
  return serial(pullStep);
}

/** True when this browser holds nothing but the starting defaults. */
function isPristine() {
  const s = getState();
  return JSON.stringify(normalize(JSON.parse(JSON.stringify(s)))) === JSON.stringify(defaultState());
}

/** Checks the repo is private, saves the connection and does a first sync. */
export function connect(owner: string, repo: string, token: string): Promise<void> {
  const creds = { owner: owner.trim(), repo: repo.trim(), token: token.trim() };
  return serial(async () => {
    const res = await gh(creds, '');
    if (res.status === 404) throw new SyncError(`Couldn't find ${creds.owner}/${creds.repo}, or the token doesn't include it.`);
    if (!res.ok) throw new SyncError(`GitHub returned an error (${res.status}). Try again in a minute.`);
    const info = (await res.json()) as { private?: boolean };
    if (info.private !== true) throw new SyncError(`${creds.owner}/${creds.repo} is public. Your tracker holds draft emails, so sync only to a private repo.`);
    saveConfig({ ...creds, dirty: !isPristine(), localAt: new Date().toISOString() });
    const c = getConfig()!;
    const remote = await fetchRemote(c);
    if (!remote) {
      patchConfig({ dirty: true });
      return pushStep();
    }
    if (!c.dirty) return apply(remote);
    enterConflict(remote);
  });
}

/** Settles a conflict: keep this device's data (overwrites GitHub) or take the other device's. */
export function resolveConflict(keep: 'this' | 'other'): Promise<void> {
  const remote = conflictRemote;
  if (!remote) return Promise.resolve();
  conflictRemote = undefined;
  setStatus({ kind: 'idle' });
  if (keep === 'other') {
    apply(remote);
    return Promise.resolve();
  }
  patchConfig({ lastSha: remote.sha, dirty: true });
  return serial(pushStep);
}

/** Stops syncing on this device. The data here stays as it is. */
export function disconnect() {
  clearTimeout(pushTimer);
  conflictRemote = undefined;
  saveConfig(undefined);
  setStatus({ kind: 'off' });
}

let started = false;

/** Wires sync to edits, app start and the app coming back to the foreground. */
export function startSync() {
  if (started) return;
  started = true;
  onLocalEdit(() => {
    editSeq++;
    const c = getConfig();
    if (!c) return;
    patchConfig({ dirty: true, localAt: new Date().toISOString() });
    if (status.kind !== 'conflict') schedulePush();
  });
  document.addEventListener('visibilitychange', () => {
    // Coming back pulls the other device's changes; leaving sends ours right away.
    void syncNow();
  });
  window.addEventListener('online', () => void syncNow());
  void syncNow();
}

/** For tests only. */
export function _resetForTests() {
  clearTimeout(pushTimer);
  conflictRemote = undefined;
  chain = Promise.resolve();
  status = getConfig() ? { kind: 'idle' } : { kind: 'off' };
}
