/**
 * Pulls live course data from the JHU SIS Course Search API into the planner.
 *
 *   npm run sync-sis                 # every course code in the planner's catalog and majors
 *   npm run sync-sis -- AS.389.201   # plus any extra codes (e.g. ones in your plan)
 *
 * Needs JHU_SIS_API_KEY in .env (see .env.example). The key goes in the request URL, so
 * this runs only here, never in the browser, and URLs are never logged. Responses are
 * cached in scripts/.sis-cache/ (7 days, or SIS_CACHE_DAYS), except that a newly posted term
 * (seen on a few always-offered courses) refreshes everything. Requests are spaced out to stay polite.
 * The weekly GitHub Action (.github/workflows/sync-sis.yml) runs this with the key stored
 * as a repository secret, so the public site gets SIS data without the key being shared.
 * Output: src/planner/sisCourses.json (public course data, safe to commit), which the
 * app merges over its seed catalog.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { summarize, type SisSection } from '../src/planner/sis.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(root, 'scripts/.sis-cache');
const OUT = join(root, 'src/planner/sisCourses.json');
// How long a cached response is reused (the weekly GitHub Action uses 28 days to spread the load).
const MAX_AGE = Number(process.env.SIS_CACHE_DAYS ?? 7) * 864e5;
const GAP_MS = 600; // ≤ 2 requests per second

try {
  process.loadEnvFile(join(root, '.env'));
} catch {
  // No .env: fall back to the environment.
}
const KEY = process.env.JHU_SIS_API_KEY;
if (!KEY) {
  console.error('Set JHU_SIS_API_KEY in .env (copy .env.example) to sync course data from SIS.');
  process.exit(1);
}

/** Every real course code the planner mentions, including all imported majors' courses. */
function plannerCodes(): string[] {
  const text = ['src/planner/catalog.ts', 'src/planner/majors.ts', 'src/planner/catalogueData.json'].map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
  // Literal codes, plus the AS.171.${n} physics variants built in a loop.
  const codes = new Set(text.match(/\b(?:AS|EN)\.\d{3}\.\d{3}\b/g) ?? []);
  for (const n of ['101', '102', '103', '104', '105', '106', '107', '108']) codes.add(`AS.171.${n}`);
  return [...codes].sort();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let maxAge = MAX_AGE;

async function fetchCourse(code: string, fresh = false): Promise<SisSection[] | null> {
  const file = join(CACHE, `${code}.json`);
  if (!fresh && existsSync(file) && Date.now() - statSync(file).mtimeMs < maxAge) return JSON.parse(readFileSync(file, 'utf8'));
  await sleep(GAP_MS);
  const res = await fetch(`https://sis.jhu.edu/api/classes/${encodeURIComponent(code)}?key=${encodeURIComponent(KEY!)}`);
  if (!res.ok) {
    console.warn(`${code}: SIS returned ${res.status}`);
    return null;
  }
  const data = (await res.json()) as SisSection[];
  writeFileSync(file, JSON.stringify(data));
  return data;
}

mkdirSync(CACHE, { recursive: true });
const codes = [...new Set([...plannerCodes(), ...process.argv.slice(2).map((c) => c.toUpperCase())])];
console.log(`Syncing ${codes.length} courses from SIS…`);

// Start from the last sync so a course SIS doesn't return this time keeps its data.
const prevFile = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as { courses: { code: string; offered?: string[] }[]; terms?: string[] }) : { courses: [] };
const previous = prevFile.courses;
const knownTerms = new Set(prevFile.terms ?? []);

// Big courses that run every semester: always fetched fresh. If they show a term SIS hadn't
// posted at the last sync (e.g. Spring 2028 just went up), every cached course is refetched.
const CANARIES = ['AS.030.101', 'AS.030.102', 'AS.110.108', 'AS.110.109', 'AS.020.151', 'AS.171.101', 'EN.553.211', 'AS.280.101'];
const newTerms = new Set<string>();
for (const code of CANARIES) for (const s of (await fetchCourse(code, true)) ?? []) if (!knownTerms.has(s.Term)) newTerms.add(s.Term);
if (knownTerms.size && newTerms.size) {
  console.log(`New in SIS since the last sync: ${[...newTerms].join(', ')}. Refreshing every course.`);
  maxAge = 0;
}

const byCode = new Map<string, { code: string }>(previous.map((c) => [c.code, c]));
let missing = 0;
for (const code of codes) {
  const sections = await fetchCourse(code);
  if (!sections?.length) {
    missing++;
    continue;
  }
  byCode.set(code, summarize(code, sections, new Date()));
}

const today = new Date().toISOString().slice(0, 10);
const courses = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
// Every term with a section in any synced course: the schedules SIS has posted.
const terms = [...new Set([...knownTerms, ...courses.flatMap((c) => (c as { offered?: string[] }).offered ?? [])])].sort();
writeFileSync(OUT, `${JSON.stringify({ syncedAt: today, terms, courses }, null, 2)}\n`);
console.log(`Wrote ${courses.length} courses to src/planner/sisCourses.json (${missing} not found in SIS).`);
