import { useState } from 'react';
import { ChevronDown, Lightbulb, Sparkles } from 'lucide-react';
import { GUIDES } from '../data/guides';
import { AREA_LABELS } from '../data/benchmarks';
import { useAnalysis } from '../engine/useAnalysis';

export default function Guides() {
  const { gaps } = useAnalysis();
  const gapAreas = new Set(gaps.map((g) => g.area));
  const sorted = [...GUIDES].sort((a, b) => Number(b.areas.some((x) => gapAreas.has(x))) - Number(a.areas.some((x) => gapAreas.has(x))));
  const [open, setOpen] = useState<string | null>(sorted[0]?.id ?? null);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Guides</h1>
          <p className="muted">Step-by-step playbooks. Guides for your current gaps come first.</p>
        </div>
      </header>
      <div className="guides">
        {sorted.map((g) => {
          const relevant = g.areas.some((x) => gapAreas.has(x));
          const isOpen = open === g.id;
          return (
            <article key={g.id} className={`guide ${isOpen ? 'open' : ''}`}>
              <h2>
                <button className="guide-head" onClick={() => setOpen(isOpen ? null : g.id)} aria-expanded={isOpen} aria-controls={`guide-${g.id}`}>
                  <span>{g.title}</span>
                  <ChevronDown className="chev" size={20} aria-hidden />
                </button>
              </h2>
              <p className="muted">{g.summary}</p>
              <p className="tags">
                {relevant && (
                  <span className="recommended">
                    <Sparkles size={14} aria-hidden /> Recommended for you
                  </span>
                )}
                {g.areas.map((a) => (
                  <span key={a} className="tag">
                    {AREA_LABELS[a]}
                  </span>
                ))}
              </p>
              {isOpen && (
                <div className="guide-body" id={`guide-${g.id}`}>
                  <ol>
                    {g.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  {g.tips && (
                    <div className="tips">
                      {g.tips.map((t, i) => (
                        <p key={i}>
                          <Lightbulb className="icon" size={16} aria-hidden />
                          <span>
                            <span className="visually-hidden">Tip: </span>
                            {t}
                          </span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
