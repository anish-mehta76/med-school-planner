/**
 * Parses JHU e-catalogue (Courseleaf) program pages into planner requirements
 * (used by import-catalogue.ts). Course-list rows become requirements:
 *   - a course row (codes joined by "&" must all be taken) → one "set" requirement;
 *     following "or" rows add alternatives
 *   - "Select two … of the following:" + the course rows under it → "pick" n
 *   - "Select three … from Table 2" → "pick" n from the page's second reference table
 *   - any other text row → a note to check by hand
 */

export interface CatReq {
  type: 'set' | 'pick' | 'note';
  key: string;
  label: string;
  section?: string;
  options?: string[][];
  n?: number;
  from?: string[];
}

export interface CatMajor {
  id: string;
  name: string;
  degree: 'BA' | 'BS';
  school: 'KSAS' | 'WSE';
  sourceUrl: string;
  totalLabel: string;
  requirements: CatReq[];
}

export type CatCourses = Record<string, [title: string, credits: number | null]>;

const decode = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;|&mdash;/g, '–')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

/** "Select two Biology Lecture Courses of the following" → 2; "Select three … from Table 2" → 3. */
export function selectCount(text: string): number | null {
  const m = text.match(/\b(?:select|choose|complete|take)\s+(?:at least\s+|any\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i);
  if (!m) return null;
  return /^\d+$/.test(m[1]) ? Number(m[1]) : WORDS[m[1].toLowerCase()];
}

/** Strips footnote numbers and trailing credits from a comment row. */
const cleanLabel = (t: string) => t.replace(/(\s+\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)+\s*$/, '').replace(/[:\s]+$/, '');

interface Row {
  cls: string;
  codes: string[];
  title: string;
  credits: number | null;
  text: string;
  comment: boolean;
  indent: boolean;
}

function rows(table: string): Row[] {
  return [...table.matchAll(/<tr[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/g)]
    .filter(([, cls]) => !cls.includes('noscript'))
    .map(([, cls, raw]) => {
      // Footnote markers are <sup> numbers; drop them so titles read cleanly.
      const body = raw.replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, '');
      const tds = [...body.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
      const codeCell = body.match(/<td class="codecol[^"]*">([\s\S]*?)<\/td>/)?.[1] ?? '';
      const codes = [...codeCell.matchAll(/class="bubblelink code"[^>]*>([^<]+)</g)].map((m) => decode(m[1]).replace(/\s+/g, ''));
      const hours = body.match(/<td class="hourscol">([\s\S]*?)<\/td>/)?.[1] ?? '';
      const cr = Number.parseFloat(decode(hours));
      return {
        cls,
        codes,
        title: decode(tds[1] ?? '').replace(/^or\s+/i, ''),
        credits: Number.isFinite(cr) ? cr : null,
        text: decode(body),
        comment: body.includes('courselistcomment') && !codes.length,
        indent: /^\s*<div[^>]*class="blockindent"/.test(codeCell),
      };
    });
}

export function parseProgram(html: string, url: string, school: 'KSAS' | 'WSE'): { major: CatMajor; courses: CatCourses } | null {
  // KSAS uses #requirementstextcontainer; WSE prefixes the entry year (#twozerotwofourrequirementstextcontainer).
  const reqHtml = html.match(/id="[a-z]*requirementstextcontainer"[\s\S]*?(?=<div id="[a-z]+textcontainer"|<\/main>)/)?.[0] ?? '';
  // Each table with the heading above it (WSE splits requirements into many headed tables).
  const tables: { html: string; heading?: string }[] = [];
  let heading: string | undefined;
  for (const m of reqHtml.matchAll(/<h([2-5])[^>]*>([\s\S]*?)<\/h\1>|<table[^>]*sc_courselist[^>]*>([\s\S]*?)<\/table>/g)) {
    if (m[2] !== undefined) heading = decode(m[2]);
    else tables.push({ html: m[3], heading });
  }
  if (!tables.length) return null;
  const name = decode(html.match(/<h1[^>]*class="page-title"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? html.match(/<title>([^<|]+)/)?.[1] ?? url);
  const degree = /bachelor-science/.test(url) ? 'BS' : 'BA';
  const slug = url.replace(/\/$/, '').split('/').pop()!;
  const courses: CatCourses = {};
  // KSAS pages: tables with area headers are requirements, the rest are "Table 1/2" lists they refer to.
  // WSE pages have no area headers: every table is a requirement.
  const headed = tables.some((t) => t.html.includes('areaheader'));
  const requirementTables = headed ? tables.filter((t) => t.html.includes('areaheader')) : tables;
  const referenceTables = headed ? tables.filter((t) => !t.html.includes('areaheader')).map((t) => t.html) : [];
  const reqs: CatReq[] = [];
  let section: string | undefined;
  let total = '';
  let n = 0;
  const key = () => `r${++n}`;

  for (const t of referenceTables) for (const r of rows(t)) for (const code of r.codes) courses[code] ??= [r.title, r.codes.length === 1 ? r.credits : null];
  const tableCodes = (i: number) => (referenceTables[i] ? rows(referenceTables[i]).flatMap((r) => r.codes) : []);

  for (const t of requirementTables) {
    if (!headed) section = t.heading;
    let group: CatReq | undefined;
    let groupIndented = false;
    for (const r of rows(t.html)) {
      for (const [i, code] of r.codes.entries()) if (!courses[code]) courses[code] = [i === 0 ? r.title.split(/\s+and\s+/)[0] : r.title, r.codes.length === 1 ? r.credits : null];
      if (r.cls.includes('listsum')) {
        total = r.text.replace(/^Total Credits\s*/i, '');
        continue;
      }
      if (r.cls.includes('areaheader') || r.cls.includes('areasubheader')) {
        section = cleanLabel(r.text);
        group = undefined;
        continue;
      }
      if (r.comment) {
        const count = selectCount(r.text);
        const table = r.text.match(/\bTable\s+(\d+)/i);
        if (count && table) {
          reqs.push({ type: 'pick', key: key(), label: cleanLabel(r.text), section, n: count, from: tableCodes(Number(table[1]) - 1) });
          group = undefined;
        } else if (count) {
          group = { type: 'pick', key: key(), label: cleanLabel(r.text), section, n: count, from: [] };
          reqs.push(group);
        } else {
          reqs.push({ type: 'note', key: key(), label: cleanLabel(r.text), section });
          group = undefined;
        }
        continue;
      }
      if (!r.codes.length) continue;
      const isOr = r.cls.includes('orclass');
      if (group) {
        // Choices under a "Select N" line are indented; without indents the group runs to the next text row or header.
        const first = !group.from!.length;
        if (first) groupIndented = r.indent;
        if (first || !groupIndented || r.indent) {
          group.from!.push(...r.codes);
          continue;
        }
        group = undefined;
      }
      const prev = reqs[reqs.length - 1];
      if (isOr && prev?.type === 'set') {
        prev.options!.push(r.codes);
        prev.label += ` or ${r.codes.join(' & ')}`;
        continue;
      }
      reqs.push({ type: 'set', key: key(), label: `${r.codes.join(' & ')} ${r.title}`.trim(), section, options: [r.codes] });
    }
  }

  // Pages often repeat a course in two sections (e.g. under FA2 and under Mathematics); one course fills
  // one slot within a major, so keep only the first copy of identical requirements.
  const seen = new Set<string>();
  const unique = reqs.filter((r) => {
    if (r.type === 'note') return true;
    const sig = `${r.type}:${r.n ?? ''}:${JSON.stringify((r.options ?? [r.from ?? []]).map((o) => [...o].sort()).sort())}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
  reqs.length = 0;
  reqs.push(...unique);

  // A "Select N" with no choices listed under it can't be checked automatically.
  for (const r of reqs) if (r.type === 'pick' && !r.from?.length) Object.assign(r, { type: 'note', from: undefined, n: undefined });

  return {
    major: { id: `${school.toLowerCase()}-${slug}`, name, degree, school, sourceUrl: `https://e-catalogue.jhu.edu${url}`, totalLabel: total ? `${total} credits` : 'see catalogue', requirements: reqs },
    courses,
  };
}

/** Bachelor's program links on a school's degree-programs index (no combined BA/MA programs). */
export function programLinks(indexHtml: string, prefix: string): string[] {
  const re = new RegExp(`href="(${prefix.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}[^"#?]+/)"`, 'g');
  return [...new Set([...indexHtml.matchAll(re)].map((m) => m[1]))].filter((u) => /-bachelor-(arts|science)\/$/.test(u)).sort();
}
