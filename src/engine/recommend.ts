import type { AppState, Area, Gap, Mentor, Opportunity, Severity } from '../types';
import { rankMentors, type MentorScore } from './mentorScore';
import { CLOSED, effectiveOutreach } from './outreach';
import type { AreaStatus } from './gaps';

const WEIGHT: Record<Severity, number> = { critical: 4, gap: 2, 'on-track': 1, strong: 0 };

export interface RankedOpportunity {
  opp: Opportunity;
  score: number;
  matched: Area[];
  /** Months until the nearest typical deadline (0 = this month). */
  monthsToDeadline?: number;
}

export function monthsToNextDeadline(months: number[] | undefined, now: Date): number | undefined {
  if (!months?.length) return undefined;
  const cur = now.getMonth() + 1;
  return Math.min(...months.map((m) => (m - cur + 12) % 12));
}

/** Area weight = worst severity from either the benchmark score or a specific gap. */
export function areaWeights(areas: AreaStatus[], gaps: Gap[]): Partial<Record<Area, number>> {
  const w: Partial<Record<Area, number>> = {};
  for (const a of areas) w[a.area] = Math.max(w[a.area] ?? 0, WEIGHT[a.severity]);
  for (const g of gaps) w[g.area] = Math.max(w[g.area] ?? 0, WEIGHT[g.severity]);
  return w;
}

export function rankOpportunities(opps: Opportunity[], areas: AreaStatus[], gaps: Gap[], now = new Date()): RankedOpportunity[] {
  const w = areaWeights(areas, gaps);
  return opps
    .map((opp) => {
      const matched = opp.areas.filter((a) => (w[a] ?? 0) >= WEIGHT.gap);
      const need = Math.max(0, ...opp.areas.map((a) => w[a] ?? 0));
      const monthsToDeadline = monthsToNextDeadline(opp.deadlineMonths, now);
      // Deadlines coming up in the next 3 months get a nudge so they aren't missed.
      const urgency = monthsToDeadline !== undefined && monthsToDeadline <= 3 ? 1.5 - monthsToDeadline * 0.4 : 0;
      return { opp, matched, monthsToDeadline, score: need * 2 + matched.length + Math.max(0, urgency) - (opp.uncertain ? 4 : 0) };
    })
    .sort((a, b) => b.score - a.score || a.opp.name.localeCompare(b.opp.name));
}

/**
 * When the research or publications area has an open gap, suggest the
 * top-scoring mentors you haven't joined or been declined by.
 */
export function suggestMentors(
  mentors: Mentor[],
  areas: AreaStatus[],
  gaps: Gap[],
  state: Pick<AppState, 'outreach' | 'tracker' | 'scoreWeights'>,
  limit = 3,
): { m: Mentor; score: MentorScore }[] {
  const open = (a: Area) =>
    areas.some((x) => x.area === a && (x.severity === 'critical' || x.severity === 'gap')) ||
    gaps.some((g) => g.area === a && (g.severity === 'critical' || g.severity === 'gap'));
  if (!open('research') && !open('publications')) return [];
  return rankMentors(mentors, state.scoreWeights)
    .filter(({ m }) => !CLOSED.includes(effectiveOutreach(m, state).status))
    .slice(0, limit);
}
