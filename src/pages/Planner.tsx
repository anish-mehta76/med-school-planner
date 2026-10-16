import { useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { usePlanner, updatePlanner, resetPlanner } from '../planner/usePlanner';
import { MAJORS, MAJOR_BY_ID } from '../planner/majors';
import { SEMESTERS, TERM_BY_ID } from '../planner/terms';
import { SIS_SYNCED_AT } from '../planner/catalog';
import PlanGrid from '../planner/ui/PlanGrid';
import { FaTracker, Requirements, WhatIf } from '../planner/ui/Views';
import { saveFile, JSON_ACCEPT } from '../lib/saveFile';
import { localDate, uid } from '../store/useStore';
import type { PlannerState } from '../planner/types';

type Tab = 'plan' | 'reqs' | 'fa' | 'whatif';
const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'reqs', label: 'Requirements' },
  { id: 'fa', label: 'Foundational Abilities' },
  { id: 'whatif', label: 'What if' },
];

export default function Planner() {
  const { planner, active, analysis, updateScenario, addScenario } = usePlanner();
  const [tab, setTab] = useState<Tab>('plan');
  const fileRef = useRef<HTMLInputElement>(null);
  const a = analysis;
  const problems = a.flags.filter((f) => f.level !== 'info');
  const notes = a.flags.filter((f) => f.level === 'info');

  const duplicate = () => {
    const { id: _id, ...rest } = active;
    addScenario({ ...rest, name: `${active.name} (copy)` });
  };
  const rename = () => {
    const name = prompt('Scenario name', active.name)?.trim();
    if (name) updateScenario((s) => ({ ...s, name }));
  };
  const remove = () => {
    if (planner.scenarios.length < 2 || !confirm(`Delete “${active.name}”?`)) return;
    updatePlanner((p) => {
      const scenarios = p.scenarios.filter((s) => s.id !== active.id);
      return { scenarios, activeId: scenarios[0].id };
    });
  };
  const exportPlans = () => saveFile(new Blob([JSON.stringify(planner, null, 2)], { type: 'application/json' }), `four-year-plans-${localDate()}.json`);
  const importPlans = async (f: File) => {
    try {
      const p = JSON.parse(await f.text()) as PlannerState;
      if (!Array.isArray(p.scenarios) || !p.scenarios.every((s) => s.id && s.name && Array.isArray(s.plan))) throw new Error('bad');
      // Imported scenarios are added, with fresh ids, next to the ones you have.
      const added = p.scenarios.map((s) => ({ ...s, id: uid() }));
      updatePlanner((cur) => ({ scenarios: [...cur.scenarios, ...added], activeId: added[0].id }));
    } catch {
      alert('That file could not be read as saved plans.');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Four-year plan</h1>
          <p className="muted">
            JHU KSAS course plan, checked against major requirements from the 2026–27 catalogue. Requirement data is a planning aid; confirm with your advisors
            and SIS. {SIS_SYNCED_AT ? `Course data synced from SIS ${SIS_SYNCED_AT}.` : 'Course data from the catalogue (2026-10-15); FA tags on science courses are estimates.'}
          </p>
        </div>
      </header>

      <section className="card plan-controls">
        <div className="plan-scenario">
          <label className="small">
            Scenario
            <select value={active.id} onChange={(e) => updatePlanner((p) => ({ ...p, activeId: e.target.value }))}>
              {planner.scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="row-actions tight">
            <button className="btn btn-small" onClick={duplicate}>
              Duplicate
            </button>
            <button className="btn btn-small" onClick={rename}>
              Rename
            </button>
            <button className="btn btn-small" onClick={remove} disabled={planner.scenarios.length < 2}>
              Delete
            </button>
            <button className="btn btn-small" onClick={() => confirm('Replace all scenarios with the three samples?') && resetPlanner()}>
              Reset to samples
            </button>
            <button className="btn btn-small" onClick={() => void exportPlans()}>
              Export plans
            </button>
            <button className="btn btn-small" onClick={() => fileRef.current?.click()}>
              Import plans
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={JSON_ACCEPT}
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await importPlans(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>
        <div className="chips" role="group" aria-label="Majors in this scenario">
          {MAJORS.map((m) => {
            const on = active.majorIds.includes(m.id);
            return (
              <button
                key={m.id}
                className={`chip ${on ? 'active' : ''}`}
                aria-pressed={on}
                onClick={() => updateScenario((s) => ({ ...s, majorIds: on ? s.majorIds.filter((x) => x !== m.id) : [...s.majorIds, m.id] }))}
              >
                <span className="plan-dot" style={{ background: m.color }} aria-hidden /> {m.name}
              </button>
            );
          })}
          <button className={`chip ${active.premed ? 'active' : ''}`} aria-pressed={active.premed} onClick={() => updateScenario((s) => ({ ...s, premed: !s.premed }))}>
            <span className="plan-dot" style={{ background: MAJOR_BY_ID.premed.color }} aria-hidden /> Pre-med track
          </button>
        </div>
        {active.premed && (
          <label className="small plan-mcat">
            MCAT after
            <select value={active.mcatAfterTermId ?? 'S29'} onChange={(e) => updateScenario((s) => ({ ...s, mcatAfterTermId: e.target.value }))}>
              {SEMESTERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                  {t.id === 'S29' ? ' (apply after junior year, no gap year)' : t.id === 'S30' ? ' (one gap year)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="stats plan-stats">
          <div className="stat">
            <span className="stat-value num">{a.total}</span>
            <span className="stat-label">credits counted{a.total < 120 ? ' (120 needed)' : ''}</span>
          </div>
          {a.results.map((r) => (
            <div key={r.major.id} className="stat">
              <span className="stat-value num">{Math.round(r.pct * 100)}%</span>
              <span className="stat-label">{r.major.short} met</span>
            </div>
          ))}
          {a.premed && (
            <div className="stat">
              <span className="stat-value num">{Math.round(a.premed.pct * 100)}%</span>
              <span className="stat-label">pre-med met</span>
            </div>
          )}
          {a.results.length > 1 && (
            <div className="stat">
              <span className="stat-value num">{a.doubleCredits}</span>
              <span className="stat-label">credits double-counted</span>
            </div>
          )}
          <div className="stat">
            <span className="stat-value num">{problems.length}</span>
            <span className="stat-label">{problems.length === 1 ? 'warning' : 'warnings'}</span>
          </div>
        </div>
      </section>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plan' && (
        <>
          {(problems.length > 0 || notes.length > 0) && (
            <section className="card plan-flags">
              <h2>Checks</h2>
              <ul>
                {[...problems, ...notes].map((f, i) => (
                  <li key={i} className={`plan-flag plan-flag-${f.level} small`}>
                    {f.level !== 'info' && <AlertTriangle size={14} aria-hidden className="icon" />}
                    {f.premed && <span className="tag">pre-med</span>} {f.termId && !f.itemId ? '' : f.termId ? `${TERM_BY_ID[f.termId]?.label}: ` : ''}
                    {f.text}
                    {f.verify && <span className="tag tag-warn">verify</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <PlanGrid scenario={active} analysis={a} update={updateScenario} />
        </>
      )}
      {tab === 'reqs' && <Requirements scenario={active} analysis={a} update={updateScenario} />}
      {tab === 'fa' && <FaTracker analysis={a} />}
      {tab === 'whatif' && <WhatIf scenario={active} analysis={a} addScenario={addScenario} />}
    </div>
  );
}
