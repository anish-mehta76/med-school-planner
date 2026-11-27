import { formatDateShort } from '../lib/format';
import type { AppState, Experience, Internship, InternshipStatus, Recommender, RecommenderStatus, Requirement, RequirementKind, RequirementStatus } from '../types';

/** Application stages in pipeline order. */
export const INTERNSHIP_STATUSES: InternshipStatus[] = [
  'interested',
  'preparing',
  'awaiting-recs',
  'applied',
  'interview',
  'waitlisted',
  'accepted',
  'committed',
  'rejected',
  'declined',
  'withdrawn',
];

export const INTERNSHIP_STATUS_LABEL: Record<InternshipStatus, string> = {
  interested: 'Interested',
  preparing: 'Preparing materials',
  'awaiting-recs': 'Applied – waiting on letters',
  applied: 'Applied – complete',
  interview: 'Interview',
  waitlisted: 'Waitlisted',
  accepted: 'Accepted',
  committed: 'Accepted offer',
  rejected: 'Rejected',
  declined: 'Declined offer',
  withdrawn: 'Withdrew',
};

/** Badge tone (reuses .stage-* styles). */
export const INTERNSHIP_TONE: Record<InternshipStatus, string> = {
  interested: 'drafted',
  preparing: 'replied',
  'awaiting-recs': 'follow-up',
  applied: 'sent',
  interview: 'meeting',
  waitlisted: 'replied',
  accepted: 'joined',
  committed: 'joined',
  rejected: 'drafted',
  declined: 'drafted',
  withdrawn: 'drafted',
};

/** Not yet submitted: deadlines still matter. */
export const PRE_SUBMIT: InternshipStatus[] = ['interested', 'preparing'];
/** Submitted and waiting to hear back. */
export const PENDING: InternshipStatus[] = ['awaiting-recs', 'applied', 'interview', 'waitlisted'];
/** Finished one way or another. */
export const CLOSED: InternshipStatus[] = ['committed', 'rejected', 'declined', 'withdrawn'];

export const REQUIREMENT_LABEL: Record<RequirementKind, string> = {
  resume: 'Resume / CV',
  cover: 'Cover letter',
  personal: 'Personal statement',
  supplemental: 'Supplemental essay',
  research: 'Research statement',
  short: 'Short-answer questions',
  transcript: 'Transcript',
  recs: 'Recommendation letters',
  writing: 'Writing sample',
  scores: 'Test scores',
  interview: 'Interview',
  enrollment: 'Proof of enrollment',
  fee: 'Application fee',
  other: 'Other',
};

export const REQUIREMENT_KINDS = Object.keys(REQUIREMENT_LABEL) as RequirementKind[];

/** Kinds that often come more than once in one application. */
export const REPEATABLE: RequirementKind[] = ['supplemental', 'short', 'writing', 'other'];

export const REQUIREMENT_STATUS_LABEL: Record<RequirementStatus, string> = {
  todo: 'Not started',
  drafting: 'Drafting',
  ready: 'Ready',
  submitted: 'Submitted',
};

export const RECOMMENDER_STATUS_LABEL: Record<RecommenderStatus, string> = {
  'to-ask': 'Not asked yet',
  asked: 'Asked – no reply',
  agreed: 'Agreed – waiting',
  submitted: 'Submitted',
  declined: 'Declined',
};

export const RECOMMENDER_TONE: Record<RecommenderStatus, string> = {
  'to-ask': 'drafted',
  asked: 'replied',
  agreed: 'sent',
  submitted: 'joined',
  declined: 'drafted',
};

/** Days from `today` to `iso` (negative when past). */
export function daysUntil(iso: string, today: string): number {
  const a = new Date(`${today}T00:00:00`).getTime();
  const b = new Date(`${iso}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Due today", "Due in 3 days", "2 days past due". */
export function dueLabel(iso: string, today: string, verb = 'Due'): string {
  const n = daysUntil(iso, today);
  if (n === 0) return `${verb} today`;
  if (n === 1) return `${verb} tomorrow`;
  if (n > 0) return `${verb} in ${n} days`;
  return `${-n} ${n === -1 ? 'day' : 'days'} past due`;
}

/** Letters that have been requested but not yet sent in. */
export const waitingOn = (i: Internship) => i.recommenders.filter((r) => r.status === 'asked' || r.status === 'agreed');
/** Everyone you have asked, whatever they said. */
export const askedList = (i: Internship) => i.recommenders.filter((r) => r.status !== 'to-ask');

/** Letters the program wants: the "count" on its letters requirement, else one per listed recommender who hasn't declined. */
export function lettersNeeded(i: Internship): number {
  const req = i.requirements.find((r) => r.kind === 'recs');
  if (!req) return 0;
  return req.count ?? i.recommenders.filter((r) => r.status !== 'declined').length;
}

export function lettersIn(i: Internship): number {
  return i.recommenders.filter((r) => r.status === 'submitted').length;
}

/** Materials you write or upload yourself (letters are tracked by recommender). */
export function materials(i: Internship): { done: number; total: number } {
  const own = i.requirements.filter((r) => r.kind !== 'recs');
  return { done: own.filter((r) => r.status === 'ready' || r.status === 'submitted').length, total: own.length };
}

/** Name for a requirement row, e.g. "Supplemental essay: Why this program?". */
export function requirementName(r: Requirement): string {
  return r.label?.trim() ? `${REQUIREMENT_LABEL[r.kind]}: ${r.label.trim()}` : REQUIREMENT_LABEL[r.kind];
}

/**
 * Applies a status change and records it: logs the change and fills in the
 * applied / decision date the first time you reach that stage.
 */
export function withStatus(i: Internship, status: InternshipStatus, today: string): Internship {
  if (i.status === status) return i;
  const next: Internship = { ...i, status, log: [...i.log, { date: today, text: `${INTERNSHIP_STATUS_LABEL[i.status]} → ${INTERNSHIP_STATUS_LABEL[status]}` }] };
  if ((status === 'awaiting-recs' || status === 'applied') && !next.appliedOn) next.appliedOn = today;
  if (['accepted', 'rejected', 'waitlisted'].includes(status) && !next.decisionOn) next.decisionOn = today;
  return next;
}

export interface InternshipTask {
  id: string;
  internshipId: string;
  date?: string;
  title: string;
  detail: string;
  urgent: boolean;
}

/**
 * What needs doing across all applications, soonest first: deadlines in the
 * next 3 weeks, letters to ask for or chase, interviews, offers to answer and
 * thank-you notes.
 */
export function internshipTasks(list: Internship[], today: string): InternshipTask[] {
  const out: InternshipTask[] = [];
  for (const i of list) {
    if (CLOSED.includes(i.status) && i.status !== 'committed') continue;
    const name = i.organization ? `${i.title} · ${i.organization}` : i.title;
    const pre = PRE_SUBMIT.includes(i.status);

    if (pre && i.deadline && daysUntil(i.deadline, today) <= 21) {
      const m = materials(i);
      out.push({
        id: `${i.id}-deadline`,
        internshipId: i.id,
        date: i.deadline,
        title: `${dueLabel(i.deadline, today)}: ${name}`,
        detail: m.total ? `${m.done} of ${m.total} materials ready` : 'Add what the application asks for',
        urgent: daysUntil(i.deadline, today) <= 7,
      });
    }

    if (pre || PENDING.includes(i.status)) {
      for (const r of i.recommenders) {
        if (r.status === 'to-ask') {
          out.push({
            id: `${i.id}-${r.id}-ask`,
            internshipId: i.id,
            date: i.deadline ? addDays(i.deadline, -21) : undefined,
            title: `Ask ${r.name} for a letter`,
            detail: i.deadline ? `For ${name}. Give at least 3 weeks before the ${formatDateShort(i.deadline)} deadline.` : `For ${name}`,
            urgent: !!i.deadline && daysUntil(i.deadline, today) <= 21,
          });
        } else if (r.status === 'agreed' || r.status === 'asked') {
          const due = r.dueDate ?? i.deadline;
          const noReply = r.status === 'asked' && r.askedOn && daysUntil(r.askedOn, today) <= -7;
          if (noReply) {
            out.push({ id: `${i.id}-${r.id}-nudge`, internshipId: i.id, date: addDays(r.askedOn!, 7), title: `Follow up with ${r.name}`, detail: `No reply since you asked on ${formatDateShort(r.askedOn!)} · ${name}`, urgent: true });
          } else if (due && daysUntil(due, today) <= 7) {
            out.push({ id: `${i.id}-${r.id}-remind`, internshipId: i.id, date: due, title: `Remind ${r.name}: letter ${dueLabel(due, today).toLowerCase()}`, detail: name, urgent: true });
          }
        }
      }
    }

    if (i.interviewOn && daysUntil(i.interviewOn, today) >= 0 && daysUntil(i.interviewOn, today) <= 14) {
      out.push({ id: `${i.id}-interview`, internshipId: i.id, date: i.interviewOn, title: dueLabel(i.interviewOn, today, 'Interview'), detail: name, urgent: daysUntil(i.interviewOn, today) <= 3 });
    }

    if (i.status === 'accepted' && i.offerDeadline) {
      out.push({ id: `${i.id}-offer`, internshipId: i.id, date: i.offerDeadline, title: dueLabel(i.offerDeadline, today, 'Offer reply due'), detail: name, urgent: daysUntil(i.offerDeadline, today) <= 5 });
    }

    // Thank-you notes once a letter is in (and the application is out).
    if (!pre) {
      for (const r of i.recommenders) {
        if (r.status === 'submitted' && !r.thanked) {
          out.push({ id: `${i.id}-${r.id}-thanks`, internshipId: i.id, date: r.submittedOn, title: `Thank ${r.name}`, detail: `Letter submitted for ${name}`, urgent: false });
        }
      }
    }
  }
  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.date ?? '9999').localeCompare(b.date ?? '9999'));
}

/** Everyone you have listed as a recommender, grouped by name across applications. */
export function recommendersByPerson(list: Internship[]): { name: string; role?: string; email?: string; items: { i: Internship; r: Recommender }[] }[] {
  const map = new Map<string, { name: string; role?: string; email?: string; items: { i: Internship; r: Recommender }[] }>();
  for (const i of list) {
    for (const r of i.recommenders) {
      const key = r.name.trim().toLowerCase();
      if (!key) continue;
      const p = map.get(key) ?? { name: r.name.trim(), items: [] };
      p.role ??= r.role || undefined;
      p.email ??= r.email || undefined;
      p.items.push({ i, r });
      map.set(key, p);
    }
  }
  return [...map.values()].sort((a, b) => waitingCount(b) - waitingCount(a) || a.name.localeCompare(b.name));
}

const waitingCount = (p: { items: { r: Recommender }[] }) => p.items.filter(({ r }) => r.status === 'asked' || r.status === 'agreed').length;

/** Sort: open applications by next date (deadline, interview or offer), then closed ones. */
export function sortInternships(list: Internship[], today: string): Internship[] {
  const key = (i: Internship) => {
    if (PRE_SUBMIT.includes(i.status)) return i.deadline ?? '9998';
    if (i.status === 'accepted') return i.offerDeadline ?? '9997';
    if (i.status === 'interview' && i.interviewOn && i.interviewOn >= today) return i.interviewOn;
    return i.decisionExpected ?? '9999';
  };
  const rank = (i: Internship) => (CLOSED.includes(i.status) ? 1 : 0);
  return [...list].sort((a, b) => rank(a) - rank(b) || key(a).localeCompare(key(b)) || a.title.localeCompare(b.title));
}

/** Adds an Experience for an internship whose offer you accepted, and links it. */
export function joinInternship(state: AppState, i: Internship, today: string): AppState {
  const exp: Experience = {
    id: `exp-${i.id}`,
    title: i.title,
    organization: i.organization,
    category: /research|lab/i.test(`${i.title} ${i.description}`) ? 'research' : 'other',
    startDate: i.startDate ?? today,
    endDate: i.endDate,
    ongoing: !i.endDate,
    baseHours: 0,
    logs: [],
    contactName: i.contactName,
    contactEmail: i.contactEmail,
    description: '',
    meaningful: false,
    underserved: false,
  };
  return {
    ...state,
    experiences: [...state.experiences, exp],
    internships: state.internships.map((x) => (x.id === i.id ? { ...x, experienceId: exp.id } : x)),
  };
}
