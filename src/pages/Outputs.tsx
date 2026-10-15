import { useState } from 'react';
import { ArrowRight, ChevronRight, Plus } from 'lucide-react';
import type { OutputStatus, OutputType, ResearchOutput } from '../types';
import { setState, uid, useStore } from '../store/useStore';
import { Empty, Modal } from '../components/ui';

const TYPE_LABELS: Record<OutputType, string> = {
  publication: 'Publication',
  poster: 'Poster',
  oral: 'Oral presentation',
  abstract: 'Abstract',
};

const STATUSES: { key: OutputStatus; label: string }[] = [
  { key: 'in-prep', label: 'In preparation' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'published', label: 'Published' },
  { key: 'presented', label: 'Presented' },
];

function OutputForm({ initial, onClose, onDelete }: { initial: ResearchOutput; onClose: () => void; onDelete?: () => void }) {
  const { experiences } = useStore();
  const [o, setO] = useState(initial);
  const set = <K extends keyof ResearchOutput>(k: K, v: ResearchOutput[K]) => setO((p) => ({ ...p, [k]: v }));
  const research = experiences.filter((e) => e.category === 'research');

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        setState((s) => ({
          ...s,
          outputs: s.outputs.some((x) => x.id === o.id) ? s.outputs.map((x) => (x.id === o.id ? o : x)) : [...s.outputs, o],
        }));
        onClose();
      }}
    >
      <label className="span-2">
        Title
        <input required value={o.title} onChange={(e) => set('title', e.target.value)} />
      </label>
      <label>
        Type
        <select value={o.type} onChange={(e) => set('type', e.target.value as OutputType)}>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={o.status} onChange={(e) => set('status', e.target.value as OutputStatus)}>
          {STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Journal / conference
        <input value={o.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. NCUR 2027" />
      </label>
      <label>
        Your author position
        <input type="number" min={1} value={o.authorPosition ?? ''} onChange={(e) => set('authorPosition', e.target.value ? Number(e.target.value) : undefined)} />
      </label>
      <label>
        Date
        <input type="date" value={o.date ?? ''} onChange={(e) => set('date', e.target.value || undefined)} />
      </label>
      <label>
        From research experience
        <select value={o.experienceId ?? ''} onChange={(e) => set('experienceId', e.target.value || undefined)}>
          <option value="">None</option>
          {research.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      <div className="form-actions span-2">
        {onDelete && (
          <button type="button" className="btn btn-ghost danger spacer" onClick={onDelete}>
            Delete output
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

export default function Outputs({ go }: { go: (page: string) => void }) {
  const { outputs } = useStore();
  const [editing, setEditing] = useState<ResearchOutput | null>(null);
  const blank = (): ResearchOutput => ({ id: uid(), type: 'poster', title: '', venue: '', status: 'in-prep' });
  const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

  const exists = (o: ResearchOutput) => outputs.some((x) => x.id === o.id);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Research output</h1>
          <p className="muted">Publications, posters and presentations, from idea to done.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(blank())}>
          <Plus size={16} aria-hidden /> Add output
        </button>
      </header>

      {outputs.length === 0 ? (
        <Empty>
          <strong>No posters or papers yet</strong>
          <p>Track each abstract, poster, talk or paper from first draft to presented. A first poster is often at your campus research symposium.</p>
          <button className="btn btn-primary" onClick={() => setEditing(blank())}>
            <Plus size={16} aria-hidden /> Add your first output
          </button>
          <button className="link" onClick={() => go('guides')}>
            Guide: turning your research into a poster <ArrowRight size={16} aria-hidden />
          </button>
        </Empty>
      ) : (
        <>
          <ol className="pipe-stepper" aria-label="Outputs by stage">
            {STATUSES.map((s) => {
              const n = outputs.filter((o) => o.status === s.key).length;
              return (
                <li key={s.key} className={n ? 'on' : ''}>
                  {s.label} <span className="num">{n}</span>
                </li>
              );
            })}
          </ol>
          <div className="pipeline">
            {STATUSES.map((s) => {
              const items = outputs.filter((o) => o.status === s.key);
              if (!items.length) return null;
              return (
                <section key={s.key} className="pipe-col" aria-labelledby={`stage-${s.key}`}>
                  <h2 id={`stage-${s.key}`}>{s.label}</h2>
                  <div className="pipe-items">
                    {items.map((o) => (
                      <button key={o.id} className="pipe-card" onClick={() => setEditing(o)}>
                        <span>
                          <span className="kind">{TYPE_LABELS[o.type]}</span>
                          <strong>{o.title}</strong>
                          {(o.venue || o.authorPosition) && (
                            <span className="muted small">
                              {o.venue}
                              {o.venue && o.authorPosition ? ' · ' : ''}
                              {o.authorPosition && `${ordinal(o.authorPosition)} author`}
                            </span>
                          )}
                        </span>
                        <ChevronRight size={18} className="muted" aria-hidden />
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      {editing && (
        <Modal title={exists(editing) ? 'Edit output' : 'Add output'} onClose={() => setEditing(null)}>
          <OutputForm
            initial={editing}
            onClose={() => setEditing(null)}
            onDelete={
              exists(editing)
                ? () => {
                    setState((s) => ({ ...s, outputs: s.outputs.filter((x) => x.id !== editing.id) }));
                    setEditing(null);
                  }
                : undefined
            }
          />
        </Modal>
      )}
    </div>
  );
}
