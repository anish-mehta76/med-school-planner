import { describe, expect, it } from 'vitest';
import { defaultState } from '../store/useStore';
import type { AppState, Experience, Opportunity } from '../types';
import { experienceHours, findGaps, projectedHours, scoreAreas } from './gaps';
import { monthsToNextDeadline, rankOpportunities } from './recommend';

const NOW = new Date(2026, 9, 14); // Oct 14 2026

function exp(p: Partial<Experience>): Experience {
  return {
    id: Math.random().toString(),
    title: 'x',
    organization: 'y',
    category: 'clinical-volunteer',
    startDate: '2025-01-01',
    ongoing: false,
    baseHours: 0,
    logs: [],
    description: '',
    meaningful: false,
    underserved: false,
    ...p,
  };
}

function state(p: Partial<AppState> = {}): AppState {
  const s = defaultState();
  return { ...s, profile: { ...s.profile, applicationYear: 2028 }, ...p };
}

describe('hours', () => {
  it('sums base hours and logs', () => {
    expect(experienceHours(exp({ baseHours: 10, logs: [{ id: 'a', date: '2026-01-01', hours: 4 }] }))).toBe(14);
  });

  it('projects ongoing weekly hours to the deadline', () => {
    const e = exp({ ongoing: true, hoursPerWeek: 4 });
    const weeks = (new Date(2028, 5, 1).getTime() - NOW.getTime()) / (7 * 86_400_000);
    expect(projectedHours(e, new Date(2028, 5, 1), NOW)).toBe(Math.round(weeks * 4));
    expect(projectedHours(exp({ ongoing: false, hoursPerWeek: 4 }), new Date(2028, 5, 1), NOW)).toBe(0);
  });
});

describe('scoreAreas', () => {
  it('flags every hour area as critical for an empty profile', () => {
    const areas = scoreAreas(state(), NOW);
    for (const a of ['clinical', 'shadowing', 'volunteering', 'research']) {
      expect(areas.find((x) => x.area === a)?.severity).toBe('critical');
    }
  });

  it('counts ongoing commitments toward the projection', () => {
    const s = state({ experiences: [exp({ baseHours: 50, ongoing: true, hoursPerWeek: 8 })] });
    const clinical = scoreAreas(s, NOW).find((a) => a.area === 'clinical')!;
    expect(clinical.current).toBe(50);
    expect(clinical.severity).toBe('on-track');
    expect(clinical.pacePerMonth).toBeGreaterThan(0);
  });

  it('rates strong at the competitive target', () => {
    const s = state({ experiences: [exp({ baseHours: 700 })] });
    expect(scoreAreas(s, NOW).find((a) => a.area === 'clinical')!.severity).toBe('strong');
  });
});

describe('findGaps', () => {
  it('detects qualitative gaps', () => {
    const s = state({
      experiences: [
        exp({ baseHours: 700 }),
        exp({ category: 'shadowing', specialty: 'Orthopedic surgery', baseHours: 60 }),
        exp({ category: 'research', baseHours: 400, ongoing: true, hoursPerWeek: 10 }),
      ],
    });
    const ids = findGaps(s, NOW).map((g) => g.id);
    expect(ids).toEqual(expect.arrayContaining(['clinical-longitudinal', 'shadow-primary', 'shadow-variety', 'output', 'underserved', 'mcat-plan']));
    expect(ids).not.toContain('hours-clinical');
  });

  it('sorts critical gaps first', () => {
    const gaps = findGaps(state(), NOW);
    expect(gaps[0].severity).toBe('critical');
  });
});

describe('rankOpportunities', () => {
  const opp = (id: string, areas: Opportunity['areas'], deadlineMonths?: number[]): Opportunity => ({
    id, name: id, kind: 'clinical-role', areas, description: '', eligibility: '', timing: '', url: '', deadlineMonths,
  });

  it('ranks opportunities for weak areas above strong ones', () => {
    const s = state({ experiences: [exp({ baseHours: 700, ongoing: true, underserved: true })] });
    const ranked = rankOpportunities([opp('clin', ['clinical']), opp('res', ['research'])], scoreAreas(s, NOW), findGaps(s, NOW), NOW);
    expect(ranked[0].opp.id).toBe('res');
  });

  it('computes months to next deadline with wraparound', () => {
    expect(monthsToNextDeadline([1], NOW)).toBe(3);
    expect(monthsToNextDeadline([10, 2], NOW)).toBe(0);
  });
});
