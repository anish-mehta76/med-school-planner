import type { PlannerState } from './planner/types';

export type Category =
  | 'clinical-paid'
  | 'clinical-volunteer'
  | 'shadowing'
  | 'research'
  | 'nonclinical-volunteer'
  | 'leadership'
  | 'teaching'
  | 'employment'
  | 'other';

/** Areas the gap engine scores. Opportunities and guides are tagged with these. */
export type Area =
  | 'clinical'
  | 'shadowing'
  | 'volunteering'
  | 'research'
  | 'publications'
  | 'leadership'
  | 'gpa'
  | 'mcat';

export interface HourLog {
  id: string;
  date: string; // YYYY-MM-DD
  hours: number;
  note?: string;
}

export interface Experience {
  id: string;
  title: string;
  organization: string;
  category: Category;
  startDate: string;
  endDate?: string;
  ongoing: boolean;
  hoursPerWeek?: number;
  /** Hours completed before you started logging individual sessions. */
  baseHours: number;
  logs: HourLog[];
  contactName?: string;
  contactEmail?: string;
  description: string;
  meaningful: boolean;
  /** Serves an underserved / low-income population. */
  underserved: boolean;
  /** Shadowing only. */
  specialty?: string;
}

export type OutputType = 'publication' | 'poster' | 'oral' | 'abstract';
export type OutputStatus = 'in-prep' | 'submitted' | 'accepted' | 'published' | 'presented';

export interface ResearchOutput {
  id: string;
  type: OutputType;
  title: string;
  venue: string;
  status: OutputStatus;
  authorPosition?: number;
  date?: string;
  experienceId?: string;
}

export interface Academics {
  gpa?: number;
  scienceGpa?: number;
  mcat?: number;
  mcatTarget?: number;
  mcatDate?: string;
  prereqs: Record<string, boolean>;
}

export interface Profile {
  name: string;
  school: string;
  gradYear: number;
  /** The year you submit AMCAS (it opens in May of this year). */
  applicationYear: number;
}

export interface Benchmark {
  area: Area;
  label: string;
  unit: string;
  minimum: number;
  competitive: number;
  why: string;
}

export type OppStatus = 'interested' | 'applied' | 'accepted' | 'declined';

export interface AppState {
  version: 1;
  profile: Profile;
  academics: Academics;
  experiences: Experience[];
  outputs: ResearchOutput[];
  oppStatus: Record<string, OppStatus>;
  benchmarks: Benchmark[];
  /** Your edits to mentor outreach, keyed by mentor ID. Overrides imported CSV values. */
  outreach: Record<string, Partial<Outreach>>;
  /** Program IDs you have marked as applied / not pursuing. */
  programStatus: Record<string, OppStatus>;
  scoreWeights: ScoreWeights;
  /** Your imported tracker CSV (private columns live only here, in this browser). */
  tracker?: TrackerImport;
  /** Your own "Why this lab" wording per disease bridge (private, this browser only). */
  whyTemplates?: Partial<Record<'endometrial' | 'cervical' | 'methods', string>>;
  /** Mentor and program lists restored from a backup (they aren't published with the website). */
  mentors?: Mentor[];
  programs?: Program[];
  /** Four-year course plans; the sample scenarios are used until you change something. */
  planner?: PlannerState;
}

export type Severity = 'critical' | 'gap' | 'on-track' | 'strong';

export interface Gap {
  id: string;
  area: Area;
  severity: Severity;
  title: string;
  detail: string;
  action: string;
}

export interface Opportunity {
  id: string;
  name: string;
  kind: 'summer-program' | 'clinical-role' | 'shadowing' | 'conference' | 'journal' | 'volunteering' | 'leadership' | 'test-prep';
  areas: Area[];
  description: string;
  eligibility: string;
  /** Typical application deadline months (1–12), if any. */
  deadlineMonths?: number[];
  timing: string;
  url: string;
  paid?: boolean;
  /** Program may not run this cycle (e.g. funding ended). */
  uncertain?: boolean;
}

export interface Guide {
  id: string;
  title: string;
  areas: Area[];
  summary: string;
  steps: string[];
  tips?: string[];
}

// ── Research targeting ─────────────────────────────────────────────────────

export interface Link {
  label: string;
  url: string;
}

/** CSV text with its "(url)" citations pulled out into links. */
export interface Cited {
  text: string;
  links: Link[];
}

export interface MentorPublication {
  code?: string;
  journal: string;
  year?: number;
  note?: string;
  url?: string;
}

export type MentorPriority = 'Start' | 'Next' | 'Conditional';

/**
 * One key per "Outreach status" value allowed in the tracker CSV (see CLAUDE.md):
 * Drafted; not sent | Sent | Followed up | No response | Replied - declined |
 * Replied - redirected | Replied - interested | Meeting | Joined.
 */
export type OutreachStatus =
  | 'drafted'
  | 'sent'
  | 'followed-up'
  | 'no-response'
  | 'declined'
  | 'redirected'
  | 'interested'
  | 'meeting'
  | 'joined';

/** Editable outreach-tracking fields. Mirrors the tracker CSV's tracking columns. */
export interface Outreach {
  status: OutreachStatus;
  firstContact?: string;
  /** Set automatically to 10 business days after first contact; editable. */
  followUpDue?: string;
  lastResponse?: string;
  response?: string;
  window?: string;
  hoursPerWeek?: string;
  skills?: string;
  worksite?: string;
  dayToDayMentor?: string;
  dataset?: string;
  irb?: string;
  workPackage?: string;
  authorship?: string;
  milestone?: string;
  funding?: string;
  applicationRoute?: string;
  notes?: string;
  /** Short label for the email variant sent, e.g. "v1-PCOS-bridge". */
  pitchVersion?: string;
  /** What came of joining, e.g. "poster 2027". Blank until known. */
  outcome?: string;
  /** Experience created when this mentor reached "joined". */
  experienceId?: string;
}

/**
 * Public research facts about a mentor. This is bundled into the website, so it
 * must hold only public information (see MentorPrivate for everything else).
 */
export interface Mentor {
  id: string;
  priority: MentorPriority;
  name: string;
  institution: Cited;
  diseaseFit: Cited;
  strength: Cited;
  publications: MentorPublication[];
  contact: Cited;
  email?: string;
  evidenceGate: string;
  lastVerified: string;
  undergradOpening: Cited;
  mentorshipEvidence: Cited;
  evidenceUrl?: string;
}

/**
 * Your private tracker columns for one mentor: project pitch, draft email and
 * outreach tracking. Read in the browser from the tracker CSV you import; never
 * bundled into the website.
 */
export interface MentorPrivate {
  pitch: string;
  draftSubject: string;
  draftBody: string;
  /** Outreach values from the CSV; edits in the app override these. */
  outreach: Partial<Outreach>;
}

/** The tracker CSV as you last imported it, kept verbatim so it can be exported again. */
export interface TrackerImport {
  fileName: string;
  importedAt: string;
  columns: string[];
  rows: Record<string, string>[];
}

export interface ProgramDate {
  date: string; // YYYY-MM-DD
  label: string;
}

export interface Program {
  id: string;
  priority: number;
  name: string;
  location: string;
  recommendation: string;
  eligibility: string;
  timeline: string;
  /** Next application deadline parsed from the timeline, if one is stated. */
  deadline?: string;
  /** False when the timeline says TBD / not verified / historical, or asks to clarify. */
  deadlineVerified: boolean;
  dates: ProgramDate[];
  summerDates: string;
  fit: string;
  publicationEvidence: string;
  deliverable: string;
  pay: string;
  nextAction: string;
  source: string;
}

export interface ScoreWeights {
  diseaseFit: number;
  skillsBridge: number;
  publications: number;
  largeStudy: number;
  underrepresented: number;
  mentorship: number;
  reachability: number;
}
