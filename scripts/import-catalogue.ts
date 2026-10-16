/**
 * Imports every KSAS and WSE bachelor's major from the JHU e-catalogue.
 *
 *   npm run import-catalogue
 *
 * Writes src/planner/catalogueData.json: each major's requirements (course rows,
 * "or" alternatives, "Select N" groups) and the titles/credits of every course
 * they list. Text-only rules become notes to check by hand. Pages are cached in
 * scripts/.catalogue-cache/ for a week and fetched one at a time.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseProgram, programLinks, type CatCourses, type CatMajor } from './catalogue.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(root, 'scripts/.catalogue-cache');
const BASE = 'https://e-catalogue.jhu.edu';
const SCHOOLS = [
  { school: 'KSAS' as const, prefix: '/arts-sciences/full-time-residential-programs/degree-programs/' },
  { school: 'WSE' as const, prefix: '/engineering/full-time-residential-programs/degree-programs/' },
];

async function get(path: string): Promise<string> {
  const file = join(CACHE, `${path.replace(/[^a-z0-9]+/gi, '_')}.html`);
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < 7 * 864e5) return readFileSync(file, 'utf8');
  await new Promise((r) => setTimeout(r, 400));
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  const html = await res.text();
  writeFileSync(file, html);
  return html;
}

mkdirSync(CACHE, { recursive: true });
const majors: CatMajor[] = [];
const courses: CatCourses = {};
for (const { school, prefix } of SCHOOLS) {
  const links = programLinks(await get(prefix), prefix);
  console.log(`${school}: ${links.length} programs`);
  for (const url of links) {
    const parsed = parseProgram(await get(url), url, school);
    if (!parsed) {
      console.warn(`  no requirement table: ${url}`);
      continue;
    }
    majors.push(parsed.major);
    for (const [code, v] of Object.entries(parsed.courses)) if (!courses[code] || (courses[code][1] === null && v[1] !== null)) courses[code] = v;
  }
}

const out = { importedAt: new Date().toISOString().slice(0, 10), source: BASE, majors, courses };
writeFileSync(join(root, 'src/planner/catalogueData.json'), `${JSON.stringify(out)}\n`);
const reqs = majors.flatMap((m) => m.requirements);
console.log(`Wrote ${majors.length} majors, ${Object.keys(courses).length} courses; requirements: ${reqs.filter((r) => r.type !== 'note').length} checkable, ${reqs.filter((r) => r.type === 'note').length} notes.`);
