import type { AppState, Mentor, Outreach, OutreachStatus, Program, TrackerImport } from '../types';

export const FOLLOW_UP_BUSINESS_DAYS = 10;

/** The exact "Outreach status" strings CLAUDE.md allows in the tracker CSV, in its order. */
export const TRACKER_STATUS: Record<OutreachStatus, string> = {
  drafted: 'Drafted; not sent',
  sent: 'Sent',
  'followed-up': 'Followed up',
  'no-response': 'No response',
  declined: 'Replied - declined',
  redirected: 'Replied - redirected',
  interested: 'Replied - interested',
  meeting: 'Meeting',
  joined: 'Joined',
};

export const OUTREACH_STATUSES = Object.keys(TRACKER_STATUS) as OutreachStatus[];

export function isOutreachStatus(v: unknown): v is OutreachStatus {
  return typeof v === 'string' && v in TRACKER_STATUS;
}

/**
 * Reads a tracker "Outreach status" cell, a key, or a legacy value (older saves
 * used drafted / sent / replied / meeting / joined / declined). Exact tracker
 * values match first; anything else falls back to keywords, then "drafted".
 */
export function toOutreachStatus(raw: string | undefined): OutreachStatus {
  if (isOutreachStatus(raw)) return raw;
  const s = (raw ?? '').toLowerCase().replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
  const exact = OUTREACH_STATUSES.find((k) => TRACKER_STATUS[k].toLowerCase() === s);
  if (exact) return exact;
  if (/joined|accepted|started/.test(s)) return 'joined';
  if (/no (response|reply)|unanswered|ghost/.test(s)) return 'no-response';
  if (/declin|no capacity|rejected/.test(s)) return 'declined';
  if (/redirect|referred|pointed/.test(s)) return 'redirected';
  if (/meeting|interview|\bcall\b/.test(s)) return 'meeting';
  // A bare "replied" (the old stage) meant the ball was in your court.
  if (/interest|repl|respond/.test(s)) return 'interested';
  if (/followed[- ]?up|follow[- ]?up sent|nudge/.test(s)) return 'followed-up';
  if (/sent|emailed|contacted/.test(s) && !/not sent/.test(s)) return 'sent';
  return 'drafted';
}

/** Pipeline stages in order. "follow-up" is derived: sent and past the follow-up date. */
export type PipelineStage = OutreachStatus | 'follow-up';

export const STAGE_LABELS: Record<PipelineStage, string> = { ...TRACKER_STATUS, 'follow-up': 'Follow-up due' };

export const PIPELINE: PipelineStage[] = ['drafted', 'sent', 'follow-up', 'followed-up', 'no-response', 'declined', 'redirected', 'interested', 'meeting', 'joined'];

/** Badge colour group per stage (reuses the existing .stage-* styles). */
export const STAGE_TONE: Record<PipelineStage, string> = {
  drafted: 'drafted',
  sent: 'sent',
  'follow-up': 'follow-up',
  'followed-up': 'sent',
  'no-response': 'drafted',
  declined: 'drafted',
  redirected: 'replied',
  interested: 'replied',
  meeting: 'meeting',
  joined: 'joined',
};

/** Statuses where the next move is yours. */
export const NEEDS_ACTION: OutreachStatus[] = ['interested', 'redirected', 'meeting'];

/** Statuses that take a mentor out of new suggestions. */
export const CLOSED: OutreachStatus[] = ['joined', 'declined'];

function parseDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Adds weekdays (Mon–Fri). Holidays are not accounted for. */
export function addBusinessDays(iso: string, days: number): string {
  const d = parseDay(iso);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return fmtDay(d);
}

/** Tracker CSV columns that hold outreach tracking, and the Outreach field each maps to. */
export const OUTREACH_COLUMNS: Record<string, keyof Outreach> = {
  'Preferred academic-year or summer window': 'window',
  'Hours per week I can offer': 'hoursPerWeek',
  'Relevant skills I can offer': 'skills',
  'First contact date': 'firstContact',
  'Follow-up due date': 'followUpDue',
  'Last response date': 'lastResponse',
  'Response and next action': 'response',
  'Actual worksite and in-person requirement': 'worksite',
  'Proposed day-to-day mentor': 'dayToDayMentor',
  'Available dataset or specimens': 'dataset',
  'IRB and data-access readiness': 'irb',
  'Agreed student work package': 'workPackage',
  'Authorship expectations discussed': 'authorship',
  'First milestone and due date': 'milestone',
  'Funding or credit arrangement': 'funding',
  'Application route and eligibility confirmed': 'applicationRoute',
  Notes: 'notes',
  'Pitch version': 'pitchVersion',
  Outcome: 'outcome',
};

/** Reads the outreach columns of one tracker CSV row. */
export function rowOutreach(row: Record<string, string>): Partial<Outreach> {
  const o: Partial<Outreach> = { status: toOutreachStatus(row['Outreach status']) };
  for (const [col, key] of Object.entries(OUTREACH_COLUMNS)) {
    const v = row[col]?.trim();
    if (v) (o as Record<string, string>)[key] = v;
  }
  return o;
}

const csvCache = new WeakMap<TrackerImport, Record<string, Partial<Outreach>>>();

/** Outreach values from your imported tracker CSV, by mentor ID (empty if nothing imported). */
export function csvOutreachById(tracker: TrackerImport | undefined): Record<string, Partial<Outreach>> {
  if (!tracker) return {};
  let byId = csvCache.get(tracker);
  if (!byId) {
    byId = Object.fromEntries(tracker.rows.filter((r) => r.ID?.trim()).map((r) => [r.ID.trim(), rowOutreach(r)]));
    csvCache.set(tracker, byId);
  }
  return byId;
}

/** Imported CSV values with your in-app edits layered on top. */
export function effectiveOutreach(m: Mentor, state: Pick<AppState, 'outreach' | 'tracker'>): Outreach {
  return { status: 'drafted', ...csvOutreachById(state.tracker)[m.id], ...state.outreach[m.id] } as Outreach;
}

/**
 * Builds the patch to store for an edit. Setting a first-contact date fills the
 * follow-up date (10 business days later) and moves a draft to "sent".
 */
export function outreachPatch(current: Outreach, patch: Partial<Outreach>): Partial<Outreach> {
  const out = { ...patch };
  if (patch.firstContact && patch.firstContact !== current.firstContact) {
    out.followUpDue = addBusinessDays(patch.firstContact, FOLLOW_UP_BUSINESS_DAYS);
    if ((patch.status ?? current.status) === 'drafted') out.status = 'sent';
  }
  return out;
}

export function stageOf(o: Outreach, today: string): PipelineStage {
  if (o.status === 'sent' && o.followUpDue && o.followUpDue <= today) return 'follow-up';
  return o.status;
}

export function weekEnd(today: string): string {
  const d = parseDay(today);
  d.setDate(d.getDate() + (7 - d.getDay()) % 7);
  return fmtDay(d);
}

/** Sent mentors whose follow-up is overdue or due by the end of this week (Sunday). */
export function followUpsDue(mentors: Mentor[], state: Pick<AppState, 'outreach' | 'tracker'>, today: string) {
  const end = weekEnd(today);
  return mentors
    .map((m) => ({ m, o: effectiveOutreach(m, state) }))
    .filter(({ o }) => o.status === 'sent' && o.followUpDue && o.followUpDue <= end)
    .sort((a, b) => a.o.followUpDue!.localeCompare(b.o.followUpDue!));
}

/** Interested or redirected replies and meetings, i.e. the ball is in your court. */
export function awaitingAction(mentors: Mentor[], state: Pick<AppState, 'outreach' | 'tracker'>) {
  return mentors.map((m) => ({ m, o: effectiveOutreach(m, state) })).filter(({ o }) => NEEDS_ACTION.includes(o.status));
}

/** Programs with a deadline on or after today, soonest first, then those without a usable date. */
export function sortPrograms(programs: Program[], today: string): Program[] {
  const upcoming = (p: Program) => (p.deadline && p.deadline >= today ? p.deadline : undefined);
  return [...programs].sort((a, b) => {
    const da = upcoming(a);
    const db = upcoming(b);
    if (da && db) return da.localeCompare(db) || a.priority - b.priority;
    if (da) return -1;
    if (db) return 1;
    return a.priority - b.priority;
  });
}
