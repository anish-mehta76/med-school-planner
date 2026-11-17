import { describe, expect, it } from 'vitest';
import { resolve } from './engine';
import { mcatReadiness, SECTION_WEIGHTS, sectionsFor } from './mcat';

const NOW = new Date(2026, 10, 17); // Fall 2026
let n = 0;
const plan = (...pairs: [string, string][]) => resolve(pairs.map(([code, termId]) => ({ id: `i${n++}`, code, termId })));

const FULL: [string, string][] = [
  ['AS.030.101', 'F26'], ['AS.030.102', 'S27'], ['AS.020.151', 'F26'], ['AS.020.152', 'S27'],
  ['AS.030.205', 'F27'], ['AS.030.206', 'S28'], ['AS.171.103', 'F27'], ['AS.171.104', 'S28'],
  ['AS.020.305', 'F28'], ['AS.200.101', 'F26'], ['AS.230.101', 'S27'], ['AS.020.306', 'F28'], ['AS.020.303', 'S29'],
];

describe('MCAT readiness', () => {
  it('section weights match the AAMC mix (sum to 100%)', () => {
    for (const w of Object.values(SECTION_WEIGHTS)) expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('a full pre-med sequence before the test covers every science section', () => {
    const r = mcatReadiness(plan(...FULL), 'S29', NOW);
    expect(r.byTest.cp).toBeCloseTo(100);
    expect(r.byTest.bb).toBeCloseTo(100);
    expect(r.byTest.ps).toBeCloseTo(100);
    expect(r.gaps).toHaveLength(0);
  });

  it('orgo after the MCAT costs Chem/Phys 15 points and Bio/Biochem 5', () => {
    const late = FULL.map(([c, t]): [string, string] => (c === 'AS.030.205' || c === 'AS.030.206' ? [c, 'F29'] : [c, t]));
    const r = mcatReadiness(plan(...late), 'S29', NOW);
    expect(r.byTest.cp).toBeCloseTo(85);
    expect(r.byTest.bb).toBeCloseTo(95);
    expect(r.gaps.filter((g) => g.discipline === 'orgo').every((g) => g.reason === 'after')).toBe(true);
    expect(r.courses.find((c) => c.code === 'AS.030.205')?.timing).toBe('after');
  });

  it('counts AP/exam credit at half', () => {
    const r = mcatReadiness(plan(['AS.200.101', 'PRE']), 'S29', NOW);
    expect(r.byTest.ps).toBeCloseTo(65 * 0.5);
    expect(r.gaps.find((g) => g.discipline === 'psych')?.reason).toBe('exam');
  });

  it('separates finished courses from planned ones', () => {
    const r = mcatReadiness(plan(['AS.200.101', 'F26'], ['AS.230.101', 'S27']), 'S29', new Date(2027, 1, 1));
    expect(r.now.ps).toBeCloseTo(65);
    expect(r.byTest.ps).toBeCloseTo(95);
  });

  it('orgo feeds Chem/Phys most, then Bio/Biochem', () => {
    expect(sectionsFor('orgo').map((x) => x.section)).toEqual(['cp', 'bb']);
  });
});

describe('MCAT gaps', () => {
  it('a single upper-level bio course is a partial gap, not a missing one', () => {
    const r = mcatReadiness(plan(['AS.020.306', 'F27']), 'S29', NOW);
    expect(r.gaps.find((g) => g.part.startsWith('Upper-level'))?.reason).toBe('more');
  });
});
