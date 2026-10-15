/**
 * Read-only PubMed check of the Start-priority mentors in the uterine/cervical tracker.
 *
 *   npm run verify-pubmed            # writes reports/YYYY-MM-DD-verify-pubmed.md
 *   npm run verify-pubmed -- --update-csv   # also updates the verification date + evidence gate cells,
 *                                           # after backing the CSV up to reports/backups/<name>-YYYY-MM-DD.csv
 *
 * Uses NCBI E-utilities (esearch, efetch) and the PMC ID converter. Contacts no one.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Papa from 'papaparse';
import { findJournal, TIER_LABELS } from '../src/data/journalTiers.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = 'uterine-cervical-cancer-opportunities-tracker.csv';
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const FROM = 2022;
const TO = 2026;
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
/** Locations from CLAUDE.md rules 4 and 5. */
const REPORT = `reports/${today}-verify-pubmed.md`;
const BACKUP = `reports/backups/${CSV.replace(/\.csv$/, '')}-${today}.csv`;

/**
 * PubMed author queries live in private/pubmed-queries.ts (git-ignored), since they name the researchers.
 * Full-author-name [FAU] where possible; common names are narrowed by affiliation, and each hit is
 * re-checked against the matched author's own affiliation.
 * `trusted`: a full first name that identifies the person without also checking affiliation.
 */
export interface AuthorQuery {
  query: string;
  last: string;
  first: RegExp;
  affiliation?: RegExp;
  trusted?: RegExp;
}
const QUERIES_FILE = join(root, 'private/pubmed-queries.ts');
if (!existsSync(QUERIES_FILE)) {
  console.error('Missing private/pubmed-queries.ts (local-only researcher queries).');
  process.exit(1);
}
const { QUERIES } = (await import(pathToFileURL(QUERIES_FILE).href)) as { QUERIES: Record<string, AuthorQuery> };

const LARGE = /cohort|consorti|randomi[sz]ed|\bclinical trials?\b|phase (I|II|III|1|2|3)\b|biobank|registry|SEER|National Cancer Database|NCDB|characteri[sz]|sequencing|genome-wide|GWAS|population-based|multi-?cent(er|re)|multi-?institution|pooled|meta-analys|TCGA|whole-exome|whole-genome/i;
const DISEASE = /endometri|uterine|uterus|cervi|HPV|papillomavirus/i;
const TRAINEE = /undergraduate|Krieger School|Homewood|post-?bac|Summer (Internship|Research)|Training Award|Prevention Fellowship|\bstudents?\b|Medical Student/i;

interface Author {
  last: string;
  fore: string;
  affiliations: string[];
}
interface Paper {
  pmid: string;
  title: string;
  journal: string;
  iso: string;
  year?: number;
  types: string[];
  abstract: string;
  authors: Author[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(path: string, params: Record<string, string>): Promise<string> {
  const url = `${EUTILS}${path}?${new URLSearchParams({ ...params, tool: 'med-school-planner' })}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.text();
    await sleep(1500);
  }
  throw new Error(`Request failed: ${url}`);
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1];
const tags = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => m[1]);

function parseArticles(xml: string): Paper[] {
  return tags(xml, 'PubmedArticle').map((a) => {
    const year = Number(tag(a, 'PubDate')?.match(/(19|20)\d\d/)?.[0]) || undefined;
    return {
      pmid: decode(tag(a, 'PMID') ?? ''),
      title: decode(tag(a, 'ArticleTitle') ?? ''),
      journal: decode(tag(tag(a, 'Journal') ?? '', 'Title') ?? ''),
      iso: decode(tag(a, 'ISOAbbreviation') ?? ''),
      year,
      types: tags(a, 'PublicationType').map(decode),
      abstract: decode(tags(a, 'AbstractText').join(' ')),
      authors: tags(a, 'Author').map((au) => ({
        last: decode(tag(au, 'LastName') ?? tag(au, 'CollectiveName') ?? ''),
        fore: decode(tag(au, 'ForeName') ?? tag(au, 'Initials') ?? ''),
        affiliations: tags(au, 'Affiliation').map(decode),
      })),
    };
  });
}

async function search(query: string): Promise<string[]> {
  const term = `(${query}) AND ${FROM}:${TO}[dp]`;
  const r = JSON.parse(await get('esearch.fcgi', { db: 'pubmed', term, retmax: '1000', retmode: 'json' }));
  return r.esearchresult.idlist;
}

async function fetchPapers(pmids: string[]): Promise<Paper[]> {
  const out: Paper[] = [];
  for (let i = 0; i < pmids.length; i += 150) {
    await sleep(400);
    out.push(...parseArticles(await get('efetch.fcgi', { db: 'pubmed', id: pmids.slice(i, i + 150).join(','), retmode: 'xml' })));
  }
  return out;
}

/** Converts PMC IDs in tracker links to PMIDs so tracker publications can be matched. */
async function pmcToPmid(pmcids: string[]): Promise<Record<string, string>> {
  if (!pmcids.length) return {};
  const res = await fetch(`https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/?${new URLSearchParams({ ids: pmcids.join(','), format: 'json', tool: 'med-school-planner' })}`);
  if (!res.ok) return {};
  // The converter returns PMIDs as numbers; normalize to strings to match esearch IDs.
  const j = (await res.json()) as { records: { pmcid: string; pmid?: string | number }[] };
  return Object.fromEntries(j.records.filter((r) => r.pmid).map((r) => [r.pmcid, String(r.pmid)]));
}

function count<T>(xs: T[]) {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const pubmedLink = (pmid: string) => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
const searchLink = (q: string) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(`(${q}) AND ${FROM}:${TO}[dp]`)}`;

interface Result {
  id: string;
  name: string;
  query: string;
  total: number;
  kept: Paper[];
  dropped: number;
  positions: { first: number; last: number; middle: number };
  disease: Paper[];
  large: Paper[];
  tiered: [string, string, number][];
  journals: [string, number][];
  trainee: { paper: Paper; who: string[] }[];
  trackerPubs: { label: string; url: string; pmid?: string; found: boolean | undefined; byJournalYear?: boolean }[];
  summary: string;
}

async function verify(row: Record<string, string>): Promise<Result> {
  const id = row.ID.trim();
  const q = QUERIES[id];
  const pmids = await search(q.query);
  const papers = await fetchPapers(pmids);

  // Keep only papers where an author matches the mentor (and, for common names, their affiliation).
  const positions = { first: 0, last: 0, middle: 0 };
  const kept: Paper[] = [];
  for (const p of papers) {
    const idx = p.authors.findIndex(
      (a) =>
        a.last.toLowerCase() === q.last.toLowerCase() &&
        q.first.test(a.fore) &&
        (!q.affiliation || q.trusted?.test(a.fore) || a.affiliations.some((af) => q.affiliation!.test(af))),
    );
    if (idx < 0) continue;
    kept.push(p);
    if (idx === 0) positions.first++;
    else if (idx === p.authors.length - 1) positions.last++;
    else positions.middle++;
  }

  const journals = count(kept.map((p) => p.iso || p.journal));
  const tiered = journals
    .map(([j, n]) => {
      const t = findJournal(j) ?? findJournal(kept.find((p) => p.iso === j)?.journal ?? '');
      return t ? ([j, `${TIER_LABELS[t.tier]}${t.verified ? '' : ' (tier unverified)'}`, n] as [string, string, number]) : undefined;
    })
    .filter((x): x is [string, string, number] => !!x && !x[1].startsWith('Specialty'));
  const disease = kept.filter((p) => DISEASE.test(`${p.title} ${p.abstract}`));
  const large = kept.filter((p) => LARGE.test(`${p.title} ${p.abstract} ${p.types.join(' ')}`));
  const trainee = kept
    .map((p) => ({
      paper: p,
      who: p.authors.filter((a) => a.affiliations.some((af) => TRAINEE.test(af))).map((a) => `${a.fore} ${a.last}`),
    }))
    .filter((t) => t.who.length);

  // Tracker publications: are they in this author's PubMed results?
  const urls = [...row['Verified publication examples'].matchAll(/\(([^)\s]+)\)/g)].map((m) => m[1]);
  const pmcids = urls.map((u) => u.match(/PMC\d+/)?.[0]).filter((x): x is string => !!x);
  await sleep(400);
  const conv = await pmcToPmid(pmcids);
  const keptIds = new Set(kept.map((p) => p.pmid));
  const allIds = new Set(papers.map((p) => p.pmid));
  const trackerPubs = row['Verified publication examples']
    .split(/;\s*/)
    .filter(Boolean)
    .map((item) => {
      const url = item.match(/\((https?:[^)\s]+)\)/)?.[1] ?? '';
      const pmid = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/)?.[1] ?? conv[url.match(/PMC\d+/)?.[0] ?? ''];
      const label = item.replace(/\s*\(https?:[^)]+\)/g, '').trim();
      // Only judge papers in the search window; older ones and non-PubMed links stay "not checked".
      const year = Number(label.match(/\b(19|20)\d\d\b/)?.[0]);
      const inWindow = year >= FROM && year <= TO;
      if (pmid) return { label, url, pmid, found: inWindow ? keptIds.has(pmid) || allIds.has(pmid) : undefined };
      // No PubMed/PMC link (e.g. a profile page): match by journal + year among this author's papers.
      const journalName = label.replace(/^P\d+:\s*/, '').split(',')[0].trim();
      const want = findJournal(journalName);
      const match = inWindow
        ? kept.find((p) => p.year === year && (want ? findJournal(p.iso) === want || findJournal(p.journal) === want : p.iso === journalName || p.journal === journalName))
        : undefined;
      return { label, url, pmid: match?.pmid, found: match ? true : undefined, byJournalYear: !!match };
    });

  const summary =
    `PubMed check ${today}: ${kept.length} papers ${FROM}–${TO} (${disease.length} endometrial/cervical/HPV; ${large.length} with large-study signals; ` +
    `${positions.first} first-author, ${positions.last} senior-author). Undergraduate/trainee authorship not determinable from PubMed. See ${REPORT}.`;

  return { id, name: row.Researcher.trim(), query: q.query, total: pmids.length, kept, dropped: papers.length - kept.length, positions, disease, large, tiered, journals, trainee, trackerPubs, summary };
}

function report(results: Result[]): string {
  const lines: string[] = [];
  const L = (s = '') => lines.push(s);
  L(`# Research verification — ${today}`);
  L();
  L(`Read-only PubMed check of the ${results.length} Start-priority mentors in \`${CSV}\`. No one was contacted.`);
  L();
  L('## Method');
  L();
  L(`- Source: NCBI E-utilities (esearch + efetch) over PubMed, publication dates ${FROM}–${TO}, run ${today}. Each mentor's exact query is linked below so you can re-run it.`);
  L('- Every hit was re-checked: a paper is counted only if an author matches the mentor’s last name and first name/initial (and, for common names, an affiliation consistent with the tracker).');
  L('- “Large-study signal” = title/abstract/publication type mentions cohort, consortium, trial, biobank, registry, SEER/NCDB, characterization, sequencing, GWAS, population-based, multicenter, pooled or meta-analysis. This is a keyword screen, not a reading of each paper.');
  L('- “Disease-relevant” = title or abstract mentions endometrial/uterine or cervical/HPV.');
  L('- Journal tiers come from `src/data/journalTiers.ts`; every tier is **unverified** (no impact factors are asserted).');
  L('- **Undergraduate/trainee authorship cannot be determined from PubMed**, which does not record career stage. The only signal used is affiliation text naming an undergraduate school, summer/post-bac program, training award or “student”; it is listed where found and is weak evidence either way.');
  L();
  L('## Summary');
  L();
  L('| ID | Mentor | Papers | Disease-relevant | Large-study signal | First / senior / middle author | Flagship + high-impact (tier unverified) |');
  L('|---|---|---|---|---|---|---|');
  for (const r of results) {
    const hi = r.tiered.reduce((s, [, , n]) => s + n, 0);
    L(`| ${r.id} | ${r.name} | ${r.kept.length} | ${r.disease.length} | ${r.large.length} | ${r.positions.first} / ${r.positions.last} / ${r.positions.middle} | ${hi} |`);
  }
  L();

  const unverified: string[] = [];
  for (const r of results) {
    L(`## ${r.id} — ${r.name}`);
    L();
    L(`- Query: \`${r.query}\` — [run on PubMed](${searchLink(r.query)})`);
    L(`- ${r.total} search hits; ${r.kept.length} confirmed as this author${r.dropped ? ` (${r.dropped} dropped: name/affiliation did not match)` : ''}.`);
    L(`- By year: ${count(r.kept.map((p) => p.year ?? 0)).sort((a, b) => a[0] - b[0]).map(([y, n]) => `${y || '?'}: ${n}`).join(', ') || '—'}`);
    L(`- Author position: ${r.positions.first} first, ${r.positions.last} senior (last), ${r.positions.middle} middle.`);
    L(`- Top journals: ${r.journals.slice(0, 8).map(([j, n]) => `${j} (${n})`).join('; ') || '—'}`);
    L(`- Flagship/high-impact journals (tier unverified): ${r.tiered.map(([j, t, n]) => `${j} ×${n} [${t}]`).join('; ') || 'none in tier list'}`);
    L(`- Disease-relevant (endometrial/cervical/HPV): ${r.disease.length} of ${r.kept.length}.`);
    L(`- Large-study signal: ${r.large.length} of ${r.kept.length}. Examples:`);
    for (const p of r.large.filter((p) => DISEASE.test(`${p.title} ${p.abstract}`)).slice(0, 5)) {
      const kw = `${p.title} ${p.abstract} ${p.types.join(' ')}`.match(LARGE)?.[0];
      L(`  - [${p.title}](${pubmedLink(p.pmid)}) — ${p.iso || p.journal}, ${p.year} _(signal: “${kw}”)_`);
    }
    L(`- Trainee signals in affiliations: ${r.trainee.length ? '' : 'none found (does not mean none exist).'}`);
    for (const t of r.trainee.slice(0, 4)) L(`  - [${t.paper.title}](${pubmedLink(t.paper.pmid)}) — ${t.who.slice(0, 3).join(', ')}`);
    L('- Tracker publication examples:');
    for (const tp of r.trackerPubs) {
      const status = tp.byJournalYear
        ? '✓ matched by journal and year (tracker link is not a PubMed record; confirm it is the same paper)'
        : tp.found === true
          ? '✓ found in this author’s PubMed results' : tp.found === false ? '✗ **not found** with this author — check attribution' : 'not checked (outside 2022–2026 or not a PubMed/PMC link)';
      L(`  - ${tp.label} — ${status}${tp.pmid ? ` ([PMID ${tp.pmid}](${pubmedLink(tp.pmid)}))` : tp.url ? ` ([link](${tp.url}))` : ''}`);
      if (tp.found === false) unverified.push(`${r.id} ${r.name}: tracker example “${tp.label}” not found among this author’s PubMed records.`);
      if (tp.found === undefined) unverified.push(`${r.id} ${r.name}: tracker example “${tp.label}” not checked (outside window or not a PubMed/PMC link).`);
    }
    unverified.push(`${r.id} ${r.name}: undergraduate/trainee co-authorship — not determinable from PubMed.`);
    L();
  }

  L('## Could not verify');
  L();
  L('- Current undergraduate openings and mentoring capacity for every lab (not in PubMed; ask directly).');
  L('- Journal impact factors (none asserted; tiers in `journalTiers.ts` are unverified).');
  for (const u of unverified.filter((u) => !/trainee co-authorship/.test(u))) L(`- ${u}`);
  L(`- Undergraduate/trainee co-authorship for all ${results.length} mentors (PubMed does not record career stage).`);
  L();
  L('## Needs your decision');
  L();
  const notFound = results.flatMap((r) => r.trackerPubs.filter((tp) => tp.found === false).map((tp) => `${r.id} ${r.name}: “${tp.label}”`));
  const byJournalYear = results.flatMap((r) => r.trackerPubs.filter((tp) => tp.byJournalYear).map((tp) => `${r.id} ${r.name}: “${tp.label}”`));
  const thin = results.filter((r) => r.disease.length === 0 || r.large.length === 0);
  if (notFound.length) L(`- Fix or remove tracker publication examples not found under this author (${notFound.join('; ')}).`);
  if (byJournalYear.length) L(`- Confirm these examples matched only by journal and year are the same paper (${byJournalYear.join('; ')}).`);
  if (thin.length) L(`- Weak PubMed fit for ${thin.map((r) => `${r.id} ${r.name} (${r.disease.length} disease-relevant, ${r.large.length} large-study)`).join('; ')}: keep at Start or move down? Only you change priorities.`);
  L(process.argv.includes('--update-csv')
    ? `- The CSV's verification date and evidence-gate cells were updated for these ${results.length} rows (backup: \`${BACKUP}\`). Review the diff and keep or restore.`
    : '- Write these results into the CSV? Re-run with `--update-csv` (backs the CSV up first).');
  L();
  return lines.join('\n');
}

async function main() {
  const text = readFileSync(join(root, CSV), 'utf8').replace(/^﻿/, '');
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  const start = rows.filter((r) => r['Outreach priority'].trim() === 'Start');
  const results: Result[] = [];
  for (const row of start) {
    process.stdout.write(`${row.ID} ${row.Researcher}… `);
    const r = await verify(row);
    results.push(r);
    console.log(`${r.kept.length} papers`);
  }
  if (process.argv.includes('--update-csv')) {
    mkdirSync(join(root, 'reports/backups'), { recursive: true });
    // Keep the first backup of the day so a second run can't overwrite the pre-edit copy.
    if (!existsSync(join(root, BACKUP))) copyFileSync(join(root, CSV), join(root, BACKUP));
    const byId = new Map(results.map((r) => [r.id, r]));
    for (const row of rows) {
      const r = byId.get(row.ID.trim());
      if (!r) continue;
      row['Last research verification date'] = today;
      const gate = row['Publication evidence gate'].replace(/\s*PubMed check \d{4}-\d{2}-\d{2}:.*$/s, '').trim();
      row['Publication evidence gate'] = `${gate} ${r.summary}`;
    }
    const csv = Papa.unparse(rows, { quotes: true, newline: '\r\n', columns: parsed.meta.fields });
    writeFileSync(join(root, CSV), `\ufeff${csv}\r\n`);
    console.log(`Updated ${results.length} rows in ${CSV} (backup: ${BACKUP})`);
  }

  mkdirSync(join(root, 'reports'), { recursive: true });
  writeFileSync(join(root, REPORT), report(results));
  console.log(`Wrote ${REPORT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
