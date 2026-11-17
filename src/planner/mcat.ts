import type { Resolved } from './types';
import { TERM_BY_ID, currentTermId, termOrd } from './terms';

/**
 * MCAT content coverage from a course plan.
 *
 * Section weights are the AAMC's published discipline mix for each section
 * ("What's on the MCAT Exam?", https://students-residents.aamc.org/prepare-mcat-exam/whats-mcat-exam):
 *   Chem/Phys: first-semester biochemistry 25%, intro biology 5%, general chemistry 30%, organic chemistry 15%, intro physics 25%
 *   Bio/Biochem: intro biology 65%, first-semester biochemistry 25%, general chemistry 5%, organic chemistry 5%
 *   Psych/Soc: intro psychology 65%, intro sociology 30%, intro biology 5%
 * CARS has no science content, so coursework doesn't cover it.
 *
 * This measures how much tested content your classes will have taught you by test day.
 * It is not a score prediction: practice exams and review drive the score.
 */

export type McatSection = 'cp' | 'cars' | 'bb' | 'ps';
export type Discipline = 'genchem' | 'orgo' | 'physics' | 'bio' | 'biochem' | 'psych' | 'soc';

export const SECTION_INFO: Record<McatSection, { short: string; name: string }> = {
  cp: { short: 'Chem/Phys', name: 'Chemical and Physical Foundations of Biological Systems' },
  cars: { short: 'CARS', name: 'Critical Analysis and Reasoning Skills' },
  bb: { short: 'Bio/Biochem', name: 'Biological and Biochemical Foundations of Living Systems' },
  ps: { short: 'Psych/Soc', name: 'Psychological, Social, and Biological Foundations of Behavior' },
};

export const SECTION_WEIGHTS: Record<Exclude<McatSection, 'cars'>, Partial<Record<Discipline, number>>> = {
  cp: { biochem: 0.25, bio: 0.05, genchem: 0.3, orgo: 0.15, physics: 0.25 },
  bb: { bio: 0.65, biochem: 0.25, genchem: 0.05, orgo: 0.05 },
  ps: { psych: 0.65, soc: 0.3, bio: 0.05 },
};
export const SCIENCE_SECTIONS = ['cp', 'bb', 'ps'] as const;
export const MCAT_SOURCE = 'https://students-residents.aamc.org/prepare-mcat-exam/whats-mcat-exam';

interface Part {
  label: string;
  /** Any one of these courses covers the part. */
  codes: string[];
  /** Share of the discipline this part covers (parts of a discipline sum to 1). */
  share: number;
  /** For electives: each course adds this much of the share, up to the full share. */
  each?: number;
  /** What to add if missing. */
  suggest: string;
}

export const DISCIPLINES: Record<Discipline, { label: string; parts: Part[] }> = {
  genchem: {
    label: 'General chemistry',
    parts: [
      { label: 'Intro Chem I', codes: ['AS.030.101'], share: 0.5, suggest: 'AS.030.101' },
      { label: 'Intro Chem II', codes: ['AS.030.102', 'AS.030.103'], share: 0.5, suggest: 'AS.030.102' },
    ],
  },
  orgo: {
    label: 'Organic chemistry',
    parts: [
      { label: 'Orgo I', codes: ['AS.030.205'], share: 0.5, suggest: 'AS.030.205' },
      { label: 'Orgo II', codes: ['AS.030.206', 'AS.030.212'], share: 0.5, suggest: 'AS.030.206' },
    ],
  },
  physics: {
    label: 'Physics',
    parts: [
      { label: 'Physics I', codes: ['AS.171.101', 'AS.171.103', 'AS.171.105', 'AS.171.107'], share: 0.5, suggest: 'AS.171.103' },
      { label: 'Physics II', codes: ['AS.171.102', 'AS.171.104', 'AS.171.106', 'AS.171.108'], share: 0.5, suggest: 'AS.171.104' },
    ],
  },
  bio: {
    label: 'Biology',
    parts: [
      { label: 'Gen Bio I', codes: ['AS.020.151'], share: 0.35, suggest: 'AS.020.151' },
      { label: 'Gen Bio II', codes: ['AS.020.152'], share: 0.35, suggest: 'AS.020.152' },
      { label: 'Upper-level bio (genetics, molecular, cell, physiology)', codes: ['AS.020.303', 'AS.020.304', 'AS.020.306', 'AS.020.374'], share: 0.3, each: 0.15, suggest: 'AS.020.306' },
    ],
  },
  biochem: {
    label: 'Biochemistry',
    parts: [{ label: 'Biochemistry (first semester)', codes: ['AS.020.305', 'AS.250.315'], share: 1, suggest: 'AS.020.305' }],
  },
  psych: { label: 'Psychology', parts: [{ label: 'Intro Psychology', codes: ['AS.200.101'], share: 1, suggest: 'AS.200.101' }] },
  soc: { label: 'Sociology', parts: [{ label: 'Intro Sociology', codes: ['AS.230.101'], share: 1, suggest: 'AS.230.101' }] },
};

/** AP/transfer credit teaches less than the JHU course, so it counts at half. */
export const EXAM_CREDIT_FACTOR = 0.5;

export type Timing = 'done' | 'planned' | 'after' | 'exam';

export interface CourseImpact {
  code: string;
  title: string;
  termId: string;
  discipline: Discipline;
  part: string;
  timing: Timing;
  /** Points (0–100 scale) this course adds to each science section. 0 when it lands after the MCAT. */
  points: Record<(typeof SCIENCE_SECTIONS)[number], number>;
  /** What it would add if it were before the MCAT (for courses that land after). */
  potential: Record<(typeof SCIENCE_SECTIONS)[number], number>;
}

export interface Gap {
  discipline: Discipline;
  part: string;
  suggest: string;
  /** Points this part would add to each section if taken before the MCAT. */
  gain: Record<(typeof SCIENCE_SECTIONS)[number], number>;
  /** Already in the plan, but after the MCAT or only as exam credit. */
  reason: 'missing' | 'after' | 'exam' | 'more';
}

export interface McatReadiness {
  mcatTermId: string;
  mcatLabel: string;
  /** Coverage by test day, 0–100 per science section. */
  byTest: Record<(typeof SCIENCE_SECTIONS)[number], number>;
  /** Coverage from courses already finished. */
  now: Record<(typeof SCIENCE_SECTIONS)[number], number>;
  discipline: Record<Discipline, { byTest: number; now: number }>;
  courses: CourseImpact[];
  gaps: Gap[];
}

const zero = () => ({ cp: 0, bb: 0, ps: 0 });

/** Points a slice of one discipline is worth in each section. */
function sectionPoints(d: Discipline, fraction: number) {
  const out = zero();
  for (const s of SCIENCE_SECTIONS) out[s] = (SECTION_WEIGHTS[s][d] ?? 0) * fraction * 100;
  return out;
}

export function mcatReadiness(resolved: Resolved[], mcatTermId = 'S29', now = new Date()): McatReadiness {
  const mcatOrd = termOrd(mcatTermId);
  const nowOrd = termOrd(currentTermId(now));
  const courses: CourseImpact[] = [];
  const gaps: Gap[] = [];
  const discipline = {} as McatReadiness['discipline'];

  for (const [d, info] of Object.entries(DISCIPLINES) as [Discipline, (typeof DISCIPLINES)[Discipline]][]) {
    let byTest = 0;
    let done = 0;
    for (const part of info.parts) {
      const hits = resolved.filter((r) => part.codes.includes(r.code));
      // Per course: how much of this part it covers, and whether that lands before the test.
      const unit = (part.each ?? part.share) / part.share;
      let partTest = 0;
      let partNow = 0;
      for (const r of hits) {
        const exam = r.season === 'PRE';
        const before = exam || r.ord <= mcatOrd;
        const finished = exam || r.ord < nowOrd;
        const factor = exam ? EXAM_CREDIT_FACTOR : 1;
        const room = Math.max(0, 1 - partTest);
        const got = before ? Math.min(room, unit * factor) : 0;
        partTest += got;
        if (finished && before) partNow = Math.min(1, partNow + unit * factor);
        courses.push({
          code: r.code,
          title: r.title,
          termId: r.item.termId,
          discipline: d,
          part: part.label,
          timing: exam ? 'exam' : !before ? 'after' : finished ? 'done' : 'planned',
          points: sectionPoints(d, got * part.share),
          potential: sectionPoints(d, Math.min(1, unit) * part.share),
        });
      }
      byTest += Math.min(1, partTest) * part.share;
      done += Math.min(1, partNow) * part.share;
      if (partTest < 0.999) {
        const reason: Gap['reason'] = hits.some((r) => r.season !== 'PRE' && r.ord > mcatOrd)
          ? 'after'
          : hits.some((r) => r.season === 'PRE')
            ? 'exam'
            : hits.length
              ? 'more'
              : 'missing';
        gaps.push({ discipline: d, part: part.label, suggest: part.suggest, gain: sectionPoints(d, (1 - Math.min(1, partTest)) * part.share), reason });
      }
    }
    discipline[d] = { byTest, now: done };
  }

  const total = (key: 'byTest' | 'now') => {
    const out = zero();
    for (const s of SCIENCE_SECTIONS)
      for (const [d, w] of Object.entries(SECTION_WEIGHTS[s]) as [Discipline, number][]) out[s] += w * discipline[d][key] * 100;
    return out;
  };

  const gainSum = (g: Gap) => g.gain.cp + g.gain.bb + g.gain.ps;
  gaps.sort((a, b) => gainSum(b) - gainSum(a));

  return {
    mcatTermId,
    mcatLabel: TERM_BY_ID[mcatTermId]?.label ?? mcatTermId,
    byTest: total('byTest'),
    now: total('now'),
    discipline,
    courses,
    gaps,
  };
}

/** Which sections a discipline feeds, strongest first (e.g. orgo → Chem/Phys 15%, Bio/Biochem 5%). */
export function sectionsFor(d: Discipline) {
  return SCIENCE_SECTIONS.map((s) => ({ section: s, weight: SECTION_WEIGHTS[s][d] ?? 0 }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}
