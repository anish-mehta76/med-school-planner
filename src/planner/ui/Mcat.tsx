import { useMemo, useState } from 'react';
import type { Scenario } from '../types';
import type { ScenarioAnalysis } from '../engine';
import { COURSE } from '../catalog';
import { TERM_BY_ID } from '../terms';
import { Ring } from '../../components/viz';
import {
  DISCIPLINES,
  EXAM_CREDIT_FACTOR,
  MCAT_SOURCE,
  SCIENCE_SECTIONS,
  SECTION_INFO,
  SECTION_WEIGHTS,
  mcatReadiness,
  sectionsFor,
  type CourseImpact,
  type Discipline,
} from '../mcat';

type Sci = (typeof SCIENCE_SECTIONS)[number];
const pct = (n: number) => `${Math.round(n)}%`;
const pts = (n: number) => String(Math.round(n * 10) / 10);

const TIMING: Record<CourseImpact['timing'], { label: string; cls: string }> = {
  done: { label: 'taken', cls: 'tag-ok' },
  planned: { label: 'planned', cls: '' },
  after: { label: 'after your MCAT', cls: 'tag-warn' },
  exam: { label: `exam credit (counts ${EXAM_CREDIT_FACTOR * 100}%)`, cls: '' },
};

/** "+15 Chem/Phys · +5 Bio/Biochem" for the sections a course or gap moves. */
function Gains({ g }: { g: Record<Sci, number> }) {
  const parts = SCIENCE_SECTIONS.filter((s) => g[s] > 0.05);
  if (!parts.length) return null;
  return (
    <span className="mcat-gains">
      {parts.map((s) => (
        <span key={s} className={`mcat-gain mcat-${s}`}>
          +{pts(g[s])} {SECTION_INFO[s].short}
        </span>
      ))}
    </span>
  );
}

export default function Mcat({ scenario, analysis }: { scenario: Scenario; analysis: ScenarioAnalysis }) {
  const testTerm = scenario.mcatAfterTermId ?? 'S29';
  const r = useMemo(() => mcatReadiness(analysis.resolved, testTerm), [analysis.resolved, testTerm]);
  const [focus, setFocus] = useState<Sci | null>(null);

  const disciplines = (Object.keys(DISCIPLINES) as Discipline[])
    .filter((d) => !focus || (SECTION_WEIGHTS[focus][d] ?? 0) > 0)
    .sort((a, b) => (focus ? (SECTION_WEIGHTS[focus][b] ?? 0) - (SECTION_WEIGHTS[focus][a] ?? 0) : 0));
  const gaps = r.gaps.filter((g) => !focus || g.gain[focus] > 0.05);

  return (
    <div className="stack mcat">
      <p className="muted small">
        How much of the MCAT's tested content your courses will have taught you by test day (after {r.mcatLabel}; change it with "MCAT after" above). Each
        section is weighted by the{' '}
        <a href={MCAT_SOURCE} target="_blank" rel="noreferrer">
          AAMC's published discipline mix
        </a>
        . This is content coverage, not a score prediction: review and full-length practice tests matter more than any single class.
      </p>

      <div className="ring-grid mcat-rings" role="group" aria-label="Coverage by MCAT section. Pick one to focus the lists below">
        {(['cp', 'cars', 'bb', 'ps'] as const).map((s) =>
          s === 'cars' ? (
            <div key={s} className="ring-tile mcat-tile mcat-cars">
              <Ring value={0} size={76} stroke={7} label="CARS is not covered by coursework">
                <strong>—</strong>
              </Ring>
              <span className="ring-name">CARS</span>
              <span className="muted small">Not taught by any course. Build it with timed daily passages, starting months ahead.</span>
            </div>
          ) : (
            <button
              key={s}
              type="button"
              className={`ring-tile mcat-tile ${focus === s ? 'on' : ''}`}
              aria-pressed={focus === s}
              onClick={() => setFocus(focus === s ? null : s)}
              title={SECTION_INFO[s].name}
            >
              <Ring value={r.byTest[s] / 100} marks={[r.now[s] / 100]} size={76} stroke={7} label={`${SECTION_INFO[s].short}: ${pct(r.byTest[s])} by test day, ${pct(r.now[s])} so far`}>
                <strong className="num">{pct(r.byTest[s])}</strong>
              </Ring>
              <span className="ring-name">{SECTION_INFO[s].short}</span>
              <span className="muted small">{pct(r.now[s])} from courses already taken</span>
            </button>
          ),
        )}
      </div>

      {gaps.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Biggest gains before test day{focus && ` · ${SECTION_INFO[focus].short}`}</h2>
          </div>
          <ul className="mcat-gaps">
            {gaps.slice(0, 6).map((g) => (
              <li key={`${g.discipline}-${g.part}`}>
                <div>
                  <strong>{g.part}</strong>{' '}
                  <span className="muted small">
                    {g.reason === 'after'
                      ? `is in your plan after ${r.mcatLabel}; move it earlier`
                      : g.reason === 'more'
                        ? 'partly covered; one more course before your test fills it'
                        : g.reason === 'exam'
                        ? 'only via exam credit; taking the JHU course or reviewing it closes the rest'
                        : `not in your plan; e.g. ${g.suggest}${COURSE[g.suggest] ? ` ${COURSE[g.suggest].title}` : ''}`}
                  </span>
                </div>
                <Gains g={g.gain} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>What each subject feeds</h2>
          <span className="muted small">{focus ? `Showing what counts toward ${SECTION_INFO[focus].short}` : 'Pick a section above to focus'}</span>
        </div>
        {disciplines.map((d) => {
          const cov = r.discipline[d];
          const list = r.courses.filter((c) => c.discipline === d);
          return (
            <div key={d} className="area-row mcat-row">
              <div className="area-head">
                <span className="area-name">{DISCIPLINES[d].label}</span>
                <span className="mcat-feeds">
                  {sectionsFor(d).map((x) => (
                    <span key={x.section} className={`mcat-feed mcat-${x.section} ${focus && focus !== x.section ? 'dim' : ''}`}>
                      {Math.round(x.weight * 100)}% of {SECTION_INFO[x.section].short}
                    </span>
                  ))}
                </span>
              </div>
              <div className="bar" role="img" aria-label={`${DISCIPLINES[d].label}: ${pct(cov.byTest * 100)} covered by test day, ${pct(cov.now * 100)} so far`}>
                <div className="bar-projected" style={{ width: `${cov.byTest * 100}%` }} />
                <div className="bar-current" style={{ width: `${cov.now * 100}%` }} />
              </div>
              {list.length ? (
                <ul className="mcat-courses">
                  {list.map((c, i) => (
                    <li key={`${c.code}-${i}`}>
                      <span className="num">{c.code}</span> <span>{c.title}</span>
                      <span className="muted small"> · {TERM_BY_ID[c.termId]?.label ?? c.termId}</span>{' '}
                      <span className={`tag ${TIMING[c.timing].cls}`}>{TIMING[c.timing].label}</span>{' '}
                      {c.timing === 'after' ? (
                        <span className="muted small">
                          would add <Gains g={c.potential} />
                        </span>
                      ) : (
                        <Gains g={c.points} />
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Nothing in your plan yet. {DISCIPLINES[d].parts.map((p) => `${p.label}: ${p.suggest}`).join(' · ')}</p>
              )}
            </div>
          );
        })}
        <p className="muted small mcat-legend">Darker bar: courses already taken. Lighter: planned before your test. Numbers are points of that section's content (out of 100). Section weights are the AAMC's; splits within a subject (e.g.
          how much of biology Gen Bio I covers versus upper-level courses) and the 50% for exam credit are the planner's estimates.
        </p>
      </section>

    </div>
  );
}
