import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { AreaStatus } from '../engine/gaps';

/** True when the user has asked the OS to reduce motion. */
export function reducedMotion() {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Counts up from 0 to `value` once on mount and again whenever it changes. Screen readers get the final value. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString('en-US'), ms = 900 }: { value: number; format?: (n: number) => string; ms?: number }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));
  // What's on screen right now, so a new value glides on from there instead of jumping.
  const current = useRef(shown);

  useEffect(() => {
    const show = (n: number) => {
      current.current = n;
      setShown(n);
    };
    if (reducedMotion() || current.current === value) {
      show(value);
      return;
    }
    const start = performance.now();
    const a = current.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      show(a + (value - a) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);

  return (
    <>
      <span aria-hidden>{format(shown)}</span>
      <span className="visually-hidden">{format(value)}</span>
    </>
  );
}

/** Sets to true one frame after mount, so CSS transitions run from their starting state. */
export function useMounted() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

/** Circular progress ring. `value` is 0–1; `marks` draw ticks (also 0–1) on the track. */
export function Ring({
  value,
  size = 56,
  stroke = 6,
  color = 'var(--accent)',
  marks = [],
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  marks?: number[];
  children?: ReactNode;
  label?: string;
}) {
  const on = useMounted();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const tick = (f: number) => {
    const a = f * 2 * Math.PI - Math.PI / 2;
    const r1 = r - stroke / 2 - 1;
    const r2 = r + stroke / 2 + 1;
    return { x1: size / 2 + r1 * Math.cos(a), y1: size / 2 + r1 * Math.sin(a), x2: size / 2 + r2 * Math.cos(a), y2: size / 2 + r2 * Math.sin(a) };
  };
  return (
    <span className="ring" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={on ? c * (1 - v) : c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {marks.map((m) => (
          <line key={m} {...tick(Math.min(1, m))} stroke="var(--ink)" strokeWidth={1.5} strokeLinecap="round" opacity={0.55} />
        ))}
      </svg>
      {children && <span className="ring-center">{children}</span>}
    </span>
  );
}

export const SEVERITY_COLOR = {
  critical: 'var(--behind)',
  gap: 'var(--below)',
  'on-track': 'var(--ontrack)',
  strong: 'var(--strong)',
} as const;

/** Hour and count areas only: GPA and MCAT don't read as a share of a target. */
export function radarAreas(areas: AreaStatus[]) {
  return areas.filter((a) => a.benchmark.area !== 'gpa' && a.benchmark.area !== 'mcat');
}

const SHORT: Record<string, string> = {
  clinical: 'Clinical',
  shadowing: 'Shadowing',
  volunteering: 'Service',
  research: 'Research',
  publications: 'Output',
  leadership: 'Leadership',
};

/** Each area as a share of its competitive target (capped at 100%), with the minimum as a dashed outline. */
export function ReadinessRadar({ areas, height = 300 }: { areas: AreaStatus[]; height?: number }) {
  const data = radarAreas(areas).map((a) => {
    const b = a.benchmark;
    const pct = (n: number | undefined) => Math.min(100, Math.round(((n ?? 0) / b.competitive) * 100));
    return {
      area: SHORT[b.area] ?? b.label,
      label: b.label,
      unit: b.unit === 'posters / pubs' ? 'posters or papers' : b.unit,
      current: pct(a.current),
      projected: pct(Math.max(a.projected ?? 0, a.current ?? 0)),
      minimum: pct(b.minimum),
      raw: Math.round(a.current ?? 0),
      rawProjected: Math.round(a.projected ?? 0),
      competitive: b.competitive,
    };
  });
  const animate = !reducedMotion();
  return (
    <div className="radar" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis dataKey="area" tick={{ fill: 'var(--ink)', fontSize: 12, fontWeight: 600 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar name="Minimum" dataKey="minimum" stroke="var(--muted)" strokeDasharray="4 4" fill="none" isAnimationActive={animate} />
          <Radar name="Projected" dataKey="projected" stroke="var(--accent-2)" fill="var(--accent-2)" fillOpacity={0.18} isAnimationActive={animate} />
          <Radar name="Logged" dataKey="current" stroke="var(--accent)" strokeWidth={2} fill="var(--accent)" fillOpacity={0.28} dot={{ r: 3, fill: 'var(--accent)' }} isAnimationActive={animate} animationDuration={900} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <div className="chart-tip">
                  <strong>{d.label}</strong>
                  <span>
                    {d.raw.toLocaleString('en-US')} {d.unit} logged · {d.current}% of competitive
                  </span>
                  {d.rawProjected > d.raw && <span className="muted">{d.rawProjected.toLocaleString('en-US')} projected by June</span>}
                  <span className="muted">Competitive {d.competitive.toLocaleString('en-US')}</span>
                </div>
              );
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * One horizontal bar split into segments that grow in on mount. Each segment is a
 * button when `onPick` is given; the picked one stays bright and the rest dim.
 */
export function StackBar({ segments, picked, onPick, label, format = (n) => n.toLocaleString('en-US') }: { segments: Segment[]; picked?: string; onPick?: (key: string) => void; label: string; format?: (n: number) => string }) {
  const on = useMounted();
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div className="stackbar-wrap">
      <div className="stackbar" role="group" aria-label={label}>
        {shown.map((s, i) => {
          const style = { width: on ? `${(s.value / total) * 100}%` : '0%', background: s.color, transitionDelay: `${i * 60}ms` };
          const cls = `stackbar-seg${picked && picked !== s.key ? ' dim' : ''}${picked === s.key ? ' picked' : ''}`;
          const title = `${s.label}: ${format(s.value)} (${Math.round((s.value / total) * 100)}%)`;
          return onPick ? (
            <button key={s.key} type="button" className={cls} style={style} title={title} aria-label={title} aria-pressed={picked === s.key} onClick={() => onPick(s.key)} />
          ) : (
            <span key={s.key} className={cls} style={style} title={title} />
          );
        })}
      </div>
      <ul className="stackbar-legend">
        {shown.map((s) => (
          <li key={s.key} className={picked && picked !== s.key ? 'dim' : ''}>
            {onPick ? (
              <button type="button" className="legend-btn" aria-pressed={picked === s.key} onClick={() => onPick(s.key)}>
                <span className="legend-dot" style={{ background: s.color }} />
                {s.label} <strong className="num">{format(s.value)}</strong>
              </button>
            ) : (
              <>
                <span className="legend-dot" style={{ background: s.color }} />
                {s.label} <strong className="num">{format(s.value)}</strong>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Two-option toggle used to switch a figure between views. */
export function Toggle<T extends string>({ value, options, onChange, label }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg-toggle" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key} className={value === o.key ? 'on' : ''} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Donut of shares. Hovering a slice (or its legend row, via `active`) brings it forward. */
export function Donut({ segments, size = 168, thickness = 26, active, onHover, children }: { segments: Segment[]; size?: number; thickness?: number; active?: string; onHover?: (key: string | undefined) => void; children?: ReactNode }) {
  const on = useMounted();
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <span className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={thickness} />
        {segments.map((s) => {
          const len = (s.value / total) * c;
          const offset = acc;
          acc += len;
          if (!s.value) return null;
          return (
            <circle
              key={s.key}
              className={`donut-seg${active && active !== s.key ? ' dim' : ''}`}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={active === s.key ? thickness + 6 : thickness}
              strokeDasharray={`${on ? Math.max(0, len - 2) : 0} ${c}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              onMouseEnter={() => onHover?.(s.key)}
              onMouseLeave={() => onHover?.(undefined)}
            >
              <title>{`${s.label}: ${Math.round((s.value / total) * 100)}%`}</title>
            </circle>
          );
        })}
      </svg>
      {children && <span className="donut-center">{children}</span>}
    </span>
  );
}

export interface TimelineItem {
  id: string;
  label: string;
  date: string; // YYYY-MM-DD
  confirmed?: boolean;
}

/**
 * Dots on a 12-month line starting today. Dots close together stack into lanes.
 * Unconfirmed dates are hollow. Clicking a dot calls `onPick`.
 */
export function Timeline({ items, today, onPick, months = 12 }: { items: TimelineItem[]; today: string; onPick?: (id: string) => void; months?: number }) {
  const on = useMounted();
  const start = new Date(`${today}T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  const span = end.getTime() - start.getTime();
  const at = (iso: string) => ((new Date(`${iso}T00:00:00`).getTime() - start.getTime()) / span) * 100;
  const inRange = items.filter((i) => i.date >= today && at(i.date) <= 100).sort((a, b) => a.date.localeCompare(b.date));
  const lanes: number[] = [];
  const laneOf: Record<string, number> = {};
  for (const i of inRange) {
    const x = at(i.date);
    let lane = lanes.findIndex((last) => x - last >= 3);
    if (lane === -1) lane = lanes.length < 4 ? lanes.length : lanes.indexOf(Math.min(...lanes));
    lanes[lane] = x;
    laneOf[i.id] = lane;
  }
  const ticks: { x: number; label: string }[] = [];
  const t = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  while (t < end) {
    ticks.push({ x: ((t.getTime() - start.getTime()) / span) * 100, label: t.toLocaleDateString(undefined, { month: 'short' }) + (t.getMonth() === 0 ? ` ’${String(t.getFullYear()).slice(2)}` : '') });
    t.setMonth(t.getMonth() + 1);
  }
  return (
    <div className="timeline">
      <div className="timeline-track" role="group" aria-label={`Deadlines over the next ${months} months. Pick one to show it`}>
        <span className="timeline-today" style={{ left: 0 }}>
          <span>Today</span>
        </span>
        {ticks.map((k) => (
          <span key={k.x} className="timeline-tick" style={{ left: `${k.x}%` }}>
            {k.x > 6 && <span>{k.label}</span>}
          </span>
        ))}
        {inRange.map((i, n) => (
          <button
            key={i.id}
            type="button"
            className={`timeline-dot${i.confirmed === false ? ' hollow' : ''}`}
            style={{ left: `${on ? at(i.date) : 0}%`, bottom: 8 + laneOf[i.id] * 16, transitionDelay: `${n * 30}ms` }}
            title={`${i.label} · ${new Date(`${i.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}${i.confirmed === false ? ' · not confirmed' : ''}`}
            aria-label={`${i.label}, ${i.date}${i.confirmed === false ? ', not confirmed' : ''}`}
            onClick={() => onPick?.(i.id)}
          />
        ))}
      </div>
      {inRange.length === 0 && <p className="muted small">No deadlines in the next {months} months.</p>}
    </div>
  );
}

/** Small column chart of a series (e.g. hours per month); columns grow in on mount. */
export function MiniBars({ values, labels, height = 28, label }: { values: number[]; labels?: string[]; height?: number; label: string }) {
  const on = useMounted();
  const max = Math.max(...values, 1);
  return (
    <span className="minibars" style={{ height }} role="img" aria-label={label}>
      {values.map((v, i) => (
        <span key={i} className={`minibar${v ? '' : ' zero'}`} title={labels ? `${labels[i]}: ${Math.round(v * 10) / 10} hrs` : undefined}>
          <span style={{ height: on ? `${Math.max(v ? 8 : 0, (v / max) * 100)}%` : 0, transitionDelay: `${i * 25}ms` }} />
        </span>
      ))}
    </span>
  );
}
