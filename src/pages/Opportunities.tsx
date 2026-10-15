import { useState } from 'react';
import type { Area } from '../types';
import { useAnalysis } from '../engine/useAnalysis';
import { AREA_LABELS } from '../data/benchmarks';
import { OPPORTUNITIES_VERIFIED } from '../data/opportunities';
import { KIND_LABELS, OpportunityCard } from '../components/OpportunityCard';
import { Empty } from '../components/ui';

export default function Opportunities() {
  const { ranked, state } = useAnalysis();
  const [area, setArea] = useState<Area | 'all'>('all');
  const [kind, setKind] = useState<string>('all');
  const [tracked, setTracked] = useState(false);
  const [q, setQ] = useState('');

  const shown = ranked.filter(
    (r) =>
      (area === 'all' || r.opp.areas.includes(area)) &&
      (kind === 'all' || r.opp.kind === kind) &&
      (!tracked || state.oppStatus[r.opp.id]) &&
      (!q || `${r.opp.name} ${r.opp.description}`.toLowerCase().includes(q.toLowerCase())),
  );

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
            }}
          >
            Clear filters
          </button>
        </Empty>
      )}
    </div>
  );
}
