import { useState } from 'react';
import type { Area } from '../types';
import { useAnalysis } from '../engine/useAnalysis';
import { AREA_LABELS } from '../data/benchmarks';
import { OPPORTUNITIES_VERIFIED } from '../data/opportunities';
import { KIND_LABELS, OpportunityCard } from '../components/OpportunityCard';
import { Empty, SEVERITY_LABEL } from '../components/ui';
import { SEVERITY_COLOR, useMounted } from '../components/viz';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Opportunities() {
  const { ranked, state, areas } = useAnalysis();
  const grown = useMounted();
  const [month, setMonth] = useState<number | null>(null);
  const [area, setArea] = useState<Area | 'all'>('all');
  const [kind, setKind] = useState<string>('all');
  const [tracked, setTracked] = useState(false);
  const [q, setQ] = useState('');

  const shown = ranked.filter(
    (r) =>
      (area === 'all' || r.opp.areas.includes(area)) &&
      (kind === 'all' || r.opp.kind === kind) &&
      (!tracked || state.oppStatus[r.opp.id]) &&
      (month === null || r.opp.deadlineMonths?.includes(month)) &&
      (!q || `${r.opp.name} ${r.opp.description}`.toLowerCase().includes(q.toLowerCase())),
  );

  // The figures count everything the other filters leave, so each one shows what picking it would do.
  const base = ranked.filter(
    (r) =>
      (kind === 'all' || r.opp.kind === kind) &&
      (!tracked || state.oppStatus[r.opp.id]) &&
      (!q || `${r.opp.name} ${r.opp.description}`.toLowerCase().includes(q.toLowerCase())),
  );
  const forMonths = base.filter((r) => area === 'all' || r.opp.areas.includes(area));
  const byMonth = MONTHS.map((_, i) => forMonths.filter((r) => r.opp.deadlineMonths?.includes(i + 1)).length);
  const monthMax = Math.max(...byMonth, 1);
  const thisMonth = new Date().getMonth() + 1;
  const forAreas = base.filter((r) => month === null || r.opp.deadlineMonths?.includes(month));
  const areaRows = areas
    .map((a) => ({ a, n: forAreas.filter((r) => r.opp.areas.includes(a.area)).length }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n);
  const areaMax = Math.max(...areaRows.map((x) => x.n), 1);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Opportunities</h1>
          <p className="muted">
            Sorted by how well they fill your gaps, with upcoming deadlines boosted. Deadlines are typical months, last checked {OPPORTUNITIES_VERIFIED}; confirm
            on each program's site.
          </p>
        </div>
      </header>

      <div className="grid-2 opp-viz">
        <section className="card" aria-labelledby="months-title">
          <div className="card-head">
            <h2 id="months-title">When deadlines fall</h2>
            <span className="muted small">Click a month to filter</span>
          </div>
          <div className="month-bars" role="group" aria-label="Typical deadlines by month. Pick a month to filter">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                type="button"
                className={`month-bar${month === i + 1 ? ' picked' : ''}${month !== null && month !== i + 1 ? ' dim' : ''}${thisMonth === i + 1 ? ' now' : ''}`}
                aria-pressed={month === i + 1}
                aria-label={`${m}: ${byMonth[i]} ${byMonth[i] === 1 ? 'deadline' : 'deadlines'}${thisMonth === i + 1 ? ' (this month)' : ''}`}
                onClick={() => setMonth(month === i + 1 ? null : i + 1)}
              >
                <span className="month-count num">{byMonth[i] || ''}</span>
                <span className="month-fill-wrap">
                  <span className="month-fill" style={{ height: grown ? `${(byMonth[i] / monthMax) * 100}%` : 0, transitionDelay: `${i * 35}ms` }} />
                </span>
                <span className="month-name">{m[0]}</span>
              </button>
            ))}
          </div>
          <p className="muted small">Typical months; the dark outline is this month.</p>
        </section>
        <section className="card" aria-labelledby="areas-title">
          <div className="card-head">
            <h2 id="areas-title">Which gaps they fill</h2>
            <span className="muted small">Colored by where you stand</span>
          </div>
          <div className="hbars" role="group" aria-label="Opportunities per area. Pick one to filter">
            {areaRows.map(({ a, n }, i) => (
              <button
                key={a.area}
                type="button"
                className={`hbar${area === a.area ? ' picked' : ''}${area !== 'all' && area !== a.area ? ' dim' : ''}`}
                aria-pressed={area === a.area}
                onClick={() => setArea(area === a.area ? 'all' : a.area)}
              >
                <span className="hbar-label">{AREA_LABELS[a.area]}</span>
                <span className="hbar-track">
                  <span className="hbar-fill" style={{ width: grown ? `${(n / areaMax) * 100}%` : 0, background: SEVERITY_COLOR[a.severity], transitionDelay: `${i * 50}ms` }} />
                </span>
                <span className="hbar-val num">{n}</span>
                <span className="visually-hidden">, you're {SEVERITY_LABEL[a.severity].toLowerCase()} here</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="filters">
        <input type="search" placeholder="Search opportunities" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search opportunities" />
        <select value={area} onChange={(e) => setArea(e.target.value as Area | 'all')} aria-label="Filter by area">
          <option value="all">All areas</option>
          {Object.entries(AREA_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by type">
          <option value="all">All types</option>
          {Object.entries(KIND_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={tracked} onChange={(e) => setTracked(e.target.checked)} /> Tracked only
        </label>
        {month !== null && (
          <button className="chip active" onClick={() => setMonth(null)} aria-label={`Remove the ${MONTHS[month - 1]} deadline filter`}>
            Deadline in {MONTHS[month - 1]} ✕
          </button>
        )}
      </div>

      <div className="opp-grid">
        {shown.map((r) => (
          <OpportunityCard key={r.opp.id} r={r} />
        ))}
      </div>
      {shown.length === 0 && (
        <Empty>
          <p>No opportunities match those filters.</p>
          <button
            className="btn"
            onClick={() => {
              setArea('all');
              setKind('all');
              setTracked(false);
              setQ('');
              setMonth(null);
            }}
          >
            Clear filters
          </button>
        </Empty>
      )}
    </div>
  );
}
