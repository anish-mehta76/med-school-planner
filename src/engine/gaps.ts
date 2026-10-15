import type { AppState, Area, Benchmark, Experience, Gap, Severity } from '../types';
import { AMCAS_MAX_ENTRIES, AREA_CATEGORIES, PRIMARY_CARE } from '../data/benchmarks';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export function experienceHours(e: Experience): number {
  return (e.baseHours || 0) + e.logs.reduce((sum, l) => sum + (l.hours || 0), 0);
}

/** Target date to have experiences in place: AMCAS submission typically opens late May / early June. */
export function applicationDeadline(state: AppState): Date {
  return new Date(state.profile.applicationYear, 5, 1);
}

export function monthsUntil(target: Date, now: Date): number {
  return Math.max(0, (target.getTime() - now.getTime()) / (30.44 * DAY));
}

/** Hours an ongoing experience will add between now and the deadline at its stated weekly rate. */
export function projectedHours(e: Experience, until: Date, now: Date): number {
  if (!e.ongoing || !e.hoursPerWeek) return 0;
  const end = e.endDate ? Math.min(new Date(e.endDate).getTime(), until.getTime()) : until.getTime();
  const weeks = Math.max(0, (end - now.getTime()) / WEEK);
  return Math.round(weeks * e.hoursPerWeek);
}

export const COUNTED_OUTPUT = new Set(['accepted', 'published', 'presented']);

export interface AreaStatus {
  area: Area;
  benchmark: Benchmark;
  current: number | undefined;
  /** current + what ongoing activities will add by the deadline (hour areas only). */
  projected: number | undefined;
  severity: Severity;
  /** Hours per month still needed to reach the competitive target by the deadline. */
  pacePerMonth?: number;
}

function hourTotal(state: AppState, area: Area) {
  const cats = AREA_CATEGORIES[area] ?? [];
  return state.experiences.filter((e) => cats.includes(e.category));
}

function rate(current: number, projected: number, b: Benchmark): Severity {
  if (current >= b.competitive) return 'strong';
  if (projected >= b.competitive || current >= b.minimum) return 'on-track';
  if (projected >= b.minimum) return 'gap';
  return 'critical';
}

export function scoreAreas(state: AppState, now = new Date()): AreaStatus[] {
  const deadline = applicationDeadline(state);
  const months = monthsUntil(deadline, now);

  return state.benchmarks.map((b): AreaStatus => {
    const exps = hourTotal(state, b.area);
    if (AREA_CATEGORIES[b.area]) {
      const current = Math.round(exps.reduce((s, e) => s + experienceHours(e), 0));
      const projected = current + exps.reduce((s, e) => s + projectedHours(e, deadline, now), 0);
      const remaining = Math.max(0, b.competitive - current);
      return {
        area: b.area,
        benchmark: b,
        current,
        projected,
        severity: rate(current, projected, b),
        pacePerMonth: remaining > 0 && months > 0 ? Math.ceil(remaining / months) : undefined,
      };
    }
    if (b.area === 'publications') {
      const done = state.outputs.filter((o) => COUNTED_OUTPUT.has(o.status)).length;
      const pending = state.outputs.length;
      return { area: b.area, benchmark: b, current: done, projected: pending, severity: rate(done, pending, b) };
    }
    if (b.area === 'leadership') {
      const n = state.experiences.filter((e) => e.category === 'leadership').length;
      return { area: b.area, benchmark: b, current: n, projected: n, severity: rate(n, n, b) };
    }
    const value = b.area === 'gpa' ? state.academics.gpa : state.academics.mcat;
    if (value === undefined) {
      // Not entered yet: treat MCAT target as the plan; otherwise neutral.
      const target = b.area === 'mcat' ? state.academics.mcatTarget : undefined;
      return { area: b.area, benchmark: b, current: undefined, projected: target, severity: 'on-track' };
    }
    const severity: Severity = value >= b.competitive ? 'strong' : value >= b.minimum ? 'gap' : 'critical';
    return { area: b.area, benchmark: b, current: value, projected: value, severity };
  });
}

const fmt = (n: number) => n.toLocaleString();

export function findGaps(state: AppState, now = new Date()): Gap[] {
  const gaps: Gap[] = [];
  const deadline = applicationDeadline(state);
  const months = monthsUntil(deadline, now);
  const areas = scoreAreas(state, now);
  const byArea = Object.fromEntries(areas.map((a) => [a.area, a])) as Record<Area, AreaStatus>;

  for (const a of areas) {
    if (a.severity !== 'critical' && a.severity !== 'gap') continue;
    const b = a.benchmark;
    if (AREA_CATEGORIES[a.area]) {
      gaps.push({
        id: `hours-${a.area}`,
        area: a.area,
        severity: a.severity,
        title: `${b.label}: ${fmt(a.current ?? 0)} of ${fmt(b.minimum)} minimum hours`,
        detail:
          a.severity === 'critical'
            ? `At your current pace you won't reach the ${fmt(b.minimum)}-hour minimum by June ${state.profile.applicationYear}.`
            : `Your ongoing activities should get you past the minimum, but competitive applicants have ${fmt(b.competitive)}+.`,
        action: a.pacePerMonth
          ? `Aim for about ${fmt(a.pacePerMonth)} hours/month (≈${Math.ceil(a.pacePerMonth / 4.3)}/week) to reach ${fmt(b.competitive)} by your application.`
          : `Add an ongoing ${b.label.toLowerCase()} commitment.`,
      });
    } else if (a.area === 'publications') {
      gaps.push({
        id: 'output',
        area: 'publications',
        severity: a.severity,
        title: 'No research output yet',
        detail: 'A poster or presentation shows you carried a project through to results.',
        action: 'Ask your PI about presenting at your campus symposium or an undergraduate conference this year.',
      });
    } else if (a.area === 'leadership') {
      gaps.push({
        id: 'leadership',
        area: 'leadership',
        severity: a.severity,
        title: 'No leadership role logged',
        detail: 'Schools look for initiative: officer positions, starting a project, leading a team, or mentoring.',
        action: 'Run for an officer role in a club you already attend, or start a small service project.',
      });
    } else if (a.current !== undefined) {
      gaps.push({
        id: a.area,
        area: a.area,
        severity: a.severity,
        title: `${b.label} ${a.current} is below the ${b.competitive} matriculant average`,
        detail: a.area === 'gpa' ? 'An upward trend in recent semesters helps offset a lower cumulative GPA.' : 'MCAT is used heavily for screening.',
        action:
          a.area === 'gpa'
            ? 'Prioritize strong grades in remaining science courses; consider a lighter load during hard semesters.'
            : 'Consider a retake after a structured study plan if your practice scores support a higher score.',
      });
    }
  }

  const clinical = state.experiences.filter((e) => AREA_CATEGORIES.clinical!.includes(e.category));
  if (clinical.length > 0 && !clinical.some((e) => e.ongoing)) {
    gaps.push({
      id: 'clinical-longitudinal',
      area: 'clinical',
      severity: 'gap',
      title: 'No ongoing clinical activity',
      detail: 'Admissions committees value long-term clinical commitment that continues through your application.',
      action: 'Pick up a weekly clinical role (scribe, hospital or hospice volunteer, CNA/MA) and keep it going through interviews.',
    });
  }

  const shadowing = state.experiences.filter((e) => e.category === 'shadowing');
  if (shadowing.length > 0) {
    const specialties = new Set(shadowing.map((e) => (e.specialty ?? '').trim().toLowerCase()).filter(Boolean));
    if (![...specialties].some((s) => PRIMARY_CARE.some((p) => s.includes(p)))) {
      gaps.push({
        id: 'shadow-primary',
        area: 'shadowing',
        severity: 'gap',
        title: 'No primary care shadowing',
        detail: 'Many schools, especially state schools, like to see you have seen primary care.',
        action: 'Shadow a family medicine, internal medicine or pediatrics physician for at least 20 hours.',
      });
    }
    if (specialties.size === 1) {
      gaps.push({
        id: 'shadow-variety',
        area: 'shadowing',
        severity: 'gap',
        title: 'Shadowing in only one specialty',
        detail: 'Seeing several specialties shows you understand the breadth of medicine.',
        action: 'Add a second specialty, e.g. emergency medicine, surgery or a hospitalist.',
      });
    }
  }

  const research = byArea.research?.current ?? 0;
  if (research >= 200 && state.outputs.length === 0 && !gaps.some((g) => g.id === 'output')) {
    gaps.push({
      id: 'output',
      area: 'publications',
      severity: 'gap',
      title: `${fmt(research)} research hours but no posters or papers`,
      detail: 'You have enough time in the lab to present something.',
      action: 'Draft an abstract on your piece of the project and submit it to a conference.',
    });
  }

  const volunteering = state.experiences.filter((e) => e.category === 'nonclinical-volunteer');
  const sustained = volunteering.some((e) => {
    const end = e.ongoing || !e.endDate ? now : new Date(e.endDate);
    return (end.getTime() - new Date(e.startDate).getTime()) / DAY >= 180;
  });
  if (volunteering.length > 0 && !sustained) {
    gaps.push({
      id: 'volunteer-sustained',
      area: 'volunteering',
      severity: 'gap',
      title: 'Service is short-term only',
      detail: 'Each volunteering activity lasted under six months. Committees favor sustained commitment.',
      action: 'Commit to one service organization weekly for a year or more.',
    });
  }

  if (state.experiences.length > 0 && !state.experiences.some((e) => e.underserved)) {
    gaps.push({
      id: 'underserved',
      area: 'volunteering',
      severity: 'gap',
      title: 'No work with underserved communities',
      detail: 'Service to those less fortunate is a recurring theme in MD mission statements.',
      action: 'Volunteer at a free clinic, food bank, shelter, or tutoring program in a low-income area.',
    });
  }

  const { mcat, mcatDate } = state.academics;
  if (mcat === undefined) {
    const latest = new Date(state.profile.applicationYear, 5, 30);
    if (!mcatDate) {
      gaps.push({
        id: 'mcat-plan',
        area: 'mcat',
        severity: months < 12 ? 'critical' : 'gap',
        title: 'No MCAT date planned',
        detail: 'Scores take about a month to release; you want them back before or shortly after you submit.',
        action: `Plan to test by April–May ${state.profile.applicationYear} with 3–4 months of dedicated study.`,
      });
    } else if (new Date(mcatDate) > latest) {
      gaps.push({
        id: 'mcat-late',
        area: 'mcat',
        severity: 'gap',
        title: 'MCAT is scheduled late in the cycle',
        detail: 'Testing after June delays your verification and secondaries, which hurts in rolling admissions.',
        action: 'Move your test date earlier if your practice scores are near your target.',
      });
    }
  }

  if (months < 12 && state.experiences.length < 10) {
    gaps.push({
      id: 'entries',
      area: 'leadership',
      severity: 'gap',
      title: `${state.experiences.length} of ${AMCAS_MAX_ENTRIES} AMCAS activity slots used`,
      detail: 'Most successful applicants list 10–15 activities, including hobbies, teaching and awards.',
      action: 'Log everything meaningful you have done, including employment, tutoring, awards and hobbies.',
    });
  }

  const order: Record<Severity, number> = { critical: 0, gap: 1, 'on-track': 2, strong: 3 };
  return gaps.sort((a, b) => order[a.severity] - order[b.severity]);
}
