import { useSyncExternalStore } from 'react';
import type { AppState } from '../types';
import { DEFAULT_BENCHMARKS, PREREQS } from '../data/benchmarks';
import { DEFAULT_WEIGHTS } from '../engine/mentorScore';
import { toOutreachStatus } from '../engine/outreach';
import { saveFile } from '../lib/saveFile';
import { mentorsOf, programsOf } from '../data/researchData';

/** Never change this: a new key would hide every saved browser's data after the next deploy. */
export const STORAGE_KEY = 'med-school-planner:v1';

export function defaultState(): AppState {
  const year = new Date().getFullYear();
  return {
    version: 1,
    // Defaults assume a freshman applying the summer before senior year.
    profile: { name: '', school: '', gradYear: year + 4, applicationYear: year + 3 },
    academics: { prereqs: Object.fromEntries(PREREQS.map((p) => [p, false])) },
    experiences: [],
    outputs: [],
    oppStatus: {},
    benchmarks: DEFAULT_BENCHMARKS,
    outreach: {},
    programStatus: {},
    scoreWeights: DEFAULT_WEIGHTS,
  };
}

/** Fills in any fields missing from older or hand-edited saves. */
export function normalize(raw: unknown): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<AppState>;
  return {
    version: 1,
    profile: { ...base.profile, ...s.profile },
    academics: { ...base.academics, ...s.academics, prereqs: { ...base.academics.prereqs, ...s.academics?.prereqs } },
    experiences: Array.isArray(s.experiences) ? s.experiences.map((e) => ({ ...e, logs: e.logs ?? [], baseHours: e.baseHours ?? 0 })) : [],
    outputs: Array.isArray(s.outputs) ? s.outputs : [],
    oppStatus: s.oppStatus ?? {},
    benchmarks: base.benchmarks.map((b) => ({ ...b, ...s.benchmarks?.find((x) => x.area === b.area) })),
    outreach: normalizeOutreach(s.outreach),
    programStatus: s.programStatus ?? {},
    scoreWeights: { ...base.scoreWeights, ...s.scoreWeights },
    tracker: validTracker(s.tracker),
    whyTemplates: s.whyTemplates && typeof s.whyTemplates === 'object' ? s.whyTemplates : undefined,
    mentors: validList(s.mentors, (m) => !!m.institution && !!m.diseaseFit && !!m.strength),
    programs: validList(s.programs, () => true),
    planner: validPlanner(s.planner),
  };
}

/** Keeps a saved list only if every entry has an id and a name. */
function validList<T extends { id: string; name: string }>(raw: T[] | undefined, ok: (x: T) => boolean): T[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  return raw.every((x) => x && typeof x.id === 'string' && typeof x.name === 'string' && ok(x)) ? raw : undefined;
}

/** Built-in sample plans from earlier versions; dropped so everyone starts from their own blank plan. */
const SAMPLE_PLAN_IDS = new Set(['chem-phs', 'chem-phs-spanish', 'chem-phs-premed']);

/** Keeps your own course plan (one per browser) if it has the expected shape. */
function validPlanner(p: AppState['planner']): AppState['planner'] {
  if (!p || !Array.isArray(p.scenarios)) return undefined;
  const ok = (x: (typeof p.scenarios)[number]) => x && typeof x.id === 'string' && Array.isArray(x.plan) && Array.isArray(x.majorIds) && !x.sample && !SAMPLE_PLAN_IDS.has(x.id);
  const own = p.scenarios.filter(ok);
  const keep = own.find((x) => x.id === p.activeId) ?? own[0];
  return keep ? { scenarios: [keep], activeId: keep.id } : undefined;
}

function validTracker(t: AppState['tracker']): AppState['tracker'] {
  return t && Array.isArray(t.columns) && Array.isArray(t.rows) ? t : undefined;
}

/**
 * Maps saved outreach statuses onto the CLAUDE.md tracker set. Older saves used
 * drafted / sent / replied / meeting / joined / declined; "replied" becomes
 * "Replied - interested" so it still shows as waiting on you.
 */
function normalizeOutreach(raw: AppState['outreach'] | undefined): AppState['outreach'] {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw).map(([id, o]) => [id, o && typeof o === 'object' && 'status' in o ? { ...o, status: toOutreachStatus(o.status as string) } : o]),
  );
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : defaultState();
  } catch {
    return defaultState();
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

export function getState() {
  return state;
}

const editListeners = new Set<() => void>();

/** Runs after every change you make (not after data arrives from sync). */
export function onLocalEdit(l: () => void) {
  editListeners.add(l);
  return () => editListeners.delete(l);
}

export function setState(update: AppState | ((s: AppState) => AppState)) {
  write(typeof update === 'function' ? update(state) : update);
  editListeners.forEach((l) => l());
}

/** Replaces the data with what another device synced, without counting it as a local edit. */
export function replaceFromSync(next: AppState) {
  write(next);
}

function write(next: AppState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: state still lives in memory for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getState);
}

/** Backup of everything in this browser, including your imported tracker and the mentor and program lists. */
export function backupOf(s: AppState): AppState {
  const mentors = mentorsOf(s);
  const programs = programsOf(s);
  return { ...s, mentors: mentors.length ? mentors : undefined, programs: programs.length ? programs : undefined };
}

export function exportJson() {
  const blob = new Blob([JSON.stringify(backupOf(state), null, 2)], { type: 'application/json' });
  return saveFile(blob, `med-school-planner-${localDate()}.json`);
}

export async function importJson(file: File) {
  setState(normalize(JSON.parse(await file.text())));
}

/** Today's date as YYYY-MM-DD in local time (toISOString would give UTC). */
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
