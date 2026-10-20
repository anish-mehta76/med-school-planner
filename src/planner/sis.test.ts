import { describe, expect, it } from 'vitest';
import { parsePrereqExpression, summarize, type SisSection } from './sis';

describe('SIS prerequisite expressions', () => {
  it('parses AND of ORs into groups', () => {
    expect(parsePrereqExpression('(AS.280.345 OR EN.553.211) AND AS.280.101')).toEqual([['AS.280.345', 'EN.553.211'], ['AS.280.101']]);
    expect(parsePrereqExpression('AS.030.205')).toEqual([['AS.030.205']]);
  });

  it('gives up on anything it cannot represent', () => {
    expect(parsePrereqExpression('(AS.030.101 AND AS.030.105) OR AS.030.103')).toBeNull();
    expect(parsePrereqExpression('Permission of instructor')).toBeNull();
    expect(parsePrereqExpression('')).toBeNull();
  });
});

describe('summarize', () => {
  const sec = (Term: string, extra: Partial<SisSection> = {}): SisSection => ({ OfferingName: 'AS.280.345', Title: 'Public Health Biostatistics', Credits: '4.00', Term, ...extra });

  it('takes FA tags, writing flag and POS tags from the latest term, and finds fall-only courses', () => {
    const c = summarize(
      'AS.280.345',
      [
        sec('Fall 2024'),
        sec('Fall 2025', {
          Areas: 'Quantitative Studies (Q)^Science and Data (FA2)',
          IsWritingIntensive: 'No',
          SectionDetails: [{ PosTags: [{ Tag: 'BIOL-UL' }], Prerequisites: [{ Description: 'AS.280.101', Expression: 'AS.280.101' }] }],
        }),
      ],
      new Date(2026, 9, 15),
    );
    expect(c).toMatchObject({ title: 'Public Health Biostatistics', credits: 4, fa: ['FA2'], writingIntensive: false, posTags: ['BIOLUL'], term: 'F', prereqs: [['AS.280.101']], lastOffered: 'Fall 2025' });
  });

  it('marks courses offered in both semesters as unrestricted', () => {
    expect(summarize('X', [sec('Fall 2025'), sec('Spring 2026')], new Date(2026, 9, 15)).term).toBeNull();
  });
});

describe('FA tags across sections', () => {
  it('keeps tags every section shares and lists the rest as varying', () => {
    const sec = (Areas: string) => ({ OfferingName: 'AS.004.101', Title: 'Reintroduction to Writing', Credits: '3.00', Term: 'Fall 2026', Areas });
    const c = summarize('AS.004.101', [sec('Writing (FA1), Ethics (FA5)'), sec('Writing (FA1), Democracy (FA4.1)')], new Date(2026, 9, 20));
    expect(c.fa).toEqual(['FA1']);
    expect(c.faVaries).toEqual(['FA4.1', 'FA5']);
  });
});
