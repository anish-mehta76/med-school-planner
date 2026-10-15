import type { Mentor } from '../types';

/**
 * The researcher list is personal and lives only on this computer, in src/data/private/
 * (git-ignored; written by `npm run import-trackers`). The public site builds without it.
 */
const mods = import.meta.glob<{ MENTORS: Mentor[] }>('./private/mentors.ts', { eager: true });
export const MENTORS: Mentor[] = Object.values(mods)[0]?.MENTORS ?? [];
