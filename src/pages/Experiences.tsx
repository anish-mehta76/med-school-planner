import { useState } from 'react';
import { FolderOpen, Plus, Star, X } from 'lucide-react';
import type { Category, Experience } from '../types';
import { localDate, setState, uid, useStore } from '../store/useStore';
import { AMCAS_DESC_LIMIT, AMCAS_MAX_ENTRIES, CATEGORY_LABELS } from '../data/benchmarks';
import { amcasSlots, experienceHours } from '../engine/gaps';
import { Empty, Modal } from '../components/ui';
import { formatDate, formatHours, formatMonth } from '../lib/format';
import { MiniBars, StackBar } from '../components/viz';

/** The last 12 months, oldest first, as YYYY-MM keys and short labels. */
function last12() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) };
  });
}

/** Hours from logged sessions in each of the last 12 months. */
function monthlyHours(e: Experience) {
  return last12().map((m) => e.logs.filter((l) => l.date.startsWith(m.key)).reduce((sum, l) => sum + l.hours, 0));
}

const CATEGORY_COLORS: Record<Category, string> = {
  'clinical-paid': 'var(--c1)',
  'clinical-volunteer': 'var(--c2)',
  shadowing: 'var(--c4)',
  research: 'var(--c3)',
  'nonclinical-volunteer': 'var(--c5)',
  leadership: 'var(--c6)',
  teaching: 'var(--c7)',
  employment: 'var(--muted)',
  other: 'var(--border-control)',
};

const today = () => localDate();

function blank(group?: string): Experience {
  return {
    id: uid(),
    title: '',
    organization: '',
    group,
    category: 'clinical-volunteer',
    startDate: today(),
    ongoing: true,
    baseHours: 0,
    logs: [],
    description: '',
    meaningful: false,
    underserved: false,
  };
}

/** Save, keeping the previous description when it changed. */
function save(e: Experience, before?: Experience) {
  const old = before?.description.trim();
  if (old && old !== e.description.trim()) {
    e = { ...e, descriptionHistory: [...(e.descriptionHistory ?? []), { date: today(), text: before!.description }] };
  }
  upsert({ ...e, group: e.group?.trim() || undefined });
}

function upsert(e: Experience) {
  setState((s) => {
    const exists = s.experiences.some((x) => x.id === e.id);
    return { ...s, experiences: exists ? s.experiences.map((x) => (x.id === e.id ? e : x)) : [...s.experiences, e] };
  });
}

function ExperienceForm({ initial, onClose, onDelete }: { initial: Experience; onClose: () => void; onDelete?: () => void }) {
  const [e, setE] = useState(initial);
  const set = <K extends keyof Experience>(k: K, v: Experience[K]) => setE((p) => ({ ...p, [k]: v }));
  const num = (v: string) => (v === '' ? undefined : Number(v));
  const all = useStore().experiences;
  const meaningfulCount = all.filter((x) => x.meaningful && x.id !== e.id).length;
  const groups = [...new Set(all.map((x) => x.group?.trim()).filter(Boolean))] as string[];
  const before = all.find((x) => x.id === initial.id);

  return (
    <form
      className="form"
      onSubmit={(ev) => {
        ev.preventDefault();
        save(e, before);
        onClose();
      }}
    >
      <label className="span-2">
        Role
        <input required value={e.title} onChange={(ev) => set('title', ev.target.value)} placeholder="e.g. Emergency department scribe" />
      </label>
      <label className="span-2">
        Part of (optional)
        <input value={e.group ?? ''} onChange={(ev) => set('group', ev.target.value)} placeholder="e.g. ABC Health" list="exp-groups" />
        <datalist id="exp-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <span className="hint">A club or program behind this. Entries with the same name are shown together and count as one AMCAS slot.</span>
      </label>
      <label>
        Organization
        <input value={e.organization} onChange={(ev) => set('organization', ev.target.value)} placeholder="e.g. Mercy Hospital" />
      </label>
      <label>
        Category
        <select value={e.category} onChange={(ev) => set('category', ev.target.value as Category)}>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      {e.category === 'shadowing' && (
        <label className="span-2">
          Specialty
          <input
            value={e.specialty ?? ''}
            onChange={(ev) => set('specialty', ev.target.value)}
            placeholder="e.g. Family medicine, Cardiology"
            list="specialties"
          />
          <datalist id="specialties">
            {['Family medicine', 'Internal medicine', 'Pediatrics', 'Emergency medicine', 'General surgery', 'Orthopedic surgery', 'Cardiology', 'OB/GYN', 'Psychiatry', 'Anesthesiology', 'Neurology', 'Radiology'].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
      )}
      <label>
        Start date
        <input type="date" required value={e.startDate} onChange={(ev) => set('startDate', ev.target.value)} />
      </label>
      <label>
        End date
        <input type="date" value={e.endDate ?? ''} disabled={e.ongoing} onChange={(ev) => set('endDate', ev.target.value || undefined)} />
      </label>
      <label className="check span-2">
        <input type="checkbox" checked={e.ongoing} onChange={(ev) => set('ongoing', ev.target.checked)} />
        I'm still doing this
      </label>
      <label>
        Hours completed so far
        <input type="number" min={0} step="0.5" value={e.baseHours || ''} onChange={(ev) => set('baseHours', Number(ev.target.value) || 0)} />
        <span className="hint">Hours before you start logging sessions here.</span>
      </label>
      <label>
        Typical hours per week
        <input type="number" min={0} step="0.5" value={e.hoursPerWeek ?? ''} onChange={(ev) => set('hoursPerWeek', num(ev.target.value))} />
        <span className="hint">Used to project hours by your application.</span>
      </label>
      <label>
        Contact name
        <input value={e.contactName ?? ''} onChange={(ev) => set('contactName', ev.target.value)} />
      </label>
      <label>
        Contact email
        <input type="email" value={e.contactEmail ?? ''} onChange={(ev) => set('contactEmail', ev.target.value)} />
      </label>
      <label className="span-2">
        Description for AMCAS
        <textarea rows={5} value={e.description} onChange={(ev) => set('description', ev.target.value)} placeholder="What you did, the impact, and what you learned." />
        <span className={`hint ${e.description.length > AMCAS_DESC_LIMIT ? 'over' : ''}`}>
          {e.description.length} / {AMCAS_DESC_LIMIT} characters
          {e.descriptionHistory?.length ? ` · ${e.descriptionHistory.length} earlier version${e.descriptionHistory.length > 1 ? 's' : ''} saved in History` : ''}
        </span>
      </label>
      <label className="check span-2">
        <input type="checkbox" checked={e.underserved} onChange={(ev) => set('underserved', ev.target.checked)} />
        Serves underserved or low-income communities
      </label>
      <label className="check span-2">
        <input type="checkbox" checked={e.meaningful} disabled={!e.meaningful && meaningfulCount >= 3} onChange={(ev) => set('meaningful', ev.target.checked)} />
        Most meaningful experience {meaningfulCount >= 3 && !e.meaningful && <span className="muted">(you've chosen 3 already)</span>}
      </label>
      <div className="form-actions span-2">
        {onDelete && (
          <button type="button" className="btn btn-ghost danger spacer" onClick={onDelete}>
            Delete experience
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

function LogHours({ exp, onClose }: { exp: Experience; onClose: () => void }) {
  const [date, setDate] = useState(today());
  const [hours, setHours] = useState<number | ''>(exp.hoursPerWeek ?? '');
  const [note, setNote] = useState('');
  const removeLog = (id: string) => upsert({ ...exp, logs: exp.logs.filter((l) => l.id !== id) });

  return (
    <div>
      <form
        className="form"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!hours) return;
          upsert({ ...exp, logs: [...exp.logs, { id: uid(), date, hours: Number(hours), note: note || undefined }].sort((a, b) => a.date.localeCompare(b.date)) });
          onClose();
        }}
      >
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Hours
          <input type="number" min={0.25} step="0.25" value={hours} onChange={(e) => setHours(e.target.value === '' ? '' : Number(e.target.value))} required autoFocus />
        </label>
        <label className="span-2">
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A patient interaction or task worth remembering" />
        </label>
        <div className="form-actions span-2">
          <button type="submit" className="btn btn-primary">
            Add hours
          </button>
        </div>
      </form>
      {exp.logs.length > 0 && (
        <div className="log-list">
          <h4>Previous sessions</h4>
          <ul>
            {[...exp.logs].reverse().map((l) => (
              <li key={l.id}>
                <span>{formatDate(l.date)}</span>
                <strong>{formatHours(l.hours)}</strong>
                <span className="muted">{l.note}</span>
                <button className="btn-icon" onClick={() => removeLog(l.id)} aria-label={`Remove ${formatHours(l.hours)} on ${formatDate(l.date)}`}>
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const span = (e: Experience) => `${formatMonth(e.startDate)} – ${e.ongoing ? 'present' : e.endDate ? formatMonth(e.endDate) : 'end date not set'}`;
const latest = (list: Experience[]) => list.reduce((m, e) => (e.startDate > m ? e.startDate : m), '');

function ExpCard({ e, inGroup, onLog, onEdit }: { e: Experience; inGroup?: boolean; onLog: () => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const long = e.description.length > 220;
  return (
    <article className={`exp-card ${inGroup ? 'exp-card-nested' : ''}`}>
      <div className="exp-main">
        <div className="exp-title">
          <h3>{e.title}</h3>
          {e.meaningful && (
            <span className="tag tag-star">
              <Star size={12} fill="currentColor" aria-hidden /> Most meaningful
            </span>
          )}
          {e.underserved && <span className="tag">Underserved</span>}
        </div>
        <p className="muted">
          {CATEGORY_LABELS[e.category]}
          {e.specialty && ` · ${e.specialty}`}
          {e.organization && ` · ${e.organization}`} · {span(e)}
          {e.hoursPerWeek ? ` · ${formatHours(e.hoursPerWeek)}/week` : ''}
        </p>
        {e.description && <p className={`exp-desc ${open ? 'open' : ''}`}>{e.description}</p>}
        {long && (
          <button className="link-btn small" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'Show less' : 'Show full description'}
          </button>
        )}
      </div>
      <div className="exp-side">
        {e.logs.length > 0 && (
          <span className="exp-spark" title="Hours logged per month, last 12 months">
            <MiniBars values={monthlyHours(e)} labels={last12().map((m) => m.label)} label={`Hours logged per month over the last 12 months for ${e.title}`} />
            <span className="muted">12 mo</span>
          </span>
        )}
        <div className="exp-hours">
          <strong>{Math.round(experienceHours(e)).toLocaleString('en-US')}</strong>
          <span className="muted small">hrs</span>
        </div>
        <div className="exp-actions">
          <button className="btn btn-small" onClick={onLog}>
            Log hours
          </button>
          <button className="btn btn-small btn-ghost" onClick={onEdit} aria-label={`Edit ${e.title}`}>
            Edit
          </button>
        </div>
      </div>
    </article>
  );
}

type HistoryEvent = { date: string; exp: Experience; kind: 'session' | 'start' | 'end' | 'desc'; hours?: number; text?: string };

function History({ list, onEdit }: { list: Experience[]; onEdit: (e: Experience) => void }) {
  const events: HistoryEvent[] = list.flatMap((e) => [
    { date: e.startDate, exp: e, kind: 'start' as const, text: e.description },
    ...(!e.ongoing && e.endDate ? [{ date: e.endDate, exp: e, kind: 'end' as const }] : []),
    ...e.logs.map((l) => ({ date: l.date, exp: e, kind: 'session' as const, hours: l.hours, text: l.note })),
    ...(e.descriptionHistory ?? []).map((d) => ({ date: d.date, exp: e, kind: 'desc' as const, text: d.text })),
  ]);
  events.sort((a, b) => b.date.localeCompare(a.date));
  if (events.length === 0) return <Empty>Nothing to show for this filter yet.</Empty>;

  const months: { key: string; items: HistoryEvent[] }[] = [];
  for (const ev of events) {
    const key = ev.date.slice(0, 7);
    if (months.at(-1)?.key !== key) months.push({ key, items: [] });
    months.at(-1)!.items.push(ev);
  }
  const label = { start: 'Started', end: 'Ended', session: 'Logged', desc: 'Revised description' };

  return (
    <div className="history">
      {months.map((m) => {
        const hrs = m.items.reduce((sum, ev) => sum + (ev.hours ?? 0), 0);
        return (
          <section key={m.key} className="history-month">
            <h3>
              {formatMonth(`${m.key}-01`)}
              {hrs > 0 && <span className="muted small"> · {formatHours(hrs)} logged</span>}
            </h3>
            <ol>
              {m.items.map((ev, i) => (
                <li key={`${ev.exp.id}-${ev.kind}-${i}`} className={`history-item history-${ev.kind}`}>
                  <span className="history-date">{formatDate(ev.date)}</span>
                  <div>
                    <p>
                      <span className="history-kind">{label[ev.kind]}</span>{' '}
                      {ev.hours != null && <strong>{formatHours(ev.hours)} · </strong>}
                      <button className="link-btn" onClick={() => onEdit(ev.exp)}>
                        {ev.exp.title}
                      </button>
                      <span className="muted">
                        {ev.exp.group && ` · ${ev.exp.group}`}
                        {ev.exp.organization && ` · ${ev.exp.organization}`}
                      </span>
                    </p>
                    {ev.text && (
                      <p className={ev.kind === 'session' ? 'muted' : 'history-text'}>
                        {ev.kind === 'desc' && <span className="muted small history-caption">Previous wording</span>}
                        {ev.text}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

export default function Experiences() {
  const { experiences } = useStore();
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [view, setView] = useState<'list' | 'history'>('list');
  const [editing, setEditing] = useState<Experience | null>(null);
  const [logging, setLogging] = useState<Experience | null>(null);

  const shown = experiences
    .filter((e) => filter === 'all' || e.category === filter)
    .sort((a, b) => Number(b.ongoing) - Number(a.ongoing) || b.startDate.localeCompare(a.startDate));

  // Same group name (ignoring case and spaces) → one block; everything else stays on its own.
  const units: { key: string; name?: string; members: Experience[] }[] = [];
  for (const e of shown) {
    const g = e.group?.trim();
    const key = g ? `g:${g.toLowerCase()}` : e.id;
    const unit = units.find((u) => u.key === key);
    if (unit) unit.members.push(e);
    else units.push({ key, name: g, members: [e] });
  }
  units.sort(
    (a, b) =>
      Number(b.members.some((e) => e.ongoing)) - Number(a.members.some((e) => e.ongoing)) || latest(b.members).localeCompare(latest(a.members)),
  );

  const remove = (e: Experience) => {
    if (confirm(`Delete "${e.title}" and its logged hours?`)) {
      setState((s) => ({ ...s, experiences: s.experiences.filter((x) => x.id !== e.id) }));
      setEditing(null);
    }
  };
  const slots = amcasSlots(experiences);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Experiences</h1>
          <p className="muted">
            {slots} of {AMCAS_MAX_ENTRIES} AMCAS activity slots
            {slots < experiences.length && ` (${experiences.length} entries, grouped)`} · {experiences.filter((e) => e.meaningful).length} of 3 most meaningful
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(blank())}>
          <Plus size={16} aria-hidden /> Add experience
        </button>
      </header>

      {experiences.length > 0 && (
        <section className="card hours-mix" aria-labelledby="mix-title">
          <div className="card-head">
            <h2 id="mix-title">Where your hours go</h2>
            <span className="muted small">Click a bar or name to filter</span>
          </div>
          <StackBar
            label="Hours by category. Pick one to filter the list"
            picked={filter === 'all' ? undefined : filter}
            onPick={(k) => setFilter(filter === k ? 'all' : (k as Category))}
            format={(n) => `${Math.round(n).toLocaleString('en-US')} hrs`}
            segments={(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => ({
              key: c,
              label: CATEGORY_LABELS[c],
              value: experiences.filter((e) => e.category === c).reduce((sum, e) => sum + experienceHours(e), 0),
              color: CATEGORY_COLORS[c],
            }))}
          />
        </section>
      )}

      {experiences.length > 0 && (
        <div className="exp-toolbar">
          <div className="chips chips-scroll" role="group" aria-label="Filter by category">
            {(['all', ...Object.keys(CATEGORY_LABELS)] as (Category | 'all')[]).map((c) => {
              const n = c === 'all' ? experiences.length : experiences.filter((e) => e.category === c).length;
              if (c !== 'all' && n === 0) return null;
              return (
                <button key={c} className={`chip ${filter === c ? 'active' : ''}`} aria-pressed={filter === c} onClick={() => setFilter(c)}>
                  {c === 'all' ? 'All' : CATEGORY_LABELS[c]} <span className="muted">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="seg-toggle" role="group" aria-label="View">
            <button className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>
              Activities
            </button>
            <button className={view === 'history' ? 'on' : ''} aria-pressed={view === 'history'} onClick={() => setView('history')}>
              History
            </button>
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <Empty>
          <strong>No experiences yet</strong>
          <p>
            Add everything that could go on AMCAS: clinical work, research, shadowing, service, jobs, tutoring and leadership. You can include hours
            you've already done.
          </p>
          <button className="btn btn-primary" onClick={() => setEditing(blank())}>
            <Plus size={16} aria-hidden /> Add your first experience
          </button>
        </Empty>
      ) : view === 'history' ? (
        <History list={shown} onEdit={setEditing} />
      ) : (
        <div className="exp-list">
          {units.map((u) =>
            u.name ? (
              <section key={u.key} className="exp-group" aria-label={u.name}>
                <header className="exp-group-head">
                  <div>
                    <h3>
                      <FolderOpen size={16} aria-hidden /> {u.name}
                    </h3>
                    <p className="muted small">
                      {u.members.length} {u.members.length === 1 ? 'entry' : 'entries'} · one AMCAS slot ·{' '}
                      {formatMonth(u.members.reduce((m, e) => (e.startDate < m ? e.startDate : m), u.members[0].startDate))} –{' '}
                      {u.members.some((e) => e.ongoing) ? 'present' : formatMonth(u.members.reduce((m, e) => ((e.endDate ?? '') > m ? e.endDate! : m), ''))}
                    </p>
                  </div>
                  <div className="exp-group-side">
                    <div className="exp-hours">
                      <strong>{Math.round(u.members.reduce((sum, e) => sum + experienceHours(e), 0)).toLocaleString('en-US')}</strong>
                      <span className="muted small">hrs total</span>
                    </div>
                    <button className="btn btn-small btn-ghost" onClick={() => setEditing(blank(u.name))}>
                      <Plus size={14} aria-hidden /> Add to group
                    </button>
                  </div>
                </header>
                {u.members.map((e) => (
                  <ExpCard key={e.id} e={e} inGroup onLog={() => setLogging(e)} onEdit={() => setEditing(e)} />
                ))}
              </section>
            ) : (
              <ExpCard key={u.key} e={u.members[0]} onLog={() => setLogging(u.members[0])} onEdit={() => setEditing(u.members[0])} />
            ),
          )}
        </div>
      )}

      {editing && (
        <Modal title={experiences.some((x) => x.id === editing.id) ? 'Edit experience' : 'Add experience'} onClose={() => setEditing(null)}>
          <ExperienceForm
            initial={editing}
            onClose={() => setEditing(null)}
            onDelete={experiences.some((x) => x.id === editing.id) ? () => remove(editing) : undefined}
          />
        </Modal>
      )}
      {logging && (
        <Modal title={`Log hours · ${logging.title}`} onClose={() => setLogging(null)}>
          <LogHours exp={experiences.find((x) => x.id === logging.id) ?? logging} onClose={() => setLogging(null)} />
        </Modal>
      )}
    </div>
  );
}
