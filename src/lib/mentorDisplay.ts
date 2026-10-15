/**
 * Display-only wording for text imported from the research tracker.
 * Nothing here changes stored data or scoring; it only rewrites what the page shows.
 */
import { findJournal } from '../data/journalTiers';
import { formatDate, sentenceCase } from './format';

/** Plain-language replacements for tracker shorthand. */
const JARGON: [RegExp, string][] = [
  [/\bhigh-JIF\b/g, 'high-impact journal'],
  [/\bJIF\b/g, 'journal impact'],
  [/\bNature-level\b/g, 'top-journal'],
  [/\bNature\/Cancer-level\b/g, 'top-journal'],
  [/\bcadence\b/g, 'track record'],
];

export function plainWords(text: string): string {
  return JARGON.reduce((t, [re, to]) => t.replace(re, to), text);
}

const UNVERIFIED = /^\s*unverified\.?\s*$/i;

/** True when a tracker field only says "Unverified". */
export function isUnverified(text: string | undefined): boolean {
  return !text || UNVERIFIED.test(text);
}

/** "Unverified" → "Not yet confirmed"; anything else passes through. */
export function confirmedText(text: string | undefined): string {
  return isUnverified(text) ? 'Not yet confirmed' : (text as string);
}

const PUBMED = /\s*PubMed check (\d{4}-\d{2}-\d{2}):\s*(\d+) papers (\d{4})[–-](\d{4}) \((\d+) endometrial\/cervical\/HPV[^)]*\)\.?/;
const FILE_REF = /\s*See research-verification-(\d{4}-\d{2}-\d{2})\.md\.?/;

export interface EvidenceView {
  /** One plain line for the card. */
  summary: string;
  /** The tracker's full text, with shorthand spelled out, for a "Details" disclosure. */
  details: string;
}

/** Turns the tracker's "Evidence gate" text into a one-line summary plus details. */
export function evidenceView(gate: string): EvidenceView {
  const pub = gate.match(PUBMED);
  const details = plainWords(gate).replace(FILE_REF, (_, d: string) => ` Full notes are in the research verification report (${formatDate(d)}).`).trim();
  if (pub) {
    const [, date, total, from, , direct] = pub;
    return {
      summary: `${Number(total).toLocaleString('en-US')} papers since ${from}, ${direct} on endometrial, cervical or HPV topics (PubMed, ${formatDate(date)})`,
      details,
    };
  }
  const first = plainWords(gate).split(/;|\.\s/)[0].trim().replace(/\.$/, '');
  return { summary: sentenceCase(first), details };
}

/** Full journal name for abbreviations the tracker uses (IJGC, AJSP, …). */
export function journalName(name: string): string {
  return findJournal(name)?.name ?? name;
}

/** Score-reason wording from the engine, rewritten for display. */
export function plainReason(reason: string): string {
  return reason
    .replace(/^×0\.7: tracker says “([^”]*)”$/, 'Partly relevant: the tracker notes “$1”')
    .replace(/, tier unverified\)/, ', tier not confirmed)')
    .replace(/\bnot in tier list\b/, 'journal not in the tier list')
    .replace(/^Unverified$/, 'Not yet confirmed')
    .replace(/capacity unverified/, 'capacity not yet confirmed')
    .replace(/^Signals: /, 'Mentions ');
}
