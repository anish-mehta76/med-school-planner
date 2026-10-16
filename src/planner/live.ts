import { addPublishedTerms, applySis, COURSE } from './catalog';
import { summarize, type SisSection } from './sis';

/**
 * Live SIS lookups with your own API key, for when the app runs on your computer
 * (`npm run dev`). SIS doesn't accept requests from web pages, so the local dev
 * server relays them (see vite.config.ts). The key and the results stay in this
 * browser only: never in backups, synced data or the website.
 */
const KEY = 'med-school-planner:sis-key';
const CACHE = 'med-school-planner:sis-live';

/** Live lookups need the local dev server's relay. */
export const LIVE_AVAILABLE = import.meta.env.DEV;

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // Storage blocked: works for this session only.
  }
};

export const getSisKey = () => read(KEY) ?? '';
export const setSisKey = (key: string) => write(KEY, key.trim() || null);

interface LiveCache {
  syncedAt: string;
  courses: ReturnType<typeof summarize>[];
}

let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};
export const liveVersion = () => version;
export function subscribeLive(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function liveSyncedAt(): string | undefined {
  try {
    return (JSON.parse(read(CACHE) ?? 'null') as LiveCache | null)?.syncedAt;
  } catch {
    return undefined;
  }
}

// Apply what this browser fetched before.
try {
  const cached = JSON.parse(read(CACHE) ?? 'null') as LiveCache | null;
  if (cached?.courses?.length) {
    applySis(cached.courses as never);
    addPublishedTerms(cached.courses.flatMap((c) => c.offered ?? []));
  }
} catch {
  // Ignore a damaged cache.
}

export interface LiveProgress {
  done: number;
  total: number;
  failed: string[];
}

/** Looks up each course in SIS (about two a second) and merges the results into the catalog. */
export async function refreshLive(codes: string[], onProgress: (p: LiveProgress) => void): Promise<LiveProgress> {
  const key = getSisKey();
  if (!key) throw new Error('Add your SIS API key first.');
  const real = [...new Set(codes)].filter((c) => /^[A-Z]{2}\.\d{3}\.\d{3}$/.test(c));
  const prev = (JSON.parse(read(CACHE) ?? 'null') as LiveCache | null)?.courses ?? [];
  const byCode = new Map(prev.map((c) => [c.code, c]));
  const p: LiveProgress = { done: 0, total: real.length, failed: [] };
  for (const code of real) {
    try {
      const res = await fetch(`/sis-api/classes/${encodeURIComponent(code)}?key=${encodeURIComponent(key)}`);
      if (res.status === 401 || res.status === 403) throw Object.assign(new Error('SIS did not accept the API key.'), { fatal: true });
      const sections = res.ok ? ((await res.json()) as SisSection[]) : [];
      if (sections.length) byCode.set(code, summarize(code, sections, new Date()));
      else p.failed.push(code);
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal) throw e;
      p.failed.push(code);
    }
    p.done++;
    onProgress({ ...p });
    await new Promise((r) => setTimeout(r, 500));
  }
  const courses = [...byCode.values()];
  write(CACHE, JSON.stringify({ syncedAt: new Date().toISOString().slice(0, 10), courses } satisfies LiveCache));
  applySis(courses as never);
  addPublishedTerms(courses.flatMap((c) => c.offered ?? []));
  bump();
  return p;
}

/** True when a code has live or synced SIS data. */
export const hasSis = (code: string) => COURSE[code]?.source === 'SIS';
