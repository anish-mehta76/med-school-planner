/**
 * Pulls live course data from the JHU SIS Course Search API into the planner.
 *
 *   npm run sync-sis                 # every course code in the planner's catalog and majors
 *   npm run sync-sis -- AS.389.201   # plus any extra codes (e.g. ones in your plan)
 *
 * Needs JHU_SIS_API_KEY in .env (see .env.example). The key goes in the request URL, so
 * this runs only here, never in the browser, and URLs are never logged. Responses are
 * cached in scripts/.sis-cache/ for a week; requests are spaced out to stay polite.
 * Output: src/planner/sisCourses.json (public course data, safe to commit), which the
 * app merges over its seed catalog.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { summarize, type SisSection } from './sis.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(root, 'scripts/.sis-cache');
const OUT = join(root, 'src/planner/sisCourses.json');
const WEEK = 7 * 24 * 3600 * 1000;
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

/** Every real course code the planner mentions. */
function plannerCodes(): string[] {
  const text = ['src/planner/catalog.ts', 'src/planner/majors.ts'].map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
  // Literal codes, plus the AS.171.${n} physics variants built in a loop.
  const codes = new Set(text.match(/\b(?:AS|EN)\.\d{3}\.\d{3}\b/g) ?? []);
  for (const n of ['101', '102', '103', '104', '105', '106', '107', '108']) codes.add(`AS.171.${n}`);
  return [...codes].sort();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchCourse(code: string): Promise<SisSection[] | null> {
  const file = join(CACHE, `${code}.json`);
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < WEEK) return JSON.parse(readFileSync(file, 'utf8'));
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

const courses = [];
let missing = 0;
for (const code of codes) {
  const sections = await fetchCourse(code);
  if (!sections?.length) {
    missing++;
    continue;
  }
  courses.push(summarize(code, sections, new Date()));
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(OUT, `${JSON.stringify({ syncedAt: today, courses }, null, 2)}\n`);
console.log(`Wrote ${courses.length} courses to src/planner/sisCourses.json (${missing} not found in SIS).`);
