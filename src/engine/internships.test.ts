import { describe, expect, it } from 'vitest';
import type { Internship } from '../types';
import { normalize } from '../store/useStore';
import { dueLabel, internshipTasks, lettersNeeded, materials, recommendersByPerson, sortInternships, waitingOn, withStatus } from './internships';

const base = (p: Partial<Internship> = {}): Internship => ({
  id: 'i1',
  title: 'SURF',
  organization: 'Lab',
  description: '',
  status: 'preparing',
  requirements: [],
  recommenders: [],
  log: [],
  createdAt: '2026-11-01',
  ...p,
});

describe('internships', () => {
  it('counts materials without letters and letters from the requirement', () => {
    const i = base({
      requirements: [
        { id: 'a', kind: 'cover', status: 'ready' },
        { id: 'b', kind: 'supplemental', status: 'drafting' },
        { id: 'c', kind: 'recs', status: 'todo', count: 2 },
      ],
    });
    expect(materials(i)).toEqual({ done: 1, total: 2 });
    expect(lettersNeeded(i)).toBe(2);
  });

  it('logs status changes and fills the applied date once', () => {
    const i = withStatus(base(), 'awaiting-recs', '2026-11-27');
    expect(i.appliedOn).toBe('2026-11-27');
    expect(i.log.at(-1)?.text).toMatch(/Preparing materials → Applied – waiting on letters/);
    expect(withStatus(i, 'applied', '2026-12-01').appliedOn).toBe('2026-11-27');
  });

  it('lists who you are waiting on', () => {
    const i = base({
      recommenders: [
        { id: 'r1', name: 'A', status: 'agreed' },
        { id: 'r2', name: 'B', status: 'submitted' },
        { id: 'r3', name: 'C', status: 'asked' },
      ],
    });
    expect(waitingOn(i).map((r) => r.name)).toEqual(['A', 'C']);
  });

  it('builds tasks for close deadlines, unasked letters, silent recommenders and thank-yous', () => {
    const today = '2026-11-27';
    const tasks = internshipTasks(
      [
        base({ deadline: '2026-12-02', recommenders: [{ id: 'r1', name: 'Dr. A', status: 'to-ask' }] }),
        base({ id: 'i2', status: 'applied', recommenders: [{ id: 'r2', name: 'Dr. B', status: 'asked', askedOn: '2026-11-10' }, { id: 'r3', name: 'Dr. C', status: 'submitted' }] }),
        base({ id: 'i3', status: 'rejected', deadline: '2026-11-30' }),
      ],
      today,
    );
    const titles = tasks.map((t) => t.title);
    expect(titles).toContain('Due in 5 days: SURF · Lab');
    expect(titles).toContain('Ask Dr. A for a letter');
    expect(titles).toContain('Follow up with Dr. B');
    expect(titles).toContain('Thank Dr. C');
    expect(tasks.some((t) => t.internshipId === 'i3')).toBe(false);
  });

  it('groups recommenders by name across applications', () => {
    const people = recommendersByPerson([
      base({ recommenders: [{ id: 'r1', name: 'Dr. A', role: 'PI', status: 'agreed' }] }),
      base({ id: 'i2', recommenders: [{ id: 'r2', name: 'dr. a ', status: 'submitted' }] }),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].items).toHaveLength(2);
    expect(people[0].role).toBe('PI');
  });

  it('sorts open applications before closed ones', () => {
    const list = sortInternships([base({ id: 'x', status: 'rejected' }), base({ id: 'y', deadline: '2027-01-01' })], '2026-11-27');
    expect(list.map((i) => i.id)).toEqual(['y', 'x']);
  });

  it('formats due labels', () => {
    expect(dueLabel('2026-11-27', '2026-11-27')).toBe('Due today');
    expect(dueLabel('2026-11-25', '2026-11-27')).toBe('2 days past due');
  });

  it('keeps internships through normalize and drops malformed ones', () => {
    const s = normalize({ internships: [{ id: 'a', title: 'T' }, { nope: true }] });
    expect(s.internships).toHaveLength(1);
    expect(s.internships[0].requirements).toEqual([]);
    expect(normalize({}).internships).toEqual([]);
  });
});
