import type { Term } from './types';

const t = (id: string, label: string, ord: number, season: Term['season'], sisName?: string): Term => ({ id, label, ord, season, sisName });

/** Exam lane, then Fall → Winter intersession → Spring → Summer for each year (spec section 9 plus intersessions). */
export const TERMS: Term[] = [
  t('PRE', 'Exam & transfer credit', -1, 'PRE'),
  ...[26, 27, 28, 29].flatMap((y, i) => [
    t(`F${y}`, `Fall 20${y}`, i * 2, 'F', `Fall 20${y}`),
    t(`W${y + 1}`, `Intersession 20${y + 1}`, i * 2 + 0.5, 'W', `Intersession 20${y + 1}`),
    t(`S${y + 1}`, `Spring 20${y + 1}`, i * 2 + 1, 'S', `Spring 20${y + 1}`),
    ...(y < 29 ? [t(`U${y + 1}`, `Summer 20${y + 1}`, i * 2 + 1.5, 'U', `Summer 20${y + 1}`)] : []),
  ]),
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
  const id = m >= 8 ? `F${y % 100}` : m === 1 ? `W${y % 100}` : m <= 5 ? `S${y % 100}` : `U${y % 100}`;
  if (TERM_BY_ID[id]) return id;
  return now < new Date(2026, 7, 1) ? 'PRE' : 'S30';
}

export function termOrd(id: string) {
  return TERM_BY_ID[id]?.ord ?? 99;
}
