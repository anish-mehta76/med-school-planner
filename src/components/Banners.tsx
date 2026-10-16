import { resolveConflict, useSyncStatus } from '../lib/sync';
import { useNewVersion } from '../lib/version';

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'an unknown time');

/** App-wide notices: a newer deploy, and a sync conflict that needs your choice. */
export default function Banners() {
  const newer = useNewVersion();
  const sync = useSyncStatus();
  return (
    <>
      {sync.kind === 'conflict' && (
        <div className="app-banner warn" role="alert">
          <p className="small">
            <strong>Both devices changed your planner.</strong> This device: {when(sync.localAt)}. Your {sync.remoteDevice ?? 'other device'}: {when(sync.remoteAt)}. Which
            copy should both use? The other one stays in your data repo's history on GitHub.
          </p>
          <div className="row-actions tight">
            <button className="btn btn-small btn-primary" onClick={() => void resolveConflict('this')}>
              Keep this device's
            </button>
            <button className="btn btn-small" onClick={() => void resolveConflict('other')}>
              Use the {sync.remoteDevice ?? 'other device'}'s
            </button>
          </div>
        </div>
      )}
      {newer && (
        <div className="app-banner" role="status">
          <p className="small">A new version of the planner is available. Your data stays as it is.</p>
          <button className="btn btn-small btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
    </>
  );
}
