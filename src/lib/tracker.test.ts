import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { exportTrackerCsv, parseTrackerCsv, TrackerImportError, trackerPrivate } from './tracker';
import { TEST_MENTORS as MENTORS } from '../engine/testMentors';

const COLUMNS = ['ID', 'Outreach priority', 'Researcher', 'Suggested project pitch (not advertised)', 'Outreach status', 'First contact date', 'Notes', 'Draft subject', 'Draft email body'];

function csv(rows: string[][], bom = true) {
  const body = Papa.unparse({ fields: COLUMNS, data: rows }, { quotes: true, newline: '\r\n' });
  return `${bom ? '﻿' : ''}${body}\r\n`;
}

const id = MENTORS[0].id;
const row = [id, 'Start', MENTORS[0].name, 'Curate the tumor series', 'Drafted; not sent', '', '', 'Hopkins freshman', 'Dear Dr. X,\n\nMulti-line [paper](https://example.org) body.'];

describe('tracker CSV', () => {
  it('imports private columns with a BOM and multi-line cells', () => {
    const t = parseTrackerCsv(csv([row]), 'tracker.csv', '2026-10-14T00:00:00Z');
    expect(t.columns).toEqual(COLUMNS);
    const p = trackerPrivate(t)[id];
    expect(p.pitch).toBe('Curate the tumor series');
    expect(p.draftBody).toContain('\n\nMulti-line');
    expect(p.outreach.status).toBe('drafted');
  });

  it('rejects files that are not the research tracker', () => {
    expect(() => parseTrackerCsv('a,b\n1,2\n', 'x.csv')).toThrow(TrackerImportError);
  });

  it('exports every column with app edits, appended columns, BOM and CRLF', () => {
    const tracker = parseTrackerCsv(csv([row]), 'tracker.csv');
    const out = exportTrackerCsv({ tracker, outreach: { [id]: { status: 'sent', firstContact: '2026-10-14', notes: 'emailed', pitchVersion: 'v1-PCOS-bridge' } } }, MENTORS);
    expect(out.startsWith('﻿"ID"')).toBe(true);
    expect(out.endsWith('\r\n')).toBe(true);
    const parsed = Papa.parse<Record<string, string>>(out.slice(1), { header: true, skipEmptyLines: true });
    expect(parsed.meta.fields).toEqual([...COLUMNS, 'Pitch version', 'Outcome']);
    const r = parsed.data[0];
    expect(r['Outreach status']).toBe('Sent');
    expect(r['First contact date']).toBe('2026-10-14');
    expect(r.Notes).toBe('emailed');
    expect(r['Pitch version']).toBe('v1-PCOS-bridge');
    expect(r['Draft email body']).toBe(row[8]);
    expect(r['Suggested project pitch (not advertised)']).toBe(row[3]);
  });

  // The tracker CSV is private and not in the public repo, so this only runs locally.
  const TRACKER = 'uterine-cervical-cancer-opportunities-tracker.csv';
  it.skipIf(!existsSync(TRACKER))('round-trips the real tracker without changing it when there are no edits', () => {
    const original = readFileSync(TRACKER, 'utf8');
    const tracker = parseTrackerCsv(original, 'tracker.csv');
    expect(exportTrackerCsv({ tracker, outreach: {} }, MENTORS)).toBe(original);
  });
});
