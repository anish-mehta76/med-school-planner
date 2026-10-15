/** Pure parsing helpers for the tracker CSVs (unit-tested in parse.test.ts). */
import type { Cited, Link, MentorPublication, OutreachStatus, ProgramDate } from '../src/types.ts';
import { toOutreachStatus } from '../src/engine/outreach.ts';

const URL_IN_PARENS = /\s*\((https?:\/\/[^\s)]+)\)/g;

/**
 * Pulls "(url)" citations out of CSV text.
 * "Endometrial (profile (https://a), trial (https://b))" → text "Endometrial", links [profile→a, trial→b]
 */
export function parseCited(raw: string | undefined): Cited {
  const src = (raw ?? '').trim();
  const links: Link[] = [];
  for (const m of src.matchAll(/([^(),;]*?)\s*\((https?:\/\/[^\s)]+)\)/g)) {
    // Only "(label (url))" nested inside another parenthetical carries a label;
    // a top-level "text (url)" is a plain citation for the whole field.
    const before = src.slice(0, m.index);
    const nested = (before.match(/\(/g)?.length ?? 0) > (before.match(/\)/g)?.length ?? 0);
    const label = m[1].trim().replace(/^[-–:]\s*/, '');
    links.push({ label: nested && label && label.length <= 60 ? label : 'source', url: m[2] });
  }
  const labels = new Set(links.map((l) => l.label.toLowerCase()));
  let text = src.replace(URL_IN_PARENS, '');
  // Drop parenthetical groups that only held link labels, e.g. "(profile, SPORE)".
  text = text.replace(/\s*\(([^()]*)\)/g, (whole, inner: string) =>
    inner.split(',').every((p) => labels.has(p.trim().toLowerCase()) || !p.trim()) ? '' : whole,
  );
  return { text: text.replace(/\s{2,}/g, ' ').trim(), links: dedupe(links) };
}

function dedupe(links: Link[]) {
  const seen = new Set<string>();
  return links.filter((l) => !seen.has(l.url) && seen.add(l.url));
}

export function parseEmail(raw: string | undefined): string | undefined {
  return raw?.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0];
}

/** "P01: Modern Pathology, 2025 (url); J Med Virol, 2022, HPV E5 biology (url)" */
export function parsePublications(raw: string | undefined): MentorPublication[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/;\s*(?=(?:P\d+:|[A-Z]))/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const url = item.match(/\((https?:\/\/[^\s)]+)\)/)?.[1];
      let rest = item.replace(URL_IN_PARENS, '').trim();
      const code = rest.match(/^(P\d+):\s*/)?.[1];
      if (code) rest = rest.slice(code.length + 1).trim();
      const parts = rest.split(',').map((p) => p.trim()).filter(Boolean);
      const yearIdx = parts.findIndex((p) => /^(19|20)\d\d$/.test(p));
      const year = yearIdx >= 0 ? Number(parts[yearIdx]) : undefined;
      const journal = yearIdx > 0 ? parts.slice(0, yearIdx).join(', ') : parts[0] ?? rest;
      const note = yearIdx >= 0 ? parts.slice(yearIdx + 1).join(', ') || undefined : undefined;
      return { code, journal, year, note, url };
    });
}

/** Tracker "Outreach status" cell → status key. Shared with the app's saved-data migration. */
export function parseStatus(raw: string | undefined): OutreachStatus {
  return toOutreachStatus(raw);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DATE_RE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d\d)\b/gi;

/**
 * Finds dated milestones in a free-text application timeline.
 * The deadline is the latest non-"opens" date on or after `today`.
 */
export function parseProgramDates(timeline: string, today: string): { dates: ProgramDate[]; deadline?: string; deadlineVerified: boolean } {
  const dates: ProgramDate[] = [];
  for (const clause of timeline.split(/[;/]/)) {
    const matches = [...clause.matchAll(DATE_RE)];
    matches.forEach((m, i) => {
      const iso = `${m[3]}-${String(MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
      const before = clause.slice(i > 0 ? matches[i - 1].index! + matches[i - 1][0].length : 0, m.index).trim();
      const after = clause.slice(m.index! + m[0].length).trimStart();
      // Keep the last few words before the date as its label ("first review", "closes").
      let label = before.replace(/^[-–,\s]+|[-–,:.\s]+$/g, '').split(/[.,]\s*/).at(-1)!.split(/\s+/).slice(-3).join(' ');
      if (after.startsWith('-') || after.startsWith('–')) label = 'opens';
      else if (/^[-–]$/.test(before.slice(-1)) || (i > 0 && /^[-–]\s*$/.test(before))) label = 'closes';
      dates.push({ date: iso, label: label || 'deadline' });
    });
  }
  const candidates = dates.filter((d) => !/open/i.test(d.label) && d.date >= today).map((d) => d.date).sort();
  const deadline = candidates.at(-1);
  const deadlineVerified = !!deadline && !/TBD|not (yet )?verified|historical|clarify/i.test(timeline);
  return { dates, deadline, deadlineVerified };
}
