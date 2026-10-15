import type { Program } from '../types';

/** Personal, local-only data; see mentors.ts. */
const mods = import.meta.glob<{ NYC_PROGRAMS: Program[] }>('./private/nycPrograms.ts', { eager: true });
export const NYC_PROGRAMS: Program[] = Object.values(mods)[0]?.NYC_PROGRAMS ?? [];
