import { useMemo, useState } from 'react';
import { Check, CircleDashed, CircleDot, ExternalLink, Minus } from 'lucide-react';
import { autofill, evaluate, isWaived, overlapMatrix, waiverKey, type AutofillResult, type MajorResult, type ReqResult, type ScenarioAnalysis } from '../engine';
import { MAJOR_BY_ID, MAJORS } from '../majors';
import { TERM_BY_ID } from '../terms';
import type { Scenario } from '../types';
import { Dots } from './PlanGrid';
import { resolve } from '../engine';

const STATUS = {
  done: { icon: Check, label: 'Done' },
  partial: { icon: CircleDot, label: 'Partly done' },
  missing: { icon: CircleDashed, label: 'Missing' },
  waived: { icon: Minus, label: 'Waived' },
  note: { icon: Minus, label: 'Note' },
} as const;

const pct = (x: number) => `${Math.round(x * 100)}%`;

// ── Requirements ───────────────────────────────────────────────────────────

export function Requirements({ scenario, analysis, update }: { scenario: Scenario; analysis: ScenarioAnalysis; update: (f: (s: Scenario) => Scenario) => void }) {
  const cards = [...analysis.results, ...(analysis.premed ? [analysis.premed] : [])];
  if (!cards.length) return <p className="muted">Pick at least one major above to check requirements.</p>;
  return (
    <div className="stack">
      {analysis.results.length > 1 && (
        <p className="muted small">
          <strong className="ink">{analysis.doubleCredits} credits</strong> count toward more than one major (JHU allows double counting across majors; within a major,
          one course fills one slot).
        </p>
      )}
      {cards.map((res) => (
        <MajorCard key={res.major.id} res={res} scenario={scenario} update={update} />
      ))}
    </div>
  );
}

function MajorCard({ res, scenario, update }: { res: MajorResult; scenario: Scenario; update: (f: (s: Scenario) => Scenario) => void }) {
  const m = res.major;
  const premed = m.id === 'premed';
  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <span className="plan-dot lg" style={{ background: m.color }} aria-hidden /> {m.name}
        </h2>
        <span className="muted small num">
          {pct(res.pct)} met · {res.credits} credits count
        </span>
      </div>
      {premed && <p className="callout small">Verify against each school you apply to. These mappings onto JHU courses are unconfirmed; check them with a pre-health advisor.</p>}
      <ul className="req-list">
        {res.reqs.map((r) => (
          <ReqRow key={r.req.key} r={r} majorId={m.id} scenario={scenario} update={update} />
        ))}
      </ul>
      <ul className="small muted req-notes">
        <li>Total: {m.totalLabel}.</li>
        {m.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <a className="link small" href={m.sourceUrl} target="_blank" rel="noreferrer">
        Source <ExternalLink size={12} aria-hidden />
      </a>
    </section>
  );
}

function ReqRow({ r, majorId, scenario, update }: { r: ReqResult; majorId: string; scenario: Scenario; update: (f: (s: Scenario) => Scenario) => void }) {
  const S = STATUS[r.status];
  const key = waiverKey(majorId, r.req.key);
  return (
    <li className={`req req-${r.status}`}>
      <span className="req-icon" title={S.label}>
        <S.icon size={16} aria-hidden />
        <span className="visually-hidden">{S.label}:</span>
      </span>
      <div className="req-body">
        <span className="req-label">{r.req.label}</span>
        {r.items.length > 0 && (
          <span className="small req-items">
            {r.status === 'note' ? 'In plan: ' : ''}
            {r.items.map((x) => `${x.code} (${TERM_BY_ID[x.item.termId]?.label ?? x.item.termId})`).join(', ')}
          </span>
        )}
        {r.status !== 'done' && r.missing.length > 0 && <span className="small muted">Still needed: {r.missing.join(' + ')}</span>}
        {r.detail && r.status !== 'done' && <span className="small muted">{r.detail}</span>}
        {r.req.hint && <span className="small muted">{r.req.hint}</span>}
        {r.req.waivable && (
          <label className="small check">
            <input
              type="checkbox"
              checked={isWaived(MAJOR_BY_ID[majorId], r.req, scenario.waivers)}
              onChange={(e) => update((s) => ({ ...s, waivers: { ...s.waivers, [key]: e.target.checked } }))}
            />{' '}
            Waived by placement exam
          </label>
        )}
      </div>
    </li>
  );
}

// ── Foundational Abilities ─────────────────────────────────────────────────

export function FaTracker({ analysis }: { analysis: ScenarioAnalysis }) {
  const untagged = analysis.resolved.filter((r) => r.season !== 'PRE' && !r.code.startsWith('AS.001.') && !r.fa.length);
  return (
    <div className="stack">
      <p className="muted small">
        KSAS rule: FA1 and FA6 always count; among FA2–FA5 a course counts toward one, here the one with the largest remaining need. Exam credit and First-Year
        Seminars carry no FA. FA1 needs a letter grade. Lighter bar segments are estimated tags.
      </p>
      <section className="card">
        {analysis.fa.map((f) => {
          const have = f.verified + f.estimated;
          const gap = Math.max(0, f.required - have);
          const max = Math.max(f.required, have) || 1;
          return (
            <div key={f.id} className="area-row fa-row">
              <div className="area-head">
                <span className="area-name">
                  {f.id} {f.label}
                </span>
                <span className={`small num ${gap ? 'plan-heavy' : 'muted'}`}>
                  {have} of {f.required}
                  {gap ? ` · ${gap} to go` : ' · met'}
                </span>
              </div>
              <div className="bar" role="img" aria-label={`${f.id}: ${f.verified} verified and ${f.estimated} estimated credits of ${f.required}`}>
                <div className="bar-projected" style={{ width: `${Math.min(100, (have / max) * 100)}%` }} />
                <div className="bar-current" style={{ width: `${Math.min(100, (f.verified / max) * 100)}%` }} />
              </div>
              {f.courses.length > 0 && (
                <p className="muted small fa-courses">
                  {f.courses.map((c) => `${c.r.code}${c.estimated ? ' (est.)' : ''}`).join(', ')}
                </p>
              )}
            </div>
          );
        })}
      </section>
      {untagged.length > 0 && (
        <p className="muted small">
          No FA tag known for: {untagged.map((r) => r.code).join(', ')}. Add tags in a course's details once you check SIS (or run the SIS sync).
        </p>
      )}
    </div>
  );
}

// ── What if ────────────────────────────────────────────────────────────────

export function WhatIf({ scenario, analysis, addScenario }: { scenario: Scenario; analysis: ScenarioAnalysis; addScenario: (s: Omit<Scenario, 'id'>) => void }) {
  const [preview, setPreview] = useState<{ majorId: string; swap?: string; result: AutofillResult }>();
  const matrix = useMemo(() => overlapMatrix(MAJORS), []);

  const run = (majorId: string, swap?: string) => setPreview({ majorId, swap, result: autofill(scenario.plan, MAJOR_BY_ID[majorId], scenario.waivers) });

  const save = () => {
    if (!preview) return;
    const m = MAJOR_BY_ID[preview.majorId];
    const majorIds = [...scenario.majorIds.filter((id) => id !== preview.swap && id !== m.id), m.id];
    const name = preview.swap ? `${scenario.name}: ${MAJOR_BY_ID[preview.swap].short} → ${m.short}` : `${scenario.name} + ${m.short}`;
    const { id: _id, ...rest } = scenario;
    addScenario({ ...rest, name, majorIds, plan: preview.result.plan });
    setPreview(undefined);
  };

  const others = MAJORS.filter((m) => !scenario.majorIds.includes(m.id));
  const resolved = analysis.resolved;
  return (
    <div className="stack">
      <section className="card">
        <h2>Add or swap a major</h2>
        <p className="muted small">How much of each major your current plan already covers, and what auto-fill would add. Additional majors must be declared by April 15 of junior year.</p>
        <div className="table-wrap">
          <table className="plan-table">
            <thead>
              <tr>
                <th>Major</th>
                <th className="num">Met</th>
                <th className="num">Credits already counting</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {MAJORS.map((m) => {
                const e = evaluate(m, resolved, scenario.waivers);
                const inPlan = scenario.majorIds.includes(m.id);
                return (
                  <tr key={m.id}>
                    <td>
                      <Dots ids={[m.id]} /> {m.name} {inPlan && <span className="tag">in this plan</span>}
                    </td>
                    <td className="num">{pct(e.pct)}</td>
                    <td className="num">{e.credits}</td>
                    <td>
                      {!inPlan && (
                        <div className="row-actions tight">
                          <button className="btn btn-small" onClick={() => run(m.id)}>
                            Auto-fill
                          </button>
                          {scenario.majorIds.length > 0 && (
                            <select aria-label={`Swap a major for ${m.short}`} value="" onChange={(e) => e.target.value && run(m.id, e.target.value)}>
                              <option value="">Swap for…</option>
                              {scenario.majorIds.map((id) => (
                                <option key={id} value={id}>
                                  Replace {MAJOR_BY_ID[id]?.short}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {others.length === 0 && <p className="muted small">Every major is already in this plan.</p>}
      </section>

      {preview && (
        <section className="card" aria-live="polite">
          <h2>
            {preview.swap ? `Swap ${MAJOR_BY_ID[preview.swap].short} for ${MAJOR_BY_ID[preview.majorId].short}` : `Add ${MAJOR_BY_ID[preview.majorId].name}`}
          </h2>
          <p className="small">
            Adds <strong>{preview.result.addedCredits} credits</strong> ({preview.result.added.length} courses). New plan total:{' '}
            <strong>{resolve(preview.result.plan).reduce((n, r) => n + (r.season === 'PRE' ? 0 : r.credits), 0) + Math.min(20, analysis.externalCredits)} credits</strong>.
            {preview.swap && ' Courses only the replaced major needed stay in the plan; remove them yourself if you drop it.'}
          </p>
          {preview.result.added.length > 0 && (
            <ul className="small preview-list">
              {resolve(preview.result.added).map((r) => (
                <li key={r.item.id}>
                  <span className="num">{r.code}</span> {r.title} · {r.credits} cr · {TERM_BY_ID[r.item.termId]?.label}
                </li>
              ))}
            </ul>
          )}
          {preview.result.unresolved.length > 0 && <p className="small plan-heavy">Couldn't complete: {preview.result.unresolved.join('; ')}.</p>}
          <p className="muted small">Auto-fill uses the earliest term where the course is offered, its prerequisites come first, and the term stays at 17 credits or fewer. It never adds to the current term.</p>
          <div className="row-actions">
            <button className="btn btn-primary" onClick={save}>
              Save as new scenario
            </button>
            <button className="btn" onClick={() => setPreview(undefined)}>
              Discard
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Overlap between majors</h2>
        <p className="muted small">Row major's standard path (auto-filled onto an empty plan): how many of its credits also count for the column major. Not symmetric.</p>
        <div className="table-wrap">
          <table className="plan-table overlap">
            <thead>
              <tr>
                <th>
                  <span className="visually-hidden">Path of</span>
                </th>
                {MAJORS.map((m) => (
                  <th key={m.id} className="num">
                    {m.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MAJORS.map((a, i) => (
                <tr key={a.id}>
                  <th scope="row">{a.short}</th>
                  {MAJORS.map((b, j) => (
                    <td key={b.id} className="num" style={{ ['--heat' as string]: Number.isNaN(matrix[i][j]) ? 0 : Math.min(1, matrix[i][j] / 50) }}>
                      {Number.isNaN(matrix[i][j]) ? '—' : matrix[i][j]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
