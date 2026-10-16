/** Four-year course planner (see JHU_FOUR_YEAR_PLANNER_SPEC.md). */

export type Season = 'F' | 'S' | 'U' | 'PRE';

export interface Term {
  id: string;
  label: string;
  ord: number;
  season: Season;
}

/** Where a course fact came from, shown next to it in the UI. */
export type Source = 'catalogue' | 'SIS' | 'estimated';

export interface Course {
  code: string;
  title: string;
  credits: number;
  /** Offered only in fall or only in spring (verified). */
  term?: 'F' | 'S';
  /** Each group needs one of its codes, scheduled in an earlier term. */
  prereqs?: string[][];
  /** Prereqs come from the department's sample order, not a stated prerequisite. */
  seqOnly?: boolean;
  /** Prerequisite text from SIS when it couldn't be parsed into groups. */
  prereqText?: string;
  /** Foundational Ability tags. A trailing "?" marks an estimated tag. */
  fa?: string[];
  posTags?: string[];
  writingIntensive?: boolean;
  /** Placeholder that auto-fill may add more than once. */
  placeholder?: boolean;
  /** Real course that may be taken more than once (e.g. AS.080.499). */
  repeatable?: boolean;
  note?: string;
  source: Source;
  /** Last term SIS listed it, e.g. "Spring 2026". */
  lastOffered?: string;
}

export interface PlanItem {
  id: string;
  code: string;
  termId: string;
  /** Overrides for this instance (custom courses use these). */
  title?: string;
  credits?: number;
  fa?: string[];
  /** Taken Satisfactory/Unsatisfactory instead of a letter grade. */
  su?: boolean;
  addedByAutofill?: boolean;
}

/** A plan course with catalog data merged in. */
export interface Resolved {
  item: PlanItem;
  code: string;
  title: string;
  credits: number;
  ord: number;
  season: Season;
  course?: Course;
  fa: string[];
}

export type Matcher = string | RegExp | ((c: Resolved) => boolean);

interface ReqBase {
  /** Stable key, unique within its major. */
  key: string;
  label: string;
  /** Exam/transfer credit can't satisfy it. */
  noExam?: boolean;
  /** Shown under the requirement. */
  hint?: string;
  /** Can be waived (e.g. by placement); value is whether it's waived by default. */
  waivable?: boolean;
}

export type Requirement =
  /** All codes of any `n` options (default 1), each option a list of codes. */
  | (ReqBase & { type: 'set'; options: string[][]; n?: number })
  | (ReqBase & { type: 'pick'; n: number; from: Matcher[]; minCredits?: number; minPerCourse?: number; distinctDept?: boolean; fill?: string[] })
  | (ReqBase & { type: 'cred'; credits: number; from: Matcher[]; minPerCourse?: number; fill?: string[] })
  | (ReqBase & { type: 'note'; from?: Matcher[] });

export interface Major {
  id: string;
  name: string;
  short: string;
  degree: 'BA' | 'BS' | 'Track';
  totalLabel: string;
  color: string;
  requirements: Requirement[];
  sourceUrl: string;
  notes: string[];
}

export interface Scenario {
  id: string;
  name: string;
  majorIds: string[];
  plan: PlanItem[];
  premed: boolean;
  /** MCAT is taken after this term (default S29). */
  mcatAfterTermId?: string;
  /** Requirement waivers keyed "majorId:reqKey"; missing means the requirement's default. */
  waivers?: Record<string, boolean>;
  showSummers?: boolean;
}

export interface PlannerState {
  scenarios: Scenario[];
  activeId: string;
}
