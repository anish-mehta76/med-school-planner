import { useMemo, useState } from 'react';
import { BriefcaseMedical, Check, ChevronDown, ExternalLink, Mail, Plus, Search, Trash2, X } from 'lucide-react';
import type { Internship, InternshipStatus, Recommender, RecommenderStatus, Requirement, RequirementKind, RequirementStatus } from '../types';
import { localDate, setState, uid, useStore } from '../store/useStore';
import {
  CLOSED,
  daysUntil,
  dueLabel,
  INTERNSHIP_STATUS_LABEL,
  INTERNSHIP_STATUSES,
  INTERNSHIP_TONE,
  internshipTasks,
  joinInternship,
  lettersIn,
  lettersNeeded,
  materials,
  PENDING,
  PRE_SUBMIT,
  RECOMMENDER_STATUS_LABEL,
  RECOMMENDER_TONE,
  recommendersByPerson,
  REPEATABLE,
  REQUIREMENT_KINDS,
  REQUIREMENT_LABEL,
  REQUIREMENT_STATUS_LABEL,
  requirementName,
  sortInternships,
  waitingOn,
  withStatus,
} from '../engine/internships';
import { Empty, Modal } from '../components/ui';
import { formatDate, formatDateShort } from '../lib/format';
import { StackBar, Timeline } from '../components/viz';

const STATUS_COLOR: Record<InternshipStatus, string> = {
  interested: 'var(--border-control)',
  preparing: 'var(--c4)',
  'awaiting-recs': 'var(--behind)',
  applied: 'var(--c2)',
  interview: 'var(--c5)',
  waitlisted: 'var(--below)',
  accepted: 'var(--c3)',
  committed: 'var(--strong)',
  rejected: 'var(--muted)',
  declined: 'var(--c7)',
  withdrawn: 'var(--line)',
};

/** Kinds where a prompt and length limit are worth writing down. */
const WRITTEN: RequirementKind[] = ['cover', 'personal', 'supplemental', 'research', 'short', 'writing', 'other'];

const today = () => localDate();

function blank(): Internship {
  return { id: uid(), title: '', organization: '', description: '', status: 'interested', requirements: [], recommenders: [], log: [], createdAt: today() };
}

function upsert(i: Internship) {
  setState((s) => {
    const exists = s.internships.some((x) => x.id === i.id);
    return { ...s, internships: exists ? s.internships.map((x) => (x.id === i.id ? i : x)) : [...s.internships, i] };
  });
}

function patch(id: string, fn: (i: Internship) => Internship) {
  setState((s) => ({ ...s, internships: s.internships.map((x) => (x.id === id ? fn(x) : x)) }));
}

function Stage({ status }: { status: InternshipStatus }) {
  return <span className={`stage stage-${INTERNSHIP_TONE[status]}`}>{INTERNSHIP_STATUS_LABEL[status]}</span>;
}

function RecStage({ status }: { status: RecommenderStatus }) {
  return <span className={`stage stage-${RECOMMENDER_TONE[status]}`}>{RECOMMENDER_STATUS_LABEL[status]}</span>;
}

function Ext({ href, children }: { href: string; children: string }) {
  const url = /^https?:\/\//i.test(href) ? href : `https://${href}`;
  return (
    <a className="btn btn-small" href={url} target="_blank" rel="noreferrer">
      {children} <ExternalLink size={14} aria-hidden />
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────

function RequirementsEditor({ list, onChange }: { list: Requirement[]; onChange: (l: Requirement[]) => void }) {
  const has = (k: RequirementKind) => list.some((r) => r.kind === k);
  const toggle = (k: RequirementKind) =>
    onChange(has(k) ? list.filter((r) => r.kind !== k) : [...list, { id: uid(), kind: k, status: 'todo', count: k === 'recs' ? 2 : undefined }]);
  const add = (k: RequirementKind) => onChange([...list, { id: uid(), kind: k, status: 'todo' }]);
  const set = (id: string, p: Partial<Requirement>) => onChange(list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id: string) => onChange(list.filter((r) => r.id !== id));
  const ordered = REQUIREMENT_KINDS.flatMap((k) => list.filter((r) => r.kind === k));

  return (
    <>
      <div className="span-2">
        <p className="field-label">What does it ask for?</p>
        <div className="chips" role="group" aria-label="Application requirements">
          {REQUIREMENT_KINDS.map((k) => (
            <button key={k} type="button" className={`chip int-chip ${has(k) ? 'active' : ''}`} aria-pressed={has(k)} onClick={() => toggle(k)}>
              {has(k) && <Check size={14} aria-hidden />} {REQUIREMENT_LABEL[k]}
            </button>
          ))}
        </div>
        <span className="hint">Pick everything that applies. You can add more than one essay or short-answer set.</span>
      </div>
      {ordered.length > 0 && (
        <ul className="int-req-edit span-2">
          {ordered.map((r, idx) => {
            const lastOfKind = ordered[idx + 1]?.kind !== r.kind;
            return (
              <li key={r.id}>
                <div className="int-req-edit-head">
                  <strong>{REQUIREMENT_LABEL[r.kind]}</strong>
                  <select aria-label={`Status of ${requirementName(r)}`} value={r.status} onChange={(e) => set(r.id, { status: e.target.value as RequirementStatus })}>
                    {Object.entries(REQUIREMENT_STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn-icon" onClick={() => remove(r.id)} aria-label={`Remove ${requirementName(r)}`}>
                    <X size={16} aria-hidden />
                  </button>
                </div>
                <div className="int-req-edit-fields">
                  {r.kind === 'recs' ? (
                    <label>
                      How many letters
                      <input type="number" min={1} max={10} value={r.count ?? ''} onChange={(e) => set(r.id, { count: e.target.value ? Number(e.target.value) : undefined })} />
                      <span className="hint">Add who you're asking under Recommenders below.</span>
                    </label>
                  ) : (
                    <>
                      {(REPEATABLE.includes(r.kind) || WRITTEN.includes(r.kind)) && (
                        <label>
                          Name (optional)
                          <input value={r.label ?? ''} onChange={(e) => set(r.id, { label: e.target.value })} placeholder={r.kind === 'supplemental' ? 'e.g. Why this program?' : ''} />
                        </label>
                      )}
                      {WRITTEN.includes(r.kind) && (
                        <label>
                          Length limit
                          <input value={r.limit ?? ''} onChange={(e) => set(r.id, { limit: e.target.value })} placeholder="e.g. 500 words, 1 page" />
                        </label>
                      )}
                      {WRITTEN.includes(r.kind) && (
                        <label className="span-2">
                          Prompt
                          <textarea rows={2} value={r.prompt ?? ''} onChange={(e) => set(r.id, { prompt: e.target.value })} placeholder="Paste the question exactly as written" />
                        </label>
                      )}
                      {!WRITTEN.includes(r.kind) && (
                        <label className="span-2">
                          Notes
                          <input
                            value={r.notes ?? ''}
                            onChange={(e) => set(r.id, { notes: e.target.value })}
                            placeholder={r.kind === 'transcript' ? 'Official or unofficial? Sent from SIS?' : r.kind === 'fee' ? 'Amount, or fee waiver' : ''}
                          />
                        </label>
                      )}
                    </>
                  )}
                </div>
                {lastOfKind && REPEATABLE.includes(r.kind) && (
                  <button type="button" className="link-btn small" onClick={() => add(r.kind)}>
                    <Plus size={14} aria-hidden /> Add another {REQUIREMENT_LABEL[r.kind].toLowerCase()}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function RecommendersEditor({ list, onChange, known }: { list: Recommender[]; onChange: (l: Recommender[]) => void; known: Recommender[] }) {
  const set = (id: string, p: Partial<Recommender>) => onChange(list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const pickName = (id: string, name: string) => {
    const k = known.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
    const cur = list.find((r) => r.id === id)!;
    set(id, { name, role: cur.role || k?.role, email: cur.email || k?.email });
  };
  return (
    <div className="span-2">
      {list.length === 0 && <p className="hint">Who you'll ask, or have asked, for a letter. People you add here are suggested for your other applications.</p>}
      <ul className="int-rec-edit">
        {list.map((r) => (
          <li key={r.id}>
            <label>
              Name
              <input required value={r.name} onChange={(e) => pickName(r.id, e.target.value)} list="known-recommenders" placeholder="e.g. Dr. Jane Smith" />
            </label>
            <label>
              Role
              <input value={r.role ?? ''} onChange={(e) => set(r.id, { role: e.target.value })} placeholder="e.g. PI of your lab" />
            </label>
            <label>
              Email
              <input type="email" value={r.email ?? ''} onChange={(e) => set(r.id, { email: e.target.value })} />
            </label>
            <label>
              Status
              <select
                value={r.status}
                onChange={(e) => {
                  const status = e.target.value as RecommenderStatus;
                  set(r.id, {
                    status,
                    askedOn: status !== 'to-ask' && !r.askedOn ? today() : r.askedOn,
                    submittedOn: status === 'submitted' && !r.submittedOn ? today() : r.submittedOn,
                  });
                }}
              >
                {Object.entries(RECOMMENDER_STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Asked on
              <input type="date" value={r.askedOn ?? ''} onChange={(e) => set(r.id, { askedOn: e.target.value || undefined })} />
            </label>
            <label>
              Letter due
              <input type="date" value={r.dueDate ?? ''} onChange={(e) => set(r.id, { dueDate: e.target.value || undefined })} />
            </label>
            <label className="span-all">
              Notes
              <input value={r.notes ?? ''} onChange={(e) => set(r.id, { notes: e.target.value })} placeholder="What you sent them (resume, draft points), how they submit" />
            </label>
            <button type="button" className="btn btn-small btn-ghost danger int-rec-remove" onClick={() => onChange(list.filter((x) => x.id !== r.id))}>
              <Trash2 size={14} aria-hidden /> Remove
            </button>
          </li>
        ))}
      </ul>
      <datalist id="known-recommenders">
        {[...new Set(known.map((k) => k.name.trim()))].map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <button type="button" className="btn btn-small" onClick={() => onChange([...list, { id: uid(), name: '', status: 'to-ask' }])}>
        <Plus size={14} aria-hidden /> Add recommender
      </button>
    </div>
  );
}

function InternshipForm({ initial, onClose, onDelete }: { initial: Internship; onClose: () => void; onDelete?: () => void }) {
  const [i, setI] = useState(initial);
  const all = useStore().internships;
  const set = <K extends keyof Internship>(k: K, v: Internship[K]) => setI((p) => ({ ...p, [k]: v }));
  const str = (v: string) => v || undefined;
  const known = all.filter((x) => x.id !== i.id).flatMap((x) => x.recommenders);
  const orgs = [...new Set(all.map((x) => x.organization).filter(Boolean))];

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const saved = initial.status === i.status ? i : withStatus({ ...i, status: initial.status }, i.status, today());
        upsert({ ...saved, recommenders: saved.recommenders.filter((r) => r.name.trim()) });
        onClose();
      }}
    >
      <h3 className="form-section span-2">The internship</h3>
      <label className="span-2">
        Title
        <input required value={i.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Summer Undergraduate Research Fellowship" />
      </label>
      <label>
        Organization
        <input value={i.organization} onChange={(e) => set('organization', e.target.value)} list="int-orgs" placeholder="e.g. Memorial Sloan Kettering" />
        <datalist id="int-orgs">
          {orgs.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </label>
      <label>
        Location
        <input value={i.location ?? ''} onChange={(e) => set('location', str(e.target.value))} placeholder="e.g. New York, NY" />
      </label>
      <label>
        Format
        <select value={i.format ?? ''} onChange={(e) => set('format', (e.target.value || undefined) as Internship['format'])}>
          <option value="">Not sure</option>
          <option value="in-person">In person</option>
          <option value="hybrid">Hybrid</option>
          <option value="remote">Remote</option>
        </select>
      </label>
      <label>
        Term
        <input value={i.term ?? ''} onChange={(e) => set('term', str(e.target.value))} placeholder="e.g. Summer 2027" />
      </label>
      <label>
        Program starts
        <input type="date" value={i.startDate ?? ''} onChange={(e) => set('startDate', str(e.target.value))} />
      </label>
      <label>
        Program ends
        <input type="date" value={i.endDate ?? ''} onChange={(e) => set('endDate', str(e.target.value))} />
      </label>
      <label>
        Pay or stipend
        <input value={i.compensation ?? ''} onChange={(e) => set('compensation', str(e.target.value))} placeholder="e.g. $5,000 + housing, Unpaid" />
      </label>
      <label>
        Your priority
        <select value={i.priority ?? ''} onChange={(e) => set('priority', (e.target.value || undefined) as Internship['priority'])}>
          <option value="">Not set</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label className="span-2">
        Description
        <textarea rows={4} value={i.description} onChange={(e) => set('description', e.target.value)} placeholder="What you'd do, who runs it, what it offers" />
      </label>
      <label className="span-2">
        Eligibility
        <input value={i.eligibility ?? ''} onChange={(e) => set('eligibility', str(e.target.value))} placeholder="e.g. Rising juniors and seniors, US citizens or permanent residents, GPA 3.0+" />
      </label>

      <h3 className="form-section span-2">Portal & links</h3>
      <label>
        Application portal
        <input type="url" value={i.portalUrl ?? ''} onChange={(e) => set('portalUrl', str(e.target.value))} placeholder="https://" />
      </label>
      <label>
        Program page
        <input type="url" value={i.programUrl ?? ''} onChange={(e) => set('programUrl', str(e.target.value))} placeholder="https://" />
      </label>
      <label className="span-2">
        Portal username or email
        <input value={i.portalLogin ?? ''} onChange={(e) => set('portalLogin', str(e.target.value))} autoComplete="off" />
        <span className="hint">Which account you used. Don't store passwords here; keep them in your password manager.</span>
      </label>
      <label>
        Program contact
        <input value={i.contactName ?? ''} onChange={(e) => set('contactName', str(e.target.value))} placeholder="Coordinator or PI" />
      </label>
      <label>
        Contact email
        <input type="email" value={i.contactEmail ?? ''} onChange={(e) => set('contactEmail', str(e.target.value))} />
      </label>

      <h3 className="form-section span-2">Dates & status</h3>
      <label>
        Status
        <select value={i.status} onChange={(e) => set('status', e.target.value as InternshipStatus)}>
          {INTERNSHIP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {INTERNSHIP_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Application deadline
        <input type="date" value={i.deadline ?? ''} onChange={(e) => set('deadline', str(e.target.value))} />
      </label>
      <label className="check span-2">
        <input type="checkbox" checked={!!i.rolling} onChange={(e) => set('rolling', e.target.checked || undefined)} />
        Rolling admissions (apply early)
      </label>
      <label>
        Applied on
        <input type="date" value={i.appliedOn ?? ''} onChange={(e) => set('appliedOn', str(e.target.value))} />
      </label>
      <label>
        Decisions expected
        <input type="date" value={i.decisionExpected ?? ''} onChange={(e) => set('decisionExpected', str(e.target.value))} />
      </label>
      <label>
        Interview
        <input type="date" value={i.interviewOn ?? ''} onChange={(e) => set('interviewOn', str(e.target.value))} />
      </label>
      <label>
        Decision received
        <input type="date" value={i.decisionOn ?? ''} onChange={(e) => set('decisionOn', str(e.target.value))} />
      </label>
      <label>
        Reply to offer by
        <input type="date" value={i.offerDeadline ?? ''} onChange={(e) => set('offerDeadline', str(e.target.value))} />
      </label>

      <h3 className="form-section span-2">Requirements</h3>
      <RequirementsEditor list={i.requirements} onChange={(l) => set('requirements', l)} />

      <h3 className="form-section span-2">Letters</h3>
      <RecommendersEditor list={i.recommenders} onChange={(l) => set('recommenders', l)} known={known} />

      <h3 className="form-section span-2">Notes</h3>
      <label className="span-2">
        Why it fits you
        <textarea rows={3} value={i.fitNotes ?? ''} onChange={(e) => set('fitNotes', str(e.target.value))} placeholder="Points for your essays and interview" />
      </label>
      <label className="span-2">
        Interview notes
        <textarea rows={2} value={i.interviewNotes ?? ''} onChange={(e) => set('interviewNotes', str(e.target.value))} placeholder="Who you spoke with, what they asked" />
      </label>
      <label className="span-2">
        Other notes
        <textarea rows={2} value={i.notes ?? ''} onChange={(e) => set('notes', str(e.target.value))} />
      </label>

      <div className="form-actions span-2">
        {onDelete && (
          <button type="button" className="btn btn-ghost danger spacer" onClick={onDelete}>
            Delete
          </button>
        )}
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Save
        </button>
      </div>
    </form>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────

function DateLine({ i, now }: { i: Internship; now: string }) {
  if (PRE_SUBMIT.includes(i.status)) {
    if (i.deadline) {
      const n = daysUntil(i.deadline, now);
      return <span className={`int-date num ${n < 0 ? 'danger' : n <= 7 ? 'soon' : ''}`}>{dueLabel(i.deadline, now)}</span>;
    }
    return <span className="int-date muted">{i.rolling ? 'Rolling' : 'No deadline set'}</span>;
  }
  if (i.status === 'accepted' && i.offerDeadline) return <span className="int-date soon num">{dueLabel(i.offerDeadline, now, 'Reply')}</span>;
  if (i.status === 'interview' && i.interviewOn && i.interviewOn >= now) return <span className="int-date num">{dueLabel(i.interviewOn, now, 'Interview')}</span>;
  if (PENDING.includes(i.status) && i.decisionExpected) return <span className="int-date muted num">Decision ~{formatDateShort(i.decisionExpected)}</span>;
  if (i.appliedOn) return <span className="int-date muted num">Applied {formatDateShort(i.appliedOn)}</span>;
  return null;
}

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  if (!total) return null;
  return (
    <span className="int-progress">
      <span className="muted small">
        {label} <strong className="ink num">{done}/{total}</strong>
      </span>
      <span className="int-progress-bar" aria-hidden>
        <span style={{ width: `${Math.min(100, (done / total) * 100)}%` }} className={done >= total ? 'full' : ''} />
      </span>
    </span>
  );
}

function InternshipCard({ i, open, onToggle, onEdit, now }: { i: Internship; open: boolean; onToggle: () => void; onEdit: () => void; now: string }) {
  const m = materials(i);
  const need = lettersNeeded(i);
  const wait = waitingOn(i);
  const bodyId = `int-body-${i.id}`;
  const setReq = (rid: string, status: RequirementStatus) => patch(i.id, (x) => ({ ...x, requirements: x.requirements.map((r) => (r.id === rid ? { ...r, status } : r)) }));
  const setRec = (rid: string, p: Partial<Recommender>) => patch(i.id, (x) => ({ ...x, recommenders: x.recommenders.map((r) => (r.id === rid ? { ...r, ...p } : r)) }));
  const recStatus = (r: Recommender, status: RecommenderStatus) =>
    setRec(r.id, {
      status,
      askedOn: status !== 'to-ask' && !r.askedOn ? now : r.askedOn,
      submittedOn: status === 'submitted' && !r.submittedOn ? now : r.submittedOn,
    });
  const allLettersIn = need > 0 && lettersIn(i) >= need;

  return (
    <article className={`mentor int-card ${open ? 'open' : ''} ${CLOSED.includes(i.status) && i.status !== 'committed' ? 'int-closed' : ''}`} id={`int-${i.id}`}>
      <button className="int-head" onClick={onToggle} aria-expanded={open} aria-controls={bodyId}>
        <span className="int-id">
          <strong>{i.title}</strong>
          <span className="muted small">{[i.organization, i.location, i.term].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="int-meta">
          <Progress done={m.done} total={m.total} label="Materials" />
          <Progress done={lettersIn(i)} total={need} label="Letters" />
        </span>
        <span className="int-right">
          <Stage status={i.status} />
          <DateLine i={i} now={now} />
        </span>
        <ChevronDown className="chev" size={20} aria-hidden />
      </button>
      {open && (
        <div className="mentor-body int-body" id={bodyId}>
          <div className="int-toolbar">
            <label className="int-status">
              <span className="muted small">Status</span>
              <select value={i.status} onChange={(e) => patch(i.id, (x) => withStatus(x, e.target.value as InternshipStatus, now))}>
                {INTERNSHIP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {INTERNSHIP_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <div className="row-actions tight">
              {i.portalUrl && <Ext href={i.portalUrl}>Open portal</Ext>}
              {i.programUrl && <Ext href={i.programUrl}>Program page</Ext>}
              <button className="btn btn-small" onClick={onEdit}>
                Edit
              </button>
            </div>
          </div>

          {i.status === 'awaiting-recs' && allLettersIn && (
            <div className="callout int-callout">
              <p>All {need} letters are in. Mark this application complete?</p>
              <button className="btn btn-small btn-primary" onClick={() => patch(i.id, (x) => withStatus(x, 'applied', now))}>
                Mark complete
              </button>
            </div>
          )}
          {PRE_SUBMIT.includes(i.status) && wait.length > 0 && i.deadline && daysUntil(i.deadline, now) <= 7 && (
            <div className="callout int-callout warn">
              <p>
                {dueLabel(i.deadline, now, 'The deadline is')} and {wait.length} {wait.length === 1 ? 'letter is' : 'letters are'} still out. Many portals let you submit
                first; letters can follow. Check this program's rules.
              </p>
            </div>
          )}
          {i.status === 'committed' && !i.experienceId && (
            <div className="callout int-callout">
              <p>You accepted this offer. Add it to Experiences so you can log hours and write your AMCAS description.</p>
              <button className="btn btn-small btn-primary" onClick={() => setState((s) => joinInternship(s, i, now))}>
                <BriefcaseMedical size={14} aria-hidden /> Add to Experiences
              </button>
            </div>
          )}

          <div className="int-grid">
            <section>
              <h3>Requirements</h3>
              {i.requirements.length ? (
                <ul className="int-reqs">
                  {REQUIREMENT_KINDS.flatMap((k) => i.requirements.filter((r) => r.kind === k)).map((r) => (
                    <li key={r.id} className={`int-req-${r.status}`}>
                      <div>
                        <span className="int-name">{requirementName(r)}</span>
                        {r.kind === 'recs' ? (
                          <span className="muted small">
                            {' '}
                            · {lettersIn(i)} of {need} in
                          </span>
                        ) : (
                          r.limit && <span className="muted small"> · {r.limit}</span>
                        )}
                        {r.prompt && <p className="muted small int-prompt">{r.prompt}</p>}
                        {r.notes && <p className="muted small int-prompt">{r.notes}</p>}
                      </div>
                      {r.kind !== 'recs' && (
                        <select aria-label={`Status of ${requirementName(r)}`} value={r.status} onChange={(e) => setReq(r.id, e.target.value as RequirementStatus)}>
                          {Object.entries(REQUIREMENT_STATUS_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">
                  None listed.{' '}
                  <button className="link-btn" onClick={onEdit}>
                    Add what it asks for
                  </button>
                </p>
              )}
            </section>

            <section>
              <h3>
                Letters
                {wait.length > 0 && <span className="muted small"> · waiting on {wait.map((r) => r.name).join(', ')}</span>}
              </h3>
              {i.recommenders.length ? (
                <ul className="int-recs">
                  {i.recommenders.map((r) => (
                    <li key={r.id}>
                      <div>
                        <span className="int-name">{r.name}</span>
                        {r.role && <span className="muted small"> · {r.role}</span>}
                        <p className="muted small">
                          {[
                            r.askedOn && `Asked ${formatDateShort(r.askedOn)}`,
                            r.dueDate && `due ${formatDateShort(r.dueDate)}`,
                            r.submittedOn && r.status === 'submitted' && `submitted ${formatDateShort(r.submittedOn)}`,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Not asked yet'}
                        </p>
                        {r.status === 'submitted' && (
                          <label className="check small int-thanks">
                            <input type="checkbox" checked={!!r.thanked} onChange={(e) => setRec(r.id, { thanked: e.target.checked })} />
                            Thank-you sent
                          </label>
                        )}
                      </div>
                      <div className="int-rec-side">
                        {r.email && (
                          <a className="btn-icon" href={`mailto:${r.email}`} aria-label={`Email ${r.name}`} title={r.email}>
                            <Mail size={16} aria-hidden />
                          </a>
                        )}
                        <select aria-label={`Letter status for ${r.name}`} value={r.status} onChange={(e) => recStatus(r, e.target.value as RecommenderStatus)}>
                          {Object.entries(RECOMMENDER_STATUS_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">
                  {need ? `This needs ${need} ${need === 1 ? 'letter' : 'letters'}. ` : 'No letters listed. '}
                  <button className="link-btn" onClick={onEdit}>
                    Add recommenders
                  </button>
                </p>
              )}
            </section>
          </div>

          <dl className="facts int-facts">
            {i.description && (
              <>
                <dt>Description</dt>
                <dd className="prose">{i.description}</dd>
              </>
            )}
            {i.eligibility && (
              <>
                <dt>Eligibility</dt>
                <dd>{i.eligibility}</dd>
              </>
            )}
            {(i.startDate || i.endDate) && (
              <>
                <dt>Program dates</dt>
                <dd className="num">
                  {formatDate(i.startDate) || '?'} – {formatDate(i.endDate) || '?'}
                </dd>
              </>
            )}
            {i.format && (
              <>
                <dt>Format</dt>
                <dd>{i.format === 'in-person' ? 'In person' : i.format === 'hybrid' ? 'Hybrid' : 'Remote'}</dd>
              </>
            )}
            {i.compensation && (
              <>
                <dt>Pay</dt>
                <dd>{i.compensation}</dd>
              </>
            )}
            {i.deadline && (
              <>
                <dt>Deadline</dt>
                <dd className="num">{formatDate(i.deadline)}</dd>
              </>
            )}
            {i.decisionExpected && (
              <>
                <dt>Decisions expected</dt>
                <dd className="num">{formatDate(i.decisionExpected)}</dd>
              </>
            )}
            {i.interviewOn && (
              <>
                <dt>Interview</dt>
                <dd className="num">{formatDate(i.interviewOn)}</dd>
              </>
            )}
            {i.offerDeadline && (
              <>
                <dt>Reply to offer by</dt>
                <dd className="num">{formatDate(i.offerDeadline)}</dd>
              </>
            )}
            {i.portalLogin && (
              <>
                <dt>Portal account</dt>
                <dd>{i.portalLogin}</dd>
              </>
            )}
            {(i.contactName || i.contactEmail) && (
              <>
                <dt>Contact</dt>
                <dd>
                  {i.contactName}
                  {i.contactEmail && (
                    <>
                      {i.contactName && ' · '}
                      <a href={`mailto:${i.contactEmail}`}>{i.contactEmail}</a>
                    </>
                  )}
                </dd>
              </>
            )}
            {i.priority && (
              <>
                <dt>Priority</dt>
                <dd>{i.priority[0].toUpperCase() + i.priority.slice(1)}</dd>
              </>
            )}
            {i.fitNotes && (
              <>
                <dt>Why it fits</dt>
                <dd className="prose">{i.fitNotes}</dd>
              </>
            )}
            {i.interviewNotes && (
              <>
                <dt>Interview notes</dt>
                <dd className="prose">{i.interviewNotes}</dd>
              </>
            )}
            {i.notes && (
              <>
                <dt>Notes</dt>
                <dd className="prose">{i.notes}</dd>
              </>
            )}
          </dl>

          {i.log.length > 0 && (
            <details className="disclosure">
              <summary>
                Activity <span className="muted small">· {i.log.length}</span>
                <ChevronDown className="chev" size={16} aria-hidden />
              </summary>
              <ol className="int-log">
                {[...i.log].reverse().map((l, n) => (
                  <li key={n}>
                    <span className="muted small num">{formatDate(l.date)}</span> {l.text}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </article>
  );
}

// ── Recommenders view ─────────────────────────────────────────────────────

function RecommendersView({ list, onOpen }: { list: Internship[]; onOpen: (id: string) => void }) {
  const people = recommendersByPerson(list);
  if (!people.length) return <Empty>No recommenders yet. Add them from an application's Edit form, under Letters.</Empty>;
  return (
    <div className="int-people">
      {people.map((p) => {
        const waiting = p.items.filter(({ r }) => r.status === 'asked' || r.status === 'agreed');
        return (
          <section key={p.name} className="card int-person">
            <div className="card-head">
              <div>
                <h3>{p.name}</h3>
                <p className="muted small">
                  {[p.role, `${p.items.length} ${p.items.length === 1 ? 'application' : 'applications'}`, waiting.length && `waiting on ${waiting.length}`].filter(Boolean).join(' · ')}
                </p>
              </div>
              {p.email && (
                <a className="btn btn-small" href={`mailto:${p.email}`}>
                  <Mail size={14} aria-hidden /> Email
                </a>
              )}
            </div>
            <ul className="int-recs">
              {p.items.map(({ i, r }) => (
                <li key={`${i.id}-${r.id}`}>
                  <div>
                    <button className="link-btn int-name" onClick={() => onOpen(i.id)}>
                      {i.title}
                    </button>
                    {i.organization && <span className="muted small"> · {i.organization}</span>}
                    <p className="muted small num">
                      {[r.askedOn && `Asked ${formatDateShort(r.askedOn)}`, (r.dueDate ?? i.deadline) && `due ${formatDateShort(r.dueDate ?? i.deadline)}`].filter(Boolean).join(' · ') ||
                        'Not asked yet'}
                    </p>
                  </div>
                  <div className="int-rec-side">
                    <RecStage status={r.status} />
                    {r.status === 'submitted' && (r.thanked ? <span className="tag tag-ok">Thanked</span> : <span className="tag tag-warn">Thank-you due</span>)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

type Sort = 'next' | 'deadline' | 'priority' | 'added';

export default function Internships() {
  const { internships } = useStore();
  const now = today();
  const [editing, setEditing] = useState<Internship | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<'apps' | 'letters'>('apps');
  const [status, setStatus] = useState<InternshipStatus | 'all' | 'open'>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('next');

  const counts = Object.fromEntries(INTERNSHIP_STATUSES.map((s) => [s, internships.filter((i) => i.status === s).length])) as Record<InternshipStatus, number>;
  const openCount = internships.filter((i) => !CLOSED.includes(i.status)).length;
  const submitted = internships.filter((i) => !PRE_SUBMIT.includes(i.status) && i.status !== 'withdrawn').length;
  const offers = internships.filter((i) => i.status === 'accepted' || i.status === 'committed').length;
  const decided = internships.filter((i) => ['accepted', 'committed', 'declined', 'rejected'].includes(i.status)).length;
  const lettersOut = internships.filter((i) => !CLOSED.includes(i.status)).flatMap(waitingOn);
  const tasks = useMemo(() => internshipTasks(internships, now), [internships, now]);

  const shown = useMemo(() => {
    const prio = { high: 0, medium: 1, low: 2 };
    const list = internships.filter(
      (i) =>
        (status === 'all' || (status === 'open' ? !CLOSED.includes(i.status) : i.status === status)) &&
        (!q || `${i.title} ${i.organization} ${i.location ?? ''} ${i.description} ${i.recommenders.map((r) => r.name).join(' ')}`.toLowerCase().includes(q.toLowerCase())),
    );
    if (sort === 'next') return sortInternships(list, now);
    if (sort === 'deadline') return [...list].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
    if (sort === 'priority') return [...list].sort((a, b) => (prio[a.priority ?? 'low'] ?? 3) - (prio[b.priority ?? 'low'] ?? 3) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [internships, status, q, sort, now]);

  const openCard = (id: string) => {
    setTab('apps');
    setStatus('all');
    setQ('');
    setOpen(id);
    requestAnimationFrame(() => document.getElementById(`int-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };

  const remove = (i: Internship) => {
    if (confirm(`Delete "${i.title}"? This removes its requirements, letters and notes.`)) {
      setState((s) => ({ ...s, internships: s.internships.filter((x) => x.id !== i.id) }));
      setEditing(null);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Internships</h1>
          <p className="muted">Every internship and summer program you're applying to: portals, requirements, letters and decisions in one place.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(blank())}>
          <Plus size={16} aria-hidden /> Add internship
        </button>
      </header>

      {internships.length === 0 ? (
        <Empty>
          <strong>No internships yet</strong>
          <p>Add one to track its portal, what it asks for (essays, CV, letters), who you've asked for letters, and what you hear back.</p>
          <button className="btn btn-primary" onClick={() => setEditing(blank())}>
            <Plus size={16} aria-hidden /> Add your first internship
          </button>
        </Empty>
      ) : (
        <>
          <section className="stats" aria-label="Summary">
            <div className="stat">
              <span className="stat-label">In progress</span>
              <span className="stat-value">{openCount}</span>
              <span className="muted small">{internships.length} tracked in all</span>
            </div>
            <div className="stat">
              <span className="stat-label">Submitted</span>
              <span className="stat-value">{submitted}</span>
              <span className="muted small">{counts.interested + counts.preparing} not yet sent</span>
            </div>
            <div className="stat">
              <span className="stat-label">Letters outstanding</span>
              <span className="stat-value">{lettersOut.length}</span>
              <span className="muted small">{lettersOut.length ? `From ${[...new Set(lettersOut.map((r) => r.name))].length} ${[...new Set(lettersOut.map((r) => r.name))].length === 1 ? 'person' : 'people'}` : 'None pending'}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Offers</span>
              <span className="stat-value">{offers}</span>
              <span className="muted small">{decided ? `${offers} of ${decided} decisions` : 'No decisions yet'}</span>
            </div>
          </section>

          {tasks.length > 0 && (
            <section className="card" aria-labelledby="int-next">
              <div className="card-head">
                <h2 id="int-next">Up next</h2>
                <span className="muted small">Deadlines in the next 3 weeks, letters, interviews and offers</span>
              </div>
              <ul className="int-tasks">
                {tasks.slice(0, 8).map((t) => (
                  <li key={t.id} className={t.urgent ? 'urgent' : ''}>
                    <button className="link-btn" onClick={() => openCard(t.internshipId)}>
                      {t.title}
                    </button>
                    <span className="muted small">{t.detail}</span>
                  </li>
                ))}
              </ul>
              {tasks.length > 8 && <p className="muted small">And {tasks.length - 8} more.</p>}
            </section>
          )}

          <section className="card research-viz" aria-labelledby="int-pipe">
            <div className="card-head">
              <h2 id="int-pipe">Pipeline</h2>
              <span className="muted small">Click a stage to filter</span>
            </div>
            <StackBar
              label="Applications by status. Pick one to filter"
              picked={status === 'all' || status === 'open' ? undefined : status}
              onPick={(k) => {
                setTab('apps');
                setStatus(status === k ? 'all' : (k as InternshipStatus));
              }}
              segments={INTERNSHIP_STATUSES.map((s) => ({ key: s, label: INTERNSHIP_STATUS_LABEL[s], value: counts[s], color: STATUS_COLOR[s] }))}
            />
            {internships.some((i) => PRE_SUBMIT.includes(i.status) && i.deadline && i.deadline >= now) && (
              <>
                <h3 className="viz-sub">Deadlines ahead</h3>
                <Timeline
                  today={now}
                  items={internships
                    .filter((i) => PRE_SUBMIT.includes(i.status) && i.deadline)
                    .map((i) => ({ id: i.id, label: `${i.title}${i.organization ? ` · ${i.organization}` : ''}`, date: i.deadline!, confirmed: true }))}
                  onPick={openCard}
                />
              </>
            )}
          </section>

          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'apps'} className={tab === 'apps' ? 'active' : ''} onClick={() => setTab('apps')}>
              Applications <span className="muted">{internships.length}</span>
            </button>
            <button role="tab" aria-selected={tab === 'letters'} className={tab === 'letters' ? 'active' : ''} onClick={() => setTab('letters')}>
              Recommenders <span className="muted">{recommendersByPerson(internships).length}</span>
            </button>
          </div>

          {tab === 'letters' ? (
            <RecommendersView list={internships} onOpen={openCard} />
          ) : (
            <>
              <div className="chips chips-scroll" role="group" aria-label="Filter by status">
                <button className={`chip ${status === 'all' ? 'active' : ''}`} aria-pressed={status === 'all'} onClick={() => setStatus('all')}>
                  All <span className="muted">{internships.length}</span>
                </button>
                <button className={`chip ${status === 'open' ? 'active' : ''}`} aria-pressed={status === 'open'} onClick={() => setStatus('open')}>
                  In progress <span className="muted">{openCount}</span>
                </button>
                {INTERNSHIP_STATUSES.filter((s) => counts[s] > 0 || status === s).map((s) => (
                  <button key={s} className={`chip ${status === s ? 'active' : ''}`} aria-pressed={status === s} onClick={() => setStatus(s)}>
                    {INTERNSHIP_STATUS_LABEL[s]} <span className="muted">{counts[s]}</span>
                  </button>
                ))}
              </div>
              <div className="filters">
                <span className="search-field">
                  <Search size={16} aria-hidden />
                  <input type="search" placeholder="Search title, organization or recommender" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search internships" />
                </span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
                  <option value="next">Sort: next date</option>
                  <option value="deadline">Sort: deadline</option>
                  <option value="priority">Sort: priority</option>
                  <option value="added">Sort: recently added</option>
                </select>
              </div>
              <div className="mentor-list">
                {shown.map((i) => (
                  <InternshipCard key={i.id} i={i} now={now} open={open === i.id} onToggle={() => setOpen(open === i.id ? null : i.id)} onEdit={() => setEditing(i)} />
                ))}
                {shown.length === 0 && (
                  <Empty>
                    <p>No internships match those filters.</p>
                    <button
                      className="btn"
                      onClick={() => {
                        setStatus('all');
                        setQ('');
                      }}
                    >
                      Clear filters
                    </button>
                  </Empty>
                )}
              </div>
            </>
          )}
        </>
      )}

      {editing && (
        <Modal title={internships.some((x) => x.id === editing.id) ? 'Edit internship' : 'Add internship'} onClose={() => setEditing(null)}>
          <InternshipForm
            initial={internships.find((x) => x.id === editing.id) ?? editing}
            onClose={() => setEditing(null)}
            onDelete={internships.some((x) => x.id === editing.id) ? () => remove(editing) : undefined}
          />
        </Modal>
      )}
    </div>
  );
}
