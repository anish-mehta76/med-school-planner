import { describe, expect, it } from 'vitest';
import { AP_TABLE, apAward, apItems, forfeits } from './apCredit';
import { analyze, newItemId, resolve } from './engine';
import { evaluateSchool, MED_SCHOOL_BY_ID, MED_SCHOOLS } from './medSchools';
import type { PlanItem, Scenario } from './types';

const ap = (exam: string, score: number) => apItems(exam, score, newItemId);
const at = (termId: string, ...codes: string[]): PlanItem[] => codes.map((code) => ({ id: newItemId(), code, termId }));
const school = (id: string, plan: PlanItem[]) => evaluateSchool(MED_SCHOOL_BY_ID[id], resolve(plan));
const row = (id: string, plan: PlanItem[], key: string) => school(id, plan).reqs.find((r) => r.req.key === key)!;
const scenario = (plan: PlanItem[]): Scenario => ({ id: 't', name: 't', majorIds: [], plan, premed: false });

describe('JHU AP table', () => {
  it('awards the catalogue credits for each score', () => {
    expect(ap('AP Chemistry', 5).reduce((n, p) => n + (p.credits ?? 0), 0)).toBe(8);
    expect(ap('AP Chemistry', 4).map((p) => p.code)).toEqual(['AS.030.101', 'AS.030.105']);
    expect(ap('AP Calculus BC', 3).map((p) => p.code)).toEqual(['AS.110.108']);
    expect(ap('AP Biology', 4)).toEqual([]);
    expect(apAward('AP Statistics', 3)).toBeUndefined();
    for (const a of AP_TABLE) expect(a.courses.length).toBeGreaterThan(0);
  });

  it('flags JHU forfeiture when the course is also taken here', () => {
    const bio = ap('AP Biology', 5);
    const lost = forfeits([...bio, ...at('F26', 'AS.020.153')]);
    expect(lost.map((f) => f.item.code)).toEqual(['AS.020.151']);
    const chem = ap('AP Chemistry', 5);
    expect(forfeits([...chem, ...at('F26', 'AS.030.103')]).map((f) => f.item.code).sort()).toEqual(['AS.030.102', 'AS.030.106']);
  });

  it('drops forfeited exam credit from the counted total and warns', () => {
    const a = analyze(scenario([...ap('AP Calculus AB', 5), ...at('F26', 'AS.110.106')]));
    expect(a.externalCredits).toBe(0);
    expect(a.flags.some((f) => f.text.includes('cancels your AP Calculus AB (5) credit'))).toBe(true);
    expect(a.flags.some((f) => f.text.includes('in the plan 2 times'))).toBe(false);
  });

  it('warns that AP Chemistry 4 students should take 030.103, not 030.102', () => {
    const a = analyze(scenario([...ap('AP Chemistry', 4), ...at('F26', 'AS.030.102')]));
    expect(a.flags.some((f) => f.text.includes('Take AS.030.103 instead'))).toBe(true);
  });
});

describe('medical-school comparison', () => {
  it('every school has a source page, a date and at least one requirement', () => {
    for (const s of MED_SCHOOLS) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.reqs.length).toBeGreaterThan(0);
    }
  });

  it('every school id is unique', () => {
    const ids = MED_SCHOOLS.map((s) => s.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('AP Biology: Harvard never counts it; Hopkins counts it once there is an advanced biology course', () => {
    const base = [...ap('AP Biology', 5)];
    expect(row('harvard', base, 'bio').status).toBe('missing');
    expect(row('jhu-som', base, 'bio').status).toBe('partial');
    const withGenetics = [...base, ...at('F27', 'AS.020.303', 'AS.020.340')];
    expect(row('jhu-som', withGenetics, 'bio').status).toBe('met');
    expect(row('harvard', withGenetics, 'bio').status).toBe('partial');
    expect(row('jhu-advising', withGenetics, 'bio').status).toBe('partial');
  });

  it('a lab requirement met only by AP credit asks you to check', () => {
    const plan = [...ap('AP Physics C: Mechanics', 5), ...ap('AP Physics C: Electricity & Magnetism', 5)];
    expect(row('jhu-som', plan, 'physics').status).toBe('check');
    expect(row('washu', plan, 'physics').status).toBe('met');
  });

  it('Harvard counts at most one semester of AP in chemistry, with an upper-level course', () => {
    const plan = [...ap('AP Chemistry', 5), ...at('F26', 'AS.030.205', 'AS.030.225'), ...at('S27', 'AS.030.206'), ...at('F27', 'AS.020.305')];
    const r = row('harvard', plan, 'chem');
    expect(r.items.filter((x) => x.season === 'PRE')).toHaveLength(1);
    expect(r.status).toBe('met');
  });

  it('applies the Hopkins 12-credit AP cap across requirements', () => {
    const plan = [...ap('AP Physics C: Mechanics', 5), ...ap('AP Physics C: Electricity & Magnetism', 5), ...ap('AP Calculus BC', 5)];
    const res = school('jhu-som', plan);
    const used = res.reqs.flatMap((r) => r.items).filter((x) => x.season === 'PRE');
    expect(used.reduce((n, x) => n + x.credits, 0)).toBeLessThanOrEqual(12);
  });

  it('Mount Sinai takes AP physics only with a 5', () => {
    const four = ap('AP Physics C: Mechanics', 4);
    expect(row('sinai', four, 'physics').status).toBe('missing');
    expect(row('sinai', ap('AP Physics C: Mechanics', 5), 'physics').status).toBe('met');
  });
});

describe('upper-level requirements', () => {
  it('UNC counts only upper-level biology, never AP', () => {
    expect(row('unc', [...ap('AP Biology', 5), ...at('F26', 'AS.020.151', 'AS.020.152')], 'bio').status).toBe('missing');
    expect(row('unc', at('F27', 'AS.020.303', 'AS.020.306'), 'bio').status).toBe('met');
  });
});

describe('every school', () => {
  it('evaluates a typical pre-med plan with AP credit without errors', () => {
    const plan = [
      ...ap('AP Chemistry', 5),
      ...ap('AP Calculus BC', 5),
      ...at('F26', 'AS.020.151', 'AS.020.153', 'AS.030.205', 'AS.030.225'),
      ...at('S27', 'AS.020.152', 'AS.020.154', 'AS.030.206'),
      ...at('F27', 'AS.171.101', 'AS.173.111', 'AS.020.305'),
      ...at('S28', 'AS.171.102', 'AS.173.112', 'AS.280.345'),
    ];
    for (const s of MED_SCHOOLS) {
      const res = evaluateSchool(s, resolve(plan));
      expect(res.reqs).toHaveLength(s.reqs.length);
      expect(res.requiredMet).toBeLessThanOrEqual(res.required);
    }
  });
});
