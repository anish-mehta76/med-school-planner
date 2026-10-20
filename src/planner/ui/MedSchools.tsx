import { useMemo } from 'react';
import { Check, CircleDashed, CircleDot, ExternalLink, HelpCircle, X } from 'lucide-react';
import type { ScenarioAnalysis } from '../engine';
import { AP_SOURCE } from '../apCredit';
import {
  apVerdict,
  DEFAULT_MED_SCHOOLS,
  evaluateSchool,
  MED_SCHOOL_BY_ID,
  MED_SCHOOLS,
  verdictLabel,
  type ApVerdict,
  type SchoolReqResult,
  type SchoolResult,
} from '../medSchools';
import { TERM_BY_ID } from '../terms';
import type { Resolved, Scenario } from '../types';

type Update = (f: (s: Scenario) => Scenario) => void;

const STATUS = {
  met: { icon: Check, label: 'Met', cls: 'done' },
  partial: { icon: CircleDot, label: 'Partly met', cls: 'partial' },
  missing: { icon: CircleDashed, label: 'Missing', cls: 'missing' },
  check: { icon: HelpCircle, label: 'Check with the school', cls: 'note' },
} as const;

const VERDICT_SHORT: Record<ApVerdict, string> = {
  counts: 'Counts',
  advanced: 'With an advanced course',
  no: 'Doesn’t count',
  unstated: 'Not stated',
  score: 'Score too low',
  forfeited: 'Forfeited at JHU',
  'not-required': 'Not required',
};

const MODEL_LABEL = { prerequisites: 'Fixed prerequisites', competencies: 'Competencies (recommended courses)', advising: 'JHU advising' } as const;

export default function MedSchools({ scenario, analysis, update }: { scenario: Scenario; analysis: ScenarioAnalysis; update: Update }) {
  const ids = (scenario.medSchoolIds ?? DEFAULT_MED_SCHOOLS).filter((id) => MED_SCHOOL_BY_ID[id]);
  const schools = ids.map((id) => MED_SCHOOL_BY_ID[id]);
  const results = useMemo(() => schools.map((s) => evaluateSchool(s, analysis.resolved)), [ids.join(), analysis.resolved]);
  const setIds = (next: string[]) => update((s) => ({ ...s, medSchoolIds: next }));

  // One row per AP exam (its lecture courses decide the verdict).
  const exams = useMemo(() => {
    const groups = new Map<string, Resolved[]>();
    for (const r of analysis.resolved.filter((x) => x.season === 'PRE')) {
      const key = r.item.exam ? `${r.item.exam}|${r.item.score ?? ''}` : r.code;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    return [...groups.values()];
  }, [analysis.resolved]);

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <h2>Compare with medical schools</h2>
        </div>
        <p className="small muted">
          Every school’s rules run against the same plan. AP scores enter the plan once, as the JHU courses JHU’s{' '}
          <a className="link" href={AP_SOURCE} target="_blank" rel="noreferrer">
            AP table
          </a>{' '}
          awards; each school then decides whether that credit counts. There’s no free API for medical-school prerequisites (AAMC’s MSAR is a paid subscription), so
          each school here is summarized from its own admissions page. Requirements change every cycle: confirm on the school’s page before relying on it.
        </p>
        <div className="chips" role="group" aria-label="Schools to compare">
          {ids.map((id) => (
            <span key={id} className="chip active">
              {MED_SCHOOL_BY_ID[id].short}
              <button type="button" className="chip-x" aria-label={`Remove ${MED_SCHOOL_BY_ID[id].name}`} onClick={() => setIds(ids.filter((x) => x !== id))}>
                <X size={14} aria-hidden />
              </button>
            </span>
          ))}
          <select value="" onChange={(e) => e.target.value && setIds([...ids, e.target.value])} aria-label="Add a school">
            <option value="">Add a school…</option>
            {MED_SCHOOLS.filter((s) => !ids.includes(s.id)).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {ids.length < MED_SCHOOLS.length && (
            <button type="button" className="chip" onClick={() => setIds(MED_SCHOOLS.map((s) => s.id))}>
              Add all {MED_SCHOOLS.length}
            </button>
          )}
        </div>
      </section>

      {results.length > 0 && (
        <section className="card">
          <h2>At a glance</h2>
          <div className="table-wrap ap-wrap">
            <table className="plan-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Type</th>
                  <th className="num">Required met</th>
                  <th className="num">To check</th>
                  <th>AP policy</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.school.id}>
                    <td>{r.school.name}</td>
                    <td className="small">{MODEL_LABEL[r.school.model]}</td>
                    <td className="num">
                      {r.required ? (
                        <span className="cell-meter">
                          <span className="meter" aria-hidden>
                            <span style={{ width: `${(r.requiredMet / r.required) * 100}%` }} className={r.requiredMet >= r.required ? 'full' : ''} />
                          </span>
                          {`${r.requiredMet} of ${r.required}`}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num">{r.checks || ''}</td>
                    <td className="small">{r.school.ap.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Your AP credit, school by school</h2>
        {!exams.length ? (
          <p className="small muted">Add AP scores in the Exam & transfer credit lane on the Plan tab to see which schools accept them.</p>
        ) : (
          <div className="table-wrap ap-wrap">
            <table className="plan-table ap-table">
              <thead>
                <tr>
                  <th>Exam credit</th>
                  {schools.map((s) => (
                    <th key={s.id}>{s.short}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exams.map((group) => {
                  const lectures = group.filter((r) => !/\blab\b/i.test(r.title));
                  const lead = lectures[0] ?? group[0];
                  const name = lead.item.exam ? `${lead.item.exam}${lead.item.score ? ` (${lead.item.score})` : ''}` : lead.title;
                  return (
                    <tr key={lead.item.id}>
                      <td>
                        {name}
                        <span className="small muted ap-codes">{group.map((r) => r.code).join(', ')}</span>
                      </td>
                      {schools.map((s) => {
                        // Courses from one exam can differ (e.g. only Calc I forfeited), so show each when they do.
                        const vs = (lectures.length ? lectures : [lead]).map((r) => ({ r, v: apVerdict(s, r, analysis.resolved, analysis.forfeited) }));
                        const same = vs.every((x) => x.v === vs[0].v);
                        return (
                          <td key={s.id} className="small">
                            {same ? (
                              <span className={`ap-${vs[0].v}`} title={verdictLabel(vs[0].v)}>
                                {VERDICT_SHORT[vs[0].v]}
                              </span>
                            ) : (
                              vs.map(({ r, v }) => (
                                <span key={r.item.id} className={`ap-${v} ap-line`} title={verdictLabel(v)}>
                                  {r.code.slice(3)}: {VERDICT_SHORT[v]}
                                </span>
                              ))
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted">
          “With an advanced course” turns into “Counts” once the plan has a more advanced college course in that subject (e.g. Genetics or Cell Biology after AP Biology).
          Lab requirements need college labs: JHU waives labs for AP Biology and Physics but gives no credit for them.
        </p>
      </section>

      {results.map((r) => (
        <SchoolCard key={r.school.id} res={r} />
      ))}
    </div>
  );
}

function SchoolCard({ res }: { res: SchoolResult }) {
  const s = res.school;
  const required = res.reqs.filter((r) => r.req.level === 'required');
  const recommended = res.reqs.filter((r) => r.req.level === 'recommended');
  return (
    <section className="card">
      <div className="card-head">
        <h2>{s.name}</h2>
        <span className="muted small num">{res.required ? `${res.requiredMet} of ${res.required} required met` : 'No fixed prerequisites'}</span>
      </div>
      {required.length > 0 && <ReqList title="Required" rows={required} />}
      {recommended.length > 0 && <ReqList title={s.model === 'competencies' ? 'Recommended (no fixed list)' : 'Recommended'} rows={recommended} />}
      <ul className="small muted req-notes">
        <li>AP: {s.ap.note}</li>
        {s.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
        <li>Checked {s.checked}. Course-to-area mapping is this planner’s; confirm with a pre-health advisor.</li>
      </ul>
      <a className="link small" href={s.url} target="_blank" rel="noreferrer">
        School’s requirements page <ExternalLink size={12} aria-hidden />
      </a>
    </section>
  );
}

function ReqList({ title, rows }: { title: string; rows: SchoolReqResult[] }) {
  return (
    <div className="req-section">
      <h3 className="req-section-title">{title}</h3>
      <ul className="req-list">
        {rows.map((r) => {
          const S = STATUS[r.status];
          return (
            <li key={r.req.key} className={`req req-${S.cls}`}>
              <span className="req-icon" title={S.label}>
                <S.icon size={16} aria-hidden />
                <span className="visually-hidden">{S.label}:</span>
              </span>
              <div className="req-body">
                <span className="req-label">{r.req.label}</span>
                {r.items.length > 0 && (
                  <span className="small req-items">
                    Filled by {r.items.map((x) => `${x.code} (${x.season === 'PRE' ? (x.item.exam ?? 'exam credit') : TERM_BY_ID[x.item.termId]?.label})`).join(', ')}
                  </span>
                )}
                {r.detail && r.status !== 'met' && <span className="small muted">{r.detail}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
