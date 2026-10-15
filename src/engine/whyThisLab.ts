import type { Mentor } from '../types';
import { RECENT_FROM } from './mentorScore';

export type Bridge = 'endometrial' | 'cervical' | 'methods';

export type WhyTemplates = Partial<Record<Bridge, string>>;

export function bridgeFor(m: Mentor): Bridge {
  const t = m.diseaseFit.text;
  if (/endometri|uterine|uterus|carcinosarcoma/i.test(t)) return 'endometrial';
  if (/cervi|HPV/i.test(t)) return 'cervical';
  return 'methods';
}

/**
 * Neutral wording that ships with the public website. Your own wording (your
 * research story) is entered in the app and saved only in your browser.
 * Placeholders: {dr}, {focus}, {paper}.
 */
export const DEFAULT_WHY_TEMPLATES: Record<Bridge, string> = {
  endometrial: "{dr}'s work on {focus} connects closely to the questions I want to study in endometrial cancer. {paper} I'd like to contribute data analysis to this work.",
  cervical:
    "{dr}'s work on {focus} addresses a public-health problem I care about: cervical cancer is largely preventable through HPV vaccination and screening, yet its burden is unequal. {paper} I'd like to contribute data analysis to this work.",
  methods: "{dr}'s work on {focus} offers methods I'd like to apply to gynecologic cancers. {paper}",
};

export const BRIDGE_TEMPLATE_LABELS: Record<Bridge, string> = {
  endometrial: 'Endometrial labs',
  cervical: 'Cervical / HPV labs',
  methods: 'Methods / adjacent labs',
};

function lastName(name: string) {
  return name.replace(/\s+(II|III|IV|Jr\.?|Sr\.?)$/i, '').replace(/“[^”]*”\s*/g, '').trim().split(/\s+/).at(-1) ?? name;
}

/** Lowercase the first letter unless it starts an acronym (HPV, NCI). */
function lcFirst(s: string) {
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

function focus(m: Mentor) {
  const first = m.diseaseFit.text.split(/;|\s—\s/)[0].trim().replace(/\.$/, '');
  // Drop tracker qualifiers like "Direct …" / "Adjacent …" that read oddly in prose.
  return lcFirst(first.replace(/^(direct|adjacent|historic)\s+/i, ''));
}

function recentPaper(m: Mentor) {
  const p = m.publications.filter((x) => x.year && x.year >= RECENT_FROM).sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
  return p ? `${p.year} ${p.journal} paper${p.note ? ` (${p.note})` : ''}` : undefined;
}

/**
 * A 2–3 sentence line connecting a lab to your story, from a template per
 * disease bridge. Uses only public tracker fields; edit before using it anywhere.
 */
export function whyThisLab(m: Mentor, templates: WhyTemplates = {}): string {
  const bridge = bridgeFor(m);
  const template = templates[bridge]?.trim() || DEFAULT_WHY_TEMPLATES[bridge];
  const paper = recentPaper(m);
  const values: Record<string, string> = {
    dr: `Dr. ${lastName(m.name)}`,
    focus: focus(m),
    paper: paper ? `Your ${paper} stood out to me.` : `Your lab's focus on ${lcFirst(m.strength.text.split(';')[0].trim().replace(/\.$/, ''))} stood out to me.`,
  };
  return template.replace(/\{(dr|focus|paper)\}/g, (_, k: string) => values[k]).replace(/\s{2,}/g, ' ').trim();
}
