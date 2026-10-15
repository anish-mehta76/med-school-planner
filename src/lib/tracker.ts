import Papa from 'papaparse';
import type { AppState, Mentor, MentorPrivate, TrackerImport } from '../types';
import { csvOutreachById, effectiveOutreach, OUTREACH_COLUMNS, TRACKER_STATUS } from '../engine/outreach';

/** Columns a tracker CSV must have to be imported. */
export const REQUIRED_COLUMNS = ['ID', 'Researcher', 'Outreach status', 'Draft subject', 'Draft email body'];

/** Columns CLAUDE.md says are appended to the tracker if missing. */
const APPENDED_COLUMNS = ['Pitch version', 'Outcome'];

export class TrackerImportError extends Error {}

/**
 * Parses your uterine/cervical tracker CSV (UTF-8 with or without BOM,
 * multi-line quoted cells) and keeps it verbatim so it can be exported again.
 */
export function parseTrackerCsv(text: string, fileName: string, importedAt = new Date().toISOString()): TrackerImport {
  const { data, errors, meta } = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true });
  if (errors.length) throw new TrackerImportError(`Couldn't read the CSV (row ${errors[0].row ?? '?'}: ${errors[0].message}).`);
  const columns = meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length) throw new TrackerImportError(`This doesn't look like your research tracker: missing ${missing.join(', ')}.`);
  const rows = data.filter((r) => r.ID?.trim());
  if (!rows.length) throw new TrackerImportError('The CSV has no researcher rows.');
  return { fileName, importedAt, columns, rows };
}

const privateCache = new WeakMap<TrackerImport, Record<string, MentorPrivate>>();

/** Private columns (pitch, draft email, outreach) by mentor ID, from the imported CSV. */
export function trackerPrivate(tracker: TrackerImport | undefined): Record<string, MentorPrivate> {
  if (!tracker) return {};
  let byId = privateCache.get(tracker);
  if (!byId) {
    const outreach = csvOutreachById(tracker);
    byId = Object.fromEntries(
      tracker.rows.map((r) => {
        const id = r.ID.trim();
        return [
          id,
          {
            pitch: r['Suggested project pitch (not advertised)']?.trim() ?? '',
            draftSubject: r['Draft subject']?.trim() ?? '',
            draftBody: r['Draft email body']?.trim() ?? '',
            outreach: outreach[id] ?? {},
          },
        ];
      }),
    );
    privateCache.set(tracker, byId);
  }
  return byId;
}

/**
 * Rebuilds the full tracker CSV: every original column and row, with your in-app
 * outreach edits written into the outreach columns. Same column order, UTF-8 BOM,
 * every cell quoted and CRLF line endings, matching the original file.
 */
export function exportTrackerCsv(state: Pick<AppState, 'outreach' | 'tracker'>, mentors: Mentor[]): string {
  const tracker = state.tracker;
  if (!tracker) throw new TrackerImportError('Import your tracker CSV first.');
  const columns = [...tracker.columns, ...APPENDED_COLUMNS.filter((c) => !tracker.columns.includes(c))];
  const byId = new Map(mentors.map((m) => [m.id, m]));
  const rows = tracker.rows.map((row) => {
    const m = byId.get(row.ID.trim());
    if (!m) return { ...row };
    const o = effectiveOutreach(m, state);
    const out: Record<string, string> = { ...row, 'Outreach status': TRACKER_STATUS[o.status] };
    for (const [col, key] of Object.entries(OUTREACH_COLUMNS)) {
      const v = o[key];
      out[col] = v === undefined || v === null ? '' : String(v);
    }
    return out;
  });
  return `﻿${Papa.unparse(rows, { columns, quotes: true, newline: '\r\n' })}\r\n`;
}
