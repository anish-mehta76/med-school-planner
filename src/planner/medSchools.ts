import type { Resolved } from './types';
import { forfeits } from './apCredit';
import { numOf } from './majors';
import { deptOf } from './catalog';

/**
 * Medical-school prerequisites in one standard shape, so the same plan can be checked against
 * any school. There is no free API for this (AAMC's MSAR, the only database, is a paid
 * subscription with no public API), so each entry is summarized from the school's own
 * admissions page, linked in `url`, on the `checked` date. Requirements change every cycle:
 * confirm on the school's page before relying on any of it.
 *
 * Every school's AP rule is applied to the same JHU courses: AP credit always enters the plan
 * through JHU's AP table (apCredit.ts), and a school then decides whether that credit counts.
 */

export type Area = 'bio' | 'genchem' | 'orgo' | 'biochem' | 'physics' | 'calc' | 'stats' | 'writing' | 'behavioral';

export const AREA_LABEL: Record<Area, string> = {
  bio: 'Biology',
  genchem: 'General chemistry',
  orgo: 'Organic chemistry',
  biochem: 'Biochemistry',
  physics: 'Physics',
  calc: 'Calculus',
  stats: 'Statistics',
  writing: 'Writing / English',
  behavioral: 'Psychology / sociology',
};

/**
 * How a school treats AP credit in an area:
 * counts: AP credit on the JHU transcript satisfies it.
 * advanced: AP counts only once you've also taken a more advanced college course in that subject.
 * no: AP never counts; take the college course (or an advanced one) instead.
 * unstated: the school's page doesn't say.
 */
export type ApRule = 'counts' | 'advanced' | 'no' | 'unstated';

export interface SchoolReq {
  key: string;
  label: string;
  /** Courses in any of these areas count toward it. */
  areas: Area[];
  /** Semester courses needed. */
  sem: number;
  /** At least one college lab in these areas. */
  lab?: boolean;
  /** Count lab courses instead of lectures (e.g. "one year of lab"). */
  labsOnly?: boolean;
  /** Minimum courses from particular areas, e.g. at least one organic. */
  min?: Partial<Record<Area, number>>;
  level: 'required' | 'recommended';
  /** Overrides the school's AP rule for this requirement. */
  ap?: ApRule;
  /** Most semesters AP may cover here. */
  apMaxSem?: number;
  /** Lowest AP score accepted here. */
  apMinScore?: number;
  /** Only upper-level college courses count (JHU numbers 200 and up); exam credit never does. */
  upper?: boolean;
}

export interface MedSchool {
  id: string;
  name: string;
  short: string;
  url: string;
  /** Date the entry was checked against `url`. */
  checked: string;
  /** "competencies": no fixed course list; reqs are the courses the school says usually cover each area. */
  model: 'prerequisites' | 'competencies' | 'advising';
  ap: { rule: ApRule; minScore?: number; /** Most AP credits counted in total. */ maxCredits?: number; note: string };
  reqs: SchoolReq[];
  notes: string[];
}

const req = (key: string, label: string, areas: Area[], sem: number, o: Partial<SchoolReq> = {}): SchoolReq => ({ key, label, areas, sem, level: 'required', ...o });
const rec = (key: string, label: string, areas: Area[], sem: number, o: Partial<SchoolReq> = {}): SchoolReq => req(key, label, areas, sem, { level: 'recommended', ...o });

const CHECKED = '2026-10-20';

export const MED_SCHOOLS: MedSchool[] = [
  {
    id: 'jhu-advising',
    name: 'JHU pre-med advising (undergraduate)',
    short: 'JHU advising',
    url: 'https://studentaffairs.jhu.edu/preprofadvising/pre-medhealth/prerequisites/',
    checked: CHECKED,
    model: 'advising',
    ap: { rule: 'advanced', note: 'With AP credit in a science, JHU advising expects at least one more JHU course in that area. AP Biology does not replace the two biology courses with labs.' },
    reqs: [
      req('genchem', 'General chemistry with labs', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry with lab', ['orgo'], 2, { lab: true }),
      req('bio', 'Biology with labs', ['bio'], 2, { lab: true, ap: 'no' }),
      req('biochem', 'Biochemistry', ['biochem'], 1),
      req('physics', 'Physics with labs', ['physics'], 2, { lab: true }),
      req('calc', 'Calculus', ['calc'], 1),
      req('stats', 'Statistics', ['stats'], 1),
      req('writing', 'Writing-intensive courses', ['writing'], 2, { ap: 'unstated' }),
      req('behavioral', 'Psychology / sociology', ['behavioral'], 2, { ap: 'unstated' }),
    ],
    notes: ['JHU publishes recommendations, not a fixed list. This mirrors the planner’s pre-med track.'],
  },
  {
    id: 'jhu-som',
    name: 'Johns Hopkins School of Medicine',
    short: 'Hopkins SOM',
    url: 'https://www.hopkinsmedicine.org/som/education-programs/md-program/application-process/prerequisites-requirements-and-policies',
    checked: CHECKED,
    model: 'prerequisites',
    ap: {
      rule: 'counts',
      maxCredits: 12,
      note: 'AP/IB counts if your college gave credit on the transcript, up to 12 credits. Using it for biology or chemistry means also taking an advanced semester in that subject (e.g. cell biology or genetics; a second semester of organic or biochemistry).',
    },
    reqs: [
      req('bio', 'Biology with lab (8 semester hours)', ['bio'], 2, { lab: true, ap: 'advanced' }),
      req('genchem', 'General chemistry with lab (8 semester hours)', ['genchem'], 2, { lab: true, ap: 'advanced' }),
      req('orgo', 'Organic chemistry with lab (4 semester hours)', ['orgo'], 1, { lab: true, ap: 'advanced' }),
      req('biochem', 'Biochemistry (3 semester hours; lab not required)', ['biochem'], 1),
      req('physics', 'Physics with lab (8 semester hours)', ['physics'], 2, { lab: true }),
      req('math', 'Calculus and/or statistics (6 semester hours)', ['calc', 'stats'], 2),
      rec('stats', 'Statistics or epidemiology (strongly recommended)', ['stats'], 1),
      req('writing', 'Two writing-intensive courses (within 24 hours of humanities/social/behavioral)', ['writing'], 2, { ap: 'unstated' }),
    ],
    notes: [
      '24 semester hours of humanities, social and behavioral sciences in all; AP may cover up to half. The planner checks only the two writing-intensive courses.',
      'Genetics is recommended. CLEP is not accepted.',
    ],
  },
  {
    id: 'harvard',
    name: 'Harvard Medical School (Pathways)',
    short: 'Harvard',
    url: 'https://hms.harvard.edu/education-admissions/md-program/admissions/preparing-apply/prerequisite-courses',
    checked: CHECKED,
    model: 'prerequisites',
    ap: {
      rule: 'advanced',
      minScore: 4,
      note: 'Scores of 4 or 5 only. AP can cover one semester of chemistry or physics if it let you into an upper-level course. Never biology or writing.',
    },
    reqs: [
      req('bio', 'Biology, one year with lab', ['bio'], 2, { lab: true, ap: 'no' }),
      req('chem', 'Chemistry, two years: inorganic, organic and biochemistry, with lab', ['genchem', 'orgo', 'biochem'], 4, { lab: true, apMaxSem: 1, min: { orgo: 1, biochem: 1 } }),
      req('physics', 'Physics, one year (lab desirable)', ['physics'], 2, { apMaxSem: 1 }),
      req('writing', 'Expository writing, one year', ['writing'], 2, { ap: 'no' }),
      rec('math', 'Calculus and statistics, one semester each (encouraged)', ['calc', 'stats'], 2, { min: { calc: 1, stats: 1 }, ap: 'counts' }),
      rec('behavioral', 'Behavioral sciences (encouraged)', ['behavioral'], 1, { ap: 'unstated' }),
    ],
    notes: ['HST track differs: physics must be taken in college and upper-level math is expected.', 'Lab sciences should not be taken online.'],
  },
  {
    id: 'stanford',
    name: 'Stanford School of Medicine',
    short: 'Stanford',
    url: 'https://med.stanford.edu/md-admissions/academic-requirements.html',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'unstated', note: 'No specific course requirements, and no AP policy for the MD program on the page.' },
    reqs: [
      rec('bio', 'Biology', ['bio'], 2),
      rec('chem', 'Chemistry', ['genchem', 'orgo', 'biochem'], 2),
      rec('physics', 'Physics', ['physics'], 1),
      rec('math', 'Mathematics / statistics', ['calc', 'stats'], 1),
      rec('behavioral', 'Behavioral and social sciences', ['behavioral'], 1),
      rec('writing', 'Communication (writing)', ['writing'], 1),
    ],
    notes: ['Recommends depth in each area plus laboratory or field experience; Spanish or an Asian language is recommended.'],
  },
  {
    id: 'penn',
    name: 'Perelman School of Medicine (Penn)',
    short: 'Penn',
    url: 'https://www.med.upenn.edu/admissions/faq',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'counts', note: 'AP/IB accepted if it’s on your transcript; Penn encourages taking the next course in the sequence.' },
    reqs: [
      rec('bio', 'Biology', ['bio'], 2),
      rec('chem', 'Chemistry, including organic', ['genchem', 'orgo'], 2, { min: { orgo: 1 } }),
      rec('biochem', 'Biochemistry', ['biochem'], 1),
      rec('physics', 'Physics', ['physics'], 2),
      rec('math', 'Mathematics and statistics', ['calc', 'stats'], 1),
    ],
    notes: ['No specific courses required; competency must be shown. Refresher work is recommended if your last science course was over five years ago.'],
  },
  {
    id: 'columbia',
    name: 'Columbia Vagelos College of Physicians and Surgeons',
    short: 'Columbia',
    url: 'https://www.vagelos.columbia.edu/education/academic-programs/md-program/admissions/apply/application-requirements',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP physics or general chemistry counts. AP biology doesn’t: it has to be replaced by a year of advanced biology.' },
    reqs: [
      req('bio', 'Biology, one year with labs', ['bio'], 2, { lab: true, ap: 'no' }),
      req('genchem', 'General chemistry with lab', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry with lab', ['orgo'], 2, { lab: true, ap: 'no' }),
      req('biochem', 'Biochemistry (lab recommended)', ['biochem'], 1, { ap: 'no' }),
      req('physics', 'Physics, one year with a semester of lab', ['physics'], 2, { lab: true }),
      req('writing', 'English or writing-intensive, one year', ['writing'], 2, { ap: 'unstated' }),
    ],
    notes: [
      'The FAQ and application pages differ slightly on course counts; confirm with admissions.',
      'Online prerequisites aren’t accepted. Grades below C- don’t count. Courses must be within 10 years.',
    ],
  },
  {
    id: 'ucsf',
    name: 'UCSF School of Medicine',
    short: 'UCSF',
    url: 'https://meded.ucsf.edu/prospective-students/md-program-admissions/md-program-application-process',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'no', note: 'AP accepted only for chemistry and physics, and only if it’s on your transcript.' },
    reqs: [
      req('bio', 'Biology, one year with lab (may include biochemistry)', ['bio', 'biochem'], 2, { lab: true }),
      req('chem', 'Chemistry, one year including a semester of organic with lab', ['genchem', 'orgo'], 2, { lab: true, min: { orgo: 1 }, ap: 'counts' }),
      req('biochem', 'Biochemistry, one semester', ['biochem'], 1),
      req('physics', 'Physics, one semester', ['physics'], 1, { ap: 'counts' }),
    ],
    notes: ['Online and pass/no-pass courses accepted. U.S. citizens, permanent residents and DACA recipients only.'],
  },
  {
    id: 'duke',
    name: 'Duke University School of Medicine',
    short: 'Duke',
    url: 'https://medschool.duke.edu/education/health-professions-education-programs/doctor-medicine-md-program/admissions/admissions-1',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'counts', note: 'No prerequisites. AP credit your college accepts is accepted.' },
    reqs: [
      rec('bio', 'Biology, incl. cell/molecular', ['bio'], 2),
      rec('chem', 'Chemistry', ['genchem', 'orgo'], 2),
      rec('biochem', 'Biochemistry', ['biochem'], 1),
      rec('physics', 'Physics or biophysics (lab optional)', ['physics'], 1),
      rec('behavioral', 'Sociology and psychology', ['behavioral'], 2),
    ],
    notes: ['The FAQ lists a minimum GPA of 3.0 and MCAT of 500.'],
  },
  {
    id: 'washu',
    name: 'Washington University School of Medicine',
    short: 'WashU',
    url: 'https://mdadmissions.wustl.edu/how-to-apply/requirements/',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP, IB or CLEP counts if it’s on a college transcript or documented (e.g. a College Board score report).' },
    reqs: [
      req('bio', 'Biological science, one year', ['bio'], 2),
      req('genchem', 'General / inorganic chemistry, one year', ['genchem'], 2),
      req('orgo', 'Organic chemistry, one year', ['orgo'], 2),
      req('physics', 'Physics, one year', ['physics'], 2),
      req('calc', 'Differential and integral calculus, one year', ['calc'], 2),
    ],
    notes: ['Footnotes on organic chemistry and calculus weren’t captured; check the page. 90 semester hours required. AAMC PREview required.'],
  },
  {
    id: 'yale',
    name: 'Yale School of Medicine',
    short: 'Yale',
    url: 'https://medicine.yale.edu/md-program/admissions/requirements/',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP/IB counts if your college gave credit on its transcript.' },
    reqs: [
      req('bio', 'General biology with lab, one year', ['bio'], 2, { lab: true }),
      req('genchem', 'General chemistry with lab, one year', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry with lab', ['orgo'], 1, { lab: true }),
      req('biochem', 'Biochemistry (lab recommended)', ['biochem'], 1),
      req('physics', 'General physics with lab, one year', ['physics'], 2, { lab: true }),
      req('stats', 'Statistics or biostatistics (required from the 2027–28 cycle)', ['stats'], 1),
    ],
    notes: ['Labs must be in person; online courses aren’t accepted. Courses should be letter-graded.'],
  },
  {
    id: 'nyu',
    name: 'NYU Grossman School of Medicine',
    short: 'NYU',
    url: 'https://med.nyu.edu/education/md-degree/md-admissions/admissions-requirements',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'unstated', note: 'No prerequisites, and no AP policy on the page.' },
    reqs: [
      rec('chem', 'Inorganic and organic chemistry with lab', ['genchem', 'orgo'], 2, { min: { orgo: 1 } }),
      rec('biochem', 'Biochemistry with lab', ['biochem'], 1),
      rec('bio', 'General biology with lab (genetics also recommended)', ['bio'], 2),
      rec('physics', 'General physics with lab', ['physics'], 2),
      rec('stats', 'Statistics', ['stats'], 1),
      rec('writing', 'English', ['writing'], 1),
    ],
    notes: [],
  },
  {
    id: 'sinai',
    name: 'Icahn School of Medicine at Mount Sinai',
    short: 'Mount Sinai',
    url: 'https://icahn.mssm.edu/education/admissions/md-program',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'advanced', note: 'AP physics with a 5 counts. AP chemistry or biology needs advanced coursework in that area. FlexMed accepts no AP or IB.' },
    reqs: [
      req('genchem', 'General chemistry, one year', ['genchem'], 2),
      req('orgo', 'Organic chemistry, one semester', ['orgo'], 1),
      req('biochem', 'Biochemistry, one semester', ['biochem'], 1),
      req('bio', 'Biology, one year', ['bio'], 2),
      req('physics', 'Physics, one semester', ['physics'], 1, { ap: 'counts', apMinScore: 5 }),
      req('lab', 'One year of lab in biology and/or chemistry', ['bio', 'genchem', 'orgo', 'biochem'], 2, { labsOnly: true }),
      req('stats', 'Statistics (biostatistics preferred)', ['stats'], 1, { ap: 'unstated' }),
      req('writing', 'English writing-intensive, one year', ['writing'], 2, { ap: 'unstated' }),
    ],
    notes: ['The page found was several years old; confirm. Lab sciences should not be online. Biology within five years of applying is recommended.'],
  },
  {
    id: 'michigan',
    name: 'University of Michigan Medical School',
    short: 'Michigan',
    url: 'https://medschool.umich.edu/programs-admissions/md-program/md-admissions/md-admissions-requirements',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'unstated', note: 'No AP policy on the page. Competencies can also be shown through research or other routes.' },
    reqs: [
      rec('bio', 'Cell/molecular biology and genetics (typically 2 semesters)', ['bio'], 2),
      rec('biochem', 'Biochemistry (with its chemistry prerequisites)', ['biochem'], 1),
      rec('physics', 'Physics (typically 2 semesters)', ['physics'], 2),
      rec('stats', 'Statistics, one semester', ['stats'], 1),
    ],
    notes: ['U.S. citizens, permanent residents and DACA recipients only. 90 credit hours required.'],
  },
  {
    id: 'northwestern',
    name: 'Northwestern Feinberg School of Medicine',
    short: 'Northwestern',
    url: 'https://www.feinberg.northwestern.edu/admissions/how-to-apply/requirements.html',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'advanced', note: 'Science AP counts only with an advanced college course in that subject. Placing out of general chemistry meets that requirement outright.' },
    reqs: [
      req('bio', 'Biology with lab, one year', ['bio'], 2, { lab: true }),
      req('genchem', 'General chemistry with lab, one year', ['genchem'], 2, { lab: true, ap: 'counts' }),
      req('orgo', 'Organic chemistry with lab, one year (or a semester each of organic and biochemistry)', ['orgo', 'biochem'], 2, { lab: true, min: { orgo: 1 } }),
      req('physics', 'Physics with lab, one year', ['physics'], 2, { lab: true }),
      rec('stats', 'Statistics', ['stats'], 1),
      rec('writing', 'Writing', ['writing'], 1),
      rec('behavioral', 'Social sciences', ['behavioral'], 1),
    ],
    notes: [],
  },
  {
    id: 'umaryland',
    name: 'University of Maryland School of Medicine',
    short: 'Maryland',
    url: 'https://www.medschool.umaryland.edu/admissions/your-path-to-medical-school/',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP/IB accepted. Students with strong AP science are encouraged to take advanced courses instead of the standard ones.' },
    reqs: [
      req('bio', 'Biological sciences with lab, one year', ['bio'], 2, { lab: true }),
      req('genchem', 'General chemistry with lab, one year', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry with lab, one year (or a semester each of organic and biochemistry)', ['orgo', 'biochem'], 2, { lab: true, min: { orgo: 1 } }),
      req('physics', 'Physical sciences with lab, one year', ['physics'], 2, { lab: true }),
      req('writing', 'English or writing-intensive, one year', ['writing'], 2, { ap: 'unstated' }),
    ],
    notes: ['Prerequisites within five years of applying are recommended. Immunology, physiology, microbiology, genetics and epidemiology are strongly recommended.'],
  },
  {
    id: 'ucla',
    name: 'UCLA David Geffen School of Medicine',
    short: 'UCLA',
    url: 'https://medschool.ucla.edu/education/md-education/admissions/preparing-to-apply',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'counts', note: 'No specific prerequisites; the page says AP credit is acceptable.' },
    reqs: [
      rec('bio', 'Biological sciences (cell/molecular biology, genetics)', ['bio'], 2),
      rec('chem', 'Inorganic and organic chemistry with labs', ['genchem', 'orgo'], 2),
      rec('biochem', 'Biochemistry', ['biochem'], 1),
      rec('math', 'Mathematics and statistics', ['calc', 'stats'], 1),
      rec('behavioral', 'Humanities and social sciences', ['behavioral'], 1),
    ],
    notes: ['Applications from international students aren’t considered.'],
  },
  {
    id: 'cornell',
    name: 'Weill Cornell Medicine',
    short: 'Weill Cornell',
    url: 'https://teach.weill.cornell.edu/medical-education/admissions/selection-criteria-and-requirements',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'no', note: 'AP counts for physics only. With AP biology or chemistry, take advanced coursework in that subject instead.' },
    reqs: [
      req('bio', 'Biology with lab, two semesters', ['bio'], 2, { lab: true }),
      req('genchem', 'General chemistry with lab, two semesters', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry with lab, two semesters (the second may be advanced biology/chemistry)', ['orgo', 'biochem'], 2, { lab: true, min: { orgo: 1 } }),
      req('physics', 'Physics with lab, two semesters', ['physics'], 2, { lab: true, ap: 'counts' }),
      req('writing', 'Writing-intensive humanities/social science, two semesters', ['writing'], 2),
      rec('math', 'Math, statistics or computation (encouraged)', ['calc', 'stats'], 1),
    ],
    notes: ['CLEP generally not accepted. Minimum grade C. Courses within 10 years.'],
  },
  {
    id: 'vanderbilt',
    name: 'Vanderbilt University School of Medicine',
    short: 'Vanderbilt',
    url: 'https://medschool.vanderbilt.edu/md/admissions/process/',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'counts', note: 'AP is acceptable, but college courses are strongly encouraged.' },
    reqs: [
      rec('bio', 'Molecular/cellular biology and genetics', ['bio'], 2),
      rec('chem', 'Chemistry', ['genchem', 'orgo'], 2),
      rec('biochem', 'Biochemistry', ['biochem'], 1),
      rec('physics', 'Physics', ['physics'], 1),
      rec('stats', 'Statistics or biostatistics', ['stats'], 1),
      rec('behavioral', 'Psychology / sociology', ['behavioral'], 1),
    ],
    notes: [],
  },
  {
    id: 'pitt',
    name: 'University of Pittsburgh School of Medicine',
    short: 'Pitt',
    url: 'https://www.medadmissions.pitt.edu/admissions/you-apply/academic-requirements',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP counts if your college awarded it and it’s on your transcript. CLEP isn’t accepted.' },
    reqs: [
      req('bio', 'Biology with lab, one year', ['bio'], 2, { lab: true }),
      req('genchem', 'General / inorganic chemistry with lab, one year', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry with lab, one semester', ['orgo'], 1, { lab: true }),
      req('biochem', 'Biochemistry, one semester', ['biochem'], 1),
      req('physics', 'Physics with lab, one year', ['physics'], 2, { lab: true }),
    ],
    notes: ['Biology excludes microbiology, botany, ecology and anatomy. Pass/fail accepted (except for Pitt’s Guaranteed Admission Program).'],
  },
  {
    id: 'uchicago',
    name: 'University of Chicago Pritzker School of Medicine',
    short: 'UChicago',
    url: 'https://pritzker.uchicago.edu/admissions/entrance-requirements',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'unstated', note: 'The entrance requirements page doesn’t mention AP.' },
    reqs: [
      rec('chem', 'Organic chemistry, one semester, with a semester of lab', ['orgo'], 1, { lab: true }),
      rec('biochem', 'Biochemistry, one semester', ['biochem'], 1),
      rec('stats', 'Statistics or biomathematics', ['stats'], 1),
      rec('writing', 'Writing and analysis, one year', ['writing'], 2),
    ],
    notes: ['Also 6 semester hours of arts, humanities, social sciences or language (not checked).'],
  },
  {
    id: 'georgetown',
    name: 'Georgetown University School of Medicine',
    short: 'Georgetown',
    url: 'https://meded.georgetown.edu/admissions/degrees-and-admissions/md/guide/',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP and IB fulfill prerequisites if the courses and credits are detailed on your college transcript.' },
    reqs: [
      req('bio', 'General biology with lab, one year (8 semester hours)', ['bio'], 2, { lab: true }),
      req('genchem', 'General chemistry with lab, one year (8 semester hours)', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry with lab, one year (biochemistry may replace the second semester)', ['orgo', 'biochem'], 2, { lab: true, min: { orgo: 1 } }),
      req('physics', 'Physics with lab, one year (8 semester hours)', ['physics'], 2, { lab: true }),
      req('math', 'College mathematics, one semester (calculus not required; statistics acceptable)', ['calc', 'stats'], 1),
      rec('biochem', 'Biochemistry (lab not required)', ['biochem'], 1),
    ],
    notes: ['90 credit hours required to be considered. Substitutions for prerequisites aren’t permitted. Prerequisites five or more years old need recent upper-level or post-bac coursework.'],
  },
  {
    id: 'gwu',
    name: 'George Washington University School of Medicine and Health Sciences',
    short: 'GW',
    url: 'https://smhs.gwu.edu/academics/md-program/admissions/application-process/minimum-eligibility-recommendations',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP, online and community college coursework are accepted, graded or pass/fail.' },
    reqs: [
      req('bio', 'Biology, one course with lab', ['bio'], 1, { lab: true }),
      req('biochem', 'Biochemistry, one course (lab if available)', ['biochem'], 1),
      req('orgo', 'Organic chemistry, one course with lab', ['orgo'], 1, { lab: true }),
      req('physics', 'Physics, one course (lab if available)', ['physics'], 1),
    ],
    notes: ['Requirements for the 2027 cycle; they must be complete by June of the matriculation year. AAMC PREview is required.'],
  },
  {
    id: 'howard',
    name: 'Howard University College of Medicine',
    short: 'Howard',
    url: 'https://medicine.howard.edu/admission-aid/requirements-procedures',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'unstated', note: 'The requirements page doesn’t mention AP credit.' },
    reqs: [
      req('bio', 'Biology with lab (8 semester hours)', ['bio'], 2, { lab: true }),
      req('genchem', 'Inorganic chemistry with lab (8 semester hours)', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry with lab (8 semester hours)', ['orgo'], 2, { lab: true }),
      req('physics', 'Physics with lab (8 semester hours)', ['physics'], 2, { lab: true }),
      req('math', 'Math / statistics (6 semester hours, any college-level math)', ['calc', 'stats'], 2),
      req('biochem', 'Biochemistry (3 semester hours)', ['biochem'], 1),
      req('writing', 'English (6 semester hours)', ['writing'], 2),
    ],
    notes: ['71 semester hours required, including 6 hours of humanities (not checked). Anatomy and physiology, cell biology, embryology, genetics, neuroscience and microbiology are recommended.'],
  },
  {
    id: 'einstein',
    name: 'Albert Einstein College of Medicine',
    short: 'Einstein',
    url: 'https://einsteinmed.edu/education/md-program/md-admissions/admissions-requirements',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'counts', note: 'AP credit granted by examination is acceptable. With AP biology, advanced biology coursework is strongly recommended.' },
    reqs: [
      rec('chem', 'Inorganic chemistry, organic chemistry and biochemistry', ['genchem', 'orgo', 'biochem'], 3, { min: { genchem: 1, orgo: 1, biochem: 1 } }),
      rec('bio', 'General biology', ['bio'], 1),
      rec('physics', 'General physics', ['physics'], 1),
      rec('math', 'Mathematics (statistics and probability; calculus useful, not required)', ['calc', 'stats'], 1),
      rec('behavioral', 'Humanities, social and behavioral sciences', ['behavioral'], 1),
    ],
    notes: [
      'No prerequisites. Einstein says its competencies are usually met with 40 credit hours of science and math (including advanced biology) and 40 of humanities and social sciences.',
      'Pass/fail isn’t accepted unless it was your college’s policy. International students aren’t considered.',
    ],
  },
  {
    id: 'downstate',
    name: 'SUNY Downstate College of Medicine',
    short: 'Downstate',
    url: 'https://www.downstate.edu/education-training/college-of-medicine/admissions/admissions-requirements.html',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP counts if listed by subject title on your final college transcript, but never for the lab component. You should take as many credits of advanced science as the AP credit used.' },
    reqs: [
      req('writing', 'English (6 credits; English-department courses)', ['writing'], 2),
      req('bio', 'General biology or zoology with labs (8 credits)', ['bio'], 2, { lab: true }),
      req('physics', 'General physics with labs (8 credits)', ['physics'], 2, { lab: true }),
      req('genchem', 'General or inorganic chemistry with labs (8 credits)', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry with labs (8 credits)', ['orgo'], 2, { lab: true }),
      rec('math', 'College mathematics, one year', ['calc', 'stats'], 2),
      rec('biochem', 'Biochemistry (strongly recommended)', ['biochem'], 1),
      rec('stats', 'Biostatistics or statistics (strongly recommended)', ['stats'], 1),
    ],
    notes: ['Grade of C or better in each prerequisite. 90 semester credits required. Classroom (not distance) prerequisites at four-year US colleges get preference.'],
  },
  {
    id: 'stonybrook',
    name: 'Renaissance School of Medicine at Stony Brook University',
    short: 'Stony Brook',
    url: 'https://renaissance.stonybrookmedicine.edu/admissions/procedures',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'unstated', note: 'The current requirements page doesn’t mention AP. An older admissions page (requirements from the 2015 class) says AP with a 4 or 5 is considered, at most one course per discipline.' },
    reqs: [
      rec('bio', 'Biology, two semesters with lab', ['bio'], 2, { lab: true }),
      rec('chem', 'Chemistry, four semesters incl. general, organic and biochemistry (three semesters of lab)', ['genchem', 'orgo', 'biochem'], 4, { lab: true, min: { genchem: 1, orgo: 1, biochem: 1 } }),
      rec('writing', 'English / writing, one semester', ['writing'], 1),
      rec('physics', 'Physics, one semester with lab', ['physics'], 1, { lab: true }),
      rec('behavioral', 'Psychology, sociology, logic, ethics, anthropology or philosophy, one semester', ['behavioral'], 1),
      rec('stats', 'Statistics, one semester', ['stats'], 1),
    ],
    notes: ['For the 2027 entering class these courses are highly recommended, not required. The older admissions page (https://renaissance.stonybrookmedicine.edu/admissions/welcome) still lists them as required.'],
  },
  {
    id: 'hofstra',
    name: 'Donald and Barbara Zucker School of Medicine at Hofstra/Northwell',
    short: 'Zucker (Hofstra)',
    url: 'https://medicine.hofstra.edu/admission/md/requirements/',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'unstated', note: 'The requirements page doesn’t mention AP.' },
    reqs: [
      rec('bio', 'College biology with lab, one year', ['bio'], 2, { lab: true }),
      rec('chem', 'Chemistry through organic and biochemistry', ['genchem', 'orgo', 'biochem'], 3, { min: { orgo: 1, biochem: 1 } }),
      rec('math', 'College mathematics, one year, preferably including statistics', ['calc', 'stats'], 2),
      rec('physics', 'College physics, one year', ['physics'], 2),
      rec('writing', 'English literature or equivalent, including writing', ['writing'], 1),
    ],
    notes: ['No natural-science prerequisites; these are strongly recommended. U.S. citizens, permanent residents and DACA recipients only.'],
  },
  {
    id: 'nymc',
    name: 'New York Medical College School of Medicine',
    short: 'NYMC',
    url: 'https://www.nymc.edu/som/admissions--aid/',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'Required courses, including AP taken in high school, must be accepted by an accredited U.S. or Canadian college toward a bachelor’s degree.' },
    reqs: [
      req('writing', 'English, two semesters', ['writing'], 2),
      req('bio', 'General biology with lab, two semesters', ['bio'], 2, { lab: true }),
      req('physics', 'General physics with lab, two semesters', ['physics'], 2, { lab: true }),
      req('genchem', 'General chemistry with lab, two semesters', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry with lab, one semester', ['orgo'], 1, { lab: true }),
      req('biochem', 'Biochemistry, one semester (lab optional)', ['biochem'], 1),
    ],
    notes: ['Upper-level lab sciences are strongly recommended. Online bachelor’s degrees aren’t accepted.'],
  },
  {
    id: 'usuhs',
    name: 'Uniformed Services University Hébert School of Medicine',
    short: 'USU',
    url: 'https://medschool.usuhs.edu/admissions/application-requirements',
    checked: CHECKED,
    model: 'prerequisites',
    ap: {
      rule: 'advanced',
      note: 'AP/IB credit your college granted is acceptable for biology, calculus, statistics, general chemistry, physics and English; with AP/IB science credit you must take upper-level science coursework. CLEP isn’t accepted.',
    },
    reqs: [
      req('bio', 'Biology with lab, one year (8 credits)', ['bio'], 2, { lab: true }),
      req('genchem', 'General / inorganic chemistry with lab, one year (8 credits)', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry with lab, one year (biochemistry may replace the second semester)', ['orgo', 'biochem'], 2, { lab: true, min: { orgo: 1 }, ap: 'no' }),
      req('physics', 'General physics with lab, one year (8 credits)', ['physics'], 2, { lab: true }),
      req('writing', 'English, foreign language, writing-intensive humanities, social science or psychology, one year', ['writing', 'behavioral'], 2, { ap: 'counts' }),
      req('math', 'Calculus or statistics, one semester (statistics no longer accepted from the 2028 cycle)', ['calc', 'stats'], 1, { ap: 'counts' }),
    ],
    notes: ['U.S. citizens only; commissioning age and medical standards apply. Grade of C or higher (C- not accepted). Online and community college courses, including labs, are accepted.'],
  },
  {
    id: 'baylor',
    name: 'Baylor College of Medicine',
    short: 'Baylor',
    url: 'https://www.bcm.edu/education/school-of-medicine/m-d-program/admissions-process/requirements',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'no', note: 'AP courses aren’t accepted for the required coursework.' },
    reqs: [
      req('math', 'Math (3–4 hours; biostatistics preferred, any quantitative math such as statistics, physics or calculus)', ['stats', 'calc', 'physics'], 1),
      req('writing', 'Expository writing (3–4 hours; writing-intensive courses in many fields count)', ['writing'], 1),
      req('orgo', 'Organic chemistry, two semesters (lab not required)', ['orgo'], 2),
      req('biochem', 'Biochemistry (lab not required)', ['biochem'], 1),
      req('bio', 'Advanced biology (lab not required; genetics or cell/molecular highly recommended)', ['bio'], 1, { upper: true }),
    ],
    notes: ['Also 12 semester hours of humanities and social/behavioral sciences (not checked). 90 semester hours at a U.S. college required. Spanish recommended.'],
  },
  {
    id: 'unc',
    name: 'UNC School of Medicine',
    short: 'UNC',
    url: 'https://www.med.unc.edu/md/admissions/how-to-apply/admissions-requirements/',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'no', note: 'AP and CLEP credits don’t count toward required coursework or the 30 BCPM hours.' },
    reqs: [
      req('biochem', 'Biochemistry, one course', ['biochem'], 1),
      req('bio', 'Upper-level biology, two courses (e.g. anatomy/physiology, cell biology, genetics, microbiology, immunology)', ['bio'], 2, { upper: true }),
      rec('stats', 'Statistics', ['stats'], 1),
    ],
    notes: ['At least 30 credit hours of letter-graded biology, chemistry, physics and math (not checked). Humanities coursework recommended. A substantial majority of coursework should be in person.'],
  },
  {
    id: 'mayo',
    name: 'Mayo Clinic Alix School of Medicine',
    short: 'Mayo',
    url: 'https://college.mayo.edu/academics/mayo-clinic-alix-school-of-medicine/md-program/how-to-apply/prerequisites-and-requirements/',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'unstated', note: 'No specific prerequisites, and no AP policy for the MD program on the page.' },
    reqs: [
      rec('bio', 'Biology and microbiology', ['bio'], 1),
      rec('biochem', 'Biochemistry', ['biochem'], 1),
      rec('chem', 'Chemistry', ['genchem', 'orgo'], 1),
      rec('physics', 'Physics', ['physics'], 1),
    ],
    notes: ['Successful applicants show a broad foundation in life, physical and social sciences and humanities. Bachelor’s from a U.S. or Canadian college required.'],
  },
  {
    id: 'ucsd',
    name: 'UC San Diego School of Medicine',
    short: 'UCSD',
    url: 'https://medschool.ucsd.edu/education/md-combined/admissions/application-process.html',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'unstated', note: 'No required coursework, and no AP policy on the page.' },
    reqs: [
      rec('bio', 'Biology, one year', ['bio'], 2, { lab: true }),
      rec('genchem', 'General chemistry, one year', ['genchem'], 2, { lab: true }),
      rec('biochem', 'Biochemistry, one term', ['biochem'], 1),
      rec('orgo', 'Organic chemistry, one year', ['orgo'], 2, { lab: true }),
      rec('physics', 'Physics, one year', ['physics'], 2, { lab: true }),
      rec('math', 'Calculus or statistics, one year', ['calc', 'stats'], 2),
    ],
    notes: ['Labs recommended for every course that offers one. Online grades accepted. U.S. citizens, permanent residents and DACA recipients only.'],
  },
  {
    id: 'emory',
    name: 'Emory University School of Medicine',
    short: 'Emory',
    url: 'https://med.emory.edu/education/programs/md/admissions/faq.html',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'unstated', note: 'Emory accepts “some” AP and IB credit if it appears on your undergraduate transcript, without saying which. Extra science courses are helpful but not required.' },
    reqs: [
      req('bio', 'Biology with lab, one year', ['bio'], 2, { lab: true }),
      req('genchem', 'General chemistry with lab, one year', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry with lab, one year', ['orgo'], 2, { lab: true }),
      req('physics', 'Physics with lab, one year', ['physics'], 2, { lab: true }),
      req('writing', 'English: grammar and composition, one year (6 semester hours)', ['writing'], 2),
    ],
    notes: ['Also 18 hours (six courses) of humanities and social sciences (not checked).'],
  },
  {
    id: 'osu',
    name: 'Ohio State University College of Medicine',
    short: 'Ohio State',
    url: 'https://medicine.osu.edu/education/md/admissions/before-you-apply/requirements',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'unstated', note: 'The requirements page doesn’t mention AP.' },
    reqs: [
      req('bio', 'Biology, two semesters', ['bio'], 2),
      req('genchem', 'General chemistry series with lab, two semesters', ['genchem'], 2, { lab: true }),
      req('biochem', 'Biochemistry, one semester', ['biochem'], 1),
      req('orgo', 'Organic chemistry series with a year of lab, two semesters', ['orgo'], 2, { lab: true }),
      req('physics', 'Physics with lab, two semesters', ['physics'], 2, { lab: true }),
      rec('writing', 'Writing / speech', ['writing'], 1),
      rec('behavioral', 'Social sciences (psychology, sociology, anthropology, economics)', ['behavioral'], 1),
    ],
    notes: ['Within ten years of enrolling, grade C- or higher. Online lectures accepted; labs must be in person. Anatomy and ethics recommended.'],
  },
  {
    id: 'uw',
    name: 'University of Washington School of Medicine',
    short: 'UW',
    url: 'https://www.uwmedicine.org/school-of-medicine/md-program/admissions/course-requirements',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP credit substitutes for prerequisites if your college grants it on the transcript and AMCAS verifies it.' },
    reqs: [
      req('bio', 'Biology, one year (incl. molecular genetics and cell biology; lab recommended)', ['bio'], 2),
      req('chem', 'Chemistry / biochemistry, two years (inorganic, organic and biochemistry)', ['genchem', 'orgo', 'biochem'], 4, { min: { genchem: 1, orgo: 1, biochem: 1 } }),
      req('physics', 'Physics, one year', ['physics'], 2),
      rec('calc', 'Calculus', ['calc'], 1),
      rec('stats', 'Statistics (biostatistics preferred)', ['stats'], 1),
    ],
    notes: [
      'Also a demonstrated competency in social sciences, humanities or the “human condition” (not checked).',
      'Labs are encouraged but can’t count toward the prerequisites.',
    ],
  },
  {
    id: 'utsw',
    name: 'UT Southwestern Medical School',
    short: 'UT Southwestern',
    url: 'https://medschool.utsouthwestern.edu/admissions/prerequisites.html',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP credit is acceptable if your college lists the specific courses and units on the official transcript.' },
    reqs: [
      req('bio', 'Biology, 14 semester hours with lab', ['bio'], 4, { lab: true }),
      req('biochem', 'Biochemistry, 3 semester hours (not introductory)', ['biochem'], 1),
      req('genchem', 'General chemistry with lab, 4 semester hours', ['genchem'], 1, { lab: true }),
      req('orgo', 'Organic chemistry with lab, 8 semester hours', ['orgo'], 2, { lab: true }),
      req('writing', 'English, 6 semester hours (writing-heavy humanities or social science may count)', ['writing'], 2),
      req('math', 'Calculus or statistics, 3 semester hours (biostatistics preferred)', ['calc', 'stats'], 1),
      req('physics', 'Physics with lab, 8 semester hours', ['physics'], 2, { lab: true }),
    ],
    notes: ['Grade of C or better; foreign coursework doesn’t count. A second semester of biochemistry can count toward biology. A year of calculus and of physical chemistry is desirable.'],
  },
  {
    id: 'colorado',
    name: 'University of Colorado School of Medicine',
    short: 'Colorado',
    url: 'https://medschool.cuanschutz.edu/education/md-admissions/requirements',
    checked: CHECKED,
    model: 'competencies',
    ap: { rule: 'counts', note: 'AP and CLEP are treated as comparable to college courses if your degree-granting college puts them on its transcript. With AP science credit, upper-level courses are encouraged.' },
    reqs: [
      rec('bio', 'Biology: molecular and cellular, genetics, organ systems and physiology', ['bio'], 2),
      rec('chem', 'Chemistry / biochemistry as applied to living systems', ['genchem', 'orgo', 'biochem'], 2),
      rec('physics', 'Physics', ['physics'], 1),
      rec('stats', 'Statistics or biostatistics (a basic understanding is required)', ['stats'], 1),
      rec('behavioral', 'Social sciences', ['behavioral'], 1),
    ],
    notes: ['Competencies can be met through coursework or other education, work or life experience.'],
  },
  {
    id: 'utah',
    name: 'University of Utah Spencer Fox Eccles School of Medicine',
    short: 'Utah',
    url: 'https://medicine.utah.edu/programs/md/admissions/requirements',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'no', note: 'AP, IB and CLEP don’t count, except AP Chemistry with a 4 or 5, which covers one semester of general chemistry if it’s on your transcript.' },
    reqs: [
      req('genchem', 'General chemistry series, two courses', ['genchem'], 2, { ap: 'counts', apMinScore: 4, apMaxSem: 1 }),
      req('orgo', 'Organic chemistry series, two courses', ['orgo'], 2),
      req('physics', 'Physics, two courses', ['physics'], 2),
      req('bio', 'Biology, two courses (one in cell biology or biochemistry)', ['bio', 'biochem'], 2),
      req('writing', 'Writing / speech, two courses', ['writing'], 2),
      req('behavioral', 'Social science, one course', ['behavioral'], 1),
    ],
    notes: ['Also one humanities course (not checked). Labs are needed only where the course requires one. One course can’t meet two requirements.'],
  },
  {
    id: 'case',
    name: 'Case Western Reserve University School of Medicine',
    short: 'Case Western',
    url: 'https://case.edu/medicine/md/admission/admission-requirements',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'unstated', note: 'AP/IB is accepted for general chemistry and calculus/statistics, not for organic chemistry, writing or advanced biology. Biochemistry isn’t addressed.' },
    reqs: [
      req('genchem', 'General chemistry, two semesters with two of lab', ['genchem'], 2, { lab: true, ap: 'counts' }),
      req('orgo', 'Organic chemistry, one semester with lab', ['orgo'], 1, { lab: true, ap: 'no' }),
      req('biochem', 'Biochemistry including metabolism, one semester', ['biochem'], 1),
      req('writing', 'Writing / college English, one semester', ['writing'], 1, { ap: 'no' }),
      req('bio', 'Advanced biology or a biology subfield, one semester', ['bio'], 1, { upper: true }),
      req('math', 'Calculus or statistics, two semesters', ['calc', 'stats'], 2, { ap: 'counts' }),
      rec('physics', 'Physics', ['physics'], 1),
      rec('behavioral', 'Social and behavioral sciences', ['behavioral'], 1),
    ],
    notes: ['Successful applicants typically have 40+ science credit hours (non-science majors) or 55+ (science majors). Cell biology and biostatistics recommended.'],
  },
  {
    id: 'bu',
    name: 'Boston University Chobanian & Avedisian School of Medicine',
    short: 'BU',
    url: 'https://www.bumc.bu.edu/camed/admissions/application-process/requirements/',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'advanced', note: 'BU prefers college courses to AP credit. If you placed out of a required course, another course in that discipline at the same or higher level is accepted.' },
    reqs: [
      req('writing', 'English composition or writing-intensive, one year', ['writing'], 2),
      req('bio', 'Biological science with lab, one year', ['bio'], 2, { lab: true }),
      req('chem', 'Chemistry with lab, at least two years incl. organic and a semester of biochemistry', ['genchem', 'orgo', 'biochem'], 4, { lab: true, min: { orgo: 1, biochem: 1 } }),
      req('physics', 'Physics, one year', ['physics'], 2),
      rec('stats', 'Mathematics, particularly statistics', ['stats', 'calc'], 1),
      rec('behavioral', 'Social and behavioral sciences', ['behavioral'], 1),
    ],
    notes: ['Also a year of humanities (not checked). BU calls its requirements flexible and discourages online, pass/fail and community-college prerequisites.'],
  },
  {
    id: 'brown',
    name: 'Warren Alpert Medical School of Brown University',
    short: 'Brown',
    url: 'https://admission.med.brown.edu/apply/course-requirements',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP/IB accepted for credit by your college counts if it’s on your transcript and AMCAS, except in biology: two biology courses must be taken in college.' },
    reqs: [
      req('math', 'Calculus or statistics, one course (biostatistics preferred)', ['calc', 'stats'], 1),
      req('bio', 'Two courses covering cell biology and genetics, grade B or higher (lab required)', ['bio'], 2, { lab: true, ap: 'no' }),
      req('genchem', 'General (inorganic) chemistry, two courses (lab required)', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry, one course (lab required)', ['orgo'], 1, { lab: true }),
      req('biochem', 'Biochemistry, one course (lab encouraged)', ['biochem'], 1),
      req('physics', 'Physics, a two-course sequence', ['physics'], 2),
    ],
    notes: ['No writing course is required, but strong writing is expected. Most prerequisites must be within the previous 10 years.'],
  },
  {
    id: 'dartmouth',
    name: 'Geisel School of Medicine at Dartmouth',
    short: 'Dartmouth',
    url: 'https://geiselmed.dartmouth.edu/admissions/applying/admissions-requirements/',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'The FAQ says AP credit on an official college transcript can be used toward the premedical requirements.' },
    reqs: [
      req('physics', 'Physics, one year (8 credit hours)', ['physics'], 2),
      req('bio', 'Biology, one year (8 credit hours; any level)', ['bio'], 2),
      req('chem', 'Chemistry: a semester each of organic and biochemistry, plus a year of any chemistry', ['genchem', 'orgo', 'biochem'], 4, { min: { orgo: 1, biochem: 1 } }),
      req('math', 'College mathematics, half a year, including calculus or statistics', ['calc', 'stats'], 1),
    ],
    notes: ['The course list is published as an image; this follows its alt text. Prerequisites must be taken for a grade (no pass/fail).'],
  },
  {
    id: 'rochester',
    name: 'University of Rochester School of Medicine and Dentistry',
    short: 'Rochester',
    url: 'https://www.urmc.rochester.edu/education/md/admissions/apply',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'unstated', note: 'AP can cover one semester of physics and the calculus/statistics requirement, but never biology (take upper-level biology with lab instead) or non-science requirements. It must be on an official transcript.' },
    reqs: [
      req('bio', 'Biology with lab, one year (biochemistry doesn’t count)', ['bio'], 2, { lab: true, ap: 'no' }),
      req('physics', 'Physics with lab, one year', ['physics'], 2, { lab: true, ap: 'counts', apMaxSem: 1 }),
      req('orgo', 'Organic chemistry with lab, one semester', ['orgo'], 1, { lab: true }),
      req('biochem', 'Biochemistry, one semester (lab optional)', ['biochem'], 1),
      req('math', 'Calculus or statistics, one semester', ['calc', 'stats'], 1, { ap: 'counts' }),
      req('writing', 'Expository writing, one year (English or writing-heavy non-science courses)', ['writing'], 2, { ap: 'no' }),
    ],
    notes: ['Also 12 credit hours of humanities and/or social or behavioral sciences (not checked). Genetics and physiology recommended.'],
  },
  {
    id: 'iowa',
    name: 'University of Iowa Carver College of Medicine',
    short: 'Iowa',
    url: 'https://md.medicine.uiowa.edu/admissions/application-process/requirements',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP/CLEP coursework may satisfy course requirements if it’s listed on a college transcript.' },
    reqs: [
      req('bio', 'Introductory biology with labs, two semesters', ['bio'], 2, { lab: true }),
      req('bioadv', 'Advanced biology, one course (e.g. cell biology, physiology, genetics, microbiology)', ['bio'], 1, { upper: true }),
      req('chem', 'Introductory chemistry, three semesters incl. general and organic with labs', ['genchem', 'orgo'], 3, { lab: true, min: { genchem: 1, orgo: 1 } }),
      req('physics', 'Introductory physics with labs, two semesters', ['physics'], 2, { lab: true }),
      req('biochem', 'Biochemistry, one comprehensive course', ['biochem'], 1),
      req('writing', 'English, two courses (composition and literature)', ['writing'], 2),
      req('math', 'Advanced mathematics or statistics, one course', ['calc', 'stats'], 1),
    ],
    notes: ['Also four social/behavioral science or humanities courses (not checked). Community college and accredited online coursework accepted.'],
  },
  {
    id: 'minnesota',
    name: 'University of Minnesota Medical School',
    short: 'Minnesota',
    url: 'https://med.umn.edu/admissions/prepare-apply/prerequisites',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'no', note: 'Prerequisites can’t be fulfilled with AP, CLEP or IB credit.' },
    reqs: [
      req('bio', 'Biology with lab, one semester', ['bio'], 1, { lab: true }),
      req('chem', 'General or organic chemistry with lab, one semester', ['genchem', 'orgo'], 1, { lab: true }),
      req('science', 'Six science courses in all, including the biology and chemistry above', ['bio', 'genchem', 'orgo', 'biochem', 'physics'], 6),
      req('upper', 'Two of them upper-level, at a four-year college', ['bio', 'genchem', 'orgo', 'biochem', 'physics'], 2, { upper: true }),
    ],
    notes: ['Seven courses in all; the seventh is an upper-level humanities or social science course (not checked). Labs must be in person.'],
  },
  {
    id: 'wisconsin',
    name: 'University of Wisconsin School of Medicine and Public Health',
    short: 'Wisconsin',
    url: 'https://www.med.wisc.edu/education/md-program/admissions/premedical-requirements-selection-criteria/',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP, IB and CLEP can meet general biology, general chemistry, physics and statistics if your transcript names the course subject. Not the writing requirement.' },
    reqs: [
      req('bio', 'General biology with lab (8 credits)', ['bio'], 2, { lab: true }),
      req('genchem', 'General chemistry with lab (8 credits)', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry (3 credits)', ['orgo'], 1),
      req('biochem', 'Biochemistry (3 credits)', ['biochem'], 1),
      req('physics', 'Physics with lab (8 credits)', ['physics'], 2, { lab: true }),
      req('stats', 'Statistics or equivalent (3 credits)', ['stats'], 1),
      req('writing', 'Intensive-writing humanities or social science course (3 credits)', ['writing'], 1, { ap: 'no' }),
    ],
    notes: ['Science courses should be at the level for science or engineering majors. Minimum cumulative GPA 3.0.'],
  },
  {
    id: 'iu',
    name: 'Indiana University School of Medicine',
    short: 'Indiana',
    url: 'https://medicine.iu.edu/md/admissions/application-requirements',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'unstated', note: 'The FAQ says the committee accepts “some” AP credit without saying which, and strongly recommends prerequisites at a four-year university.' },
    reqs: [
      req('genchem', 'General chemistry with lab, one year', ['genchem'], 2, { lab: true }),
      req('orgo', 'Organic chemistry with lab, one year', ['orgo'], 2, { lab: true }),
      req('physics', 'Physics with lab, one year', ['physics'], 2, { lab: true }),
      req('bio', 'Biology with lab, one year', ['bio'], 2, { lab: true }),
      req('biochem', 'Biochemistry, one semester', ['biochem'], 1),
    ],
    notes: ['90 credit hours from a U.S. or Canadian institution required. Pass/satisfactory grades accepted. AP policy from https://medicine.iu.edu/md/admissions/application-requirements/faq.'],
  },
  {
    id: 'uab',
    name: 'UAB Heersink School of Medicine',
    short: 'UAB',
    url: 'https://www.uab.edu/medicine/home/admissions/selection-criteria',
    checked: CHECKED,
    model: 'prerequisites',
    ap: { rule: 'counts', note: 'AP/CLEP counts if college credit for the course is on your transcript. With AP biology, take 8 more hours of advanced biology; with AP math or statistics, 3 more hours of advanced math or statistics.' },
    reqs: [
      req('bio', 'General biology with lab (8 semester hours)', ['bio'], 2, { lab: true, ap: 'advanced' }),
      req('biochem', 'Biochemistry (3 semester hours; meets the chemistry requirement)', ['biochem'], 1),
      req('physics', 'General physics with lab (8 semester hours)', ['physics'], 2, { lab: true }),
      req('math', 'Biostatistics / statistics (3 hours) or college math (6 hours)', ['stats', 'calc'], 1, { ap: 'advanced' }),
      req('writing', 'English, composition or writing-intensive (6 semester hours)', ['writing'], 2),
      req('behavioral', 'Behavioral and social sciences (3 semester hours)', ['behavioral'], 1),
    ],
    notes: ['Grade of C or better. 90 undergraduate hours. AAMC PREview required. Strong preference for Alabama residents.'],
  },
];

export const MED_SCHOOL_BY_ID: Record<string, MedSchool> = Object.fromEntries(MED_SCHOOLS.map((s) => [s.id, s]));
export const DEFAULT_MED_SCHOOLS = ['jhu-advising', 'jhu-som', 'harvard'];

// ── Mapping JHU courses onto areas ─────────────────────────────────────────

const BIOCHEM = ['AS.020.305', 'AS.250.315', 'AS.250.316'];
const BIOCHEM_LABS = ['AS.020.315', 'AS.250.253'];
const BIO_LABS = ['AS.020.153', 'AS.020.154', 'AS.020.316', 'AS.020.340', 'AS.020.377'];
const GENCHEM = ['AS.030.101', 'AS.030.102', 'AS.030.103'];
const GENCHEM_LABS = ['AS.030.105', 'AS.030.106'];
const ORGO = ['AS.030.205', 'AS.030.206', 'AS.030.212'];
const ORGO_LABS = ['AS.030.225', 'AS.030.227', 'AS.030.228'];
const STATS = ['AS.280.345', 'EN.553.111', 'EN.553.211', 'EN.553.310', 'EN.553.311'];

export interface AreaHit {
  area: Area;
  lecture: boolean;
  lab: boolean;
}

/** Which areas a course counts toward, as a lecture and/or a lab (this planner's mapping; verify). */
export function areasOf(r: Resolved): AreaHit[] {
  const c = r.code;
  const hits: AreaHit[] = [];
  const add = (area: Area, lecture: boolean, lab: boolean) => hits.push({ area, lecture, lab });
  if (BIOCHEM.includes(c)) add('biochem', true, false);
  else if (BIOCHEM_LABS.includes(c)) add('biochem', false, true);
  else if (BIO_LABS.includes(c)) add('bio', false, true);
  else if (GENCHEM.includes(c)) add('genchem', true, c === 'AS.030.103');
  else if (GENCHEM_LABS.includes(c)) add('genchem', false, true);
  else if (ORGO.includes(c)) add('orgo', true, false);
  else if (ORGO_LABS.includes(c)) add('orgo', false, true);
  else if (deptOf(c) === 'AS.020' || deptOf(c) === 'AS.250') {
    const lab = /\blab(oratory)?\b/i.test(r.title) && r.credits <= 2;
    add('bio', !lab, lab);
  } else if (deptOf(c) === 'AS.171') add('physics', true, false);
  else if (deptOf(c) === 'AS.173') add('physics', false, true);
  else if (deptOf(c) === 'AS.110' && numOf(c) >= 106) add('calc', true, false);
  else if (STATS.includes(c)) add('stats', true, false);
  if (deptOf(c) === 'AS.200' || deptOf(c) === 'AS.230') add('behavioral', true, false);
  if (r.course?.writingIntensive || /^AS\.(060|220)\./.test(c)) add('writing', true, false);
  return hits;
}

/** A college course beyond the intro level in an area, for "AP counts with an advanced course" rules. */
function isAdvanced(area: Area, r: Resolved, examCodes: Set<string>): boolean {
  if (r.season === 'PRE') return false;
  const n = numOf(r.code);
  const hit = areasOf(r).find((h) => h.lecture);
  switch (area) {
    case 'bio':
      return hit?.area === 'bio' && n >= 200;
    case 'genchem':
      return hit?.area === 'orgo' || hit?.area === 'biochem' || (deptOf(r.code) === 'AS.030' && n >= 200);
    case 'orgo':
      return hit?.area === 'biochem' || (deptOf(r.code) === 'AS.030' && n >= 300);
    case 'physics':
      return deptOf(r.code) === 'AS.171' && n >= 200;
    default: {
      // Calculus, statistics: a college course numbered above every exam course in the area.
      const top = Math.max(...[...examCodes].filter((c) => areasOf({ code: c, title: '', credits: 0 } as Resolved).some((h) => h.area === area)).map(numOf));
      return hit?.area === area && n > top;
    }
  }
}

// ── Evaluation ─────────────────────────────────────────────────────────────

export type SchoolStatus = 'met' | 'partial' | 'missing' | 'check';

export interface SchoolReqResult {
  req: SchoolReq;
  status: SchoolStatus;
  /** Courses counted, college and exam. */
  items: Resolved[];
  detail?: string;
}

export interface SchoolResult {
  school: MedSchool;
  reqs: SchoolReqResult[];
  required: number;
  requiredMet: number;
  checks: number;
}

export type ApVerdict = 'counts' | 'advanced' | 'no' | 'unstated' | 'score' | 'forfeited' | 'not-required';

const AP_WHY: Record<Exclude<ApVerdict, 'counts'>, string> = {
  advanced: 'counts only after an advanced college course in the subject',
  no: 'doesn’t accept AP here',
  unstated: 'doesn’t say whether AP counts',
  score: 'needs a higher AP score',
  forfeited: 'credit is forfeited at JHU',
  'not-required': 'no requirement in this area',
};

function ruleFor(school: MedSchool, req: SchoolReq): ApRule {
  return req.ap ?? school.ap.rule;
}

/** How a school treats one exam-lane course. */
export function apVerdict(school: MedSchool, exam: Resolved, all: Resolved[], forfeited: Set<string>): ApVerdict {
  if (forfeited.has(exam.item.id)) return 'forfeited';
  const hit = areasOf(exam).find((h) => h.lecture);
  if (!hit) return 'not-required';
  const req = school.reqs.find((q) => q.areas.includes(hit.area) && !q.labsOnly);
  if (!req) return 'not-required';
  if (req.upper) return 'no';
  const minScore = req.apMinScore ?? school.ap.minScore;
  if (minScore && exam.item.score && exam.item.score < minScore) return 'score';
  const rule = ruleFor(school, req);
  if (rule === 'advanced') {
    const examCodes = new Set(all.filter((r) => r.season === 'PRE').map((r) => r.code));
    return all.some((r) => isAdvanced(hit.area, r, examCodes)) ? 'counts' : 'advanced';
  }
  return rule;
}

export function evaluateSchool(school: MedSchool, all: Resolved[]): SchoolResult {
  const forfeited = new Set(forfeits(all.map((r) => r.item)).map((f) => f.item.id));
  const usable = all.filter((r) => !forfeited.has(r.item.id));
  let apCredits = 0;
  const reqs = school.reqs.map((q): SchoolReqResult => {
    const inArea = (r: Resolved) => areasOf(r).filter((h) => q.areas.includes(h.area) && (q.labsOnly ? h.lab : h.lecture));
    const college = usable.filter((r) => r.season !== 'PRE' && inArea(r).length && (!q.upper || numOf(r.code) >= 200));
    const exams = q.upper ? [] : usable.filter((r) => r.season === 'PRE' && inArea(r).length);
    const counted: Resolved[] = [];
    const pending: Resolved[] = [];
    const unknown: Resolved[] = [];
    const max = q.apMaxSem ?? Infinity;
    let limit = '';
    for (const e of exams) {
      const v = apVerdict(school, e, usable, forfeited);
      const capped = school.ap.maxCredits !== undefined && apCredits + e.credits > school.ap.maxCredits;
      if (v === 'counts' && counted.length < max && !capped) {
        counted.push(e);
        apCredits += e.credits;
      } else if (v === 'counts')
        limit = capped ? `over the school’s ${school.ap.maxCredits}-credit AP limit` : `the school counts at most ${max} AP ${max === 1 ? 'semester' : 'semesters'} here`;
      else if (v === 'advanced') pending.push(e);
      else if (v === 'unstated') unknown.push(e);
    }
    const items = [...college, ...counted];
    const n = items.length;
    const per = (area: Area) => items.filter((r) => inArea(r).some((h) => h.area === area)).length;
    const short = Object.entries(q.min ?? {}).filter(([a, k]) => per(a as Area) < (k ?? 0)).map(([a]) => AREA_LABEL[a as Area].toLowerCase());
    const hasLab = usable.some((r) => r.season !== 'PRE' && areasOf(r).some((h) => q.areas.includes(h.area) && h.lab));
    const label = q.areas.map((a) => AREA_LABEL[a].toLowerCase()).join(' / ');

    if (n >= q.sem && !short.length) {
      if (q.lab && !hasLab)
        return { req: q, status: 'check', items, detail: counted.length ? 'Needs lab work at college: JHU waives labs for AP credit but gives no credit for them.' : `Needs a college lab in ${label}.` };
      return { req: q, status: 'met', items };
    }
    const need = q.sem - n;
    const also = short.length ? ` Needs at least one ${short.join(' and one ')} course.` : '';
    if (pending.length && n + pending.length >= q.sem)
      return { req: q, status: 'partial', items, detail: `Your AP credit counts here once you take an advanced college course in ${label}.${also}` };
    if (unknown.length && n + unknown.length >= q.sem)
      return { req: q, status: 'check', items, detail: `The school doesn’t say whether your AP credit counts; ask, or plan ${need} more college ${need === 1 ? 'course' : 'courses'}.${also}` };
    const skipped = exams.filter((e) => !counted.includes(e) && !pending.includes(e) && !unknown.includes(e));
    const why = (e: Resolved) => {
      const v = apVerdict(school, e, usable, forfeited);
      return v === 'counts' ? limit : AP_WHY[v];
    };
    const apNote = skipped.length ? ` More AP credit doesn’t count here (${why(skipped[0])}).` : '';
    const detail = need > 0 ? `${n} of ${q.sem} semesters.${apNote}${also}` : also.trim();
    return { req: q, status: n ? 'partial' : 'missing', items, detail };
  });
  const required = reqs.filter((r) => r.req.level === 'required');
  return { school, reqs, required: required.length, requiredMet: required.filter((r) => r.status === 'met').length, checks: required.filter((r) => r.status === 'check').length };
}

export function verdictLabel(v: ApVerdict) {
  return v === 'counts' ? 'counts' : AP_WHY[v];
}
