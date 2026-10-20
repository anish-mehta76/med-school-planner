import { useMemo, useState } from 'react';
import { Check, CircleDashed, CircleDot, ExternalLink, Minus } from 'lucide-react';
import { autofill, evaluate, isWaived, overlapMatrix, resolve, waiverKey, type AutofillResult, type MajorResult, type ReqResult, type ScenarioAnalysis } from '../engine';
import { ALL_MAJORS, MAJOR_BY_ID, majorColor } from '../majors';
import { TERM_BY_ID } from '../terms';
import { SIS_SYNCED_AT } from '../catalog';
import type { Major, Resolved, Scenario } from '../types';
import { Ring } from '../../components/viz';

const STATUS = {
  done: { icon: Check, label: 'Done' },
  partial: { icon: CircleDot, label: 'Partly done' },
  missing: { icon: CircleDashed, label: 'Missing' },
  waived: { icon: Minus, label: 'Waived' },
  note: { icon: Minus, label: 'Check by hand' },
} as const;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const credits = (rs: Resolved[]) => rs.reduce((n, r) => n + r.credits, 0);
type Update = (f: (s: Scenario) => Scenario) => void;

export function MajorDot({ scenario, id, lg }: { scenario: Scenario; id: string; lg?: boolean }) {
  return <span className={`plan-dot ${lg ? 'lg' : ''}`} style={{ background: majorColor(scenario.majorIds, id) }} aria-hidden />;
}

// ── Requirements ───────────────────────────────────────────────────────────

export function Requirements({ scenario, analysis, update }: { scenario: Scenario; analysis: ScenarioAnalysis; update: Update }) {
  const cards = [...analysis.results, ...(analysis.premed ? [analysis.premed] : [])];
  if (!cards.length) return <p className="muted">Add a major above to check its requirements against your courses.</p>;
  return (
    <div className="stack">
      {cards.map((res) => (
        <MajorCard key={res.major.id} res={res} scenario={scenario} update={update} />
      ))}
    </div>
  );
}

function MajorCard({ res, scenario, update }: { res: MajorResult; scenario: Scenario; update: Update }) {
  const m = res.major;
  const counted = res.reqs.filter((r) => r.status !== 'note' && r.status !== 'waived');
  const done = counted.filter((r) => r.status === 'done').length;
  const notes = res.reqs.filter((r) => r.status === 'note').length;
  // Group rows under their catalogue section headings.
  const sections: { title?: string; reqs: ReqResult[] }[] = [];
  for (const r of res.reqs) {
    const last = sections[sections.length - 1];
    if (last && last.title === r.req.section) last.reqs.push(r);
    else sections.push({ title: r.req.section, reqs: [r] });
  }
  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <MajorDot scenario={scenario} id={m.id} lg /> {m.name}
        </h2>
        <span className="major-progress">
          <Ring value={res.pct} size={44} stroke={5} color={res.pct >= 1 ? 'var(--strong)' : 'var(--accent)'}>
            <small className="num">{Math.round(res.pct * 100)}</small>
          </Ring>
          <span className="muted small num">
            {done} of {counted.length} done · {pct(res.pct)} · {res.credits} credits count
          </span>
        </span>
      </div>
      {m.id === 'premed' && <p className="callout small">Verify against each school you apply to. These mappings onto JHU courses are unconfirmed; check them with a pre-health advisor.</p>}
      {m.auto && (
        <p className="callout small">
          Imported automatically from the catalogue. Course rows and "select N" lists are checked; {notes} {notes === 1 ? 'rule is' : 'rules are'} written as text and
          shown below to check by hand. Confirm everything with the department.
        </p>
      )}
      {sections.map((sec, i) => (
        <div key={i} className="req-section">
          {sec.title && <h3 className="req-section-title">{sec.title}</h3>}
          <ul className="req-list">
            {sec.reqs.map((r) => (
              <ReqRow key={r.req.key} r={r} major={m} scenario={scenario} update={update} />
            ))}
          </ul>
        </div>
      ))}
      <ul className="small muted req-notes">
        <li>Total: {m.totalLabel}.</li>
        {m.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <a className="link small" href={m.sourceUrl} target="_blank" rel="noreferrer">
        Catalogue page <ExternalLink size={12} aria-hidden />
      </a>
    </section>
  );
}

function ReqRow({ r, major, scenario, update }: { r: ReqResult; major: Major; scenario: Scenario; update: Update }) {
  const S = STATUS[r.status];
  const key = waiverKey(major.id, r.req.key);
  const choices = r.req.type === 'pick' ? r.req.from.filter((x): x is string => typeof x === 'string') : [];
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
            {r.status === 'note' ? 'In plan: ' : 'Filled by '}
            {r.items.map((x) => `${x.code} (${TERM_BY_ID[x.item.termId]?.label ?? x.item.termId})`).join(', ')}
          </span>
        )}
        {r.status !== 'done' && r.missing.length > 0 && <span className="small muted">Still needed: {r.missing.join(' + ')}</span>}
        {r.status !== 'done' && r.req.type === 'pick' && (
          <span className="small muted">
            {r.items.length} of {r.req.n}
            {choices.length > 0 && choices.length <= 30 ? ` from: ${choices.join(', ')}` : choices.length ? ` from ${choices.length} listed courses` : ''}
          </span>
        )}
        {r.detail && r.status !== 'done' && <span className="small muted">{r.detail}</span>}
        {r.req.hint && <span className="small muted">{r.req.hint}</span>}
        {r.req.waivable && (
          <label className="small check">
            <input type="checkbox" checked={isWaived(major, r.req, scenario.waivers)} onChange={(e) => update((s) => ({ ...s, waivers: { ...s.waivers, [key]: e.target.checked } }))} />{' '}
            Waived by placement exam
          </label>
        )}
      </div>
    </li>
  );
}

// ── Majors & overlap ───────────────────────────────────────────────────────

/** How the majors in this plan fit together: what's shared, what each still needs. */
export function Overlap({ scenario, analysis }: { scenario: Scenario; analysis: ScenarioAnalysis }) {
  const results = analysis.results;
  const [extra, setExtra] = useState('');

  const remaining = useMemo(() => {
    // Each major's missing courses on its own, then all of them together (shared courses count once).
    const each = results.map((r) => autofill(scenario.plan, r.major, scenario.waivers));
    let plan = scenario.plan;
    for (const r of results) plan = autofill(plan, r.major, scenario.waivers).plan;
    const combined = resolve(plan).reduce((n, r) => n + (r.season === 'PRE' ? 0 : r.credits), 0) + Math.min(20, analysis.externalCredits);
    return { each, combined };
  }, [scenario, results, analysis.externalCredits]);

  const pathMajors = useMemo(() => [...results.map((r) => r.major), ...(extra && MAJOR_BY_ID[extra] ? [MAJOR_BY_ID[extra]] : [])], [results, extra]);
  const matrix = useMemo(() => (pathMajors.length > 1 ? overlapMatrix(pathMajors) : []), [pathMajors]);

  if (!results.length) return <p className="muted">Add one or more majors above to see how they overlap.</p>;
  const shared = (a: MajorResult, b: MajorResult) => analysis.resolved.filter((r) => a.claimed.has(r.item.id) && b.claimed.has(r.item.id));

  return (
    <div className="stack">
      <section className="card">
        <h2>{results.length > 1 ? 'Your majors together' : 'Your major'}</h2>
        <div className="table-wrap">
          <table className="plan-table">
            <thead>
              <tr>
                <th>Major</th>
                <th className="num">Met</th>
                <th className="num">Credits counting now</th>
                <th className="num">Credits still to add (estimate)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.major.id}>
                  <td>
                    <MajorDot scenario={scenario} id={r.major.id} /> {r.major.name}
                  </td>
                  <td className="num">{pct(r.pct)}</td>
                  <td className="num">{r.credits}</td>
                  <td className="num">
                    {remaining.each[i].addedCredits}
                    {remaining.each[i].unresolved.length > 0 && ' +'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small">
          Your plan now: <strong>{analysis.total} credits</strong>. Finishing {results.length > 1 ? 'all of these majors' : 'this major'} would take it to about{' '}
          <strong>{remaining.combined} credits</strong>
          {remaining.combined < 120 ? ' (the degree needs 120; the rest are free electives)' : ''}.
          {results.length > 1 && ` ${analysis.doubleCredits} credits already count toward more than one major.`}
        </p>
        <p className="muted small">
          Estimates come from auto-fill (the courses each major still lists, plus their prerequisites), so text-only rules aren't included; "+" means some
          requirements need a choice you make. JHU allows double counting across majors; within one major, a course fills one slot. Declare additional majors by
          April 15 of junior year.
        </p>
      </section>

      {results.length > 1 && (
        <section className="card">
          <h2>Shared courses in your plan</h2>
          {results.flatMap((a, i) =>
            results.slice(i + 1).map((b) => {
              const s = shared(a, b);
              return (
                <div key={`${a.major.id}-${b.major.id}`} className="overlap-pair">
                  <h3 className="req-section-title">
                    <MajorDot scenario={scenario} id={a.major.id} /> {a.major.short} + <MajorDot scenario={scenario} id={b.major.id} /> {b.major.short}:{' '}
                    {credits(s)} shared credits
                  </h3>
                  <p className="small muted">{s.length ? s.map((r) => `${r.code} ${r.title}`).join(' · ') : 'No course in your plan counts for both yet.'}</p>
                </div>
              );
            }),
          )}
        </section>
      )}

      <section className="card">
        <h2>Compare standard paths</h2>
        <p className="muted small">
          Each row major's path from scratch (auto-filled onto an empty plan): how many of its credits also count for the column major. Not symmetric. Add another
          major to compare:
        </p>
        <MajorSelect value={extra} onChange={setExtra} exclude={results.map((r) => r.major.id)} placeholder="Add a major to compare…" />
        {pathMajors.length > 1 ? (
          <div className="table-wrap">
            <table className="plan-table overlap">
              <thead>
                <tr>
                  <th>
                    <span className="visually-hidden">Path of</span>
                  </th>
                  {pathMajors.map((m) => (
                    <th key={m.id} className="num">
                      {m.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pathMajors.map((a, i) => (
                  <tr key={a.id}>
                    <th scope="row">{a.short}</th>
                    {pathMajors.map((b, j) => (
                      <td key={b.id} className="num" style={{ ['--heat' as string]: Number.isNaN(matrix[i][j]) ? 0 : Math.min(1, matrix[i][j] / 50) }}>
                        {Number.isNaN(matrix[i][j]) ? '—' : matrix[i][j]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted small">Pick a second major to compare.</p>
        )}
      </section>
    </div>
  );
}

/** All majors grouped by school. */
export function MajorSelect({ value, onChange, exclude = [], placeholder }: { value: string; onChange: (id: string) => void; exclude?: string[]; placeholder: string }) {
  const groups = [
    { label: 'Arts & Sciences (KSAS)', school: 'KSAS' },
    { label: 'Engineering (WSE)', school: 'WSE' },
  ];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} className="major-select">
      <option value="">{placeholder}</option>
      {groups.map((g) => (
        <optgroup key={g.school} label={g.label}>
          {ALL_MAJORS.filter((m) => m.school === g.school && !exclude.includes(m.id)).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.auto ? '' : ' (hand-checked)'}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ── Foundational Abilities ─────────────────────────────────────────────────

export function FaTracker({ analysis }: { analysis: ScenarioAnalysis }) {
  const varies = analysis.resolved.filter((r) => r.season !== 'PRE' && r.course?.faVaries && !r.item.fa);
  const untagged = analysis.resolved.filter((r) => r.season !== 'PRE' && !r.code.startsWith('AS.001.') && !r.fa.length && !varies.includes(r));
  const confirmed = analysis.resolved.filter((r) => r.season !== 'PRE' && r.course?.source === 'SIS' && !r.item.fa && !varies.includes(r)).length;
  const counted = analysis.resolved.filter((r) => r.season !== 'PRE').length;
  return (
    <div className="stack">
      <p className="muted small">
        KSAS rule: FA1 and FA6 always count; among FA2–FA5 a course counts toward one, here the one with the largest remaining need. Exam credit and First-Year
        Seminars carry no FA. FA1 needs a letter grade. Lighter bar segments are estimated tags.
      </p>
      <p className="muted small">
        {SIS_SYNCED_AT
          ? `${confirmed} of ${counted} courses in your plan have FA tags confirmed by SIS (synced ${SIS_SYNCED_AT})${confirmed < counted ? '; the others vary by section, are placeholders, or use tags you entered' : ''}.`
          : 'FA tags are estimates until SIS data is synced.'}
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
              {f.courses.length > 0 && <p className="muted small fa-courses">{f.courses.map((c) => `${c.r.code}${c.estimated ? ' (est.)' : ''}`).join(', ')}</p>}
            </div>
          );
        })}
      </section>
      {varies.length > 0 && (
        <p className="muted small">
          FA tags vary by section for: {varies.map((r) => r.code).join(', ')}. Open the course on the Plan tab and enter the tags for the section you take.
        </p>
      )}
      {untagged.length > 0 && (
        <p className="muted small">
          No FA tag in SIS for: {untagged.map((r) => r.code).join(', ')}. That usually means the course carries none; placeholders get tags once you pick the real course.
        </p>
      )}
    </div>
  );
}

// ── What if ────────────────────────────────────────────────────────────────

export function WhatIf({ scenario, analysis, update }: { scenario: Scenario; analysis: ScenarioAnalysis; update: Update }) {
  const [preview, setPreview] = useState<{ majorId: string; swap?: string; result: AutofillResult }>();
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);

  const ranked = useMemo(
    () =>
      ALL_MAJORS.map((m) => ({ m, e: evaluate(m, analysis.resolved, scenario.waivers) })).sort((a, b) => b.e.pct - a.e.pct || b.e.credits - a.e.credits || a.m.name.localeCompare(b.m.name)),
    [analysis.resolved, scenario.waivers],
  );
  const shown = ranked.filter(({ m }) => !q || m.name.toLowerCase().includes(q.toLowerCase()));
  const visible = all || q ? shown : shown.slice(0, 10);

  const run = (majorId: string, swap?: string) => setPreview({ majorId, swap, result: autofill(scenario.plan, MAJOR_BY_ID[majorId], scenario.waivers) });

  /** Adds the auto-filled courses (and the major) to your plan; a swap also drops the replaced major. */
  const apply = () => {
    if (!preview) return;
    const id = preview.majorId;
    update((s) => ({ ...s, majorIds: [...s.majorIds.filter((x) => x !== preview.swap && x !== id), id], plan: [...s.plan, ...preview.result.added] }));
    setPreview(undefined);
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>Add or swap a major</h2>
        <p className="muted small">Every major, ranked by how much your current courses already cover. Auto-fill previews what you'd still need; nothing changes until you add it to your plan.</p>
        <input type="search" className="whatif-search" placeholder="Search majors" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search majors" />
        <div className="table-wrap">
          <table className="plan-table">
            <thead>
              <tr>
                <th>Major</th>
                <th className="num">Met</th>
                <th className="num">Credits counting</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ m, e }) => {
                const inPlan = scenario.majorIds.includes(m.id);
                return (
                  <tr key={m.id}>
                    <td>
                      {m.name} <span className="muted small">{m.school}</span> {inPlan && <span className="tag">in this plan</span>}
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
                            <select aria-label={`Swap a major for ${m.short}`} value="" onChange={(ev) => ev.target.value && run(m.id, ev.target.value)}>
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
        {!q && shown.length > 10 && (
          <button className="btn btn-small" onClick={() => setAll(!all)}>
            {all ? 'Show top 10' : `Show all ${shown.length} majors`}
          </button>
        )}
      </section>

      {preview && (
        <section className="card" aria-live="polite">
          <h2>{preview.swap ? `Swap ${MAJOR_BY_ID[preview.swap].short} for ${MAJOR_BY_ID[preview.majorId].short}` : `Add ${MAJOR_BY_ID[preview.majorId].name}`}</h2>
          <p className="small">
            Adds <strong>{preview.result.addedCredits} credits</strong> ({preview.result.added.length} courses). New plan total:{' '}
            <strong>{resolve(preview.result.plan).reduce((n, r) => n + (r.season === 'PRE' ? 0 : r.credits), 0) + Math.min(20, analysis.externalCredits)} credits</strong>.
            {preview.swap && ' The replaced major is removed; its courses stay in your plan until you remove them.'}
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
          <p className="muted small">
            Auto-fill uses the earliest term where the course is offered, its prerequisites come first, and the term stays at 17 credits or fewer. It never adds to
            the current term, and rules written as text aren't filled.
          </p>
          <div className="row-actions">
            <button className="btn btn-primary" onClick={apply}>
              Add to my plan
            </button>
            <button className="btn" onClick={() => setPreview(undefined)}>
              Discard
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
