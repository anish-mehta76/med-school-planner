import { ArrowRight } from 'lucide-react';
import { mentorsOf, programsOf } from '../data/researchData';
import { awaitingAction, followUpsDue, sortPrograms } from '../engine/outreach';
import type { MentorScore } from '../engine/mentorScore';
import type { Gap, Mentor } from '../types';
import { localDate, useStore } from '../store/useStore';
import { formatDateShort } from '../lib/format';
import { stageLabel } from '../lib/statusLabel';
import { Badge } from './ui';

export function MentorSuggestions({ picks, go }: { picks: { m: Mentor; score: MentorScore }[]; go: (p: string) => void }) {
  if (!picks.length) return null;
  return (
    <ul className="outreach-list suggest-list">
      {picks.map(({ m, score }) => (
        <li key={m.id}>
          <button className="link" onClick={() => go('research')}>
            {m.name}
          </button>
          <span className="muted small num">
            {m.institution.text.split(',')[0]} · Score {score.total}/100
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Dashboard "What to do next": biggest gap, follow-ups, replies waiting on you, next deadlines. */
export default function ResearchOutreach({ go, picks, gap }: { go: (p: string) => void; picks: { m: Mentor; score: MentorScore }[]; gap?: Gap }) {
  const state = useStore();
  const today = localDate();
  const mentors = mentorsOf(state);
  const due = followUpsDue(mentors, state, today);
  const waiting = awaitingAction(mentors, state);
  const deadlines = sortPrograms(programsOf(state), today)
    .filter((p) => p.deadline && p.deadline >= today)
    .slice(0, 3);

  return (
    <section className="card next-steps" aria-labelledby="next-steps-title">
      <div className="card-head">
        <h2 id="next-steps-title">What to do next</h2>
        <button className="link" onClick={() => go('research')}>
          Research targeting <ArrowRight size={16} aria-hidden />
        </button>
      </div>
      <div className="outreach-cols">
        {gap && (
          <div className="next-gap-col">
            <h3>Biggest gap</h3>
            <p className="next-gap">
              <Badge severity={gap.severity} /> <strong>{gap.title}</strong>
            </p>
            <p className="small">{gap.action}</p>
            <button className="link" onClick={() => go('gaps')}>
              Gap analysis <ArrowRight size={16} aria-hidden />
            </button>
          </div>
        )}
        <div>
          <h3>Follow-ups due this week</h3>
          {due.length ? (
            <ul className="outreach-list">
              {due.map(({ m, o }) => (
                <li key={m.id}>
                  <span>{m.name}</span>
                  <span className={o.followUpDue! < today ? 'danger small num' : 'muted small num'}>
                    {o.followUpDue! < today ? 'Overdue · ' : ''}
                    {formatDateShort(o.followUpDue!)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">None this week. When you log the date you sent an email, a follow-up reminder appears here two weeks later.</p>
          )}
        </div>
        <div>
          <h3>Replies waiting on you</h3>
          {waiting.length ? (
            <ul className="outreach-list">
              {waiting.map(({ m, o }) => (
                <li key={m.id}>
                  <span>{m.name}</span>
                  <span className="muted small">{stageLabel(o.status)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Nothing waiting on you.</p>
          )}
        </div>
        <div>
          <h3>Next NYC program deadlines</h3>
          {deadlines.length ? (
            <ul className="outreach-list">
              {deadlines.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <span className="muted small num">
                    {formatDateShort(p.deadline!)}
                    {!p.deadlineVerified && ' · Not confirmed'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No upcoming deadlines in your NYC tracker.</p>
          )}
        </div>
      </div>
      {picks.length > 0 && (
        <div className="suggest">
          <h3>Top labs for your research gap</h3>
          <MentorSuggestions picks={picks} go={go} />
        </div>
      )}
    </section>
  );
}
