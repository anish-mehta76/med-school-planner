import { describe, expect, it } from 'vitest';
import type { AppState, Program } from '../types';
import { normalize, STORAGE_KEY } from './useStore';
import { sampleState } from '../data/sample';
import { mentor } from '../engine/testMentors';
import { chemPhs } from '../planner/scenarios';

/** Every AppState field filled in, so a deploy that would drop saved data fails CI instead. */
function fullState(): AppState {
  const program: Program = {
    id: 'NYC99',
    priority: 1,
    name: 'Sample program',
    location: 'New York',
    recommendation: 'Apply',
    eligibility: 'Undergraduates',
    timeline: 'Apply by 2027-01-15',
    deadline: '2027-01-15',
    deadlineVerified: true,
    dates: [{ date: '2027-01-15', label: 'Deadline' }],
    summerDates: 'June–August',
    fit: 'Cervical screening',
    publicationEvidence: 'unverified',
    deliverable: 'Poster',
    pay: 'Stipend',
    nextAction: 'Ask a recommender',
    source: 'https://example.org',
  };
  return {
    ...sampleState(),
    oppStatus: { opp1: 'applied' },
    outreach: { R01: { status: 'sent', firstContact: '2026-10-01', notes: 'Hindi हिन्दी, Català', pitchVersion: 'v1-PCOS-bridge', outcome: '' } },
    programStatus: { NYC99: 'interested' },
    tracker: { fileName: 'tracker.csv', importedAt: '2026-10-15', columns: ['ID', 'Name'], rows: [{ ID: 'R01', Name: 'Dr. Example' }] },
    whyTemplates: { endometrial: 'My PCOS work…', cervical: 'Disparities…', methods: 'R pipelines…' },
    mentors: [mentor({ id: 'T09' })],
    programs: [program],
    planner: { scenarios: [{ ...chemPhs(), id: 'my-plan', name: 'My plan', sample: undefined }], activeId: 'my-plan' },
  };
}

describe('saved data survives a new deploy', () => {
  it('drops built-in sample plans so everyone starts from their own plan', () => {
    const sample = { ...chemPhs(), sample: undefined };
    expect(normalize({ planner: { scenarios: [sample], activeId: 'chem-phs' } }).planner).toBeUndefined();
    const mine = { ...sample, id: 'mine' };
    expect(normalize({ planner: { scenarios: [sample, mine], activeId: 'chem-phs' } }).planner).toEqual({ scenarios: [mine], activeId: 'mine' });
  });

  it('keeps the storage key, so existing browsers still find their data', () => {
    expect(STORAGE_KEY).toBe('med-school-planner:v1');
  });

  it('loads a fully filled save back unchanged', () => {
    const s = fullState();
    expect(normalize(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});
