import { useId, useState } from 'react';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { CATALOG, COURSE, isPublished } from '../catalog';
import { newItemId, type Flag, type ScenarioAnalysis } from '../engine';
import { MAJOR_BY_ID, majorColor } from '../majors';
import { TERMS, YEAR_LABEL } from '../terms';
import type { PlanItem, Resolved, Scenario, Term } from '../types';
import { AP_EXAMS, AP_SOURCE, apAward, apItems } from '../apCredit';

interface Props {
  scenario: Scenario;
  analysis: ScenarioAnalysis;
  update: (f: (s: Scenario) => Scenario) => void;
}

const SOURCE_LABEL = { catalogue: 'JHU catalogue', SIS: 'SIS', estimated: 'estimated' } as const;

export function faLabel(tags: string[]) {
  return tags.length ? tags.map((t) => (t.endsWith('?') ? `${t.slice(0, -1)} (est.)` : t)).join(', ') : 'none known';
}

/** Colored dots for the majors (and pre-med) a course counts toward. */
export function Dots({ ids, majorIds }: { ids: string[]; majorIds: string[] }) {
  if (!ids.length) return null;
  const names = ids.map((id) => MAJOR_BY_ID[id]?.short ?? id).join(', ');
  return (
    <span className="plan-dots" title={`Counts toward ${names}`}>
      {ids.map((id) => (
        <span key={id} className="plan-dot" style={{ background: majorColor(majorIds, id) }} aria-hidden />
      ))}
      <span className="visually-hidden">Counts toward {names}</span>
    </span>
  );
}

export default function PlanGrid({ scenario, analysis, update }: Props) {
  const [open, setOpen] = useState<string>();
  const listId = useId();
  const byTerm = (id: string) => analysis.resolved.filter((r) => r.item.termId === id);
  const flagsFor = (itemId: string) => analysis.flags.filter((f) => f.itemId === itemId);
  // Winter intersessions and summers show when they hold courses, or for every year when the toggle is on.
  const showTerm = (t: Term) => (t.season !== 'U' && t.season !== 'W') || !!scenario.showSummers || byTerm(t.id).length > 0;

  const setItem = (id: string, patch: Partial<PlanItem>) => update((s) => ({ ...s, plan: s.plan.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const remove = (id: string) => update((s) => ({ ...s, plan: s.plan.filter((p) => p.id !== id) }));
  const add = (termId: string, text: string) => {
    const code = text.trim().split(/\s+/)[0]?.toUpperCase();
    if (!code) return;
    const known = COURSE[code];
    const rest = text.trim().slice(code.length).replace(/^\s*[—-]\s*/, '').trim();
    const item: PlanItem = { id: newItemId(), code, termId, ...(known ? {} : { title: rest || 'Custom course', credits: 3 }) };
    update((s) => ({ ...s, plan: [...s.plan, item] }));
  };

  const termCard = (t: Term) => {
    const items = byTerm(t.id);
    const cr = analysis.termCredits[t.id] ?? 0;
    const termFlags = analysis.flags.filter((f) => f.termId === t.id && !f.itemId);
    return (
      <section key={t.id} className={`plan-term ${t.season === 'U' || t.season === 'W' ? 'summer' : ''}`} aria-label={t.label}>
        <header className="plan-term-head">
          <h3>
            {t.label}
            {isPublished(t.sisName) && <span className="plan-posted small">SIS schedule posted</span>}
          </h3>
          <span className={`num small ${cr >= 18 ? 'plan-heavy' : 'muted'}`}>
            {cr} cr{t.id === 'PRE' && cr > 20 ? ' (20 count)' : ''}
          </span>
        </header>
        {t.id === 'F26' && scenario.sample && <p className="muted small plan-note">Placeholder: replace with your actual Fall 2026 courses.</p>}
        {termFlags.map((f, i) => (
          <FlagLine key={i} f={f} />
        ))}
        <ul className="plan-items">
          {items.map((r) => (
            <PlanRow
              key={r.item.id}
              r={r}
              counts={analysis.countsFor.get(r.item.id) ?? []}
              majorIds={scenario.majorIds}
              flags={flagsFor(r.item.id)}
              forfeited={analysis.forfeited.has(r.item.id)}
              open={open === r.item.id}
              toggle={() => setOpen(open === r.item.id ? undefined : r.item.id)}
              setItem={(p) => setItem(r.item.id, p)}
              remove={() => remove(r.item.id)}
            />
          ))}
        </ul>
        {t.id === 'PRE' && <AddAp onAdd={(items) => update((s) => ({ ...s, plan: [...s.plan, ...items] }))} />}
        <AddCourse listId={listId} onAdd={(text) => add(t.id, text)} label={t.label} />
      </section>
    );
  };

  const years = [0, 1, 2, 3].map((y) => TERMS.filter((t) => t.ord >= y * 2 && t.ord < y * 2 + 2 && showTerm(t)));

  return (
    <div className="plan-grid">
      <datalist id={listId}>
        {CATALOG.map((c) => (
          <option key={c.code} value={`${c.code} — ${c.title}`} />
        ))}
      </datalist>
      <div className="plan-pre">{termCard(TERMS[0])}</div>
      {years.map((terms, y) => (
        <div key={y} className="plan-year">
          <h2 className="plan-year-label">{YEAR_LABEL[y]}</h2>
          <div
            className="plan-year-terms"
            // Fall and spring get full columns; winter and summer narrower ones.
            style={{ ['--cols' as string]: terms.map((t) => (t.season === 'F' || t.season === 'S' ? 'minmax(0, 1fr)' : 'minmax(0, 0.75fr)')).join(' ') }}
          >
            {terms.map(termCard)}
          </div>
        </div>
      ))}
      <label className="plan-summer-toggle small">
        <input type="checkbox" checked={!!scenario.showSummers} onChange={(e) => update((s) => ({ ...s, showSummers: e.target.checked }))} /> Show winter intersessions and summers
      </label>
    </div>
  );
}

function FlagLine({ f }: { f: Flag }) {
  return (
    <p className={`plan-flag plan-flag-${f.level} small`}>
      {f.level !== 'info' && <AlertTriangle size={14} aria-hidden className="icon" />} {f.text}
      {f.verify && <span className="tag tag-warn">verify</span>}
    </p>
  );
}

function PlanRow({
  r,
  counts,
  majorIds,
  flags,
  forfeited,
  open,
  toggle,
  setItem,
  remove,
}: {
  r: Resolved;
  counts: string[];
  majorIds: string[];
  flags: Flag[];
  forfeited: boolean;
  open: boolean;
  toggle: () => void;
  setItem: (p: Partial<PlanItem>) => void;
  remove: () => void;
}) {
  const c = r.course;
  const warn = flags.some((f) => f.level !== 'info');
  return (
    <li className={`plan-item ${warn ? 'flagged' : ''} ${r.item.addedByAutofill ? 'autofilled' : ''} ${forfeited ? 'forfeited' : ''}`}>
      <button type="button" className="plan-item-main" aria-expanded={open} onClick={toggle}>
        <span className="plan-code num">{r.code}</span>
        <span className="plan-title">
          {r.title}
          {r.item.exam && (
            <span className="plan-exam small">
              {r.item.exam}
              {r.item.score ? ` · ${r.item.score}` : ''}
              {forfeited ? ' · forfeited' : ''}
            </span>
          )}
        </span>
        <span className="plan-meta">
          <Dots ids={counts} majorIds={majorIds} />
          {warn && <AlertTriangle size={14} aria-label="Has a warning" className="plan-warn" />}
          <span className="num muted">{r.credits}</span>
        </span>
      </button>
      {open && (
        <div className="plan-editor">
          {flags.map((f, i) => (
            <FlagLine key={i} f={f} />
          ))}
          <dl className="plan-facts small">
            <div>
              <dt>Source</dt>
              <dd>{c ? SOURCE_LABEL[c.source] : 'custom course'}</dd>
            </div>
            <div>
              <dt>Foundational Abilities</dt>
              <dd>
                {faLabel(r.fa)}
                {c?.faVaries && (
                  <span className="muted">
                    {' '}
                    (varies by section{c.faVaries.length ? `: some sections also carry ${c.faVaries.join(', ')}` : ''}; set your section’s tags below)
                  </span>
                )}
              </dd>
            </div>
            {c?.term && (
              <div>
                <dt>Offered</dt>
                <dd>{c.term === 'F' ? 'Fall only' : 'Spring only'}</dd>
              </div>
            )}
            {(c?.prereqs || c?.prereqText) && (
              <div>
                <dt>Prerequisites</dt>
                <dd>
                  {c.prereqs?.map((g) => g.join(' or ')).join('; ') ?? c.prereqText}
                  {c.seqOnly && <span className="muted"> (planning sequence; confirm in SIS)</span>}
                </dd>
              </div>
            )}
            {c?.lastOffered && (
              <div>
                <dt>Last offered</dt>
                <dd>{c.lastOffered}</dd>
              </div>
            )}
            {c?.note && (
              <div>
                <dt>Note</dt>
                <dd>{c.note}</dd>
              </div>
            )}
          </dl>
          <div className="plan-edit-fields">
            <label>
              Term
              <select value={r.item.termId} onChange={(e) => setItem({ termId: e.target.value })}>
                {TERMS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Credits
              <input type="number" min={0} max={20} step={0.5} value={r.credits} onChange={(e) => setItem({ credits: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </label>
            <label className="wide">
              Title
              <input value={r.title} onChange={(e) => setItem({ title: e.target.value })} />
            </label>
            <label className="wide">
              FA tags (comma-separated, e.g. FA1, FA3)
              <input
                defaultValue={(r.item.fa ?? c?.fa ?? []).join(', ')}
                onBlur={(e) => {
                  const v = e.target.value.split(/[,\s]+/).filter(Boolean).map((t) => t.toUpperCase());
                  setItem({ fa: v });
                }}
              />
            </label>
            <label className="check">
              <input type="checkbox" checked={!!r.item.su} onChange={(e) => setItem({ su: e.target.checked || undefined })} /> Taking it S/U
            </label>
          </div>
          <div className="row-actions tight">
            <button type="button" className="btn btn-small" onClick={remove}>
              <X size={14} aria-hidden /> Remove
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function AddCourse({ listId, onAdd, label }: { listId: string; onAdd: (text: string) => void; label: string }) {
  const [text, setText] = useState('');
  return (
    <form
      className="plan-add"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(text);
        setText('');
      }}
    >
      <input list={listId} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add course code" aria-label={`Add a course to ${label}`} autoCapitalize="characters" />
      <button type="submit" className="btn btn-small btn-icon" aria-label={`Add to ${label}`} disabled={!text.trim()}>
        <Plus size={16} aria-hidden />
      </button>
    </form>
  );
}

/** Adds an AP score as the JHU courses JHU's AP table awards for it. */
function AddAp({ onAdd }: { onAdd: (items: PlanItem[]) => void }) {
  const [exam, setExam] = useState('');
  const [score, setScore] = useState(5);
  const award = exam ? apAward(exam, score) : undefined;
  return (
    <form
      className="plan-ap"
      onSubmit={(e) => {
        e.preventDefault();
        if (!award) return;
        onAdd(apItems(exam, score, newItemId));
        setExam('');
      }}
    >
      <div className="plan-ap-fields">
        <select value={exam} onChange={(e) => setExam(e.target.value)} aria-label="AP exam">
          <option value="">Add an AP score…</option>
          {AP_EXAMS.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <select value={score} onChange={(e) => setScore(Number(e.target.value))} aria-label="AP score">
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-small" disabled={!award}>
          Add
        </button>
      </div>
      {exam && (
        <p className="muted small">
          {award ? `JHU gives ${award.courses.map((c) => c.code).join(' + ')} (${award.courses.reduce((n, c) => n + c.credits, 0)} cr).` : 'JHU gives no credit for this score.'}
          {award?.note ? ` ${award.note}` : ''}{' '}
          <a className="link" href={AP_SOURCE} target="_blank" rel="noreferrer">
            JHU AP table
          </a>
        </p>
      )}
      {!exam && <p className="muted small">AP exams not listed (e.g. English, Psychology) earn no JHU credit.</p>}
    </form>
  );
}
