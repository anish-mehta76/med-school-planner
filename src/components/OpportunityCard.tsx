import { CalendarClock, ExternalLink } from 'lucide-react';
import type { OppStatus } from '../types';
import type { RankedOpportunity } from '../engine/recommend';
import { AREA_LABELS } from '../data/benchmarks';
import { setState, useStore } from '../store/useStore';
import { NoWrapTail, Tag } from './ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const KIND_LABELS: Record<string, string> = {
  'summer-program': 'Research program',
  'clinical-role': 'Clinical role',
  shadowing: 'Shadowing',
  conference: 'Conference',
  journal: 'Publishing',
  volunteering: 'Service',
  leadership: 'Leadership',
  'test-prep': 'MCAT / academics',
};

export function OpportunityCard({ r, compact }: { r: RankedOpportunity; compact?: boolean }) {
  const { oppStatus } = useStore();
  const { opp, matched, monthsToDeadline } = r;
  const status = oppStatus[opp.id];

  const setStatus = (s: OppStatus | '') =>
    setState((st) => {
      const next = { ...st.oppStatus };
      if (s) next[opp.id] = s;
      else delete next[opp.id];
      return { ...st, oppStatus: next };
    });

  const helps = matched.map((a) => AREA_LABELS[a].toLowerCase().replace('gpa', 'GPA').replace('mcat', 'MCAT'));
  const helpsText = helps.length > 1 ? `${helps.slice(0, -1).join(', ')} and ${helps[helps.length - 1]}` : helps[0];

  return (
    <article className="opp-card">
      <div className="opp-top">
        <span className="kind">{KIND_LABELS[opp.kind]}</span>
        {opp.paid && <Tag>Paid</Tag>}
        {opp.uncertain && <span className="tag tag-warn">Status uncertain</span>}
        {monthsToDeadline !== undefined && monthsToDeadline <= 3 && (
          <span className="deadline-soon">
            <CalendarClock size={14} aria-hidden />
            {monthsToDeadline === 0 ? 'Deadline this month' : `Deadline in about ${monthsToDeadline} ${monthsToDeadline === 1 ? 'month' : 'months'}`}
          </span>
        )}
      </div>
      <h3>
        <a href={opp.url} target="_blank" rel="noreferrer">
          <NoWrapTail text={opp.name} icon={<ExternalLink className="icon ext" size={14} aria-hidden />} />
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      </h3>
      <p>{opp.description}</p>
      {!compact && (
        <dl className="opp-meta">
          <dt>Who</dt>
          <dd>{opp.eligibility}</dd>
          <dt>When</dt>
          <dd>
            {opp.timing}
            {opp.deadlineMonths && <span className="muted"> (typical deadline: {opp.deadlineMonths.map((m) => MONTHS[m - 1]).join(', ')})</span>}
          </dd>
        </dl>
      )}
      <div className="opp-foot">
        {helpsText ? <p className="opp-helps">Helps with {helpsText}</p> : <span />}
        <label className="opp-status">
          <span className="visually-hidden">Status for {opp.name}</span>
          <select value={status ?? ''} onChange={(e) => setStatus(e.target.value as OppStatus | '')}>
            <option value="">Not tracked</option>
            <option value="interested">Interested</option>
            <option value="applied">Applied</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Not pursuing</option>
          </select>
        </label>
      </div>
    </article>
  );
}
