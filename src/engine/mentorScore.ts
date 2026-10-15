import type { Mentor, ScoreWeights } from '../types';
import { findJournal, TIER_LABELS } from '../data/journalTiers';

/** Default weights (sum to 100). Editable under Profile & academics. */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  diseaseFit: 25,
  skillsBridge: 15,
  publications: 20,
  largeStudy: 10,
  underrepresented: 10,
  mentorship: 10,
  reachability: 10,
};

export const WEIGHT_LABELS: Record<keyof ScoreWeights, string> = {
  diseaseFit: 'Disease fit',
  skillsBridge: 'Bridge to your skills',
  publications: 'Publication evidence',
  largeStudy: 'Large-study signal',
  underrepresented: 'Underrepresented populations',
  mentorship: 'Undergrad mentorship',
  reachability: 'Reachability from Homewood',
};

export interface ScorePart {
  key: keyof ScoreWeights;
  label: string;
  weight: number;
  /** 0–1 */
  value: number;
  /** Contribution to the 0–100 total. */
  points: number;
  reasons: string[];
}

export interface MentorScore {
  total: number;
  parts: ScorePart[];
}

/** Recent = this year range counts toward publication evidence. */
export const RECENT_FROM = 2022;
export const RECENT_TO = 2026;

/** The mentor's own fields only. The draft email is excluded since it describes you, not them. */
function corpus(m: Mentor) {
  // The appended "PubMed check …" summary is verification metadata, not a description of the lab.
  const gate = m.evidenceGate.replace(/\s*PubMed check \d{4}-\d{2}-\d{2}:[\s\S]*$/, '');
  // Public fields only, so a mentor scores the same on every device whether or not the private tracker is imported.
  return [m.diseaseFit.text, m.strength.text, gate, ...m.publications.map((p) => p.note ?? '')].join(' \n ');
}

function matches(text: string, groups: Record<string, RegExp>): string[] {
  return Object.entries(groups)
    .filter(([, re]) => re.test(text))
    .map(([name]) => name);
}

export function diseaseFit(m: Mentor): Pick<ScorePart, 'value' | 'reasons'> {
  const t = m.diseaseFit.text;
  let value: number;
  let reason: string;
  if (/endometri|uterine|uterus|carcinosarcoma/i.test(t)) {
    value = 1;
    reason = 'Endometrial/uterine focus';
  } else if (/cervi|HPV/i.test(t)) {
    value = 0.8;
    reason = 'Cervical/HPV focus';
  } else if (/gyn|ovar|vulv/i.test(t)) {
    value = 0.5;
    reason = 'Broader gynecologic focus';
  } else {
    value = 0.25;
    reason = 'Methods or adjacent only';
  }
  const reasons = [reason];
  const qualifier = t.match(/adjacent|primarily ovarian|primary lab model is \w+|not primarily[^;,.]*|broader [^;,.]*|historic[^;,.]*/i);
  if (qualifier && value > 0.25) {
    value *= 0.7;
    reasons.push(`×0.7: tracker says “${qualifier[0].trim()}”`);
  }
  return { value, reasons };
}

const SKILLS: Record<string, RegExp> = {
  'PCOS/endocrine': /PCOS|polycystic|endocrin|hormon|estrogen|obesity|insulin|metabolic/i,
  'ML/computational': /machine learning|\bML\b|computational|bioinformatic|biostatist|statistic|algorithm|\bAI\b|model/i,
  genomics: /genom|genetic|sequencing|expression|transcript|mutation|molecular|epigen|\b(circ|mi|lnc|m)?RNA\b|\bDNA\b/i,
  'cross-cohort': /cross-cohort|multi-cohort|consortium|pooled|heterogeneity|ancestry|across cohorts|meta-analys/i,
};
const SKILL_VALUE: Record<string, number> = { 'PCOS/endocrine': 0.35, 'ML/computational': 0.25, genomics: 0.2, 'cross-cohort': 0.2 };

export function skillsBridge(m: Mentor): Pick<ScorePart, 'value' | 'reasons'> {
  const hit = matches(corpus(m), SKILLS);
  return {
    value: Math.min(1, hit.reduce((s, h) => s + SKILL_VALUE[h], 0)),
    reasons: hit.length ? hit.map((h) => `Mentions ${h}`) : ['No overlap with PCOS, ML, genomics or cross-cohort work found'],
  };
}

const TIER_POINTS = { 1: 1, 2: 0.7, 3: 0.4 } as const;

export function publicationEvidence(m: Mentor): Pick<ScorePart, 'value' | 'reasons'> {
  const recent = m.publications.filter((p) => p.year && p.year >= RECENT_FROM && p.year <= RECENT_TO);
  if (!recent.length) return { value: 0, reasons: [`No ${RECENT_FROM}–${RECENT_TO} papers listed in the tracker`] };
  let sum = 0;
  const reasons = recent.map((p) => {
    const j = findJournal(p.journal);
    const pts = j ? TIER_POINTS[j.tier] : 0.25;
    sum += pts;
    const tier = j ? `${TIER_LABELS[j.tier]}${j.verified ? '' : ', tier unverified'}` : 'not in tier list';
    return `${p.journal} ${p.year} (${tier})`;
  });
  return { value: Math.min(1, sum / 2), reasons };
}

const LARGE: Record<string, RegExp> = {
  cohort: /cohort/i,
  consortium: /consorti|SPORE/i,
  // Word boundary so "endometrial" doesn't count as a trial.
  trial: /\btrials?\b/i,
  biobank: /biobank|specimen|tissue microarray|repository/i,
  registry: /registry|SEER/i,
  characterization: /characteri[sz]/i,
  sequencing: /sequenc|genomic profil/i,
  screening: /screening|natural history|population/i,
};

export function largeStudy(m: Mentor): Pick<ScorePart, 'value' | 'reasons'> {
  const hit = matches(corpus(m), LARGE);
  const value = [0, 0.5, 0.8, 1][Math.min(3, hit.length)];
  return { value, reasons: hit.length ? [`Signals: ${hit.join(', ')}`] : ['No cohort, trial, consortium or biobank signal'] };
}

const POPULATIONS: Record<string, RegExp> = {
  'Black/African-ancestry women': /\bBlack\b|African/i,
  'Hispanic/Latina women': /Hispanic|Latin[ao]/i,
  'disparities/underserved': /disparit|underserved|inequit|access/i,
  'ancestry-aware genetics': /ancestr/i,
  'rural/Appalachian': /rural|Appalach/i,
  'immigrant/low-income': /immigrant|low-income|low income/i,
  'global/LMIC': /global|LMIC|Nigeria|low- and middle|sub-Saharan/i,
};

export function underrepresented(m: Mentor): Pick<ScorePart, 'value' | 'reasons'> {
  const hit = matches(corpus(m), POPULATIONS);
  const value = hit.length >= 2 ? 1 : hit.length === 1 ? 0.7 : 0;
  return { value, reasons: hit.length ? hit : ['No population focus mentioned in the tracker'] };
}

export function mentorship(m: Mentor): Pick<ScorePart, 'value' | 'reasons'> {
  const t = m.mentorshipEvidence.text;
  const opening = m.undergradOpening.text;
  if (t && !/unverified/i.test(t)) return { value: 1, reasons: ['Verified undergraduate mentorship'] };
  if (/undergrad/i.test(t)) return { value: 0.6, reasons: ['Lab describes undergraduate training; capacity unverified'] };
  if (opening && !/unverified/i.test(opening)) return { value: 0.6, reasons: ['Undergraduate opening listed'] };
  return { value: 0.2, reasons: ['Unverified'] };
}

export function reachability(m: Mentor): Pick<ScorePart, 'value' | 'reasons'> {
  const t = m.institution.text;
  if (/Homewood/i.test(t)) return { value: 1, reasons: ['Homewood campus'] };
  if (/Lutherville|Towson/i.test(t)) return { value: 0.8, reasons: ['Baltimore area (Lutherville/Towson)'] };
  if (/Baltimore/i.test(t)) return { value: 0.9, reasons: ['Baltimore — reachable during the semester'] };
  if (/Bethesda|Rockville|NIH|NCI/i.test(t)) return { value: 0.5, reasons: ['Bethesda/Rockville — better for summer'] };
  if (/Washington|\bDC\b|Georgetown/i.test(t)) return { value: 0.35, reasons: ['Washington, DC — summer or remote'] };
  return { value: 0.2, reasons: ['Outside the Baltimore–DC corridor'] };
}

const SCORERS: Record<keyof ScoreWeights, (m: Mentor) => Pick<ScorePart, 'value' | 'reasons'>> = {
  diseaseFit,
  skillsBridge,
  publications: publicationEvidence,
  largeStudy,
  underrepresented,
  mentorship,
  reachability,
};

export function scoreMentor(m: Mentor, weights: ScoreWeights = DEFAULT_WEIGHTS): MentorScore {
  const totalWeight = Object.values(weights).reduce((s, w) => s + Math.max(0, w), 0) || 1;
  const parts = (Object.keys(SCORERS) as (keyof ScoreWeights)[]).map((key) => {
    const { value, reasons } = SCORERS[key](m);
    const weight = Math.max(0, weights[key]);
    return { key, label: WEIGHT_LABELS[key], weight, value, reasons, points: (value * weight * 100) / totalWeight };
  });
  return { total: Math.round(parts.reduce((s, p) => s + p.points, 0)), parts };
}

export function rankMentors(mentors: Mentor[], weights: ScoreWeights) {
  return mentors.map((m) => ({ m, score: scoreMentor(m, weights) })).sort((a, b) => b.score.total - a.score.total || a.m.id.localeCompare(b.m.id));
}
