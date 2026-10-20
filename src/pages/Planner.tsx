import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { startOver, usePlanner } from '../planner/usePlanner';
import { ALL_MAJORS, MAJOR_BY_ID } from '../planner/majors';
import { SEMESTERS, TERM_BY_ID } from '../planner/terms';
import PlanGrid from '../planner/ui/PlanGrid';
import CourseData from '../planner/ui/CourseData';
import MedSchools from '../planner/ui/MedSchools';
import { FaTracker, MajorDot, MajorSelect, Overlap, Requirements, WhatIf } from '../planner/ui/Views';
import { CountUp } from '../components/viz';

const pctText = (n: number) => `${Math.round(n)}%`;
const creditText = (target: number) => (n: number) => (Number.isInteger(target) ? String(Math.round(n)) : n.toFixed(1));

/** Thin bar that fills to `pct` (0–100) when it first appears. */
function Meter({ pct }: { pct: number }) {
  return (
    <span className="meter" aria-hidden>
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

type Tab = 'plan' | 'reqs' | 'schools' | 'overlap' | 'fa' | 'whatif' | 'data';
const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'reqs', label: 'Requirements' },
  { id: 'schools', label: 'Med schools' },
  { id: 'overlap', label: 'Majors & overlap' },
  { id: 'fa', label: 'Foundational Abilities' },
  { id: 'whatif', label: 'What if' },
  { id: 'data', label: 'Course data' },
];

export default function Planner() {
  const { active, analysis: a, updateScenario } = usePlanner();
  const [tab, setTab] = useState<Tab>('plan');
  const problems = a.flags.filter((f) => f.level !== 'info');
  const notes = a.flags.filter((f) => f.level === 'info');
  const empty = !active.plan.length;

  const addMajor = (id: string) => id && updateScenario((s) => ({ ...s, majorIds: s.majorIds.includes(id) ? s.majorIds : [...s.majorIds, id] }));
  const dropMajor = (id: string) => updateScenario((s) => ({ ...s, majorIds: s.majorIds.filter((x) => x !== id) }));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Four-year plan</h1>
          <p className="muted">
            Pick your majors (any of {ALL_MAJORS.length} JHU bachelor's majors) and add courses term by term. The planner checks each major's requirements, shows
            what counts toward two majors at once, and flags sequencing problems. It's a planning aid: confirm with your advisors and SIS.
          </p>
        </div>
      </header>

      <section className="card plan-controls">
        <div className="plan-majors">
          <h2 className="plan-majors-label">Your majors</h2>
          <div className="chips" role="group" aria-label="Majors in this scenario">
            {active.majorIds.map((id) => (
              <span key={id} className="chip active major-chip">
                <MajorDot scenario={active} id={id} /> {MAJOR_BY_ID[id]?.name ?? id}
                <button type="button" className="chip-x" aria-label={`Remove ${MAJOR_BY_ID[id]?.name ?? id}`} onClick={() => dropMajor(id)}>
                  <X size={14} aria-hidden />
                </button>
              </span>
            ))}
            <MajorSelect value="" onChange={addMajor} exclude={active.majorIds} placeholder={active.majorIds.length ? 'Add another major…' : 'Add a major…'} />
            <button className={`chip ${active.premed ? 'active' : ''}`} aria-pressed={active.premed} onClick={() => updateScenario((s) => ({ ...s, premed: !s.premed }))}>
              <MajorDot scenario={active} id="premed" /> Pre-med track
            </button>
          </div>
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
            <span className="stat-value num">
              <CountUp value={a.total} format={creditText(a.total)} />
            </span>
            <span className="stat-label">credits counted{a.total < 120 ? ' (120 needed)' : ''}</span>
            <Meter pct={(a.total / 120) * 100} />
          </div>
          {a.results.map((r) => (
            <div key={r.major.id} className="stat">
              <span className="stat-value num">
                <CountUp value={Math.round(r.pct * 100)} format={pctText} />
              </span>
              <span className="stat-label">{r.major.short} met</span>
              <Meter pct={r.pct * 100} />
            </div>
          ))}
          {a.premed && (
            <div className="stat">
              <span className="stat-value num">
                <CountUp value={Math.round(a.premed.pct * 100)} format={pctText} />
              </span>
              <span className="stat-label">pre-med met</span>
              <Meter pct={a.premed.pct * 100} />
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
        {(active.plan.length > 0 || active.majorIds.length > 0) && (
          <div className="row-actions tight">
            <button className="btn btn-small" onClick={() => confirm('Clear all your courses and majors?') && startOver()}>
              Clear plan
            </button>
          </div>
        )}
      </section>

      <div className="tabs tabs-scroll" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plan' && (
        <>
          {empty && (
            <div className="callout small">
              <strong>Pick your majors above, then add courses.</strong>
              <span>
                Type a course code (e.g. AS.030.101) in any term: ones you've taken, or ones you're considering. Add AP scores in the exam lane: they become the JHU courses JHU's AP table awards, and Med schools shows which schools accept them. Unknown codes
                are added as custom courses you can edit. To try out a major, use What if.
              </span>
            </div>
          )}
          {!empty && (problems.length > 0 || notes.length > 0) && (
            <section className="card plan-flags">
              <h2>Checks</h2>
              <ul>
                {[...problems, ...notes].map((f, i) => (
                  <li key={i} className={`plan-flag plan-flag-${f.level} small`}>
                    {f.level !== 'info' && <AlertTriangle size={14} aria-hidden className="icon" />}
                    {f.premed && <span className="tag">pre-med</span>} {f.itemId && f.termId ? `${TERM_BY_ID[f.termId]?.label}: ` : ''}
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
      {tab === 'schools' && <MedSchools scenario={active} analysis={a} update={updateScenario} />}
      {tab === 'overlap' && <Overlap scenario={active} analysis={a} />}
      {tab === 'fa' && <FaTracker analysis={a} />}
      {tab === 'whatif' && <WhatIf scenario={active} analysis={a} update={updateScenario} />}
      {tab === 'data' && <CourseData analysis={a} />}
    </div>
  );
}
