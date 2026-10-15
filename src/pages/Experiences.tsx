import { useState } from 'react';
import { Plus, Star, X } from 'lucide-react';
import type { Category, Experience } from '../types';
import { localDate, setState, uid, useStore } from '../store/useStore';
import { AMCAS_DESC_LIMIT, AMCAS_MAX_ENTRIES, CATEGORY_LABELS } from '../data/benchmarks';
import { experienceHours } from '../engine/gaps';
import { Empty, Modal } from '../components/ui';
import { formatDate, formatHours, formatMonth } from '../lib/format';

const today = () => localDate();

function blank(): Experience {
  return {
    id: uid(),
    title: '',
    organization: '',
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
  const meaningfulCount = useStore().experiences.filter((x) => x.meaningful && x.id !== e.id).length;

  return (
    <form
      className="form"
      onSubmit={(ev) => {
        ev.preventDefault();
        upsert(e);
        onClose();
      }}
    >
      <label className="span-2">
        Role
        <input required value={e.title} onChange={(ev) => set('title', ev.target.value)} placeholder="e.g. Emergency department scribe" />
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
            {[...exp.logs].reverse().slice(0, 20).map((l) => (
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

export default function Experiences() {
  const { experiences } = useStore();
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [editing, setEditing] = useState<Experience | null>(null);
  const [logging, setLogging] = useState<Experience | null>(null);

  const shown = experiences
    .filter((e) => filter === 'all' || e.category === filter)
    .sort((a, b) => Number(b.ongoing) - Number(a.ongoing) || b.startDate.localeCompare(a.startDate));

  const remove = (e: Experience) => {
    if (confirm(`Delete "${e.title}" and its logged hours?`)) {
      setState((s) => ({ ...s, experiences: s.experiences.filter((x) => x.id !== e.id) }));
      setEditing(null);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Experiences</h1>
          <p className="muted">
            {experiences.length} of {AMCAS_MAX_ENTRIES} AMCAS activity slots · {experiences.filter((e) => e.meaningful).length} of 3 most meaningful
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(blank())}>
          <Plus size={16} aria-hidden /> Add experience
        </button>
      </header>

      {experiences.length > 0 && (
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
      ) : (
        <div className="exp-list">
          {shown.map((e) => (
            <article key={e.id} className="exp-card">
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
                  {e.organization && ` · ${e.organization}`} · {formatMonth(e.startDate)} – {e.ongoing ? 'present' : e.endDate ? formatMonth(e.endDate) : 'end date not set'}
                  {e.hoursPerWeek ? ` · ${formatHours(e.hoursPerWeek)}/week` : ''}
                </p>
                {e.description && <p className="exp-desc">{e.description}</p>}
              </div>
              <div className="exp-side">
                <div className="exp-hours">
                  <strong>{Math.round(experienceHours(e)).toLocaleString('en-US')}</strong>
                  <span className="muted small">hrs</span>
                </div>
                <div className="exp-actions">
                  <button className="btn btn-small" onClick={() => setLogging(e)}>
                    Log hours
                  </button>
                  <button className="btn btn-small btn-ghost" onClick={() => setEditing(e)} aria-label={`Edit ${e.title}`}>
                    Edit
                  </button>
                </div>
              </div>
            </article>
          ))}
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
