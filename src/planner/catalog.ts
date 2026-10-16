import type { Course } from './types';
import sis from './sisCourses.json';
import catalogue from './catalogueData.json';

/**
 * Seed catalog from the JHU 2026–27 Academic Catalogue (spec section 6, pulled 2026-10-15).
 * "FA2?" marks an estimated tag. Titles the spec didn't give are labeled "title not in
 * catalogue notes" instead of guessed. Run `npm run sync-sis` to replace these with live
 * SIS data (src/planner/sisCourses.json), which wins over the seed.
 */
type Opts = Omit<Partial<Course>, 'code' | 'title' | 'credits'>;
const c = (code: string, title: string, credits: number, o: Opts = {}): Course => ({ code, title, credits, source: 'catalogue', ...o });
const sci = (code: string, title: string, credits: number, o: Opts = {}) => c(code, title, credits, { fa: ['FA2?'], ...o });
const ph = (code: string, title: string, credits: number, fa: string[], o: Opts = {}) => c(code, title, credits, { fa, ...o });

const CALC2 = ['AS.110.109', 'AS.110.107', 'AS.110.113'];
const CHEM2 = ['AS.030.102', 'AS.030.103'];
const STATS = ['AS.280.345', 'EN.553.211', 'EN.553.310', 'EN.553.311'];
const T1 = 'Social science (PHS Table 1); title not in catalogue notes';

const SEED: Course[] = [
  // General
  c('AS.001.1XX', 'First-Year Seminar', 3, { term: 'F', placeholder: true, note: 'S/U, fall of first year. No FA.' }),
  c('AS.004.101', 'Reintroduction to Writing', 3, { note: 'First-year requirement, letter grade, C- or better. FAs vary by section.' }),

  // Chemistry
  sci('AS.030.101', 'Introductory Chemistry I', 3),
  sci('AS.030.105', 'Introductory Chemistry Lab I', 1),
  sci('AS.030.102', 'Introductory Chemistry II', 3, { prereqs: [['AS.030.101']], seqOnly: true }),
  sci('AS.030.106', 'Introductory Chemistry Lab II', 1, { prereqs: [['AS.030.105']], seqOnly: true }),
  sci('AS.030.103', 'Applied Chemical Equilibrium & Reactivity w/lab', 4),
  sci('AS.030.205', 'Introductory Organic Chemistry I', 4, { prereqs: [CHEM2], seqOnly: true }),
  sci('AS.030.206', 'Introductory Organic Chemistry II', 4, { prereqs: [['AS.030.205']] }),
  sci('AS.030.212', 'Honors Organic Chemistry II', 4, { prereqs: [['AS.030.205']] }),
  sci('AS.030.225', 'Introductory Organic Chemistry Lab', 3),
  sci('AS.030.227', 'Chemical Chirality (organic lab techniques)', 3, { term: 'F' }),
  sci('AS.030.228', 'Intermediate Organic Chemistry Lab', 3, { prereqs: [['AS.030.225', 'AS.030.227']] }),
  sci('AS.030.246', 'Quantitative Analytical Chem & Spectroscopy Lab', 3, { term: 'F', prereqs: [CHEM2], seqOnly: true }),
  sci('AS.030.301', 'Physical Chemistry I', 3, { prereqs: [CHEM2, CALC2], seqOnly: true }),
  sci('AS.030.302', 'Physical Chemistry II', 3, { prereqs: [['AS.030.301']], seqOnly: true }),
  sci('AS.030.307', 'Physical Chemistry & Instrumentation Lab', 3, { term: 'S', prereqs: [['AS.030.301']], seqOnly: true }),
  sci('AS.030.449', 'Chemistry of Inorganic Compounds', 3),
  c('AS.030.356', 'Advanced Inorganic Lab', 3, { fa: ['FA1', 'FA2?'], prereqs: [['AS.030.228'], ['AS.030.449']] }),

  // Math, stats, physics
  sci('AS.110.106', 'Calculus I (Biology & Social Sciences)', 4),
  sci('AS.110.108', 'Calculus I (Physical Sciences & Engineering)', 4),
  sci('AS.110.107', 'Calculus II (Biology & Social Sciences)', 4, { prereqs: [['AS.110.106', 'AS.110.108']] }),
  sci('AS.110.109', 'Calculus II (Physical Sciences & Engineering)', 4, { prereqs: [['AS.110.106', 'AS.110.108']] }),
  sci('AS.110.113', 'Honors Single Variable Calculus', 4),
  sci('AS.110.202', 'Calculus III', 4, { prereqs: [CALC2] }),
  sci('EN.553.211', 'Probability & Statistics for the Life Sciences', 4),
  sci('EN.553.310', 'Probability & Statistics (Physical Sciences)', 4),
  sci('EN.553.311', 'Intermediate Probability & Statistics', 4),
  ...['101', '103', '105', '107'].map((n) => sci(`AS.171.${n}`, 'General Physics I (variant: check SIS)', 4)),
  ...[
    ['102', '101'],
    ['104', '103'],
    ['106', '105'],
    ['108', '107'],
  ].map(([n, p]) => sci(`AS.171.${n}`, 'General Physics II (variant: check SIS)', 4, { prereqs: [[`AS.171.${p}`]] })),
  c('AS.173.111', 'General Physics Lab I', 1),
  c('AS.173.115', 'Physics Lab I (variant)', 1),
  c('AS.173.112', 'General Physics Lab II', 1, { prereqs: [['AS.173.111', 'AS.173.115']] }),
  c('AS.173.116', 'Physics Lab II (variant)', 1, { prereqs: [['AS.173.111', 'AS.173.115']] }),

  // Biology, biophysics
  sci('AS.020.151', 'General Biology I', 3),
  sci('AS.020.152', 'General Biology II', 3),
  sci('AS.020.153', 'General Biology Lab I', 1),
  sci('AS.020.154', 'General Biology Lab II', 1),
  sci('AS.020.303', 'Genetics', 3),
  sci('AS.020.304', 'Molecular Biology', 3),
  sci('AS.020.305', 'Biochemistry', 3, { prereqs: [['AS.030.205']], seqOnly: true }),
  sci('AS.020.306', 'Cell Biology', 3),
  sci('AS.020.315', 'Biochemistry Project Lab', 2),
  sci('AS.020.316', 'Cell Biology Lab', 1),
  sci('AS.020.340', 'Developmental Genetics Lab', 2),
  sci('AS.020.374', 'Comparative Physiology', 3),
  sci('AS.020.377', 'Comparative Physiology Lab', 1),
  sci('AS.250.253', 'Protein Engineering & Biochemistry Lab', 3),
  sci('AS.250.315', 'Biochemistry I', 3),

  // Public health (FA tags verified from course descriptions)
  ph('AS.280.101', 'Introduction to Public Health', 4, ['FA1', 'FA4', 'FA5'], { writingIntensive: true, note: 'Restricted to incoming first-years and declared majors.' }),
  ph('AS.280.161', 'Biodiversity and Public Health', 3, ['FA1', 'FA2', 'FA6'], { prereqs: [['AS.020.151']] }),
  ph('AS.280.225', 'Population, Health and Development', 3, ['FA4', 'FA5']),
  ph('AS.280.240', 'Research Methods in Public Health', 4, ['FA1', 'FA2', 'FA6'], {
    writingIntensive: true,
    prereqs: [['AS.280.101'], [...STATS, 'AS.200.314']],
  }),
  ph('AS.280.314', 'Truth, Evidence, and Influence', 3, ['FA4', 'FA4.1', 'FA5'], { prereqs: [['AS.280.101'], ['AS.280.350']] }),
  ph('AS.280.320', 'Seminar on Public Health & Well-being in Baltimore', 3, ['FA4', 'FA6']),
  ph('AS.280.330', 'Mind-Body Practices and Public Health', 3, ['FA4', 'FA5', 'FA6'], { prereqs: [['AS.280.101']] }),
  ph('AS.280.335', 'The Environment and Your Health', 3, ['FA2', 'FA6'], { prereqs: [['AS.280.101', 'AS.270.103']] }),
  ph('AS.280.340', 'Fundamentals of Health Policy & Management', 3, ['FA4', 'FA5'], { term: 'S', prereqs: [['AS.280.101']] }),
  ph('AS.280.345', 'Public Health Biostatistics', 4, ['FA2']),
  ph('AS.280.346', 'Introduction to R Programming for Public Health', 1, ['FA2'], { prereqs: [['AS.280.345', 'EN.553.211']] }),
  ph('AS.280.347', 'Health Data Analysis Practicum (R)', 3, ['FA2', 'FA6'], { prereqs: [['AS.280.345', 'EN.553.211']] }),
  ph('AS.280.350', 'Fundamentals of Epidemiology', 4, ['FA2'], { prereqs: [['AS.280.101']] }),
  ph('AS.280.355', 'Intro to Social & Behavioral Determinants of Health', 3, ['FA4', 'FA5'], { prereqs: [['AS.280.101']] }),
  ph('AS.280.365', 'Public Policy, Politics and Public Health', 3, ['FA4', 'FA5'], { prereqs: [['AS.280.101']] }),
  ph('AS.280.366', 'Politics and Public Health', 3, ['FA4', 'FA5'], { prereqs: [['AS.280.101']] }),
  ph('AS.280.380', 'Global Health Principles and Practices', 3, ['FA4', 'FA5']),
  ph('AS.280.389', 'Medicine for the Greater Good', 3, ['FA4', 'FA5'], { prereqs: [['AS.280.101']], note: 'Not with AS.280.379.' }),
  ph('AS.280.390', 'Power, Positionality, and Social Change', 3, ['FA4', 'FA5'], { prereqs: [['AS.280.101']] }),
  ph('AS.280.399', 'Service-Learning in Baltimore', 3, ['FA4', 'FA5']),
  ph('AS.280.484', 'Arts in Public Health Research (Gordis Teaching Fellowship)', 3, ['FA3', 'FA5'], { prereqs: [['AS.280.240']] }),
  ph('AS.280.485', 'Food as Medicine (Gordis Teaching Fellowship)', 3, ['FA3', 'FA5'], { prereqs: [['AS.280.240']] }),
  ph('AS.280.495', 'Honors in Public Health (seminar)', 3, ['FA1', 'FA2', 'FA6'], { writingIntensive: true }),
  ph('AS.280.499', 'Honors in Public Health (thesis)', 3, ['FA1', 'FA2', 'FA6'], { writingIntensive: true }),
  ph('AS.280.500', 'Applied Experience', 2, ['FA4', 'FA6'], { note: '1–2 credits (planned as 2). 80+ hours over 4+ weeks; can start spring of sophomore year.' }),
  c('AS.230.341', 'Sociology of Health and Illness', 3),
  c('AS.180.289', 'Economics of Health', 3),
  c('AS.190.405', 'Food Politics', 3),
  c('AS.196.302', 'Science and Democracy', 3),
  c('AS.230.335', 'Medical Humanitarianism', 3),
  c('AS.230.370', 'Housing and Homelessness', 3),
  c('PH.BSPH', 'Bloomberg School of Public Health course(s)', 5, { placeholder: true, note: 'Homewood-equivalent credits for one term of BSPH courses.' }),

  // PHS Table 1 social sciences
  c('AS.140.105', 'History of Medicine', 3),
  c('AS.180.102', 'Microeconomics', 3),
  c('AS.200.101', 'Introduction to Psychology', 3),
  c('AS.230.101', 'Introduction to Sociology', 3),
  c('AS.150.219', 'Introduction to Bioethics', 3),
  ...['AS.070.132', 'AS.140.106', 'AS.180.101', 'AS.190.220', 'AS.200.110', 'AS.200.132', 'AS.200.133', 'AS.200.209', 'AS.200.212', 'AS.200.222', 'AS.230.150', 'AS.271.107', 'EN.570.108'].map(
    (code) => c(code, T1, 3),
  ),

  // Writing placeholders (pre-med)
  c('AS.220.1XX', 'Writing Seminars course', 3, { placeholder: true, note: 'Likely FA1 and/or FA3; verify per section.' }),
  c('AS.060.1XX', 'English course', 3, { placeholder: true, note: 'Likely FA1 and/or FA3; verify per section.' }),

  // Neuroscience
  c('AS.200.141', 'Foundations of Brain, Behavior & Cognition', 3),
  c('AS.050.105', 'Introduction to Cognitive Neuropsychology', 3),
  c('AS.050.203', 'Neuroscience: Cognitive', 3, { term: 'S' }),
  c('AS.080.250', 'Neuroscience Lab', 3, { prereqs: [['AS.200.141', 'AS.080.306']] }),
  c('AS.080.305', 'Neuroscience: Cellular & Systems I', 3, { term: 'F', prereqs: [['AS.200.141', 'AS.050.105']] }),
  c('AS.080.306', 'Neuroscience: Cellular & Systems II', 3, { term: 'S', prereqs: [['AS.080.305']] }),
  c('AS.080.541', 'Research in Neuroscience', 3),
  c('AS.080.544', 'Research in Neuroscience', 3),
  c('AS.080.499', 'Scientific Communication & Mentoring', 1.5, { repeatable: true }),

  // History
  c('AS.100.293', 'Historical Methods, Archives & Interpretations', 3, { term: 'F' }),
  c('AS.100.388', 'Practicing Historical Research', 3, { term: 'S', prereqs: [['AS.100.293']], seqOnly: true }),
  c('AS.100.507', 'Senior Honors Thesis I', 3),
  c('AS.100.508', 'Senior Honors Thesis II', 3),

  // Spanish (no prerequisite on 210.311, so auto-fill doesn't add the sequence he places out of)
  c('AS.210.111', 'Spanish Elements I', 4),
  c('AS.210.112', 'Spanish Elements II', 4),
  c('AS.210.211', 'Intermediate Spanish I', 3),
  c('AS.210.212', 'Intermediate Spanish II', 3),
  c('AS.210.311', 'Advanced Spanish I', 3),
  c('AS.210.312', 'Advanced Spanish II', 3),
  c('AS.210.313', 'Medical Spanish', 3),
  c('AS.210.316', 'Advanced Conversation', 3),
  c('AS.210.317', 'Advanced Composition', 3),
  c('AS.210.319', 'Spanish for Public Health', 3),
  c('AS.210.411', 'Contacts & Contrasts in Spanish for the Professions', 3),
  c('AS.210.412', 'Community-Based Learning Practicum', 3),

  // Placeholders (repeatable in auto-fill)
  c('AS.100.1XX', 'History intro course', 3, { placeholder: true }),
  c('AS.100.2XX', 'History course (any level)', 3, { placeholder: true }),
  c('AS.100.3XX', '300-level History course', 3, { placeholder: true }),
  c('AS.215.2XX', 'Hispanic studies course (215.2xx–4xx)', 3, { placeholder: true }),
  c('AS.215.3XX', 'Hispanic studies course', 3, { placeholder: true }),
  c('AS.215.4XX', '400-level Hispanic studies seminar', 3, { placeholder: true }),
  c('BIOLUL', 'Upper-level biology elective', 3, { placeholder: true, posTags: ['BIOLUL'] }),
  c('RES-BIO', 'Biology-approved research', 3, { placeholder: true }),
  c('NEUR-FOCUS', 'Neuroscience focus-area elective', 3, { placeholder: true }),
  c('NEUR-OUT', 'Neuroscience elective outside focus area', 3, { placeholder: true }),
  c('ELECTIVE', 'Open elective', 3, { placeholder: true }),
];

/** Titles and credits of every course the imported majors list (seed entries win). */
const seedCodes = new Set(SEED.map((x) => x.code));
const FROM_CATALOGUE: Course[] = Object.entries(catalogue.courses as unknown as Record<string, [string, number | null]>)
  .filter(([code]) => !seedCodes.has(code))
  .map(([code, [title, credits]]) => ({ code, title, credits: credits ?? 3, source: 'catalogue' as const, ...(credits === null ? { note: 'Credits not listed in the catalogue; 3 assumed.' } : {}) }));

export const CATALOG: Course[] = [...SEED, ...FROM_CATALOGUE];
export const COURSE: Record<string, Course> = Object.fromEntries(CATALOG.map((x) => [x.code, x]));

/**
 * Merges SIS data over the catalog in place: SIS wins, but seed-only fields such as
 * placeholders and planning-sequence prereqs are kept.
 */
export function applySis(live: Partial<Course>[]) {
  for (const l of live) {
    if (!l.code) continue;
    const s = COURSE[l.code];
    const parsed = !!l.prereqs?.length;
    const next = {
      ...(s ?? { code: l.code, title: l.code, credits: 3 }),
      ...Object.fromEntries(Object.entries(l).filter(([, v]) => v !== undefined && v !== '')),
      prereqs: parsed ? l.prereqs : s?.prereqs,
      seqOnly: parsed ? false : s?.seqOnly,
      source: 'SIS',
    } as Course;
    if (s) CATALOG[CATALOG.indexOf(s)] = next;
    else CATALOG.push(next);
    COURSE[l.code] = next;
  }
}

/**
 * SIS terms whose schedule has been posted: any term in which a synced course has a section.
 * For those terms the planner checks real offerings instead of the fall/spring-only pattern.
 */
const PUBLISHED = new Set<string>();
export function addPublishedTerms(terms: string[]) {
  for (const t of terms) PUBLISHED.add(t);
}
export const isPublished = (sisName?: string) => !!sisName && PUBLISHED.has(sisName);
export const publishedTerms = () => [...PUBLISHED];

const synced = (sis as { courses: Partial<Course>[]; terms?: string[] });
applySis(synced.courses);
addPublishedTerms([...(synced.terms ?? []), ...synced.courses.flatMap((c) => c.offered ?? [])]);

export const SIS_SYNCED_AT: string | undefined = (sis as { syncedAt?: string | null }).syncedAt ?? undefined;

/** "AS.140" from "AS.140.105". */
export function deptOf(code: string) {
  return code.split('.').slice(0, 2).join('.');
}
