import { describe, expect, it } from 'vitest';
import { parseCited, parseEmail, parseProgramDates, parsePublications, parseStatus } from './parse';

describe('parseCited', () => {
  it('extracts nested labeled links and cleans the text', () => {
    const c = parseCited('Endometrial cancer (endometrial paper (https://a.org/1), cervical trial (https://b.org/2))');
    expect(c.text).toBe('Endometrial cancer');
    expect(c.links).toEqual([
      { label: 'endometrial paper', url: 'https://a.org/1' },
      { label: 'cervical trial', url: 'https://b.org/2' },
    ]);
  });

  it('labels a top-level citation as source', () => {
    const c = parseCited('Johns Hopkins, Baltimore (https://x.org/p)');
    expect(c).toEqual({ text: 'Johns Hopkins, Baltimore', links: [{ label: 'source', url: 'https://x.org/p' }] });
  });

  it('keeps text-only parentheticals', () => {
    expect(parseCited('Cervical (HPV-associated) cancer').text).toBe('Cervical (HPV-associated) cancer');
  });
});

describe('parsePublications', () => {
  it('parses codes, journals, years and notes', () => {
    expect(parsePublications('P01: Modern Pathology, 2025 (https://a/1); J Med Virol, 2022, HPV E5 biology (https://b/2)')).toEqual([
      { code: 'P01', journal: 'Modern Pathology', year: 2025, note: undefined, url: 'https://a/1' },
      { code: undefined, journal: 'J Med Virol', year: 2022, note: 'HPV E5 biology', url: 'https://b/2' },
    ]);
  });
});

describe('parseEmail / parseStatus', () => {
  it('finds emails', () => {
    expect(parseEmail('jdoe1@example.edu (correspondence (https://x))')).toBe('jdoe1@example.edu');
    expect(parseEmail('n.a. verified email; faculty introduction')).toBeUndefined();
  });
  it('treats "Drafted; not sent" as drafted', () => {
    expect(parseStatus('Drafted; not sent')).toBe('drafted');
    expect(parseStatus('Sent 2026-10-20')).toBe('sent');
  });
  it('reads every CLAUDE.md tracker status exactly', () => {
    expect(parseStatus('Followed up')).toBe('followed-up');
    expect(parseStatus('No response')).toBe('no-response');
    expect(parseStatus('Replied - declined')).toBe('declined');
    expect(parseStatus('Replied - redirected')).toBe('redirected');
    expect(parseStatus('Replied - interested')).toBe('interested');
    expect(parseStatus('Meeting')).toBe('meeting');
    expect(parseStatus('Joined')).toBe('joined');
  });
  it('tolerates case, en dashes and free-text variants', () => {
    expect(parseStatus('replied – interested')).toBe('interested');
    expect(parseStatus('REPLIED - REDIRECTED')).toBe('redirected');
    expect(parseStatus('Replied')).toBe('interested');
    expect(parseStatus('No response after follow-up')).toBe('no-response');
    expect(parseStatus('Follow-up sent 2026-11-02')).toBe('followed-up');
    expect(parseStatus('')).toBe('drafted');
    expect(parseStatus(undefined)).toBe('drafted');
  });
});

describe('parseProgramDates', () => {
  it('uses the close date, not the open date', () => {
    const r = parseProgramDates('Opens Oct 26 2026; first review Jan 4 2027; closes Jan 18 2027 9am ET', '2026-10-14');
    expect(r.deadline).toBe('2027-01-18');
    expect(r.deadlineVerified).toBe(true);
    expect(r.dates.map((d) => d.label)).toEqual(['Opens', 'first review', 'closes']);
  });

  it('handles ranges', () => {
    expect(parseProgramDates('Oct 1 2026-Jan 1 2027', '2026-10-14').deadline).toBe('2027-01-01');
  });

  it('ignores historical dates and marks TBD as unverified', () => {
    const r = parseProgramDates('2027 TBD; prior Feb 1 2026 11:59pm ET', '2026-10-14');
    expect(r.deadline).toBeUndefined();
    expect(r.deadlineVerified).toBe(false);
  });

  it('marks deadlines that need clarifying as unverified', () => {
    const r = parseProgramDates('2027 program page Oct 1 2026-Jan 15 2027; admissions generic Jan 10; clarify/use earlier date', '2026-10-14');
    expect(r.deadline).toBe('2027-01-15');
    expect(r.deadlineVerified).toBe(false);
  });
});
