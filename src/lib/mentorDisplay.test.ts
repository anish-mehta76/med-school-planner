import { describe, expect, it } from 'vitest';
import { confirmedText, evidenceView, journalName, plainReason } from './mentorDisplay';

describe('evidenceView', () => {
  it('summarizes the appended PubMed check in plain words', () => {
    const gate =
      'Two recent direct-disease specialty papers; strict high-JIF cadence not verified. PubMed check 2026-10-14: 38 papers 2022–2026 (16 endometrial/cervical/HPV; 24 with large-study signals; 4 first-author, 3 senior-author). Undergraduate/trainee authorship not determinable from PubMed. See research-verification-2026-10-14.md.';
    const v = evidenceView(gate);
    expect(v.summary).toBe('38 papers since 2022, 16 on endometrial, cervical or HPV topics (PubMed, Oct 14, 2026)');
    expect(v.details).toContain('high-impact journal track record not verified');
    expect(v.details).not.toContain('.md');
  });

  it('uses the first clause when there is no PubMed check', () => {
    expect(evidenceView('Direct program fit is strong; recent repeated high-JIF direct-disease evidence is incomplete.').summary).toBe(
      'Direct program fit is strong',
    );
  });
});

describe('display wording', () => {
  it('shows "Unverified" as "Not yet confirmed"', () => {
    expect(confirmedText('Unverified')).toBe('Not yet confirmed');
    expect(confirmedText('Mentors summer students')).toBe('Mentors summer students');
  });

  it('expands journal abbreviations it knows', () => {
    expect(journalName('IJGC')).toBe('International Journal of Gynecological Cancer');
    expect(journalName('Some New Journal')).toBe('Some New Journal');
  });

  it('rewrites engine score reasons', () => {
    expect(plainReason('IJGC 2024 (Specialty, tier unverified)')).toBe('IJGC 2024 (Specialty, tier not confirmed)');
    expect(plainReason('Unverified')).toBe('Not yet confirmed');
  });
});
