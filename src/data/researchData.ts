import type { AppState, Mentor, Program } from '../types';
import { MENTORS } from './mentors';
import { NYC_PROGRAMS } from './nycPrograms';

/**
 * The mentor and program lists. A local copy with src/data/private/ uses those (always the latest import);
 * the public site has none built in and uses the lists restored from your backup file instead.
 */
export function mentorsOf(s: Pick<AppState, 'mentors'>): Mentor[] {
  return MENTORS.length ? MENTORS : (s.mentors ?? []);
}

export function programsOf(s: Pick<AppState, 'programs'>): Program[] {
  return NYC_PROGRAMS.length ? NYC_PROGRAMS : (s.programs ?? []);
}
