import type { Major, Matcher, Requirement, Resolved } from './types';
import catalogue from './catalogueData.json';
import { deptOf } from './catalog';

/**
 * Major requirements from the JHU 2026–27 Academic Catalogue (spec section 5).
 * Requirements are evaluated in order; earlier, more specific ones claim courses first.
 */

// ── Helpers ────────────────────────────────────────────────────────────────

/** Course number with placeholder X's read as 0 (AS.100.3XX → 300). */
export function numOf(code: string) {
  const n = Number(code.split('.')[2]?.replace(/X/g, '0'));
  return Number.isFinite(n) ? n : NaN;
}

/** Courses in a department within a number range. */
const range =
  (dept: string, lo: number, hi: number): Matcher =>
  (r: Resolved) =>
    deptOf(r.code) === dept && numOf(r.code) >= lo && numOf(r.code) <= hi;

/** POS tag match; SIS hyphenates tags (BIOL-UL) while the catalogue doesn't (BIOLUL). */
export const pos =
  (tag: string): Matcher =>
  (r: Resolved) =>
    (r.course?.posTags ?? []).some((t) => t.replace(/-/g, '') === tag);

type Opt = Partial<Pick<Requirement, 'noExam' | 'hint' | 'waivable'>>;
const set = (key: string, label: string, options: string[][], o: Opt & { n?: number } = {}): Requirement => ({ type: 'set', key, label, options, ...o });
/** One course from a list of alternatives. */
const one = (key: string, label: string, codes: string[], o: Opt = {}) => set(key, label, codes.map((x) => [x]), o);
const note = (key: string, label: string, o: Opt & { from?: Matcher[] } = {}): Requirement => ({ type: 'note', key, label, ...o });

const cross = (a: string[], b: string[]) => a.flatMap((x) => b.map((y) => [x, y]));
const PHYS1 = ['AS.171.101', 'AS.171.103', 'AS.171.105', 'AS.171.107'];
const PHYS2 = ['AS.171.102', 'AS.171.104', 'AS.171.106', 'AS.171.108'];
const CALC1 = ['AS.110.108', 'AS.110.106'];
const CALC2 = ['AS.110.109', 'AS.110.107', 'AS.110.113'];
const STATS = ['AS.280.345', 'EN.553.211', 'EN.553.310', 'EN.553.311'];

const physics = (labs1: string[], labs2: string[]) => [
  set('phys1', 'Physics I + lab', cross(PHYS1, labs1)),
  set('phys2', 'Physics II + lab', cross(PHYS2, labs2)),
];
const genChem = [
  set('chem1', 'Intro Chemistry I + lab', [['AS.030.101', 'AS.030.105']]),
  set('chem2', 'Intro Chemistry II + lab', [['AS.030.102', 'AS.030.106'], ['AS.030.103']]),
];
const calc = [one('calc1', 'Calculus I', CALC1), one('calc2', 'Calculus II', CALC2)];

export const PHS_CORE = ['AS.280.101', 'AS.280.240', 'AS.280.335', 'AS.280.340', 'AS.280.345', 'AS.280.350'];
export const PHS_TABLE1 = [
  'AS.070.132', 'AS.140.105', 'AS.140.106', 'AS.150.219', 'AS.180.101', 'AS.180.102', 'AS.190.220', 'AS.200.101', 'AS.200.110',
  'AS.200.132', 'AS.200.133', 'AS.200.209', 'AS.200.212', 'AS.200.222', 'AS.230.101', 'AS.230.150', 'AS.271.107', 'EN.570.108',
];
const PHS_TABLE2 = [
  'AS.180.289', 'AS.190.405', 'AS.196.302', 'AS.230.335', 'AS.230.370', 'AS.280.225', 'AS.280.314', 'AS.280.320', 'AS.280.330',
  'AS.280.347', 'AS.280.365', 'AS.280.366', 'AS.280.380', 'AS.280.389', 'AS.280.390', 'AS.280.399', 'AS.280.484', 'AS.280.485',
];

const CAT = 'https://e-catalogue.jhu.edu/arts-sciences/full-time-residential-programs/degree-programs';

// ── Majors ─────────────────────────────────────────────────────────────────

export const MAJORS: Major[] = [
  {
    id: 'chem',
    name: 'Chemistry, BS',
    short: 'Chem',
    degree: 'BS',
    school: 'KSAS',
    totalLabel: '70 major credits',
    sourceUrl: `${CAT}/chemistry/chemistry-bachelor-science/`,
    notes: [
      'Grade C- or better, letter grade.',
      'Finish physics and organic chemistry by the end of sophomore year (recommended).',
      'Total credits for the Chemistry BS: confirm with the department (verify).',
    ],
    requirements: [
      ...genChem,
      one('org1', 'Organic Chemistry I', ['AS.030.205']),
      one('org2', 'Organic Chemistry II', ['AS.030.206', 'AS.030.212']),
      one('orglab', 'Organic lab (Chemical Chirality or Intro Organic Lab)', ['AS.030.227', 'AS.030.225']),
      one('orglab2', 'Intermediate Organic Lab', ['AS.030.228']),
      one('pchem1', 'Physical Chemistry I', ['AS.030.301']),
      one('pchem2', 'Physical Chemistry II', ['AS.030.302']),
      one('inorg', 'Chemistry of Inorganic Compounds', ['AS.030.449'], { hint: 'Must come before AS.030.356.' }),
      one('inorglab', 'Advanced Inorganic Lab', ['AS.030.356']),
      one('anal', 'Quantitative Analytical Chem & Spectroscopy Lab (fall only)', ['AS.030.246']),
      one('pchemlab', 'Physical Chem & Instrumentation Lab (spring only)', ['AS.030.307']),
      ...physics(['AS.173.111', 'AS.173.115'], ['AS.173.112', 'AS.173.116']),
      ...calc,
      {
        type: 'cred',
        key: 'adv',
        label: 'Advanced chemistry (3 cr)',
        credits: 3,
        from: [range('AS.030', 307, 457), 'AS.020.305', 'AS.250.315'],
        fill: ['AS.020.305'],
        hint: 'AS.030.307–457 (not research), or AS.020.305 / AS.250.315 Biochemistry.',
      },
      {
        type: 'cred',
        key: 'elec',
        label: 'Science/math electives (9 cr)',
        credits: 9,
        minPerCourse: 3,
        from: [...['AS.020', 'AS.250', 'AS.030', 'AS.270', 'AS.080', 'AS.171'].map((d) => range(d, 300, 499)), range('AS.110', 200, 499), range('EN.553', 200, 499)],
        fill: ['AS.020.303', 'AS.020.304', 'AS.020.306'],
        hint: 'Graded, 3+ credits: 300/400-level AS.020, 250, 030, 270, 080, 171; or AS.110 / EN.553 at 200–400.',
      },
      note('wim', 'Writing in the Major: AS.030.356 + one FA1-tagged elective'),
    ],
  },
  {
    id: 'phs',
    name: 'Public Health Studies, BA',
    short: 'PHS',
    degree: 'BA',
    school: 'KSAS',
    totalLabel: '63–67 credits',
    sourceUrl: `${CAT}/public-health-studies/public-health-studies-bachelor-arts/`,
    notes: [
      'Grade C- or better, letter grade.',
      'Other JHU statistics courses may substitute for AS.280.345 with advisor approval.',
      'Up to two Gordis Teaching Fellowship courses (e.g. AS.280.484, 280.485) count as intermediates.',
    ],
    requirements: [
      one('calc1', 'Calculus I', ['AS.110.106', 'AS.110.108']),
      {
        type: 'pick',
        key: 'bio',
        label: '2 biology lectures',
        n: 2,
        from: ['AS.020.151', 'AS.020.152', 'AS.020.303', 'AS.020.305', 'AS.020.306', 'AS.020.374', 'AS.280.161'],
        fill: ['AS.020.151', 'AS.020.152'],
      },
      {
        type: 'pick',
        key: 'biolab',
        label: '1 biology lab',
        n: 1,
        from: ['AS.020.153', 'AS.020.154', 'AS.020.315', 'AS.020.316', 'AS.020.340', 'AS.020.377', 'AS.250.253'],
        fill: ['AS.020.153'],
      },
      {
        type: 'pick',
        key: 'soc',
        label: '2 intro social sciences from two departments (Table 1)',
        n: 2,
        distinctDept: true,
        from: PHS_TABLE1,
        fill: ['AS.200.101', 'AS.230.101'],
      },
      one('c101', 'Introduction to Public Health', ['AS.280.101']),
      one('c240', 'Research Methods in Public Health', ['AS.280.240']),
      one('c335', 'The Environment and Your Health', ['AS.280.335']),
      one('c340', 'Fundamentals of Health Policy & Management (spring)', ['AS.280.340']),
      one('c345', 'Public Health Biostatistics', ['AS.280.345']),
      one('c350', 'Fundamentals of Epidemiology', ['AS.280.350']),
      one('sbs', 'Social/behavioral sciences', ['AS.280.355', 'AS.230.341']),
      {
        type: 'pick',
        key: 'inter',
        label: '3 intermediate courses (Table 2)',
        n: 3,
        minPerCourse: 3,
        from: PHS_TABLE2,
        fill: ['AS.280.380', 'AS.280.347', 'AS.280.314'],
      },
      one('applied', 'Applied Experience', ['AS.280.500'], { hint: '80+ hours over 4+ weeks; can start spring of sophomore year.' }),
      {
        type: 'cred',
        key: 'bsph',
        label: 'BSPH courses (10 Homewood credits)',
        credits: 10,
        from: [/^PH\./],
        fill: ['PH.BSPH', 'PH.BSPH'],
        hint: '15 BSPH credits = 10 Homewood credits, final academic year only, after all six core courses, not summer/winter; 8 BSPH credits must form a focus area.',
      },
      note('wim', 'Writing in the Major: AS.280.101 + AS.280.240'),
    ],
  },
  {
    id: 'mcb',
    name: 'Molecular & Cellular Biology, BS',
    short: 'MCB',
    degree: 'BS',
    school: 'KSAS',
    totalLabel: '72–73 credits',
    sourceUrl: `${CAT}/biology/molecular-cellular-biology-bachelor-science/`,
    notes: ['Cannot be combined with the Biology BA.', 'At least one elective must be an AS.020 course.'],
    requirements: [
      ...calc,
      ...physics(['AS.173.111'], ['AS.173.112']),
      ...genChem,
      one('org1', 'Organic Chemistry I', ['AS.030.205']),
      one('org2', 'Organic Chemistry II', ['AS.030.206', 'AS.030.212']),
      one('orglab', 'Organic lab', ['AS.030.225', 'AS.030.227']),
      one('gen', 'Genetics', ['AS.020.303']),
      one('mol', 'Molecular Biology', ['AS.020.304']),
      one('cell', 'Cell Biology', ['AS.020.306']),
      one('biochem', 'Biochemistry', ['AS.020.305']),
      one('bclab', 'Biochemistry Project Lab or PEBL', ['AS.020.315', 'AS.250.253']),
      one('devlab', 'Developmental Genetics Lab', ['AS.020.340']),
      one('celllab', 'Cell Biology Lab', ['AS.020.316']),
      { type: 'pick', key: 'elec', label: 'Electives: 4+ courses, 12+ credits, POS tag BIOLUL', n: 4, minCredits: 12, from: [pos('BIOLUL')], fill: ['BIOLUL', 'BIOLUL', 'BIOLUL', 'BIOLUL'] },
      { type: 'cred', key: 'res', label: 'Research (6 cr)', credits: 6, from: ['RES-BIO', /^AS\.020\.5\d\d$/], fill: ['RES-BIO', 'RES-BIO'] },
    ],
  },
  {
    id: 'neuro',
    name: 'Neuroscience, BS',
    short: 'Neuro',
    degree: 'BS',
    school: 'KSAS',
    totalLabel: '66.5–81.5 credits',
    sourceUrl: `${CAT}/neuroscience/neuroscience-bachelor-science/`,
    notes: ['Pre-med note: Organic II + lab and biochemistry are not major requirements.'],
    requirements: [
      note('fy', 'First year: AS.200.141 or AS.050.105 (prerequisite for AS.080.305; not a counted requirement)', { from: ['AS.200.141', 'AS.050.105'] }),
      one('cog', 'Neuroscience: Cognitive (spring)', ['AS.050.203']),
      one('lab', 'Neuroscience Lab', ['AS.080.250']),
      one('cs1', 'Neuroscience: Cellular & Systems I (fall)', ['AS.080.305']),
      one('cs2', 'Neuroscience: Cellular & Systems II (spring)', ['AS.080.306']),
      one('stats', 'Statistics', ['EN.553.211', 'EN.553.310', 'EN.553.311', 'AS.280.345']),
      ...calc,
      ...genChem,
      one('org1', 'Organic Chemistry I', ['AS.030.205']),
      ...physics(['AS.173.111', 'AS.173.115'], ['AS.173.112', 'AS.173.116']),
      set(
        'bio',
        'One biology course + lab',
        [
          ['AS.020.151', 'AS.020.153'],
          ['AS.020.152', 'AS.020.154'],
          ...cross(['AS.020.303', 'AS.020.305', 'AS.250.315'], ['AS.250.253', 'AS.020.315']),
          ['AS.020.306', 'AS.020.316'],
          ['AS.020.374', 'AS.020.377'],
        ],
        { noExam: true, hint: 'AP Biology cannot satisfy it.' },
      ),
      { type: 'cred', key: 'focus', label: '9 cr at 300+ in one focus area', credits: 9, from: ['NEUR-FOCUS', pos('NEURCM'), pos('NEURCG'), pos('NEURCP'), pos('NEURST')], fill: ['NEUR-FOCUS', 'NEUR-FOCUS', 'NEUR-FOCUS'] },
      { type: 'cred', key: 'outside', label: '3 cr outside the focus area', credits: 3, from: ['NEUR-OUT'], fill: ['NEUR-OUT'] },
      { type: 'cred', key: 'res', label: 'Research (6 cr)', credits: 6, from: ['AS.080.541', 'AS.080.544'], fill: ['AS.080.541', 'AS.080.544'] },
      { type: 'pick', key: 'comm', label: 'Scientific Communication & Mentoring, twice', n: 2, from: ['AS.080.499'], fill: ['AS.080.499', 'AS.080.499'] },
    ],
  },
  {
    id: 'hist',
    name: 'History, BA',
    short: 'History',
    degree: 'BA',
    school: 'KSAS',
    totalLabel: '36–54 credits',
    sourceUrl: `${CAT}/history/history-bachelor-arts/`,
    notes: ['At least 4 of the 8 electives must be AS.100 courses.', 'Senior thesis (honors) needs a 3.25 GPA overall and 3.5 in History.'],
    requirements: [
      { type: 'pick', key: 'intro', label: '2 intro History courses', n: 2, from: [range('AS.100', 100, 299)], fill: ['AS.100.1XX', 'AS.100.1XX'], hint: 'Or 1 + a First-Year Seminar cross-listed with History.' },
      one('methods', 'Historical Methods (fall, year 2 or 3)', ['AS.100.293']),
      one('research', 'Practicing Historical Research (spring, year 2 or 3)', ['AS.100.388']),
      { type: 'pick', key: 'upper', label: '4 History courses at 300+', n: 4, from: [range('AS.100', 300, 499)], fill: ['AS.100.3XX', 'AS.100.3XX', 'AS.100.3XX', 'AS.100.3XX'] },
      { type: 'pick', key: 'more', label: '2 more 300+ courses, or Senior Thesis', n: 2, from: [range('AS.100', 300, 499), 'AS.100.507', 'AS.100.508'], fill: ['AS.100.3XX', 'AS.100.3XX'] },
      { type: 'pick', key: 'any', label: '2 History courses at any level', n: 2, from: [/^AS\.100\./], fill: ['AS.100.2XX', 'AS.100.2XX'] },
      note('lang', 'Second language through the intermediate level (Spanish likely met by placement; verify with the History DUS)'),
    ],
  },
  {
    id: 'span',
    name: 'Spanish, BA',
    short: 'Spanish',
    degree: 'BA',
    school: 'KSAS',
    totalLabel: '41 credits (fewer with placement)',
    sourceUrl: `${CAT}/modern-languages-literatures/spanish-bachelor-arts/`,
    notes: [
      '15+ credits at 300+; grade C or better.',
      'One English-taught course with DUS approval; up to 4 courses via Hopkins in Madrid.',
      'Optional Spanish for the Professions track: one of 210.313/314/315/318/319 + 210.411 + 210.412.',
    ],
    requirements: [
      set('seq', 'Spanish language sequence (210.111, 112, 211, 212)', [['AS.210.111', 'AS.210.112', 'AS.210.211', 'AS.210.212']], {
        waivable: true,
        hint: 'Waivable by placement exam.',
      }),
      one('adv', 'Advanced Spanish I (or a replacement if placed above it)', ['AS.210.311']),
      { type: 'pick', key: 'sem', label: '1 course at AS.215.4xx', n: 1, from: [range('AS.215', 400, 499)], fill: ['AS.215.4XX'] },
      { type: 'pick', key: 'h215', label: '3 courses at AS.215.2xx–4xx', n: 3, from: [range('AS.215', 200, 499)], fill: ['AS.215.2XX', 'AS.215.2XX', 'AS.215.2XX'] },
      {
        type: 'pick',
        key: 'inspan',
        label: '4 courses taught in Spanish',
        n: 4,
        from: [range('AS.215', 100, 499), range('AS.210', 300, 499)],
        fill: ['AS.210.313', 'AS.210.319', 'AS.210.312', 'AS.210.316'],
        hint: 'AS.215.1xx–4xx or AS.210.3xx–4xx (e.g. Medical Spanish, Spanish for Public Health).',
      },
    ],
  },
];

// ── Pre-med track (not a major) ────────────────────────────────────────────

/** Writing check: writing-intensive courses plus English and Writing Seminars. AS.004.101 isn't counted (unconfirmed). */
const writingCourse: Matcher = (r) => r.code !== 'AS.004.101' && (!!r.course?.writingIntensive || /^AS\.(060|220)\./.test(r.code));
export const ENGLISH_WS_UWP = /^AS\.(060|220|004)\./;

export const PREMED: Major = {
  id: 'premed',
  name: 'Pre-med track',
  short: 'Pre-med',
  degree: 'Track',
  school: 'JHU',
  totalLabel: 'JHU recommendations, not a fixed list',
  sourceUrl: 'https://studentaffairs.jhu.edu/preprofadvising/pre-medhealth/prerequisites/',
  notes: [
    'Verify against each school you apply to. JHU publishes recommendations, not a fixed list, and these course codes are this planner’s mapping onto the catalogue (verify with a pre-health advisor).',
    'All pre-med courses: letter grade, C or better.',
    'Pre-Health 101 (fall or spring) is required in year 1 or 2 before booking a one-on-one pre-professional advising appointment.',
    'Chemistry and PHS majors: confirm with your advisor which biochemistry option fits your major.',
    'Forfeiting AP credit to retake an intro course for MCAT preparation is acceptable.',
    'Whether AS.004.101 Reintroduction to Writing counts toward the writing item is unconfirmed (verify); the planner doesn’t count it.',
  ],
  requirements: [
    ...genChem,
    one('org1', 'Organic Chemistry I', ['AS.030.205']),
    one('org2', 'Organic Chemistry II', ['AS.030.206', 'AS.030.212']),
    one('orglab', 'Organic lab', ['AS.030.225', 'AS.030.227']),
    set(
      'bio',
      'Biology: 2 courses with labs',
      [
        ['AS.020.151', 'AS.020.153'],
        ['AS.020.152', 'AS.020.154'],
        ['AS.020.306', 'AS.020.316'],
        ['AS.020.303', 'AS.020.340'],
        ['AS.020.374', 'AS.020.377'],
      ],
      { n: 2, noExam: true, hint: 'AP Biology does not replace these. Whether upper-level lecture + lab pairs count is unverified; 020.151/153 + 020.152/154 is the safest option.' },
    ),
    one('biochem', 'Biochemistry', ['AS.020.305', 'AS.250.315'], { hint: 'Lab optional.' }),
    ...physics(['AS.173.111'], ['AS.173.112']).map((r) => ({ ...r, hint: 'Calculus I & II are co-requisites for physics.' })),
    one('math', 'Calculus', ['AS.110.106', 'AS.110.108', 'AS.110.113']),
    one('stats', 'Statistics', STATS),
    { type: 'pick', key: 'writing', label: 'Writing: 2 writing-intensive courses', n: 2, from: [writingCourse], fill: ['AS.220.1XX'] },
    { type: 'pick', key: 'sbs', label: 'Social & behavioral sciences: 2 courses', n: 2, from: ['AS.200.101', 'AS.230.101', ...PHS_TABLE1], fill: ['AS.200.101', 'AS.230.101'] },
    note('nice', 'Nice to have: ethics/philosophy, cross-cultural study, population health, upper-level BCPM', {
      from: ['AS.150.219', /^AS\.280\./, range('AS.020', 300, 499), range('AS.030', 300, 499)],
    }),
  ],
};

/** Courses the MCAT draws on directly. */
export const MCAT_RELEVANT: Matcher[] = [
  ...['101', '102', '103', '105', '106', '205', '206', '212', '225', '227'].map((n) => `AS.030.${n}`),
  'AS.020.151', 'AS.020.152', 'AS.020.153', 'AS.020.154', 'AS.020.305', 'AS.250.315',
  ...PHYS1, ...PHYS2, 'AS.173.111', 'AS.173.112', 'AS.173.115', 'AS.173.116',
  'AS.200.101', 'AS.230.101', ...STATS,
];
/** Not pre-med items, but MCAT biology content benefits from them. */
export const MCAT_HELPFUL = ['AS.020.303', 'AS.020.304', 'AS.020.306', 'AS.020.374'];

/** Pre-med science (for the summer check). */
export const PREMED_SCIENCE = /^(AS\.(020|030|171|173|250)\.|AS\.110\.10[6-9]|AS\.110\.113)/;

// ── Majors imported from the e-catalogue (npm run import-catalogue) ───────

interface CatReq {
  type: 'set' | 'pick' | 'note';
  key: string;
  label: string;
  section?: string;
  options?: string[][];
  n?: number;
  from?: string[];
}
interface CatMajor {
  id: string;
  name: string;
  degree: 'BA' | 'BS';
  school: 'KSAS' | 'WSE';
  sourceUrl: string;
  totalLabel: string;
  requirements: CatReq[];
}

export const CATALOGUE_IMPORTED_AT: string = catalogue.importedAt;

/** "Chemistry, Bachelor of Science" → "Chemistry, BS". */
const shortName = (name: string) => name.replace(/,?\s*Bachelor of Arts$/i, ', BA').replace(/,?\s*Bachelor of Science$/i, ', BS');

function fromCatalogue(m: CatMajor): Major {
  const name = shortName(m.name);
  return {
    id: m.id,
    name,
    short: name.replace(/, B[AS]$/, ''),
    degree: m.degree,
    school: m.school,
    auto: true,
    totalLabel: m.totalLabel,
    sourceUrl: m.sourceUrl,
    notes: [`Imported automatically from the JHU e-catalogue on ${catalogue.importedAt}. Rules written as text are shown as notes and aren't checked; confirm everything with the department.`],
    requirements: m.requirements.map((r): Requirement => {
      const base = { key: r.key, label: r.label, section: r.section };
      if (r.type === 'set') return { ...base, type: 'set', options: r.options ?? [] };
      if (r.type === 'pick') return { ...base, type: 'pick', n: r.n ?? 1, from: r.from ?? [], fill: (r.from ?? []).slice(0, r.n ?? 1) };
      return { ...base, type: 'note' };
    }),
  };
}

const HAND_CHECKED = new Set(MAJORS.map((m) => m.sourceUrl.replace(/\/$/, '')));
/** Every KSAS and WSE bachelor's major: the hand-checked ones above, then the rest from the catalogue. */
export const ALL_MAJORS: Major[] = [
  ...MAJORS,
  ...(catalogue.majors as CatMajor[]).filter((m) => !HAND_CHECKED.has(m.sourceUrl.replace(/\/$/, ''))).map(fromCatalogue),
].sort((a, b) => a.school.localeCompare(b.school) || a.name.localeCompare(b.name));

export const ALL_TRACKS: Major[] = [...ALL_MAJORS, PREMED];

const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
/** Color for a major by its position in the scenario (pre-med has its own). */
export function majorColor(majorIds: string[], id: string) {
  return id === PREMED.id ? 'var(--c7)' : PALETTE[Math.max(0, majorIds.indexOf(id)) % PALETTE.length];
}
export const MAJOR_BY_ID: Record<string, Major> = Object.fromEntries(ALL_TRACKS.map((m) => [m.id, m]));

export { CALC1, CALC2, PHYS1, PHYS2, STATS };
