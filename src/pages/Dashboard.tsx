import { useMemo, useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { Area as ChartArea, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAnalysis } from '../engine/useAnalysis';
import { AREA_CATEGORIES } from '../data/benchmarks';
import { AreaBar, Empty, GapCard } from '../components/ui';
import { OpportunityCard } from '../components/OpportunityCard';
import ResearchOutreach from '../components/ResearchOutreach';
import type { AppState, Area } from '../types';
import { CountUp, ReadinessRadar, Ring, SEVERITY_COLOR, StackBar, Toggle } from '../components/viz';
import { SEVERITY_LABEL } from '../components/ui';
import blueJay from '../assets/blue-jay.svg';

const SERIES: { area: Area; label: string; color: string }[] = [
  { area: 'clinical', label: 'Clinical', color: 'var(--c1)' },
  { area: 'research', label: 'Research', color: 'var(--c2)' },
  { area: 'volunteering', label: 'Service', color: 'var(--c3)' },
  { area: 'shadowing', label: 'Shadowing', color: 'var(--c4)' },
];

/** Cumulative hours by month. Base hours are counted at the experience's start date. */
function cumulative(state: AppState) {
  const events: { month: string; area: Area; hours: number }[] = [];
  for (const e of state.experiences) {
    const area = SERIES.find((s) => AREA_CATEGORIES[s.area]?.includes(e.category))?.area;
    if (!area) continue;
    if (e.baseHours) events.push({ month: e.startDate.slice(0, 7), area, hours: e.baseHours });
    for (const l of e.logs) events.push({ month: l.date.slice(0, 7), area, hours: l.hours });
  }
  if (!events.length) return [];
  const months: string[] = [];
  const first = events.map((e) => e.month).sort()[0];
  const d = new Date(`${first}-01T00:00:00`);
  const end = new Date();
  while (d <= end) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  const running: Record<string, number> = {};
  return months.map((m) => {
    for (const ev of events) if (ev.month === m) running[ev.area] = (running[ev.area] ?? 0) + ev.hours;
    const label = new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    return { month: label, ...Object.fromEntries(SERIES.map((s) => [s.area, Math.round(running[s.area] ?? 0)])) };
  });
}

/** Month-by-month hours from the cumulative series. */
function perMonth(data: ReturnType<typeof cumulative>) {
  return data.map((row, i) => {
    const prev = data[i - 1] as Record<string, number | string> | undefined;
    const r = row as Record<string, number | string>;
    return { month: row.month, ...Object.fromEntries(SERIES.map((s) => [s.area, (r[s.area] as number) - ((prev?.[s.area] as number) ?? 0)])) };
  });
}

const hrsTick = (n: number) => n.toLocaleString('en-US');

export default function Dashboard({ go }: { go: (page: string) => void }) {
  const { state, areas, gaps, ranked, months, mentorSuggestions } = useAnalysis();
  const data = useMemo(() => cumulative(state), [state]);
  const [view, setView] = useState<'bars' | 'radar'>('bars');
  const [mode, setMode] = useState<'total' | 'month'>('total');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const chartData = mode === 'total' ? data : perMonth(data);
  const toggleSeries = (key: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const totalHours = areas.filter((a) => AREA_CATEGORIES[a.area]).reduce((s, a) => s + (a.current ?? 0), 0);
  const behind = gaps.filter((g) => g.severity === 'critical').length;
  const { profile } = state;
  const empty = state.experiences.length === 0;
  const monthsLeft = Math.floor(months);
  const completed = state.outputs.filter((o) => o.status === 'published' || o.status === 'presented').length;

  return (
    <div className="page">
      <header className="page-head hero">
        <div>
          <h1>{profile.name ? `Hi, ${profile.name.split(' ')[0]}` : 'Your application at a glance'}</h1>
          <p className="muted">
            Applying in the {profile.applicationYear} AMCAS cycle
            {profile.school && ` · ${profile.school}`}
          </p>
        </div>
        <div className="hero-count">
          <Ring value={Math.min(months, 48) / 48} size={88} stroke={7} color="var(--accent-2)" label={`${monthsLeft} months until AMCAS submission`}>
            <strong className="num">{months < 1 ? 'Now' : <CountUp value={monthsLeft} />}</strong>
            {months >= 1 && <small>months</small>}
          </Ring>
          <span className="hero-count-label">until AMCAS submission, June {profile.applicationYear}</span>
        </div>
        <img className="hero-jay" src={blueJay} alt="" aria-hidden />
      </header>

      {empty && (
        <section className="callout" aria-labelledby="welcome-title">
          <h2 id="welcome-title">Start by adding your experiences</h2>
          <p>
            Log clinical work, research, shadowing and service, including hours you have already done. The planner will then show where you stand
            and what to do next.
          </p>
          <div>
            <button className="btn btn-primary" onClick={() => go('experiences')}>
              <Plus size={16} aria-hidden /> Add your first experience
            </button>
          </div>
        </section>
      )}

      <ResearchOutreach go={go} picks={mentorSuggestions} gap={empty ? undefined : gaps[0]} />

      {!empty && (
        <section className="stats" aria-label="Summary">
          <div className="stat">
            <span className="stat-label">Until AMCAS submission</span>
            <span className="stat-value">{months < 1 ? 'Now' : `${monthsLeft} ${monthsLeft === 1 ? 'month' : 'months'}`}</span>
            <span className="muted small">June {profile.applicationYear}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Logged hours</span>
            <span className="stat-value">
              <CountUp value={totalHours} />
            </span>
            <span className="muted small">Clinical, shadowing, service and research</span>
            <StackBar
              label="Logged hours by area"
              segments={SERIES.map((s) => ({ key: s.area, label: s.label, value: Math.round(areas.find((a) => a.area === s.area)?.current ?? 0), color: s.color }))}
            />
          </div>
          <div className="stat">
            <span className="stat-label">Areas behind</span>
            <span className="stat-value">
              <CountUp value={behind} />
            </span>
            <span className="muted small">
              {gaps.length} {gaps.length === 1 ? 'item' : 'items'} to work on in total
            </span>
            <span className="sev-dots" aria-hidden>
              {areas.map((a, i) => (
                <span key={a.area} className="sev-dot" style={{ background: SEVERITY_COLOR[a.severity], animationDelay: `${i * 70}ms` }} title={`${a.benchmark.label}: ${SEVERITY_LABEL[a.severity]}`} />
              ))}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Posters and papers</span>
            <span className="stat-value">
              <CountUp value={state.outputs.length} />
            </span>
            <span className="muted small">{completed} presented or published</span>
          </div>
        </section>
      )}

      <div className={empty ? '' : 'grid-2'}>
        <section className="card">
          <div className="card-head">
            <h2>Readiness</h2>
            <span className="card-tools">
              {!empty && (
                <Toggle
                  label="Readiness view"
                  value={view}
                  onChange={setView}
                  options={[
                    { key: 'bars', label: 'Bars' },
                    { key: 'radar', label: 'Radar' },
                  ]}
                />
              )}
              <button className="link" onClick={() => go('gaps')}>
                Gap analysis <ArrowRight size={16} aria-hidden />
              </button>
            </span>
          </div>
          {empty && <p className="muted small readiness-note">Typical targets for MD applicants. Your progress appears here once you add experiences.</p>}
          {view === 'radar' && !empty ? (
            <>
              <ReadinessRadar areas={areas} />
              <p className="muted small legend-note">
                <span>
                  <span className="swatch swatch-current" /> Logged
                </span>
                <span>
                  <span className="swatch swatch-projected" /> Projected from weekly hours
                </span>
                <span>
                  <span className="swatch-mark" /> Minimum
                </span>
                <span>Edge of the chart = competitive target. GPA and MCAT stay in the bar view.</span>
              </p>
            </>
          ) : (
          <>
          <div className="areas">
            {areas.map((a) => (
              <AreaBar key={a.area} s={a} quiet={empty} />
            ))}
          </div>
          <p className="muted small legend-note">
            <span>
              <span className="swatch swatch-current" /> Logged
            </span>
            <span>
              <span className="swatch swatch-projected" /> Projected from weekly hours
            </span>
            <span>
              <span className="swatch-mark" /> Minimum
            </span>
            <span>
              <span className="swatch-mark strong" /> Competitive
            </span>
          </p>
          </>
          )}
        </section>

        {!empty && (
          <section className="card">
            <div className="card-head">
              <h2>Top priorities</h2>
              <button className="link" onClick={() => go('gaps')}>
                All {gaps.length} <ArrowRight size={16} aria-hidden />
              </button>
            </div>
            {gaps.length ? (
              <div className="gap-list">
                {gaps.slice(0, 3).map((g) => (
                  <GapCard key={g.id} gap={g} />
                ))}
              </div>
            ) : (
              <Empty>
                <p>No gaps right now. Keep your current commitments going through your application.</p>
              </Empty>
            )}
          </section>
        )}
      </div>

      {data.length > 1 && (
        <section className="card">
          <div className="card-head">
            <h2>Hours over time</h2>
            <Toggle
              label="Hours view"
              value={mode}
              onChange={setMode}
              options={[
                { key: 'total', label: 'Running total' },
                { key: 'month', label: 'Per month' },
              ]}
            />
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={hrsTick} width={48} />
                <Tooltip
                  formatter={(v: number) => `${v.toLocaleString('en-US')} hrs`}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)' }}
                  labelStyle={{ color: 'var(--ink)', fontWeight: 600 }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ color: 'var(--muted)', fontSize: 14, cursor: 'pointer' }}
                  onClick={(e) => toggleSeries(String(e.dataKey))}
                  formatter={(value, entry) => <span style={{ opacity: hidden.has(String(entry.dataKey)) ? 0.4 : 1 }}>{value}</span>}
                />
                {SERIES.map((s) => (
                  <ChartArea
                    key={s.area}
                    type="monotone"
                    dataKey={s.area}
                    name={s.label}
                    stroke={s.color}
                    fill={s.color}
                    fillOpacity={0.14}
                    strokeWidth={2}
                    hide={hidden.has(s.area)}
                    isAnimationActive={!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="muted small">Click a name in the legend to hide or show it.</p>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Recommended for you</h2>
          <button className="link" onClick={() => go('opportunities')}>
            All opportunities <ArrowRight size={16} aria-hidden />
          </button>
        </div>
        <div className="opp-grid">
          {ranked.slice(0, 3).map((r) => (
            <OpportunityCard key={r.opp.id} r={r} compact />
          ))}
        </div>
      </section>
    </div>
  );
}
