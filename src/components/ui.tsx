import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { Gap, Severity } from '../types';
import type { AreaStatus } from '../engine/gaps';

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Behind',
  gap: 'Below target',
  'on-track': 'On track',
  strong: 'Strong',
};

export function Badge({ severity }: { severity: Severity }) {
  return <span className={`badge badge-${severity}`}>{SEVERITY_LABEL[severity]}</span>;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}

/** Bar with filled current value, lighter projected value, and minimum / competitive markers. */
export function AreaBar({ s, quiet }: { s: AreaStatus; quiet?: boolean }) {
  const b = s.benchmark;
  const max = Math.max(b.competitive * 1.15, s.projected ?? 0, s.current ?? 0) || 1;
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  const isScore = b.area === 'gpa' || b.area === 'mcat';
  const fmt = (n: number | undefined) => (n === undefined ? '—' : isScore ? String(n) : Math.round(n).toLocaleString());

  if (isScore) {
    return (
      <div className="area-row">
        <div className="area-head">
          <span className="area-name">{b.label}</span>
          {!quiet && <Badge severity={s.severity} />}
        </div>
        <div className="area-score">
          <strong>{fmt(s.current)}</strong>
          <span className="muted">
            {s.current === undefined && s.projected !== undefined ? `Target ${s.projected} · ` : ''}
            Average matriculant {b.competitive}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="area-row">
      <div className="area-head">
        <span className="area-name">{b.label}</span>
        {!quiet && <Badge severity={s.severity} />}
      </div>
      <div className="bar" role="img" aria-label={`${b.label}: ${fmt(s.current)} ${b.unit}, minimum ${b.minimum}, competitive ${b.competitive}`}>
        <div className="bar-projected" style={{ width: pct(s.projected ?? 0) }} />
        <div className="bar-current" style={{ width: pct(s.current ?? 0) }} />
        <div className="bar-mark" style={{ left: pct(b.minimum) }} title={`Minimum ${b.minimum}`} />
        <div className="bar-mark bar-mark-strong" style={{ left: pct(b.competitive) }} title={`Competitive ${b.competitive}`} />
      </div>
      <div className="area-foot muted">
        <span>
          <strong className="ink">{fmt(s.current)}</strong> {b.unit === 'posters / pubs' ? 'posters or papers' : b.unit}
          {s.projected !== undefined && s.projected > (s.current ?? 0) && <> · {fmt(s.projected)} projected</>}
        </span>
        <span>
          Minimum {b.minimum.toLocaleString()} · Competitive {b.competitive.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export function GapCard({ gap }: { gap: Gap }) {
  return (
    <div className={`gap-card gap-${gap.severity}`}>
      <div className="gap-head">
        <Badge severity={gap.severity} />
        <h3>{gap.title}</h3>
      </div>
      <p className="muted">{gap.detail}</p>
      <p className="gap-action">
        <ArrowRight className="icon" size={16} strokeWidth={2} aria-hidden />
        <span>{gap.action}</span>
      </p>
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Escape closes; Tab stays inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus the first field on open; return focus to the trigger on close.
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const auto = ref.current?.querySelector<HTMLElement>('[autofocus]');
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea') ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    (auto ?? first)?.focus();
    return () => trigger?.focus?.();
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Keeps the last word and a trailing icon together so the icon never wraps onto its own line. */
export function NoWrapTail({ text, icon }: { text: string; icon: ReactNode }) {
  const i = text.lastIndexOf(' ');
  return (
    <>
      {i > 0 ? text.slice(0, i + 1) : ''}
      <span className="nowrap">
        {i > 0 ? text.slice(i + 1) : text}
        {icon}
      </span>
    </>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
