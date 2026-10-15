import type { Area, Benchmark, Category } from '../types';

/**
 * General guidance compiled from AAMC matriculant data and common advising targets.
 * These are not official cutoffs; every school weighs applicants holistically.
 */
export const DEFAULT_BENCHMARKS: Benchmark[] = [
  {
    area: 'clinical',
    label: 'Clinical experience',
    unit: 'hours',
    minimum: 150,
    competitive: 600,
    why: 'Schools want proof you understand patient care and still want to do it. Direct, hands-on patient contact over a long period counts most.',
  },
  {
    area: 'shadowing',
    label: 'Physician shadowing',
    unit: 'hours',
    minimum: 50,
    competitive: 100,
    why: 'Shows you have seen what physicians actually do day to day. Variety matters: include primary care and at least one other specialty.',
  },
  {
    area: 'volunteering',
    label: 'Non-clinical service',
    unit: 'hours',
    minimum: 100,
    competitive: 200,
    why: 'Service orientation is an AAMC core competency. Sustained commitment to one cause reads better than many one-day events.',
  },
  {
    area: 'research',
    label: 'Research',
    unit: 'hours',
    minimum: 300,
    competitive: 1000,
    why: 'Expected at most MD programs and essential at research-heavy schools. Depth in one lab beats short stints in several.',
  },
  {
    area: 'publications',
    label: 'Research output',
    unit: 'posters / pubs',
    minimum: 1,
    competitive: 2,
    why: 'Presentations and publications show you carried a project through to a result. Not required, but they differentiate you at top schools.',
  },
  {
    area: 'leadership',
    label: 'Leadership roles',
    unit: 'roles',
    minimum: 1,
    competitive: 2,
    why: 'Schools look for initiative and teamwork: officer roles, founding something, leading a team, or teaching/mentoring.',
  },
  {
    area: 'gpa',
    label: 'Cumulative GPA',
    unit: 'GPA',
    minimum: 3.6,
    competitive: 3.77,
    why: 'Recent MD matriculant average is about 3.77 overall and 3.7 science. An upward trend helps if early grades were weak.',
  },
  {
    area: 'mcat',
    label: 'MCAT',
    unit: 'score',
    minimum: 508,
    competitive: 512,
    why: 'Recent MD matriculant average is about 511–512. Many schools screen on MCAT, so a balanced score with no weak section matters.',
  },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  'clinical-paid': 'Clinical (paid)',
  'clinical-volunteer': 'Clinical (volunteer)',
  shadowing: 'Shadowing',
  research: 'Research',
  'nonclinical-volunteer': 'Non-clinical volunteering',
  leadership: 'Leadership',
  teaching: 'Teaching / tutoring',
  employment: 'Non-clinical employment',
  other: 'Other',
};

export const AREA_LABELS: Record<Area, string> = {
  clinical: 'Clinical',
  shadowing: 'Shadowing',
  volunteering: 'Service',
  research: 'Research',
  publications: 'Research output',
  leadership: 'Leadership',
  gpa: 'GPA',
  mcat: 'MCAT',
};

/** Which experience categories count toward each hour-based area. */
export const AREA_CATEGORIES: Partial<Record<Area, Category[]>> = {
  clinical: ['clinical-paid', 'clinical-volunteer'],
  shadowing: ['shadowing'],
  volunteering: ['nonclinical-volunteer'],
  research: ['research'],
};

export const PRIMARY_CARE = ['family medicine', 'internal medicine', 'pediatrics', 'primary care', 'ob/gyn', 'obgyn'];

export const PREREQS = [
  'General Chemistry I & II (with lab)',
  'Organic Chemistry I & II (with lab)',
  'Biochemistry',
  'Biology I & II (with lab)',
  'Physics I & II (with lab)',
  'English / Writing (2 semesters)',
  'Statistics',
  'Psychology',
  'Sociology',
  'Calculus',
];

export const AMCAS_MAX_ENTRIES = 15;
export const AMCAS_DESC_LIMIT = 700;
