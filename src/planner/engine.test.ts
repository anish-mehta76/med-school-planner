import { describe, expect, it } from 'vitest';
import { analyze, autofill, evaluate, faTracker, offeredIn, overlapMatrix, resolve, type MajorResult } from './engine';
import { ALL_MAJORS, MAJOR_BY_ID, MAJORS } from './majors';
import { chemPhs, chemPhsPremed, chemPhsSpanish } from './scenarios';
import { addPublishedTerms, applySis, CATALOG, COURSE } from './catalog';
import { TERM_BY_ID } from './terms';
import type { Scenario } from './types';

const NOW = new Date(2026, 9, 15);
const status = (res: MajorResult, key: string) => res.reqs.find((r) => r.req.key === key)!;
const codes = (res: MajorResult, key: string) => status(res, key).items.map((r) => r.code);
const texts = (s: Scenario) => analyze(s).flags.map((f) => f.text);

describe('catalog', () => {
  it('has no duplicate codes and every prerequisite exists or is a known outside course', () => {
    expect(new Set(CATALOG.map((c) => c.code)).size).toBe(CATALOG.length);
    const outside = new Set(['AS.270.103', 'AS.200.314']);
    for (const c of CATALOG) for (const g of c.prereqs ?? []) for (const p of g) expect(COURSE[p] || outside.has(p), `${c.code} → ${p}`).toBeTruthy();
  });

  it('every requirement fill code is in the catalog', () => {
    for (const m of [...MAJORS, MAJOR_BY_ID.premed])
      for (const r of m.requirements) {
        if (r.type === 'pick' || r.type === 'cred') for (const f of r.fill ?? []) expect(COURSE[f], `${m.id}:${r.key} → ${f}`).toBeTruthy();
        if (r.type === 'set') for (const o of r.options) for (const code of o) expect(COURSE[code], `${m.id}:${r.key} → ${code}`).toBeTruthy();
      }
  });
});

describe('default plan: Chem BS + PHS BA (spec section 7)', () => {
  const s = chemPhs();
  const a = analyze(s);
  const [chem, phs] = a.results;

  it('totals 130 credits and meets both majors', () => {
    expect(a.total).toBe(130);
    expect(chem.reqs.filter((r) => r.status === 'partial' || r.status === 'missing').map((r) => r.req.key)).toEqual([]);
    expect(phs.reqs.filter((r) => r.status === 'partial' || r.status === 'missing').map((r) => r.req.key)).toEqual([]);
    expect(chem.pct).toBe(1);
  });

  it('double counts the way the spec describes', () => {
    expect(codes(chem, 'adv')).toEqual(['AS.020.305']);
    expect(codes(chem, 'elec')).toEqual(['AS.020.303', 'AS.020.304', 'AS.020.306']);
    expect(codes(phs, 'bio')).toEqual(['AS.020.303', 'AS.020.305']);
    expect(codes(phs, 'biolab')).toEqual(['AS.020.315']);
    expect(codes(phs, 'soc')).toEqual(['AS.140.105', 'AS.180.102']);
    expect(codes(phs, 'calc1')).toEqual(['AS.110.108']);
    expect(codes(chem, 'calc1')).toEqual(['AS.110.108']);
    expect(a.doubleCredits).toBeGreaterThan(0);
  });

  it('has no sequencing errors or warnings', () => {
    expect(a.flags.filter((f) => f.level !== 'info')).toEqual([]);
  });

  it('surfaces the FA gaps from spec section 8', () => {
    const fa = Object.fromEntries(a.fa.map((f) => [f.id, f]));
    expect(fa.FA3.verified + fa.FA3.estimated).toBe(0);
    expect(fa['FA4.1'].verified).toBe(0);
    expect(fa.FA1.verified).toBe(11); // 280.101 + 280.240 + 030.356
    expect(fa.FA2.verified + fa.FA2.estimated).toBeGreaterThanOrEqual(15);
  });
});

describe('pre-med plan (spec section 7b)', () => {
  const a = analyze(chemPhsPremed());
  const pm = a.premed!;

  it('totals 133 and still meets both majors', () => {
    expect(a.total).toBe(133);
    for (const res of a.results) expect(res.reqs.filter((r) => r.status === 'partial' || r.status === 'missing')).toEqual([]);
  });

  it('matches the expected checklist', () => {
    for (const k of ['chem1', 'chem2', 'org1', 'org2', 'orglab', 'biochem', 'phys1', 'phys2', 'math', 'stats', 'sbs']) expect(status(pm, k).status, k).toBe('done');
    expect(codes(pm, 'bio').sort()).toEqual(['AS.020.303', 'AS.020.306', 'AS.020.316', 'AS.020.340']);
    expect(status(pm, 'writing').status).toBe('partial');
    expect(status(pm, 'writing').detail).toMatch(/English, Writing Seminars/);
  });

  it('flags MCAT timing and the 18-credit term', () => {
    const t = a.flags.map((f) => f.text);
    expect(t.some((x) => /AS\.020\.303 Genetics is MCAT-helpful/.test(x))).toBe(true);
    expect(t.some((x) => /AS\.020\.306 Cell Biology is MCAT-helpful/.test(x))).toBe(true);
    expect(t.some((x) => /Spring 2028 has 18 credits/.test(x))).toBe(true);
    expect(t.some((x) => /is MCAT content but lands after/.test(x))).toBe(false);
    expect(t.some((x) => /Pre-med squeeze/.test(x))).toBe(true);
  });

  it('a gap year (MCAT after Spring 2030) clears the MCAT flags', () => {
    expect(texts({ ...chemPhsPremed(), mcatAfterTermId: 'S30' }).some((x) => /MCAT/.test(x))).toBe(false);
  });

  it('PHS Table 2 includes 280.314, which also covers FA4.1', () => {
    expect(codes(a.results[1], 'inter')).toContain('AS.280.314');
    expect(a.fa.find((f) => f.id === 'FA4.1')!.verified).toBe(3);
  });
});

describe('validation flags', () => {
  const base = chemPhs();
  const move = (code: string, termId: string): Scenario => ({ ...base, plan: base.plan.map((p) => (p.code === code ? { ...p, termId } : p)) });

  it('catches a fall-only course in spring', () => {
    expect(texts(move('AS.030.246', 'S29')).some((x) => /AS\.030\.246 .* offered only in fall/.test(x))).toBe(true);
  });

  it('catches a prerequisite scheduled too late', () => {
    expect(texts(move('AS.030.449', 'S30')).some((x) => /AS\.030\.356 needs AS\.030\.449 in an earlier term/.test(x))).toBe(true);
  });

  it('catches BSPH before the final year and before the PHS core', () => {
    const t = texts(move('PH.BSPH', 'F28'));
    expect(t.some((x) => /final academic year/.test(x))).toBe(true);
    expect(t.some((x) => /six PHS core/.test(x))).toBe(true);
  });

  it('flags a plan under 120 credits', () => {
    expect(texts({ ...base, plan: base.plan.slice(0, 10) }).some((x) => /at least 120/.test(x))).toBe(true);
  });

  it('pre-med: S/U, summer science, AP credit', () => {
    const p = chemPhsPremed();
    const s: Scenario = {
      ...p,
      plan: [
        ...p.plan.map((x) => (x.code === 'AS.230.101' ? { ...x, su: true } : x.code === 'AS.030.205' ? { ...x, termId: 'U27' } : x)),
        { id: 'ap', code: 'AS.020.151', termId: 'PRE' },
      ],
    };
    const t = texts(s);
    expect(t.some((x) => /AS\.230\.101 is marked S\/U; pre-med/.test(x))).toBe(true);
    expect(t.some((x) => /AS\.030\.205 is a pre-med science course in a summer/.test(x))).toBe(true);
    expect(t.some((x) => /AP Biology is in your exam lane/.test(x))).toBe(true);
  });
});

describe('Foundational Abilities counting rule', () => {
  it('FA1 + FA3 + FA4 counts toward FA1 and only one of FA3/FA4', () => {
    const rows = faTracker(resolve([{ id: 'x', code: 'CUSTOM', termId: 'F27', credits: 3, fa: ['FA1', 'FA3', 'FA4'] }]));
    const by = Object.fromEntries(rows.map((r) => [r.id, r.verified]));
    expect(by.FA1).toBe(3);
    expect(by.FA3 + by.FA4).toBe(3);
  });

  it('exam credit and First-Year Seminars carry no FA', () => {
    const rows = faTracker(resolve([{ id: 'a', code: 'AS.280.345', termId: 'PRE' }, { id: 'b', code: 'AS.001.1XX', termId: 'F26', fa: ['FA3'] }]));
    expect(rows.every((r) => r.verified + r.estimated === 0)).toBe(true);
  });
});

describe('what-if auto-fill', () => {
  it('fills Spanish onto the default plan without touching Fall 2026 or adding the waived sequence', () => {
    const base = chemPhs();
    const r = autofill(base.plan, MAJOR_BY_ID.span, undefined, NOW);
    expect(r.unresolved).toEqual([]);
    expect(r.added.every((p) => p.termId !== 'F26' && TERM_BY_ID[p.termId].season !== 'U')).toBe(true);
    expect(r.added.some((p) => p.code === 'AS.210.111')).toBe(false);
    expect(evaluate(MAJOR_BY_ID.span, resolve(r.plan)).pct).toBe(1);
    expect(r.addedCredits).toBe(27);
    expect(chemPhsSpanish(NOW).majorIds).toContain('span');
  });

  it('adds missing prerequisites in order (Neuroscience needs 200.141 before 080.305)', () => {
    const r = autofill(chemPhs().plan, MAJOR_BY_ID.neuro, undefined, NOW);
    const t = (code: string) => TERM_BY_ID[r.plan.find((p) => p.code === code)!.termId].ord;
    expect(t('AS.200.141')).toBeLessThan(t('AS.080.305'));
    expect(t('AS.080.305')).toBeLessThan(t('AS.080.306'));
    expect(TERM_BY_ID[r.plan.find((p) => p.code === 'AS.080.305')!.termId].season).toBe('F');
    expect(r.unresolved).toEqual([]);
  });

  it('fills every major from an empty plan with no prerequisite or offering errors', () => {
    for (const m of MAJORS) {
      const r = autofill([], m, undefined, NOW);
      expect(r.unresolved, m.id).toEqual([]);
      const s: Scenario = { id: 'x', name: 'x', majorIds: [m.id], plan: r.plan, premed: false };
      const bad = analyze(s).flags.filter((f) => f.itemId && f.level !== 'info');
      expect(bad.map((f) => f.text), m.id).toEqual([]);
    }
  });

  it('overlap matrix is asymmetric and Chem → MCB overlap is large', () => {
    const ids = MAJORS.map((m) => m.id);
    const mx = overlapMatrix(MAJORS, NOW);
    const at = (a: string, b: string) => mx[ids.indexOf(a)][ids.indexOf(b)];
    expect(Number.isNaN(at('chem', 'chem'))).toBe(true);
    expect(at('chem', 'mcb')).toBeGreaterThan(20);
    expect(at('chem', 'span')).toBe(0);
  });
});

describe('majors imported from the catalogue', () => {
  it('covers KSAS and WSE, without duplicating the hand-checked majors', () => {
    expect(ALL_MAJORS.length).toBeGreaterThanOrEqual(45);
    expect(ALL_MAJORS.some((m) => m.school === 'WSE')).toBe(true);
    expect(new Set(ALL_MAJORS.map((m) => m.id)).size).toBe(ALL_MAJORS.length);
    expect(ALL_MAJORS.filter((m) => /public-health-studies/.test(m.sourceUrl))).toHaveLength(1);
  });

  it('every imported course code is in the catalog and every major auto-fills from scratch', () => {
    for (const m of ALL_MAJORS.filter((x) => x.auto)) {
      for (const r of m.requirements) if (r.type === 'set') for (const o of r.options) for (const c of o) expect(COURSE[c], `${m.id} → ${c}`).toBeTruthy();
      const res = autofill([], m, undefined, NOW);
      expect(evaluate(m, resolve(res.plan)).pct, m.id).toBeGreaterThan(0.6);
    }
  });

  it('a plan of your own courses shows how far each major is', () => {
    const plan = ['AS.030.101', 'AS.030.105', 'AS.110.108', 'AS.280.101'].map((code, i) => ({ id: `x${i}`, code, termId: 'F26' }));
    const pct = (id: string) => evaluate(MAJOR_BY_ID[id], resolve(plan)).pct;
    expect(pct('chem')).toBeGreaterThan(0);
    expect(pct('phs')).toBeGreaterThan(pct('ksas-english-bachelor-arts'));
  });
});

describe('SIS schedules and intersessions', () => {
  it('has a winter intersession between fall and spring every year', () => {
    for (const [w, f, sp] of [['W27', 'F26', 'S27'], ['W28', 'F27', 'S28'], ['W29', 'F28', 'S29'], ['W30', 'F29', 'S30']]) {
      expect(TERM_BY_ID[w].season).toBe('W');
      expect(TERM_BY_ID[f].ord).toBeLessThan(TERM_BY_ID[w].ord);
      expect(TERM_BY_ID[w].ord).toBeLessThan(TERM_BY_ID[sp].ord);
    }
    expect(TERM_BY_ID.W28.sisName).toBe('Intersession 2028');
  });

  it('uses the posted SIS schedule over the fall/spring pattern, and the pattern before it is posted', () => {
    applySis([{ code: 'AS.999.101', title: 'Test course', credits: 3, term: 'F', offered: ['Fall 2026', 'Spring 2027'] }]);
    addPublishedTerms(['Fall 2026', 'Spring 2027']);
    const c = COURSE['AS.999.101'];
    expect(offeredIn(c, TERM_BY_ID.S27)).toBe(true); // posted, has a section: the pattern no longer matters
    expect(offeredIn(c, TERM_BY_ID.S28)).toBe(false); // not posted yet: fall-only pattern
    expect(offeredIn(c, TERM_BY_ID.F27)).toBe(true);
    applySis([{ code: 'AS.999.101', offered: ['Fall 2026'] }]);
    expect(offeredIn(COURSE['AS.999.101'], TERM_BY_ID.S27)).toBe(false); // posted, no section
    const s: Scenario = { id: 'x', name: 'x', majorIds: [], premed: false, plan: [{ id: 'a', code: 'AS.999.101', termId: 'S27' }] };
    expect(texts(s).some((t) => /isn't on the SIS schedule for Spring 2027/.test(t))).toBe(true);
  });

  it('intersession and summer offerings are unknown until SIS posts them', () => {
    expect(offeredIn(COURSE['AS.280.345'], TERM_BY_ID.W28)).toBeUndefined();
    expect(offeredIn(COURSE['AS.030.246'], TERM_BY_ID.W28)).toBe(false); // fall-only course
  });
});
