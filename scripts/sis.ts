/** Turns SIS Course Search API sections into planner course records (used by sync-sis.ts). */

export interface SisSection {
  OfferingName: string;
  Title: string;
  Credits: string;
  Term: string;
  Areas?: string;
  IsWritingIntensive?: string;
  SectionDetails?: {
    PosTags?: { Tag: string }[];
    Prerequisites?: { Description?: string; Expression?: string; IsNegative?: string | boolean }[];
  }[];
}

const SEASON_RANK: Record<string, number> = { Intersession: 0, Spring: 1, Summer: 2, Fall: 3 };

/** "Fall 2026" → sortable number. */
export function termRank(term: string) {
  const [season, year] = term.split(' ');
  return Number(year) * 10 + (SEASON_RANK[season] ?? 0);
}

/**
 * Parses "(A OR B) AND C" style expressions into the engine's groups ([[A, B], [C]]).
 * Returns null for anything else (nested logic, grades, permission text), and the app
 * shows the prerequisite text instead.
 */
export function parsePrereqExpression(expr: string | undefined): string[][] | null {
  if (!expr?.trim()) return null;
  const CODE = /^[A-Z]{2}\.\d{3}\.\d{3}$/;
  const clauses: string[] = [];
  let depth = 0;
  let cur = '';
  const s = expr.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) return null;
    if (depth === 0 && /^ AND /i.test(s.slice(i, i + 5))) {
      clauses.push(cur);
      cur = '';
      i += 4;
      continue;
    }
    cur += ch;
  }
  if (depth !== 0) return null;
  clauses.push(cur);
  const groups = clauses.map((c) => {
    const inner = c.trim().replace(/^\((.*)\)$/, '$1');
    if (/[()]|\bAND\b/i.test(inner)) return null;
    const alts = inner.split(/\s+OR\s+/i).map((x) => x.trim());
    return alts.every((a) => CODE.test(a)) ? alts : null;
  });
  return groups.every(Boolean) ? (groups as string[][]) : null;
}

/** One planner course from all of a course's SIS sections. */
export function summarize(code: string, sections: SisSection[], now: Date) {
  const sorted = [...sections].sort((a, b) => termRank(b.Term) - termRank(a.Term));
  const latest = sorted[0];
  const latestTerm = sorted.filter((s) => s.Term === latest.Term);
  const fa = [...new Set([...(latest.Areas ?? '').matchAll(/\((FA\d(?:\.\d)?)\)/g)].map((m) => m[1]))];
  const posTags = [...new Set(latestTerm.flatMap((s) => s.SectionDetails?.flatMap((d) => d.PosTags?.map((p) => p.Tag.replace(/-/g, '')) ?? []) ?? []))];
  const prereq = latest.SectionDetails?.[0]?.Prerequisites?.filter((p) => !(p.IsNegative === true || p.IsNegative === 'Yes'));
  const prereqText = prereq?.map((p) => p.Description).filter(Boolean).join(' ') || undefined;
  const parsed = prereq?.length === 1 ? parsePrereqExpression(prereq[0].Expression) : null;

  // Fall-only / spring-only, from the last ~6 years of regular terms.
  const since = (now.getFullYear() - 6) * 10;
  const seasons = new Set(sorted.filter((s) => termRank(s.Term) >= since).map((s) => s.Term.split(' ')[0]).filter((x) => x === 'Fall' || x === 'Spring'));
  const offerings = new Set(sorted.filter((s) => termRank(s.Term) >= since).map((s) => s.Term)).size;
  const term = offerings >= 2 && seasons.size === 1 ? (seasons.has('Fall') ? 'F' : 'S') : null;

  return {
    code,
    title: latest.Title,
    credits: Number.parseFloat(latest.Credits) || undefined,
    fa,
    writingIntensive: latest.IsWritingIntensive === 'Yes',
    posTags,
    term,
    prereqs: parsed ?? undefined,
    prereqText: parsed ? undefined : prereqText,
    lastOffered: latest.Term,
  };
}
