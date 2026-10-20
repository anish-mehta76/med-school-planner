import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Copy, Download, ExternalLink, FileUp, Info, Lock, Search } from 'lucide-react';
import type { Link, Mentor, MentorPriority, OppStatus, Outreach, OutreachStatus, Program } from '../types';
import { mentorsOf, programsOf } from '../data/researchData';
import { localDate, setState, useStore } from '../store/useStore';
import { rankMentors, type MentorScore } from '../engine/mentorScore';
import { effectiveOutreach, OUTREACH_STATUSES, outreachPatch, PIPELINE, sortPrograms, STAGE_TONE, stageOf, type PipelineStage } from '../engine/outreach';
import { BRIDGE_TEMPLATE_LABELS, bridgeFor, DEFAULT_WHY_TEMPLATES, whyThisLab, type Bridge } from '../engine/whyThisLab';
import { joinMentor } from '../engine/joinMentor';
import { Empty, NoWrapTail } from '../components/ui';
import { formatDate, sentenceCase } from '../lib/format';
import { stageLabel } from '../lib/statusLabel';
import { emailSegments, plainEmailText } from '../lib/emailText';
import { confirmedText, evidenceView, isUnverified, journalName, plainReason } from '../lib/mentorDisplay';
import { exportTrackerCsv, parseTrackerCsv, TrackerImportError, trackerPrivate } from '../lib/tracker';
import { CSV_ACCEPT, saveFile } from '../lib/saveFile';
import { reducedMotion, StackBar, Timeline, useMounted } from '../components/viz';

/** Colour per outreach stage in the pipeline bar. */
const STAGE_COLOR: Record<PipelineStage, string> = {
  drafted: 'var(--border-control)',
  sent: 'var(--c2)',
  'follow-up': 'var(--behind)',
  'followed-up': 'var(--c1)',
  'no-response': 'var(--muted)',
  declined: 'var(--c7)',
  redirected: 'var(--c4)',
  interested: 'var(--below)',
  meeting: 'var(--c5)',
  joined: 'var(--strong)',
};

const BRIDGE_COLOR: Record<Bridge, string> = { endometrial: 'var(--c1)', cervical: 'var(--c2)', methods: 'var(--c4)' };

/** Every shown mentor as a dot on a 0–100 score line. Clicking a dot opens that mentor's card. */
function ScoreStrip({ items, open, onPick }: { items: { m: Mentor; score: MentorScore }[]; open: string | null; onPick: (id: string) => void }) {
  const on = useMounted();
  // Stack dots whose scores are within ~2 points so none hide behind another.
  const lanes: number[] = [];
  const laneOf: Record<string, number> = {};
  for (const { m, score } of [...items].sort((x, y) => x.score.total - y.score.total)) {
    let lane = lanes.findIndex((last) => score.total - last >= 2.5);
    if (lane === -1) lane = lanes.length < 5 ? lanes.length : lanes.indexOf(Math.min(...lanes));
    lanes[lane] = score.total;
    laneOf[m.id] = lane;
  }
  return (
    <div className="score-strip">
      <div className="score-strip-track" role="group" aria-label="Fit scores of the mentors shown. Pick one to open it">
        {[0, 25, 50, 75, 100].map((t) => (
          <span key={t} className="score-strip-tick" style={{ left: `${t}%` }}>
            <span>{t}</span>
          </span>
        ))}
        {items.map(({ m, score }, i) => {
          const lane = laneOf[m.id];
          return (
            <button
              key={m.id}
              type="button"
              className={`score-dot${open === m.id ? ' picked' : ''}`}
              style={{ left: `${on ? score.total : 0}%`, bottom: 6 + lane * 14, background: BRIDGE_COLOR[bridgeFor(m)], transitionDelay: `${Math.min(i, 30) * 15}ms` }}
              title={`${m.name} · ${score.total}/100`}
              aria-label={`${m.name}, score ${score.total}`}
              onClick={() => onPick(m.id)}
            />
          );
        })}
      </div>
      <ul className="stackbar-legend">
        {(Object.keys(BRIDGE_LABELS) as Bridge[]).map((b) => (
          <li key={b}>
            <span className="legend-dot" style={{ background: BRIDGE_COLOR[b] }} />
            {BRIDGE_LABELS[b]}
          </li>
        ))}
      </ul>
    </div>
  );
}

const BRIDGE_LABELS: Record<Bridge, string> = { endometrial: 'Endometrial', cervical: 'Cervical / HPV', methods: 'Methods / adjacent' };


/** Broad institution group for filtering, from the first part of the institution text. */
export function institutionGroup(m: Mentor) {
  const t = m.institution.text;
  if (/Johns Hopkins/i.test(t)) return 'Johns Hopkins';
  if (/NCI|NHGRI|NIH/i.test(t)) return 'NIH / NCI';
  if (/Maryland/i.test(t)) return 'University of Maryland';
  if (/Georgetown/i.test(t)) return 'Georgetown';
  return t.split(',')[0];
}

function copy(text: string, done: () => void) {
  navigator.clipboard?.writeText(text).then(done, () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    done();
  });
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-small"
      onClick={() =>
        copy(text, () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {typeof children === 'string' ? <NoWrapTail text={children} icon={<ExternalLink className="icon" size={12} aria-hidden />} /> : children}
      {typeof children !== 'string' && <ExternalLink className="icon" size={12} aria-hidden />}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

function Links({ links }: { links: Link[] }) {
  if (!links.length) return null;
  return (
    <span className="cite-links">
      {links.map((l) => (
        <ExtLink key={l.url} href={l.url}>
          {sentenceCase(l.label)}
        </ExtLink>
      ))}
    </span>
  );
}

function StageBadge({ stage }: { stage: PipelineStage }) {
  return <span className={`stage stage-${STAGE_TONE[stage]}`}>{stageLabel(stage)}</span>;
}

/** A tracker field that may only say "Unverified". */
function Confirmed({ text }: { text: string }) {
  if (!isUnverified(text)) return <>{text}</>;
  return (
    <span className="muted unconfirmed">
      <Info className="icon" size={14} aria-hidden /> {confirmedText(text)}
    </span>
  );
}

function ScoreBreakdown({ score }: { score: MentorScore }) {
  const totalWeight = score.parts.reduce((s, x) => s + x.weight, 0);
  return (
    <div className="score-parts">
      {score.parts.map((p) => (
        <div key={p.key} className="score-part">
          <div className="score-part-head">
            <span>{p.label}</span>
            <span className="muted small">
              {Math.round(p.points)} of {Math.round((p.weight * 100) / totalWeight || 0)}
            </span>
          </div>
          <div className="bar bar-thin" aria-hidden>
            <div className="bar-current" style={{ width: `${p.value * 100}%` }} />
          </div>
          <p className="muted small">{p.reasons.map(plainReason).join(' · ')}</p>
        </div>
      ))}
    </div>
  );
}

/** Secondary outreach fields, shown under "More outreach details". */
const TEXT_FIELDS: [keyof Outreach, string][] = [
  ['response', 'Response and next action'],
  ['pitchVersion', 'Pitch version'],
  ['window', 'Academic-year or summer window'],
  ['hoursPerWeek', 'Hours per week I can offer'],
  ['worksite', 'Worksite and in-person requirement'],
  ['dayToDayMentor', 'Day-to-day mentor'],
  ['dataset', 'Dataset or specimens'],
  ['irb', 'IRB and data-access readiness'],
  ['workPackage', 'Agreed work package'],
  ['authorship', 'Authorship expectations discussed'],
  ['milestone', 'First milestone and due date'],
  ['funding', 'Funding or credit'],
  ['applicationRoute', 'Application route and eligibility confirmed'],
  ['outcome', 'Outcome'],
  ['notes', 'Notes'],
];

function useOutreachUpdate(m: Mentor) {
  return (patch: Partial<Outreach>) =>
    setState((s) => {
      const cur = effectiveOutreach(m, s);
      return { ...s, outreach: { ...s.outreach, [m.id]: { ...s.outreach[m.id], ...outreachPatch(cur, patch) } } };
    });
}

/** Status, first contact and follow-up: shown at the top of the expanded card. */
function OutreachEssentials({ m, o }: { m: Mentor; o: Outreach }) {
  const update = useOutreachUpdate(m);
  const field = (k: keyof Outreach) => (o[k] as string | undefined) ?? '';
  return (
    <div className="form outreach-essentials">
      <label>
        Outreach status
        <select value={o.status} onChange={(e) => update({ status: e.target.value as OutreachStatus })}>
          {OUTREACH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {stageLabel(s)}
            </option>
          ))}
        </select>
      </label>
      <label>
        First contact date
        <input type="date" value={field('firstContact')} onChange={(e) => update({ firstContact: e.target.value || undefined })} />
      </label>
      <label>
        Follow-up due
        <input type="date" value={field('followUpDue')} onChange={(e) => update({ followUpDue: e.target.value || undefined })} />
        <span className="hint">Filled in 10 business days after first contact.</span>
      </label>
    </div>
  );
}

function OutreachDetails({ m, o }: { m: Mentor; o: Outreach }) {
  const update = useOutreachUpdate(m);
  const field = (k: keyof Outreach) => (o[k] as string | undefined) ?? '';
  return (
    <div className="form">
      <label>
        Last response date
        <input type="date" value={field('lastResponse')} onChange={(e) => update({ lastResponse: e.target.value || undefined })} />
      </label>
      {TEXT_FIELDS.map(([k, label]) => (
        <label key={k} className={k === 'response' || k === 'notes' || k === 'workPackage' ? 'span-2' : ''}>
          {label}
          {k === 'notes' || k === 'response' ? (
            <textarea rows={2} value={field(k)} onChange={(e) => update({ [k]: e.target.value })} />
          ) : (
            <input value={field(k)} onChange={(e) => update({ [k]: e.target.value })} />
          )}
        </label>
      ))}
    </div>
  );
}

function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="disclosure">
      <summary>
        {summary}
        <ChevronDown className="chev" size={16} aria-hidden />
      </summary>
      {children}
    </details>
  );
}

function EmailPreview({ body }: { body: string }) {
  return (
    <div className="email">
      {emailSegments(body).map((s, i) =>
        'url' in s ? (
          <ExtLink key={i} href={s.url}>
            {s.text}
          </ExtLink>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </div>
  );
}

function MentorCard({ m, score, open, onToggle }: { m: Mentor; score: MentorScore; open: boolean; onToggle: () => void }) {
  const state = useStore();
  const o = effectiveOutreach(m, state);
  const stage = stageOf(o, localDate());
  const why = whyThisLab(m, state.whyTemplates);
  const linked = o.experienceId && state.experiences.some((e) => e.id === o.experienceId);
  const evidence = evidenceView(m.evidenceGate);
  const priv = trackerPrivate(state.tracker)[m.id];
  const bodyId = `mentor-${m.id}`;

  return (
    <article id={`card-${m.id}`} className={`mentor ${open ? 'open' : ''}`}>
      <button className="mentor-head" onClick={onToggle} aria-expanded={open} aria-controls={bodyId}>
        <span className="mentor-score" aria-label={`Score ${score.total} out of 100`}>
          <strong>
            {score.total}
            <small>/100</small>
          </strong>
          <span className="score-mini" aria-hidden>
            <span style={{ width: `${score.total}%` }} />
          </span>
        </span>
        <span className="mentor-id">
          <strong>{m.name}</strong>
          <span className="muted small">
            {m.institution.text} · {BRIDGE_LABELS[bridgeFor(m)]}
          </span>
        </span>
        <span className="mentor-tags">
          <span className="prio">{m.priority}</span>
          <StageBadge stage={stage} />
        </span>
        <ChevronDown className="chev" size={20} aria-hidden />
      </button>

      {open && (
        <div className="mentor-body" id={bodyId}>
          {o.status === 'joined' && !linked && (
            <div className="callout">
              <span>
                <strong>You joined this lab.</strong> Add it to your experiences with a placeholder research output?
              </span>
              <div>
                <button className="btn btn-primary" onClick={() => setState((s) => joinMentor(s, m))}>
                  Add to my experiences
                </button>
              </div>
            </div>
          )}
          {o.status === 'joined' && linked && (
            <p className="small muted">
              <Check className="icon" size={14} aria-hidden /> Linked to an experience in your Experiences list.
            </p>
          )}

          <section aria-label="Outreach">
            <OutreachEssentials m={m} o={o} />
          </section>

          <div className="mentor-grid">
            <section>
              <h3>Fit</h3>
              <dl className="facts">
                <dt>Disease fit</dt>
                <dd>
                  {m.diseaseFit.text} <Links links={m.diseaseFit.links} />
                </dd>
                <dt>Strength</dt>
                <dd>
                  {m.strength.text} <Links links={m.strength.links} />
                </dd>
                <dt>Publication record</dt>
                <dd>
                  {evidence.summary}
                  <Disclosure summary="Details">
                    <p className="muted small">{evidence.details}</p>
                  </Disclosure>
                </dd>
                <dt>Undergrad mentorship</dt>
                <dd>
                  <Confirmed text={m.mentorshipEvidence.text} /> <Links links={m.mentorshipEvidence.links} />
                </dd>
                <dt>Undergrad opening</dt>
                <dd>
                  <Confirmed text={m.undergradOpening.text} />
                </dd>
                <dt>Contact</dt>
                <dd>
                  {m.email ? <a href={`mailto:${m.email}`}>{m.email}</a> : <Confirmed text={m.contact.text} />} <Links links={m.contact.links} />
                </dd>
                <dt>Last checked</dt>
                <dd>{m.lastVerified ? formatDate(m.lastVerified) : <Confirmed text="Unverified" />}</dd>
                <dt>Tracker ID</dt>
                <dd className="num">{m.id}</dd>
              </dl>
              <h3>Publications in the tracker</h3>
              <ul className="pubs">
                {m.publications.map((p, i) => {
                  const name = journalName(p.journal);
                  return (
                    <li key={i}>
                      {p.url ? <ExtLink href={p.url}>{name}</ExtLink> : name}
                      {p.year && `, ${p.year}`}
                      {p.note && p.note !== 'n.a.' && <span className="muted"> · {sentenceCase(p.note)}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
            <section>
              <h3>Score breakdown</h3>
              <ScoreBreakdown score={score} />
            </section>
          </div>

          {priv?.pitch && (
            <section>
              <h3>Suggested pitch</h3>
              <p className="prose">{priv.pitch}</p>
            </section>
          )}

          <section>
            <div className="card-head">
              <h3>Why this lab</h3>
              <CopyButton text={why} />
            </div>
            <p className="why">{why}</p>
            <p className="hint">Built from tracker fields only. Edit before using it in an email or your AMCAS narrative.</p>
          </section>

          <section>
            <div className="card-head">
              <h3>Draft email</h3>
              {priv?.draftBody && (
                <span className="row-actions tight">
                  <CopyButton text={priv.draftSubject} label="Copy subject" />
                  <CopyButton text={plainEmailText(priv.draftBody)} label="Copy body" />
                </span>
              )}
            </div>
            {priv?.draftBody ? (
              <>
                <p className="small">
                  <span className="muted">Subject:</span> {priv.draftSubject}
                </p>
                <Disclosure summary="Show email">
                  <EmailPreview body={priv.draftBody} />
                </Disclosure>
              </>
            ) : (
              <p className="muted small">
                <Lock className="icon" size={14} aria-hidden /> Your draft emails and pitches are private and aren't part of the website. Import your tracker CSV
                at the top of this page to see them on this device.
              </p>
            )}
          </section>

          <section>
            <Disclosure summary="More outreach details">
              <OutreachDetails m={m} o={o} />
            </Disclosure>
          </section>
        </div>
      )}
    </article>
  );
}

function daysUntil(iso: string, today: string) {
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000);
}

function ProgramCard({ p, today, flash }: { p: Program; today: string; flash?: boolean }) {
  const { programStatus } = useStore();
  const upcoming = p.deadline && p.deadline >= today ? p.deadline : undefined;
  const days = upcoming ? daysUntil(upcoming, today) : undefined;
  const setStatus = (v: OppStatus | '') =>
    setState((s) => {
      const next = { ...s.programStatus };
      if (v) next[p.id] = v;
      else delete next[p.id];
      return { ...s, programStatus: next };
    });

  return (
    <article id={`program-${p.id}`} className={`opp-card program-card${flash ? ' flash' : ''}`}>
      <div className="opp-top">
        <span className="kind">{p.location}</span>
        {upcoming ? (
          <span className={`deadline-soon ${days! > 45 ? 'calm' : ''}`}>
            <span className="num">
              {formatDate(upcoming)} · {days} {days === 1 ? 'day' : 'days'} left
            </span>
          </span>
        ) : (
          <span className="deadline-soon calm">No confirmed deadline</span>
        )}
      </div>
      {upcoming && !p.deadlineVerified && (
        <p>
          <span className="tag tag-warn">Date not confirmed</span>
        </p>
      )}
      <h3>
        <ExtLink href={p.source}>{p.name}</ExtLink>
      </h3>
      <p className="muted small">{p.recommendation}</p>
      <dl className="opp-meta">
        <dt>Next step</dt>
        <dd>
          <strong>{p.nextAction}</strong>
        </dd>
        <dt>Timeline</dt>
        <dd>{p.timeline}</dd>
      </dl>
      <Disclosure summary="Details">
        <dl className="opp-meta">
          <dt>Eligibility</dt>
          <dd>{p.eligibility}</dd>
          <dt>Summer</dt>
          <dd>{p.summerDates}</dd>
          <dt>Fit</dt>
          <dd>{p.fit}</dd>
          <dt>Publication</dt>
          <dd>{p.publicationEvidence}</dd>
          <dt>Deliverable</dt>
          <dd>{p.deliverable}</dd>
          <dt>Pay and housing</dt>
          <dd>{p.pay}</dd>
        </dl>
      </Disclosure>
      <div className="opp-foot">
        <span />
        <label className="opp-status">
          <span className="visually-hidden">Status for {p.name}</span>
          <select value={programStatus[p.id] ?? ''} onChange={(e) => setStatus(e.target.value as OppStatus | '')}>
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

/** Import / export of your private tracker CSV. Its private columns stay in this browser only. */
function TrackerBar() {
  const state = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const t = state.tracker;

  const onFile = async (file: File) => {
    try {
      const tracker = parseTrackerCsv(await file.text(), file.name);
      const known = new Set(mentorsOf(state).map((m) => m.id));
      const matched = tracker.rows.filter((r) => known.has(r.ID.trim())).length;
      setState((s) => ({ ...s, tracker }));
      setMessage({ tone: 'ok', text: `Imported ${tracker.rows.length} researchers (${matched} match this app's list). Your edits in the app were kept.` });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof TrackerImportError ? e.message : "Couldn't read that file as a CSV." });
    }
  };

  const onExport = async () => {
    const csv = exportTrackerCsv(state, mentorsOf(state));
    await saveFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'uterine-cervical-cancer-opportunities-tracker.csv');
  };

  return (
    <section className="tracker-bar" aria-label="Your private tracker">
      <div>
        <strong>
          <Lock className="icon" size={14} aria-hidden /> {t ? 'Private tracker loaded' : 'Private tracker not loaded'}
        </strong>
        <p className="muted small">
          {t
            ? `${t.fileName}, imported ${formatDate(localDate(new Date(t.importedAt)))}. Draft emails, pitches and outreach notes stay in this browser only.`
            : 'Draft emails, pitches and outreach notes are kept out of the website. Import your tracker CSV to use them on this device.'}
        </p>
        {message && (
          <p className={`small ${message.tone === 'error' ? 'danger' : ''}`} role="status">
            {message.text}
          </p>
        )}
      </div>
      <div className="row-actions tight">
        <button className={`btn ${t ? '' : 'btn-primary'}`} onClick={() => input.current?.click()}>
          <FileUp size={16} aria-hidden /> {t ? 'Replace tracker CSV' : 'Import tracker CSV'}
        </button>
        {t && (
          <button className="btn" onClick={onExport}>
            <Download size={16} aria-hidden /> Export tracker CSV
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept={CSV_ACCEPT}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </section>
  );
}

/** Your own "Why this lab" wording, saved only in this browser. */
function WhyTemplatesEditor() {
  const state = useStore();
  const set = (b: Bridge, v: string) => setState((s) => ({ ...s, whyTemplates: { ...s.whyTemplates, [b]: v } }));
  return (
    <Disclosure summary="Your “Why this lab” wording">
      <div className="form">
        <p className="muted small span-2">
          Private to this browser and included in backups. Placeholders: {'{dr}'}, {'{focus}'}, {'{paper}'}. Leave a box empty to use the neutral default.
        </p>
        {(Object.keys(BRIDGE_TEMPLATE_LABELS) as Bridge[]).map((b) => (
          <label key={b} className="span-2">
            {BRIDGE_TEMPLATE_LABELS[b]}
            <textarea rows={4} value={state.whyTemplates?.[b] ?? ''} placeholder={DEFAULT_WHY_TEMPLATES[b]} onChange={(e) => set(b, e.target.value)} />
          </label>
        ))}
      </div>
    </Disclosure>
  );
}

/** Shown on the public site until a backup with the lists is imported. */
function NoListYet({ what }: { what: 'mentors' | 'programs' }) {
  return (
    <Empty>
      <p>No {what} yet. Your list isn't published with the website; import your backup (.json) in Profile & academics to load it in this browser.</p>
      <a className="btn" href="#settings">
        Go to Profile & academics
      </a>
    </Empty>
  );
}

export default function Research() {
  const state = useStore();
  const [tab, setTab] = useState<'mentors' | 'programs'>('mentors');
  const [disease, setDisease] = useState<Bridge | 'all'>('all');
  const [inst, setInst] = useState('all');
  const [prio, setPrio] = useState<MentorPriority | 'all'>('all');
  const [stage, setStage] = useState<PipelineStage | 'all'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [flashProgram, setFlashProgram] = useState<string | null>(null);
  const today = localDate();

  const mentors = mentorsOf(state);
  const ranked = useMemo(() => rankMentors(mentors, state.scoreWeights), [mentors, state.scoreWeights]);
  const institutions = [...new Set(mentors.map(institutionGroup))].sort();
  const stageCounts = Object.fromEntries(PIPELINE.map((s) => [s, 0])) as Record<PipelineStage, number>;
  for (const { m } of ranked) stageCounts[stageOf(effectiveOutreach(m, state), today)]++;

  const shown = ranked.filter(
    ({ m }) =>
      (disease === 'all' || bridgeFor(m) === disease) &&
      (inst === 'all' || institutionGroup(m) === inst) &&
      (prio === 'all' || m.priority === prio) &&
      (stage === 'all' || stageOf(effectiveOutreach(m, state), today) === stage) &&
      (!q || `${m.name} ${m.institution.text} ${m.diseaseFit.text} ${m.strength.text}`.toLowerCase().includes(q.toLowerCase())),
  );
  const programs = sortPrograms(programsOf(state), today);
  const clearFilters = () => {
    setDisease('all');
    setInst('all');
    setPrio('all');
    setStage('all');
    setQ('');
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Research targeting</h1>
          <p className="muted">Uterine and cervical cancer labs from your tracker, ranked by fit out of 100. Adjust the weights in Profile & academics.</p>
        </div>
      </header>

      <TrackerBar />
      <WhyTemplatesEditor />

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'mentors'} className={tab === 'mentors' ? 'active' : ''} onClick={() => setTab('mentors')}>
          Mentors <span className="muted">{mentors.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'programs'} className={tab === 'programs' ? 'active' : ''} onClick={() => setTab('programs')}>
          NYC programs <span className="muted">{programs.length}</span>
        </button>
      </div>

      {tab === 'mentors' ? (
        <>
          {mentors.length > 0 && (
            <section className="card research-viz" aria-labelledby="pipeline-title">
              <div className="card-head">
                <h2 id="pipeline-title">Outreach pipeline</h2>
                <span className="muted small">Click a stage to filter</span>
              </div>
              <StackBar
                label="Mentors by outreach stage. Pick one to filter"
                picked={stage === 'all' ? undefined : stage}
                onPick={(k) => setStage(stage === k ? 'all' : (k as PipelineStage))}
                segments={PIPELINE.map((s) => ({ key: s, label: stageLabel(s), value: stageCounts[s], color: STAGE_COLOR[s] }))}
              />
              <h3 className="viz-sub">
                Fit scores <span className="muted small">· {shown.length} shown</span>
              </h3>
              <ScoreStrip
                items={shown}
                open={open}
                onPick={(id) => {
                  setOpen(id);
                  requestAnimationFrame(() => document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }));
                }}
              />
            </section>
          )}
          <div className="chips chips-scroll" role="group" aria-label="Filter by outreach status">
            <button className={`chip ${stage === 'all' ? 'active' : ''}`} aria-pressed={stage === 'all'} onClick={() => setStage('all')}>
              All <span className="muted">{mentors.length}</span>
            </button>
            {PIPELINE.filter((s) => stageCounts[s] > 0 || stage === s).map((s) => (
              <button key={s} className={`chip ${stage === s ? 'active' : ''}`} aria-pressed={stage === s} onClick={() => setStage(s)}>
                {stageLabel(s)} <span className="muted">{stageCounts[s]}</span>
              </button>
            ))}
          </div>
          <div className="filters">
            <span className="search-field">
              <Search size={16} aria-hidden />
              <input type="search" placeholder="Search name, institution or topic" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search mentors" />
            </span>
            <select value={disease} onChange={(e) => setDisease(e.target.value as Bridge | 'all')} aria-label="Filter by disease">
              <option value="all">All diseases</option>
              {Object.entries(BRIDGE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select value={inst} onChange={(e) => setInst(e.target.value)} aria-label="Filter by institution">
              <option value="all">All institutions</option>
              {institutions.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
            <select value={prio} onChange={(e) => setPrio(e.target.value as MentorPriority | 'all')} aria-label="Filter by priority">
              <option value="all">All priorities</option>
              <option>Start</option>
              <option>Next</option>
              <option>Conditional</option>
            </select>
          </div>
          <div className="mentor-list">
            {shown.map(({ m, score }) => (
              <MentorCard key={m.id} m={m} score={score} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} />
            ))}
            {mentors.length === 0 && <NoListYet what="mentors" />}
            {mentors.length > 0 && shown.length === 0 && (
              <Empty>
                <p>No mentors match those filters.</p>
                <button className="btn" onClick={clearFilters}>
                  Clear filters
                </button>
              </Empty>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="muted small">
            Sorted by next deadline. Dates come from your tracker; “Date not confirmed” means the tracker lists it as TBD, historical or unclear. Check
            the official page before relying on any date.
          </p>
          {programs.length > 0 && (
            <section className="card" aria-labelledby="deadline-title">
              <div className="card-head">
                <h2 id="deadline-title">Deadlines ahead</h2>
                <span className="muted small">Hollow = date not confirmed · click a dot</span>
              </div>
              <Timeline
                today={today}
                items={programs.filter((p) => p.deadline).map((p) => ({ id: p.id, label: p.name, date: p.deadline!, confirmed: p.deadlineVerified }))}
                onPick={(id) => {
                  document.getElementById(`program-${id}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
                  setFlashProgram(id);
                  window.setTimeout(() => setFlashProgram((f) => (f === id ? null : f)), 1600);
                }}
              />
            </section>
          )}
          <div className="opp-grid">
            {programs.map((p) => (
              <ProgramCard key={p.id} p={p} today={today} flash={flashProgram === p.id} />
            ))}
          </div>
          {programs.length === 0 && <NoListYet what="programs" />}
        </>
      )}
    </div>
  );
}
