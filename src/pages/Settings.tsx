import { useRef } from 'react';
import type { Academics, Profile } from '../types';
import { defaultState, exportJson, importJson, setState, useStore } from '../store/useStore';
import { DEFAULT_BENCHMARKS } from '../data/benchmarks';
import { sampleState } from '../data/sample';
import { DEFAULT_WEIGHTS, WEIGHT_LABELS } from '../engine/mentorScore';
import { JSON_ACCEPT } from '../lib/saveFile';
import SyncCard from '../components/SyncCard';
import type { ScoreWeights } from '../types';

/** Unit shown after benchmark inputs. */
const UNIT: Record<string, string> = { hours: 'hrs', 'posters / pubs': 'posters or papers', roles: 'roles' };

export default function Settings() {
  const state = useStore();
  const { profile, academics, benchmarks } = state;
  const fileRef = useRef<HTMLInputElement>(null);

  const setProfile = <K extends keyof Profile>(k: K, v: Profile[K]) => setState((s) => ({ ...s, profile: { ...s.profile, [k]: v } }));
  const setAcad = <K extends keyof Academics>(k: K, v: Academics[K]) => setState((s) => ({ ...s, academics: { ...s.academics, [k]: v } }));
  const num = (v: string) => (v === '' ? undefined : Number(v));
  const year = new Date().getFullYear();
  const prereqsDone = Object.values(academics.prereqs).filter(Boolean).length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Profile & academics</h1>
          <p className="muted">Changes save automatically to this browser.</p>
        </div>
      </header>

      <div className="grid-2">
        <section className="card">
          <h2>Profile</h2>
          <div className="form">
            <label>
              Name
              <input value={profile.name} onChange={(e) => setProfile('name', e.target.value)} />
            </label>
            <label>
              School
              <input value={profile.school} onChange={(e) => setProfile('school', e.target.value)} />
            </label>
            <label>
              Graduation year
              <input type="number" value={profile.gradYear} onChange={(e) => setProfile('gradYear', Number(e.target.value))} />
            </label>
            <label>
              Application year
              <select value={profile.applicationYear} onChange={(e) => setProfile('applicationYear', Number(e.target.value))}>
                {[0, 1, 2, 3, 4].map((d) => (
                  <option key={d} value={year + d}>
                    {year + d} (start {year + d + 1})
                  </option>
                ))}
              </select>
              <span className="hint">The year you submit AMCAS; you would start medical school the year after.</span>
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Academics</h2>
          <div className="form">
            <label>
              Cumulative GPA
              <input type="number" min={0} max={4} step="0.01" value={academics.gpa ?? ''} onChange={(e) => setAcad('gpa', num(e.target.value))} />
            </label>
            <label>
              Science (BCPM) GPA
              <input type="number" min={0} max={4} step="0.01" value={academics.scienceGpa ?? ''} onChange={(e) => setAcad('scienceGpa', num(e.target.value))} />
            </label>
            <label>
              MCAT score
              <input type="number" min={472} max={528} value={academics.mcat ?? ''} onChange={(e) => setAcad('mcat', num(e.target.value))} />
              <span className="hint">Leave blank if you haven't taken it.</span>
            </label>
            <label>
              MCAT target
              <input type="number" min={472} max={528} value={academics.mcatTarget ?? ''} onChange={(e) => setAcad('mcatTarget', num(e.target.value))} />
            </label>
            <label className="span-2">
              Planned MCAT date
              <input type="date" value={academics.mcatDate ?? ''} onChange={(e) => setAcad('mcatDate', e.target.value || undefined)} />
            </label>
          </div>
        </section>
      </div>

      <section className="card">
        <h2>
          Prerequisites <span className="muted">{prereqsDone}/{Object.keys(academics.prereqs).length}</span>
        </h2>
        <p className="muted small">Common requirements; check each school's list in MSAR.</p>
        <div className="prereqs">
          {Object.entries(academics.prereqs).map(([name, done]) => (
            <label key={name} className="check">
              <input type="checkbox" checked={done} onChange={(e) => setAcad('prereqs', { ...academics.prereqs, [name]: e.target.checked })} />
              {name}
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Benchmarks</h2>
          <button className="link" onClick={() => setState((s) => ({ ...s, benchmarks: DEFAULT_BENCHMARKS }))}>
            Reset to defaults
          </button>
        </div>
        <p className="muted small">Raise these if you are targeting research-heavy or top-20 schools.</p>
        <div className="table-wrap">
          <table className="bench">
            <thead>
              <tr>
                <th>Area</th>
                <th>Minimum</th>
                <th>Competitive</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((b, i) => (
                <tr key={b.area}>
                  <td>{b.label}</td>
                  {(['minimum', 'competitive'] as const).map((k) => (
                    <td key={k} data-label={k === 'minimum' ? 'Minimum' : 'Competitive'}>
                      <span className="unit-input">
                        <input
                          type="number"
                          step={b.area === 'gpa' ? 0.01 : 1}
                          value={b[k]}
                          aria-label={`${b.label}, ${k}`}
                          onChange={(e) =>
                            setState((s) => ({ ...s, benchmarks: s.benchmarks.map((x, j) => (j === i ? { ...x, [k]: Number(e.target.value) } : x)) }))
                          }
                        />
                        {UNIT[b.unit] && <span>{UNIT[b.unit]}</span>}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Mentor score weights</h2>
          <button className="link" onClick={() => setState((s) => ({ ...s, scoreWeights: DEFAULT_WEIGHTS }))}>
            Reset to defaults
          </button>
        </div>
        <p className="muted small">
          How much each factor counts in the Research targeting score. Shares always add up to 100%; set a slider to zero to ignore that factor.
        </p>
        <div className="weights">
          {(Object.keys(WEIGHT_LABELS) as (keyof ScoreWeights)[]).map((k) => {
            const total = Object.values(state.scoreWeights).reduce((a, b) => a + b, 0) || 1;
            return (
              <label key={k} className="weight">
                <span>{WEIGHT_LABELS[k]}</span>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={state.scoreWeights[k]}
                  onChange={(e) => setState((s) => ({ ...s, scoreWeights: { ...s.scoreWeights, [k]: Number(e.target.value) } }))}
                />
                <span className="muted small weight-val">{Math.round((state.scoreWeights[k] / total) * 100)}%</span>
              </label>
            );
          })}
        </div>
      </section>

      <SyncCard />

      <section className="card">
        <h2>Your data</h2>
        <div className="device-note">
          <p className="small">
            <strong>Your data is saved in this browser.</strong> Everything you enter, including your imported tracker and outreach notes, stays here unless
            you turn on sync above, which copies it to your own private GitHub repo. Updates to the website don't touch it.
          </p>
          <p className="small muted">
            Without sync, move data between devices by exporting a backup on one and importing it on the other. On iPhone, Export opens the share sheet: choose Save to Files
            (iCloud Drive) or AirDrop it to your Mac. Import lets you pick the file from Files or iCloud Drive. Export a backup regularly, especially before
            clearing Safari data.
          </p>
        </div>
        <div className="row-actions">
          <button className="btn btn-primary" onClick={() => void exportJson()}>
            Export backup (.json)
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={JSON_ACCEPT}
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                await importJson(f);
                alert('Backup imported.');
              } catch {
                alert('That file could not be read as a planner backup.');
              }
              e.target.value = '';
            }}
          />
          <button className="btn" onClick={() => confirm('Replace your data with sample data?') && setState(sampleState())}>
            Load sample data
          </button>
        </div>
        <div className="danger-zone">
          <p className="small">
            <strong>Reset everything</strong>
            <br />
            <span className="muted">Deletes all your data in this browser. Export a backup first.</span>
          </p>
          <button className="btn" onClick={() => confirm('Delete all your data? Export a backup first. If sync is on, this also clears your other device.') && setState(defaultState())}>
            Reset everything
          </button>
        </div>
      </section>
    </div>
  );
}
