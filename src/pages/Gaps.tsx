import { ArrowRight } from 'lucide-react';
import { useAnalysis } from '../engine/useAnalysis';
import { AREA_CATEGORIES } from '../data/benchmarks';
import { AreaBar, Empty, GapCard } from '../components/ui';
import { OpportunityCard } from '../components/OpportunityCard';
import { MentorSuggestions } from '../components/ResearchOutreach';

export default function Gaps({ go }: { go: (page: string) => void }) {
  const { areas, gaps, ranked, months, mentorSuggestions } = useAnalysis();
  const groups = [
    { key: 'behind', title: 'Behind', note: 'The most urgent items. Start here.', items: gaps.filter((g) => g.severity === 'critical') },
    { key: 'below', title: 'Below target', note: 'Worth improving before you apply.', items: gaps.filter((g) => g.severity !== 'critical') },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Gap analysis</h1>
          <p className="muted">
            Compared against typical MD matriculant benchmarks, with {Math.floor(months)} months until you submit. Benchmarks are guidance, not cutoffs; you can
            adjust them in Profile & academics.
          </p>
        </div>
      </header>

      {gaps.length ? (
        <div className="gap-columns">
          {groups.map(
            (g) =>
              g.items.length > 0 && (
                <section key={g.key} className="card" aria-labelledby={`gaps-${g.key}`}>
                  <h2 id={`gaps-${g.key}`}>
                    {g.title} <span className="muted num">{g.items.length}</span>
                  </h2>
                  <p className="muted small group-note">{g.note}</p>
                  <div className="gap-list">
                    {g.items.map((x) => (
                      <GapCard key={x.id} gap={x} />
                    ))}
                  </div>
                </section>
              ),
          )}
        </div>
      ) : (
        <Empty>
          <strong>No gaps right now</strong>
          <p>Keep your current commitments going and spend the time on reflection and writing.</p>
        </Empty>
      )}

      <section className="card">
        <h2>Area by area</h2>
        <div className="area-detail">
          {areas.map((a) => (
            <div key={a.area} className="area-detail-row">
              <AreaBar s={a} />
              <p className="muted small">{a.benchmark.why}</p>
              {AREA_CATEGORIES[a.area] && a.pacePerMonth && (
                <p className="small">
                  To reach {a.benchmark.competitive.toLocaleString()} by June you need about <strong>{a.pacePerMonth} hrs a month</strong>.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {mentorSuggestions.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Labs to contact for your research gap</h2>
            <button className="link" onClick={() => go('research')}>
              Research targeting <ArrowRight size={16} aria-hidden />
            </button>
          </div>
          <p className="muted small">Top-scoring mentors from your tracker you haven't joined or been declined by.</p>
          <MentorSuggestions picks={mentorSuggestions} go={go} />
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Best matches for your gaps</h2>
          <button className="link" onClick={() => go('opportunities')}>
            All opportunities <ArrowRight size={16} aria-hidden />
          </button>
        </div>
        <div className="opp-grid">
          {ranked.slice(0, 6).map((r) => (
            <OpportunityCard key={r.opp.id} r={r} compact />
          ))}
        </div>
      </section>
    </div>
  );
}
