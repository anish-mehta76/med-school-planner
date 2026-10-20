import type { PlanItem } from './types';

/**
 * JHU's AP credit table (KSAS/WSE External Credit Policies, 2026–27 catalogue, read 2026-10-20).
 * One table for everyone, so an AP exam always turns into the same JHU courses; each medical
 * school's own AP rules are then applied to those courses (medSchools.ts).
 */
export const AP_SOURCE = 'https://e-catalogue.jhu.edu/ksas-wse/undergraduate-policies/academic-policies/external-credit-policies/';

export interface ApCourse {
  code: string;
  title: string;
  credits: number;
}

export interface ApAward {
  exam: string;
  /** Scores that earn this award. */
  scores: number[];
  courses: ApCourse[];
  /** Lab courses JHU waives without credit. */
  labsWaived?: string[];
  note?: string;
}

const BIO1 = { code: 'AS.020.151', title: 'General Biology I', credits: 3 };
const BIO2 = { code: 'AS.020.152', title: 'General Biology II', credits: 3 };
const CHEM1 = [
  { code: 'AS.030.101', title: 'Introductory Chemistry I', credits: 3 },
  { code: 'AS.030.105', title: 'Introductory Chemistry Lab I', credits: 1 },
];
const CHEM2 = [
  { code: 'AS.030.102', title: 'Introductory Chemistry II', credits: 3 },
  { code: 'AS.030.106', title: 'Introductory Chemistry Lab II', credits: 1 },
];
const CALC1 = { code: 'AS.110.108', title: 'Calculus I (Physical Sciences & Engineering)', credits: 4 };
const CALC2 = { code: 'AS.110.109', title: 'Calculus II (Physical Sciences & Engineering)', credits: 4 };

export const AP_TABLE: ApAward[] = [
  { exam: 'AP Biology', scores: [5], courses: [BIO1, BIO2], labsWaived: ['AS.020.153', 'AS.020.154'], note: 'Labs AS.020.153–154 are waived but earn no credit.' },
  { exam: 'AP Chemistry', scores: [5], courses: [...CHEM1, ...CHEM2] },
  {
    exam: 'AP Chemistry',
    scores: [4],
    courses: CHEM1,
    note: 'With a 4, take AS.030.103 at JHU to finish intro chemistry and keep the AP credit; taking 030.102 means retaking 030.101 and losing it.',
  },
  { exam: 'AP Environmental Science', scores: [4, 5], courses: [{ code: 'TR.270.100', title: 'Environmental Science (AP transfer credit)', credits: 4 }] },
  { exam: 'AP Computer Science A', scores: [5], courses: [{ code: 'EN.500.112', title: 'Gateway Computing: JAVA', credits: 3 }] },
  { exam: 'AP Calculus AB', scores: [5], courses: [CALC1] },
  { exam: 'AP Calculus BC', scores: [3, 4], courses: [CALC1] },
  { exam: 'AP Calculus BC', scores: [5], courses: [CALC1, CALC2] },
  { exam: 'AP Physics C: Mechanics', scores: [4, 5], courses: [{ code: 'AS.171.101', title: 'General Physics I', credits: 4 }], labsWaived: ['AS.173.111'], note: 'Lab AS.173.111 is waived but earns no credit.' },
  {
    exam: 'AP Physics C: Electricity & Magnetism',
    scores: [4, 5],
    courses: [{ code: 'AS.171.102', title: 'General Physics II', credits: 4 }],
    labsWaived: ['AS.173.112'],
    note: 'Lab AS.173.112 is waived but earns no credit.',
  },
  { exam: 'AP Statistics', scores: [4, 5], courses: [{ code: 'EN.553.111', title: 'Statistical Analysis I', credits: 4 }] },
];

export const AP_EXAMS = [...new Set(AP_TABLE.map((a) => a.exam))];

/** The award for an exam and score, or undefined if JHU gives no credit for that score. */
export function apAward(exam: string, score: number) {
  return AP_TABLE.find((a) => a.exam === exam && a.scores.includes(score));
}

/** Exam-lane plan items for an AP score (empty if JHU gives no credit). */
export function apItems(exam: string, score: number, newId: () => string): PlanItem[] {
  const award = apAward(exam, score);
  return (award?.courses ?? []).map((c) => ({ id: newId(), code: c.code, termId: 'PRE', title: c.title, credits: c.credits, exam, score }));
}

/**
 * JHU forfeiture rules (table footnotes): taking any `ifTaken` course at JHU cancels the AP
 * credit for the `lost` codes you hold.
 */
export const FORFEIT: { lost: string[]; ifTaken: string[] }[] = [
  { lost: ['AS.020.151'], ifTaken: ['AS.020.151', 'AS.020.153'] },
  { lost: ['AS.020.152'], ifTaken: ['AS.020.152', 'AS.020.154'] },
  { lost: ['AS.030.101', 'AS.030.105', 'AS.030.102', 'AS.030.106'], ifTaken: ['AS.030.101', 'AS.030.105'] },
  { lost: ['AS.030.102', 'AS.030.106'], ifTaken: ['AS.030.102', 'AS.030.106', 'AS.030.103'] },
  { lost: ['AS.110.108'], ifTaken: ['AS.110.108', 'AS.110.106'] },
  { lost: ['AS.110.109'], ifTaken: ['AS.110.109', 'AS.110.107', 'AS.110.113'] },
  { lost: ['AS.171.101'], ifTaken: ['AS.171.101', 'AS.171.103', 'AS.171.107'] },
  { lost: ['AS.171.102'], ifTaken: ['AS.171.102', 'AS.171.104', 'AS.171.108'] },
  { lost: ['EN.500.112'], ifTaken: ['EN.500.112', 'EN.500.113', 'EN.500.114'] },
];

export interface Forfeit {
  /** Exam-lane item that loses its credit. */
  item: PlanItem;
  /** The JHU plan item that causes it. */
  cause: PlanItem;
}

/** Exam-lane items whose credit JHU would cancel because of a course in the plan. */
export function forfeits(plan: PlanItem[]): Forfeit[] {
  const exam = plan.filter((p) => p.termId === 'PRE');
  const taken = plan.filter((p) => p.termId !== 'PRE');
  const out: Forfeit[] = [];
  for (const item of exam) {
    for (const rule of FORFEIT) {
      if (!rule.lost.includes(item.code)) continue;
      const cause = taken.find((t) => rule.ifTaken.includes(t.code));
      if (cause && !out.some((f) => f.item.id === item.id)) out.push({ item, cause });
    }
  }
  return out;
}
