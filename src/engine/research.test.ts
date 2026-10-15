import { describe, expect, it } from 'vitest';
import type { Program } from '../types';
import { DEFAULT_WEIGHTS, diseaseFit, mentorship, publicationEvidence, reachability, scoreMentor, underrepresented } from './mentorScore';
import { addBusinessDays, awaitingAction, effectiveOutreach, followUpsDue, OUTREACH_STATUSES, outreachPatch, sortPrograms, stageOf, TRACKER_STATUS, toOutreachStatus } from './outreach';
import { bridgeFor, whyThisLab } from './whyThisLab';
import { normalize } from '../store/useStore';
import { cited, HAS_PRIVATE_MENTORS, mentor, TEST_MENTORS as MENTORS } from './testMentors';

describe('mentor score parts', () => {
  it('ranks endometrial > cervical > gynecologic > methods-only', () => {
    const v = (t: string) => diseaseFit(mentor({ diseaseFit: cited(t) })).value;
    expect(v('Endometrial cancer')).toBeGreaterThan(v('Cervical cancer'));
    expect(v('Cervical cancer')).toBeGreaterThan(v('Ovarian and gynecologic pathology'));
    expect(v('Ovarian and gynecologic pathology')).toBeGreaterThan(v('Liquid biopsy methods'));
  });

  it('discounts qualified disease fit and says why', () => {
    const r = diseaseFit(mentor({ diseaseFit: cited('Endometrial collaboration; lab is primarily ovarian') }));
    expect(r.value).toBeCloseTo(0.7);
    expect(r.reasons.join(' ')).toMatch(/primarily ovarian/);
  });

  it('scores recent tiered publications and labels tiers unverified', () => {
    const r = publicationEvidence(mentor({ publications: [{ journal: 'Nature Genetics', year: 2023 }, { journal: 'Gynecologic Oncology', year: 2019 }] }));
    expect(r.value).toBe(0.5);
    expect(r.reasons).toEqual(['Nature Genetics 2023 (Flagship, tier unverified)']);
    expect(publicationEvidence(mentor({ publications: [{ journal: 'IJGC', year: 2024 }] })).reasons[0]).toMatch(/Specialty/);
  });

  it('prefers verified mentorship evidence', () => {
    expect(mentorship(mentor({ mentorshipEvidence: cited('Lists 3 undergraduate co-authors') })).value).toBe(1);
    expect(mentorship(mentor({ mentorshipEvidence: cited('Lab describes undergraduate education; capacity unverified') })).value).toBe(0.6);
    expect(mentorship(mentor()).value).toBe(0.2);
  });

  it('orders reachability Homewood > Baltimore > Bethesda > DC', () => {
    const v = (t: string) => reachability(mentor({ institution: cited(t) })).value;
    expect(v('Johns Hopkins INBT, Homewood')).toBeGreaterThan(v('Johns Hopkins, Baltimore'));
    expect(v('Johns Hopkins, Baltimore')).toBeGreaterThan(v('NCI/DCEG, Rockville'));
    expect(v('NCI/DCEG, Rockville')).toBeGreaterThan(v('Georgetown, Washington, DC'));
  });

  it('does not read "endometrial" as a trial or "journal" as RNA', async () => {
    const { largeStudy, skillsBridge } = await import('./mentorScore');
    expect(largeStudy(mentor({ strength: cited('Endometrial journal review') })).value).toBe(0);
    expect(skillsBridge(mentor({ strength: cited('Endometrial journal review') })).reasons[0]).toMatch(/No overlap/);
    expect(largeStudy(mentor({ strength: cited('Phase II trial') })).value).toBe(0.5);
  });

  it('ignores the appended PubMed verification note when scoring', () => {
    const base = mentor({ evidenceGate: 'Two papers.' });
    const noted = mentor({ evidenceGate: 'Two papers. PubMed check 2026-10-14: 38 papers 2022–2026 (16 endometrial/cervical/HPV; 24 with large-study signals).' });
    expect(scoreMentor(noted).total).toBe(scoreMentor(base).total);
  });

  it('detects underrepresented-population focus', () => {
    expect(underrepresented(mentor({ strength: cited('Disparities among Black women') })).value).toBe(1);
    expect(underrepresented(mentor()).value).toBe(0);
  });

  it('totals to 0–100 and respects weights', () => {
    const s = scoreMentor(mentor());
    expect(s.total).toBeGreaterThan(0);
    expect(s.total).toBeLessThanOrEqual(100);
    const onlyFit = scoreMentor(mentor(), { ...DEFAULT_WEIGHTS, skillsBridge: 0, publications: 0, largeStudy: 0, underrepresented: 0, mentorship: 0, reachability: 0 });
    expect(onlyFit.total).toBe(100);
  });

  it.skipIf(!HAS_PRIVATE_MENTORS)('scores every imported mentor without errors', () => {
    expect(MENTORS).toHaveLength(30);
    for (const m of MENTORS) expect(scoreMentor(m).total).toBeGreaterThan(0);
  });
});

describe('outreach', () => {
  it('adds business days skipping weekends', () => {
    expect(addBusinessDays('2026-10-14', 10)).toBe('2026-10-28'); // Wed → Wed two weeks later
    expect(addBusinessDays('2026-10-16', 1)).toBe('2026-10-19'); // Fri → Mon
  });

  it('sets follow-up and moves drafts to sent on first contact', () => {
    expect(outreachPatch({ status: 'drafted' }, { firstContact: '2026-10-14' })).toEqual({ firstContact: '2026-10-14', followUpDue: '2026-10-28', status: 'sent' });
    expect(outreachPatch({ status: 'interested' }, { firstContact: '2026-10-14' }).status).toBeUndefined();
  });

  it('lets app edits override imported CSV values', () => {
    const m = mentor();
    const tracker = { fileName: 't.csv', importedAt: '', columns: [], rows: [{ ID: 'RX', 'Outreach status': 'Sent', Notes: 'from csv', 'Preferred academic-year or summer window': 'summer' }] };
    const o = effectiveOutreach(m, { outreach: { RX: { notes: 'mine' } }, tracker });
    expect(o).toMatchObject({ status: 'sent', notes: 'mine', window: 'summer' });
    expect(effectiveOutreach(m, { outreach: {} })).toEqual({ status: 'drafted' });
  });

  it('derives the follow-up-due stage', () => {
    expect(stageOf({ status: 'sent', followUpDue: '2026-10-14' }, '2026-10-14')).toBe('follow-up');
    expect(stageOf({ status: 'sent', followUpDue: '2026-10-20' }, '2026-10-14')).toBe('sent');
  });

  it('lists follow-ups due by Sunday', () => {
    const ms = [mentor({ id: 'A' }), mentor({ id: 'B' }), mentor({ id: 'C' }), mentor({ id: 'D' })];
    const state = {
      outreach: {
        A: { status: 'sent' as const, followUpDue: '2026-10-16' },
        B: { status: 'sent' as const, followUpDue: '2026-10-25' },
        C: { status: 'interested' as const, followUpDue: '2026-10-15' },
        D: { status: 'followed-up' as const, followUpDue: '2026-10-15' },
      },
    };
    expect(followUpsDue(ms, state, '2026-10-14').map((x) => x.m.id)).toEqual(['A']);
  });

  it('only sent mentors get the derived follow-up-due stage', () => {
    expect(stageOf({ status: 'followed-up', followUpDue: '2026-10-01' }, '2026-10-14')).toBe('followed-up');
    expect(stageOf({ status: 'no-response', followUpDue: '2026-10-01' }, '2026-10-14')).toBe('no-response');
  });

  it('flags interested, redirected and meeting as awaiting your action', () => {
    const ids = ['drafted', 'sent', 'followed-up', 'no-response', 'declined', 'redirected', 'interested', 'meeting', 'joined'] as const;
    const ms = ids.map((id) => mentor({ id }));
    const state = { outreach: Object.fromEntries(ids.map((id) => [id, { status: id }])) };
    expect(awaitingAction(ms, state).map((x) => x.m.id)).toEqual(['redirected', 'interested', 'meeting']);
  });

  it('sorts programs by upcoming deadline, undated last', () => {
    const p = (id: string, priority: number, deadline?: string) => ({ id, priority, deadline }) as Program;
    const sorted = sortPrograms([p('a', 1), p('b', 2, '2027-02-01'), p('c', 3, '2027-01-15'), p('d', 4, '2026-01-01')], '2026-10-14');
    expect(sorted.map((x) => x.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});

describe('why this lab', () => {
  it('picks the PCOS bridge for endometrial and the HPV bridge for cervical', () => {
    expect(bridgeFor(mentor())).toBe('endometrial');
    expect(whyThisLab(mentor())).toMatch(/questions I want to study in endometrial cancer/);
    expect(whyThisLab(mentor(), { endometrial: 'Mine: {dr} on {focus}. {paper}' })).toMatch(/^Mine: Dr\. Doe on endometrial cancer\. Your lab's focus/);
    const cerv = mentor({ diseaseFit: cited('Cervical precancer and HPV'), publications: [{ journal: 'Gynecologic Oncology', year: 2025 }] });
    expect(whyThisLab(cerv)).toMatch(/HPV vaccination and screening/);
    expect(whyThisLab(cerv)).toMatch(/Your 2025 Gynecologic Oncology paper stood out/);
    expect(whyThisLab(mentor())).toMatch(/^Dr\. Doe's/);
  });
});

describe('backup compatibility', () => {
  it('loads an old backup without research fields', () => {
    const s = normalize({ version: 1, experiences: [], outputs: [] });
    expect(s.outreach).toEqual({});
    expect(s.scoreWeights).toEqual(DEFAULT_WEIGHTS);
  });
});

describe('suggestMentors', () => {
  it('suggests top mentors only while research or publications has a gap', async () => {
    const { suggestMentors } = await import('./recommend');
    const { scoreAreas, findGaps } = await import('./gaps');
    const { defaultState } = await import('../store/useStore');
    const s = defaultState();
    const now = new Date(2026, 9, 14);
    const picks = suggestMentors(MENTORS, scoreAreas(s, now), findGaps(s, now), s);
    expect(picks).toHaveLength(3);
    expect(picks[0].score.total).toBeGreaterThanOrEqual(picks[2].score.total);

    const strong = { ...s, outputs: [1, 2].map((i) => ({ id: `o${i}`, type: 'poster' as const, title: '', venue: '', status: 'presented' as const })) };
    strong.experiences = [{ ...mentorExp(), baseHours: 1200 }];
    expect(suggestMentors(MENTORS, scoreAreas(strong, now), findGaps(strong, now), strong)).toEqual([]);

    const declined = { ...s, outreach: { [picks[0].m.id]: { status: 'declined' as const } } };
    expect(suggestMentors(MENTORS, scoreAreas(declined, now), findGaps(declined, now), declined).map((x) => x.m.id)).not.toContain(picks[0].m.id);
  });
});

function mentorExp() {
  return {
    id: 'e1', title: 'Lab', organization: '', category: 'research' as const, startDate: '2025-01-01', ongoing: true,
    baseHours: 0, logs: [], description: '', meaningful: false, underserved: true,
  };
}

describe('joinMentor', () => {
  it('creates a linked experience and placeholder output', async () => {
    const { joinMentor } = await import('./joinMentor');
    const { defaultState } = await import('../store/useStore');
    const s = joinMentor(defaultState(), MENTORS[0]);
    expect(s.experiences).toHaveLength(1);
    expect(s.experiences[0].category).toBe('research');
    expect(s.outputs[0]).toMatchObject({ status: 'in-prep', experienceId: s.experiences[0].id });
    expect(s.outreach[MENTORS[0].id]).toMatchObject({ status: 'joined', experienceId: s.experiences[0].id });
  });
});

describe('outreach status set', () => {
  it('matches the CLAUDE.md tracker values one-to-one, in order', () => {
    expect(OUTREACH_STATUSES.map((k) => TRACKER_STATUS[k])).toEqual([
      'Drafted; not sent',
      'Sent',
      'Followed up',
      'No response',
      'Replied - declined',
      'Replied - redirected',
      'Replied - interested',
      'Meeting',
      'Joined',
    ]);
    for (const k of OUTREACH_STATUSES) expect(toOutreachStatus(TRACKER_STATUS[k])).toBe(k);
  });

  it('migrates statuses from older saves', () => {
    const old = { drafted: 'drafted', sent: 'sent', replied: 'interested', meeting: 'meeting', joined: 'joined', declined: 'declined' };
    const s = normalize({ outreach: Object.fromEntries(Object.keys(old).map((k) => [`R-${k}`, { status: k, notes: k }])) });
    for (const [from, to] of Object.entries(old)) expect(s.outreach[`R-${from}`]).toEqual({ status: to, notes: from });
  });

  it('keeps current statuses and status-less edits as they are', () => {
    const s = normalize({ outreach: { A: { status: 'redirected' }, B: { notes: 'just a note' }, C: { status: 'Replied - declined' } } });
    expect(s.outreach).toEqual({ A: { status: 'redirected' }, B: { notes: 'just a note' }, C: { status: 'declined' } });
  });
});

describe('mentor and program lists in backups', () => {
  it('keeps valid lists from a backup and drops malformed ones', () => {
    const m = mentor({ id: 'T09' });
    const p = { id: 'NYC99', name: 'Sample program' } as Program;
    const s = normalize({ version: 1, mentors: [m], programs: [p] });
    expect(s.mentors).toEqual([m]);
    expect(s.programs).toEqual([p]);
    expect(normalize({ version: 1, mentors: [{ name: 'no id' }], programs: 'x' }).mentors).toBeUndefined();
  });

  it('writes the lists into the backup so another browser can restore them', async () => {
    const { backupOf, defaultState } = await import('../store/useStore');
    const { mentorsOf, programsOf } = await import('../data/researchData');
    const restored = normalize(JSON.parse(JSON.stringify(backupOf({ ...defaultState(), mentors: [mentor({ id: 'T09' })] }))));
    expect(restored.mentors?.length).toBe(mentorsOf(restored).length);
    expect(restored.programs ?? []).toEqual(programsOf(restored));
  });
});
