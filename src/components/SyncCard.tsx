import { useState } from 'react';
import { connect, disconnect, getConfig, syncNow, useSyncStatus } from '../lib/sync';

function ago(iso?: string) {
  if (!iso) return 'not yet';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Connect this device to the private GitHub repo that holds the shared planner data. */
export default function SyncCard() {
  const status = useSyncStatus();
  const cfg = getConfig();
  const [owner, setOwner] = useState(cfg?.owner ?? '');
  const [repo, setRepo] = useState(cfg?.repo ?? 'med-school-planner-data');
  const [token, setToken] = useState('');

  const busy = status.kind === 'syncing';
  const error = status.kind === 'error' ? <p className="small sync-error" role="alert">{status.message}</p> : null;

  return (
    <section className="card">
      <h2>Sync between devices</h2>
      {cfg ? (
        <>
          <div className="sync-status">
            <p className="small" style={{ margin: 0 }}>
              <strong>
                Syncing with {cfg.owner}/{cfg.repo}
              </strong>
              <span className="muted">
                {' · '}
                {busy ? 'Syncing…' : status.kind === 'conflict' ? 'Waiting for your choice above' : cfg.dirty ? 'Changes waiting to sync' : `Synced ${ago(cfg.lastSyncedAt)}`}
              </span>
            </p>
            <div className="row-actions tight">
              <button className="btn btn-small" disabled={busy || status.kind === 'conflict'} onClick={() => void syncNow()}>
                Sync now
              </button>
              <button className="btn btn-small" onClick={() => confirm('Stop syncing on this device? Your data here stays as it is.') && disconnect()}>
                Disconnect
              </button>
            </div>
          </div>
          {error}
          <p className="small muted">
            Changes upload a few seconds after you make them, and the other device picks them up when you open it. Reset everything and Load sample data
            also sync, but every earlier version stays in the repo's history on GitHub.
          </p>
        </>
      ) : (
        <>
          <p className="small muted">
            Share one planner between your Mac and phone through a <strong>private</strong> GitHub repo. Set it up once:
          </p>
          <ol className="small muted sync-steps">
            <li>On GitHub, create a private repo (for example med-school-planner-data). It can be empty.</li>
            <li>
              Settings → Developer settings → Fine-grained tokens → Generate new token. Repository access: only that repo. Permissions: Contents → Read and
              write.
            </li>
            <li>Paste it below on each device. Connect your Mac first; the phone then picks up the Mac's data.</li>
          </ol>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void connect(owner, repo, token).then(() => setToken(''));
            }}
          >
            <label>
              GitHub username
              <input value={owner} onChange={(e) => setOwner(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
            </label>
            <label>
              Private repo name
              <input value={repo} onChange={(e) => setRepo(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
            </label>
            <label>
              Token
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" required />
              <span className="muted small">Saved only in this browser, never in backups. Revoke it on GitHub anytime.</span>
            </label>
            {error}
            <div className="row-actions">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
