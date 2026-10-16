import type { Term } from './types';

export const TERMS: Term[] = [
  { id: 'PRE', label: 'Exam & transfer credit', ord: -1, season: 'PRE' },
  { id: 'F26', label: 'Fall 2026', ord: 0, season: 'F' },
  { id: 'S27', label: 'Spring 2027', ord: 1, season: 'S' },
  { id: 'U27', label: 'Summer 2027', ord: 1.5, season: 'U' },
  { id: 'F27', label: 'Fall 2027', ord: 2, season: 'F' },
  { id: 'S28', label: 'Spring 2028', ord: 3, season: 'S' },
  { id: 'U28', label: 'Summer 2028', ord: 3.5, season: 'U' },
  { id: 'F28', label: 'Fall 2028', ord: 4, season: 'F' },
  { id: 'S29', label: 'Spring 2029', ord: 5, season: 'S' },
  { id: 'U29', label: 'Summer 2029', ord: 5.5, season: 'U' },
  { id: 'F29', label: 'Fall 2029', ord: 6, season: 'F' },
  { id: 'S30', label: 'Spring 2030', ord: 7, season: 'S' },
];

export const TERM_BY_ID: Record<string, Term> = Object.fromEntries(TERMS.map((t) => [t.id, t]));

export const SEMESTERS = TERMS.filter((t) => t.season === 'F' || t.season === 'S');

/** The final academic year (BSPH courses must go here). */
export const FINAL_YEAR = ['F29', 'S30'];

export const YEAR_LABEL = ['First year', 'Second year', 'Third year', 'Fourth year'];

/** The term in progress on a date; auto-fill never places courses there or earlier. */
export function currentTermId(now = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const id = m >= 8 ? `F${y % 100}` : m <= 5 ? `S${y % 100}` : `U${y % 100}`;
  if (TERM_BY_ID[id]) return id;
  return now < new Date(2026, 7, 1) ? 'PRE' : 'S30';
}

export function termOrd(id: string) {
  return TERM_BY_ID[id]?.ord ?? 99;
}
