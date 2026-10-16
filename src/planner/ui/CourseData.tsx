import { useState } from 'react';
import { CATALOGUE_IMPORTED_AT } from '../majors';
import { SIS_SYNCED_AT } from '../catalog';
import { getSisKey, LIVE_AVAILABLE, liveSyncedAt, refreshLive, setSisKey, type LiveProgress } from '../live';
import type { ScenarioAnalysis } from '../engine';

/** Where course data comes from, and your own SIS key for live lookups. */
export default function CourseData({ analysis }: { analysis: ScenarioAnalysis }) {
  const [key, setKey] = useState(getSisKey);
  const [saved, setSaved] = useState(!!getSisKey());
  const [progress, setProgress] = useState<LiveProgress>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const codes = [...new Set(analysis.resolved.map((r) => r.code))];
  const live = liveSyncedAt();

  const refresh = async () => {
    setError('');
    setBusy(true);
    try {
      setProgress(await refreshLive(codes, setProgress));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The lookup failed.');
    }
    setBusy(false);
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>Where course data comes from</h2>
        <ul className="small req-notes">
          <li>Major requirements and course titles: JHU e-catalogue, imported {CATALOGUE_IMPORTED_AT}.</li>
          <li>{SIS_SYNCED_AT ? `Offerings, FA tags and prerequisites: SIS, synced ${SIS_SYNCED_AT}.` : 'Offerings, FA tags and prerequisites: not synced from SIS yet, so science FA tags are estimates.'}</li>
          {live && <li>Your own SIS lookups in this browser: {live}.</li>}
        </ul>
      </section>

      <section className="card">
        <h2>Your SIS API key</h2>
        <p className="small muted">
          Look up the courses in your plan in SIS (titles, credits, FA tags, writing-intensive, prerequisites, fall/spring-only). The key is saved only in this
          browser: never in backups, synced data or the website. Get one at sis.jhu.edu/api.
        </p>
        {!LIVE_AVAILABLE && (
          <p className="callout small">
            SIS doesn't accept requests from websites, so live lookups work only when you run the planner on your computer (<code>npm run dev</code>). The public
            site gets SIS data from a weekly update instead.
          </p>
        )}
        <form
          className="form sis-form"
          onSubmit={(e) => {
            e.preventDefault();
            setSisKey(key);
            setSaved(!!key.trim());
          }}
        >
          <label>
            API key
            <input type="password" value={key} onChange={(e) => (setKey(e.target.value), setSaved(false))} autoComplete="off" spellCheck={false} />
          </label>
          <div className="row-actions">
            <button className="btn" type="submit">
              {saved ? 'Saved' : 'Save key'}
            </button>
            {saved && (
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setSisKey('');
                  setKey('');
                  setSaved(false);
                }}
              >
                Remove key
              </button>
            )}
            <button className="btn btn-primary" type="button" disabled={!saved || !LIVE_AVAILABLE || busy || !codes.length} onClick={() => void refresh()}>
              {busy ? `Looking up ${progress?.done ?? 0} of ${codes.length}…` : `Look up my ${codes.length} courses`}
            </button>
          </div>
        </form>
        {error && <p className="small sync-error">{error}</p>}
        {progress && !busy && (
          <p className="small muted">
            Updated {progress.total - progress.failed.length} courses.{progress.failed.length > 0 && ` Not found in SIS: ${progress.failed.join(', ')}.`}
          </p>
        )}
      </section>
    </div>
  );
}
