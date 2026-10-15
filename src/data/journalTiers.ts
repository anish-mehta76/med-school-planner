/**
 * Journal tiers used by the mentor score. Edit freely.
 *
 * Tiers are a rough editorial grouping, not impact factors. No impact factor is
 * recorded here: set `impactFactor` and `verified: true` only after you confirm
 * the number yourself (e.g. in Journal Citation Reports). Unverified entries are
 * labeled "unverified" in the app.
 */
export interface JournalTier {
  name: string;
  /** Abbreviations / alternate spellings used in the tracker CSV. */
  aliases: string[];
  tier: 1 | 2 | 3;
  impactFactor?: number;
  verified: boolean;
}

export const TIER_LABELS = { 1: 'Flagship', 2: 'High-impact', 3: 'Specialty' } as const;

export const JOURNAL_TIERS: JournalTier[] = [
  // Tier 1: flagship general and oncology journals
  { name: 'Nature', aliases: [], tier: 1, verified: false },
  { name: 'Science', aliases: [], tier: 1, verified: false },
  { name: 'Cell', aliases: [], tier: 1, verified: false },
  { name: 'New England Journal of Medicine', aliases: ['NEJM', 'N Engl J Med'], tier: 1, verified: false },
  { name: 'The Lancet', aliases: ['Lancet'], tier: 1, verified: false },
  { name: 'JAMA', aliases: [], tier: 1, verified: false },
  { name: 'Nature Medicine', aliases: ['Nat Med'], tier: 1, verified: false },
  { name: 'Nature Genetics', aliases: ['Nat Genet'], tier: 1, verified: false },
  { name: 'Cancer Cell', aliases: [], tier: 1, verified: false },
  { name: 'Lancet Oncology', aliases: ['Lancet Oncol'], tier: 1, verified: false },
  { name: 'Journal of Clinical Oncology', aliases: ['JCO', 'J Clin Oncol'], tier: 1, verified: false },
  { name: 'JAMA Oncology', aliases: ['JAMA Oncol'], tier: 1, verified: false },
  { name: 'Cancer Discovery', aliases: ['Cancer Discov'], tier: 1, verified: false },

  // Tier 2: high-impact specialty and broad journals
  { name: 'Nature Communications', aliases: ['Nat Commun'], tier: 2, verified: false },
  { name: 'Science Translational Medicine', aliases: ['Sci Transl Med'], tier: 2, verified: false },
  { name: 'Journal of the National Cancer Institute', aliases: ['JNCI', 'J Natl Cancer Inst'], tier: 2, verified: false },
  { name: 'Clinical Cancer Research', aliases: ['Clin Cancer Res', 'CCR'], tier: 2, verified: false },
  { name: 'Cancer Research', aliases: ['Cancer Res'], tier: 2, verified: false },
  { name: 'Lancet Global Health', aliases: ['Lancet Glob Health'], tier: 2, verified: false },
  { name: 'Lancet Public Health', aliases: [], tier: 2, verified: false },
  { name: 'JAMA Network Open', aliases: ['JAMA Netw Open'], tier: 2, verified: false },
  { name: 'Journal of Clinical Investigation', aliases: ['JCI', 'J Clin Invest'], tier: 2, verified: false },
  { name: 'Genome Medicine', aliases: ['Genome Med'], tier: 2, verified: false },
  { name: 'PLOS Medicine', aliases: ['PLoS Med'], tier: 2, verified: false },
  { name: 'International Journal of Cancer', aliases: ['Int J Cancer', 'IJC'], tier: 2, verified: false },

  // Tier 3: disease-specialty journals common in this field
  { name: 'Gynecologic Oncology', aliases: ['Gynecol Oncol'], tier: 3, verified: false },
  { name: 'International Journal of Gynecological Cancer', aliases: ['IJGC', 'Int J Gynecol Cancer'], tier: 3, verified: false },
  { name: 'Modern Pathology', aliases: ['Mod Pathol'], tier: 3, verified: false },
  { name: 'American Journal of Surgical Pathology', aliases: ['AJSP', 'Am J Surg Pathol'], tier: 3, verified: false },
  { name: 'Cancer Epidemiology, Biomarkers & Prevention', aliases: ['CEBP', 'Cancer Epidemiol Biomarkers Prev'], tier: 3, verified: false },
  { name: 'Cancer Medicine', aliases: ['Cancer Med'], tier: 3, verified: false },
  { name: 'Clinical and Translational Medicine', aliases: ['CTM', 'Clin Transl Med'], tier: 3, verified: false },
  { name: 'European Journal of Human Genetics', aliases: ['EJHG', 'Eur J Hum Genet'], tier: 3, verified: false },
  { name: 'Human Genomics', aliases: ['Hum Genomics'], tier: 3, verified: false },
  { name: 'Journal of Medical Virology', aliases: ['J Med Virol'], tier: 3, verified: false },
  { name: 'Biomarkers in Medicine', aliases: ['Biomark Med'], tier: 3, verified: false },
  { name: 'Journal for ImmunoTherapy of Cancer', aliases: ['JITC', 'J Immunother Cancer'], tier: 3, verified: false },
  { name: 'International Journal of Radiation Oncology, Biology, Physics', aliases: ['Red Journal', 'Int J Radiat Oncol Biol Phys', 'IJROBP'], tier: 3, verified: false },
];

const norm = (s: string) => s.toLowerCase().replace(/^the\s+/, '').replace(/[.,&]/g, '').replace(/\s+/g, ' ').trim();

const INDEX = new Map<string, JournalTier>();
for (const j of JOURNAL_TIERS) for (const n of [j.name, ...j.aliases]) INDEX.set(norm(n), j);

export function findJournal(name: string): JournalTier | undefined {
  return INDEX.get(norm(name));
}
