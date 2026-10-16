import type { Course, Major, Matcher, PlanItem, Requirement, Resolved, Scenario, Term } from './types';
import { COURSE, deptOf, isPublished } from './catalog';
import { currentTermId, FINAL_YEAR, SEMESTERS, TERM_BY_ID, TERMS, termOrd } from './terms';
import { ENGLISH_WS_UWP, MAJOR_BY_ID, numOf, MCAT_HELPFUL, MCAT_RELEVANT, PHS_CORE, PREMED, PREMED_SCIENCE } from './majors';

// ── Resolving plan items ───────────────────────────────────────────────────

/** Course credits: instance override → catalog credits → 3. */
export function resolve(plan: PlanItem[]): Resolved[] {
  return plan
    .map((item, i) => {
      const course: Course | undefined = COURSE[item.code];
      const t = TERM_BY_ID[item.termId] ?? TERMS[0];
      return {
        r: {
          item,
          code: item.code,
          title: item.title ?? course?.title ?? 'Custom course',
          credits: item.credits ?? course?.credits ?? 3,
          ord: t.ord,
          season: t.season,
          course,
          fa: item.fa ?? course?.fa ?? [],
        } satisfies Resolved,
        i,
      };
    })
    .sort((a, b) => a.r.ord - b.r.ord || a.i - b.i)
    .map((x) => x.r);
}

export function matches(m: Matcher, r: Resolved): boolean {
  if (typeof m === 'string') return r.code === m;
  if (m instanceof RegExp) return m.test(r.code) || m.test(r.code.replace(/X/g, '0'));
  return m(r);
}

/**
 * Whether a course runs in a term. Once SIS has posted that term's schedule, the real
 * sections decide; before that, the fall/spring-only pattern does (undefined = unknown).
 */
export function offeredIn(c: Course | undefined, t: Term): boolean | undefined {
  if (!c || t.season === 'PRE') return true;
  if (c.offered && isPublished(t.sisName)) return c.offered.includes(t.sisName!);
  if (c.term) return t.season === c.term;
  return t.season === 'F' || t.season === 'S' ? true : undefined;
}

const sum = (xs: Resolved[]) => xs.reduce((n, r) => n + r.credits, 0);
const isRepeatable = (code: string) => !!(COURSE[code]?.placeholder || COURSE[code]?.repeatable);

// ── Requirement engine ─────────────────────────────────────────────────────

export type ReqStatus = 'done' | 'partial' | 'missing' | 'note' | 'waived';

export interface ReqResult {
  req: Requirement;
  status: ReqStatus;
  items: Resolved[];
  /** 0–1 toward this requirement. */
  progress: number;
  /** Codes still needed (set requirements). */
  missing: string[];
  detail?: string;
}

export interface MajorResult {
  major: Major;
  reqs: ReqResult[];
  /** Plan item ids counted toward this major. */
  claimed: Set<string>;
  credits: number;
  pct: number;
}

export function waiverKey(majorId: string, reqKey: string) {
  return `${majorId}:${reqKey}`;
}

export function isWaived(major: Major, req: Requirement, waivers: Scenario['waivers']) {
  return !!req.waivable && (waivers?.[waiverKey(major.id, req.key)] ?? true);
}

/** Finds, for one option, an unused item per code. */
function findOption(option: string[], pool: Resolved[], used: Set<string>) {
  const found: Resolved[] = [];
  const missing: string[] = [];
  for (const code of option) {
    const r = pool.find((x) => x.code === code && !used.has(x.item.id) && !found.includes(x));
    if (r) found.push(r);
    else missing.push(code);
  }
  return { found, missing };
}

function evalReq(req: Requirement, all: Resolved[], claimed: Set<string>): ReqResult {
  const pool = all.filter((r) => !claimed.has(r.item.id) && !(req.noExam && r.season === 'PRE'));
  const base = { req, missing: [] as string[] };

  if (req.type === 'note') {
    const items = req.from ? all.filter((r) => req.from!.some((m) => matches(m, r))) : [];
    return { ...base, status: 'note', items, progress: 0 };
  }

  if (req.type === 'set') {
    const need = req.n ?? 1;
    const used = new Set<string>();
    const items: Resolved[] = [];
    const doneOpts = new Set<number>();
    for (let k = 0; k < need; k++) {
      const i = req.options.findIndex((o, j) => !doneOpts.has(j) && findOption(o, pool, used).missing.length === 0);
      if (i < 0) break;
      doneOpts.add(i);
      for (const r of findOption(req.options[i], pool, used).found) {
        used.add(r.item.id);
        items.push(r);
      }
    }
    if (doneOpts.size >= need) return { ...base, status: 'done', items, progress: 1 };
    // Best partial option: most codes found, then first listed.
    let best = { i: -1, found: [] as Resolved[], missing: req.options[0] };
    req.options.forEach((o, i) => {
      if (doneOpts.has(i)) return;
      const f = findOption(o, pool, used);
      if (best.i < 0 || f.found.length > best.found.length) best = { i, ...f };
    });
    items.push(...best.found);
    const part = best.found.length / (best.found.length + best.missing.length);
    const progress = (doneOpts.size + part) / need;
    return { ...base, status: items.length ? 'partial' : 'missing', items, progress, missing: best.missing };
  }

  const cands = pool.filter((r) => req.from.some((m) => matches(m, r)) && r.credits >= (req.minPerCourse ?? 0));

  if (req.type === 'pick') {
    const items: Resolved[] = [];
    const depts = new Set<string>();
    const minCr = req.minCredits ?? 0;
    for (const r of cands) {
      if (items.length >= req.n && sum(items) >= minCr) break;
      if (req.distinctDept && depts.has(deptOf(r.code))) continue;
      items.push(r);
      depts.add(deptOf(r.code));
    }
    const countPart = Math.min(1, items.length / req.n);
    const progress = minCr ? (countPart + Math.min(1, sum(items) / minCr)) / 2 : countPart;
    return { ...base, status: progress >= 1 ? 'done' : items.length ? 'partial' : 'missing', items, progress };
  }

  // cred
  const items: Resolved[] = [];
  for (const r of cands) {
    if (sum(items) >= req.credits) break;
    items.push(r);
  }
  const progress = Math.min(1, sum(items) / req.credits);
  return { ...base, status: progress >= 1 ? 'done' : items.length ? 'partial' : 'missing', items, progress, detail: `${sum(items)} of ${req.credits} credits` };
}

export function evaluate(major: Major, all: Resolved[], waivers?: Scenario['waivers']): MajorResult {
  const claimed = new Set<string>();
  const reqs = major.requirements.map((req) => {
    if (isWaived(major, req, waivers)) return { req, status: 'waived', items: [], progress: 1, missing: [], detail: 'Waived (placement)' } satisfies ReqResult;
    const r = evalReq(req, all, claimed);
    if (r.status !== 'note') r.items.forEach((x) => claimed.add(x.item.id));
    return r;
  });
  if (major.id === PREMED.id) premedChecks(reqs);
  const counted = reqs.filter((r) => r.status !== 'note' && r.status !== 'waived');
  const pct = counted.length ? counted.reduce((n, r) => n + r.progress, 0) / counted.length : 1;
  return { major, reqs, claimed, credits: sum(all.filter((r) => claimed.has(r.item.id))), pct };
}

/** Writing and social-science checks that only downgrade an otherwise complete item. */
function premedChecks(reqs: ReqResult[]) {
  for (const r of reqs) {
    if (r.status !== 'done') continue;
    if (r.req.key === 'writing' && !r.items.some((x) => ENGLISH_WS_UWP.test(x.code))) {
      r.status = 'partial';
      r.progress = 0.75;
      r.detail = 'Neither is from English, Writing Seminars or the University Writing Program. Adding one fixes this and may help Culture & Aesthetics (FA3) too.';
    }
    if (r.req.key === 'sbs' && !(r.items.some((x) => x.code === 'AS.200.101') && r.items.some((x) => x.code === 'AS.230.101'))) {
      r.status = 'partial';
      r.progress = 0.75;
      r.detail = 'Counts, but Intro Psychology (AS.200.101) + Intro Sociology (AS.230.101) are recommended for the MCAT.';
    }
  }
}

export interface ScenarioAnalysis {
  resolved: Resolved[];
  results: MajorResult[];
  premed?: MajorResult;
  /** Major ids each plan item counts toward (pre-med included as "premed"). */
  countsFor: Map<string, string[]>;
  doubleCredits: number;
  total: number;
  jhuCredits: number;
  externalCredits: number;
  termCredits: Record<string, number>;
  flags: Flag[];
  fa: FaRow[];
}

export function analyze(s: Scenario, now = new Date()): ScenarioAnalysis {
  const resolved = resolve(s.plan);
  const results = s.majorIds.map((id) => MAJOR_BY_ID[id]).filter(Boolean).map((m) => evaluate(m, resolved, s.waivers));
  const premed = s.premed ? evaluate(PREMED, resolved) : undefined;
  const countsFor = new Map<string, string[]>();
  for (const res of [...results, ...(premed ? [premed] : [])])
    for (const id of res.claimed) countsFor.set(id, [...(countsFor.get(id) ?? []), res.major.id]);
  const doubleCredits = sum(resolved.filter((r) => (countsFor.get(r.item.id) ?? []).filter((m) => m !== PREMED.id).length > 1));
  const termCredits: Record<string, number> = {};
  for (const r of resolved) termCredits[r.item.termId] = (termCredits[r.item.termId] ?? 0) + r.credits;
  const externalCredits = termCredits.PRE ?? 0;
  const jhuCredits = sum(resolved) - externalCredits;
  const total = jhuCredits + Math.min(20, externalCredits);
  const a: ScenarioAnalysis = { resolved, results, premed, countsFor, doubleCredits, total, jhuCredits, externalCredits, termCredits, flags: [], fa: faTracker(resolved) };
  a.flags = validate(s, a, now);
  return a;
}

// ── Foundational Abilities ─────────────────────────────────────────────────

export const FA_INFO: { id: string; label: string; required: number }[] = [
  { id: 'FA1', label: 'Writing & Communication', required: 15 },
  { id: 'FA2', label: 'Science & Data', required: 15 },
  { id: 'FA3', label: 'Culture & Aesthetics', required: 15 },
  { id: 'FA4', label: 'Citizens & Society', required: 15 },
  { id: 'FA4.1', label: 'Democracy (part of FA4)', required: 3 },
  { id: 'FA5', label: 'Ethics & Foundations', required: 15 },
  { id: 'FA6', label: 'Projects & Methods', required: 6 },
];

export interface FaRow {
  id: string;
  label: string;
  required: number;
  verified: number;
  estimated: number;
  courses: { r: Resolved; estimated: boolean }[];
}

/**
 * KSAS counting rule: FA1 and FA6 always count; among FA2–FA5 a course counts toward one,
 * assigned to whichever has the largest remaining need. FA4.1 courses go to FA4 and FA4.1.
 * Exam credit and First-Year Seminars carry no FA; FA1 needs a letter grade.
 */
export function faTracker(all: Resolved[]): FaRow[] {
  const rows = new Map(FA_INFO.map((f) => [f.id, { ...f, verified: 0, estimated: 0, courses: [] as FaRow['courses'] }]));
  const add = (id: string, r: Resolved, est: boolean) => {
    const row = rows.get(id)!;
    if (est) row.estimated += r.credits;
    else row.verified += r.credits;
    row.courses.push({ r, estimated: est });
  };
  const tagsOf = (r: Resolved) => r.fa.map((t) => ({ id: t.replace('?', ''), est: t.endsWith('?') }));
  const eligible = all.filter((r) => r.season !== 'PRE' && !r.code.startsWith('AS.001.') && r.fa.length);
  const choices = (r: Resolved) => tagsOf(r).filter((t) => ['FA2', 'FA3', 'FA4', 'FA5'].includes(t.id));
  const remaining = (id: string) => {
    const row = rows.get(id)!;
    return row.required - row.verified - row.estimated;
  };

  for (const r of [...eligible].sort((a, b) => choices(a).length - choices(b).length || a.ord - b.ord)) {
    const tags = tagsOf(r);
    for (const t of tags) if ((t.id === 'FA1' && !r.item.su) || t.id === 'FA6') add(t.id, r, t.est);
    const d41 = tags.find((t) => t.id === 'FA4.1');
    if (d41) {
      add('FA4', r, d41.est);
      add('FA4.1', r, d41.est);
      continue;
    }
    const opts = choices(r);
    if (!opts.length) continue;
    const pick = opts.reduce((best, t) => (remaining(t.id) > remaining(best.id) ? t : best));
    add(pick.id, r, pick.est);
  }
  return [...rows.values()];
}

// ── Validation flags ───────────────────────────────────────────────────────

export interface Flag {
  level: 'error' | 'warn' | 'info';
  text: string;
  itemId?: string;
  termId?: string;
  /** The rule behind it is unconfirmed. */
  verify?: boolean;
  premed?: boolean;
}

const SEASON_NAME = { F: 'fall', S: 'spring' } as const;
const label = (r: Resolved) => `${r.code} ${r.title}`;

function validate(s: Scenario, a: ScenarioAnalysis, now: Date): Flag[] {
  const flags: Flag[] = [];
  const { resolved: all } = a;
  const ordOfCode = (code: string) => all.filter((r) => r.code === code).map((r) => r.ord);

  for (const r of all) {
    const c = r.course;
    const term = TERM_BY_ID[r.item.termId];
    if (term && offeredIn(c, term) === false) {
      const text = isPublished(term.sisName)
        ? `${label(r)} isn't on the SIS schedule for ${term.label}.`
        : `${label(r)} is offered only in ${SEASON_NAME[c!.term!]}; it's planned for ${term.label}.`;
      flags.push({ level: 'warn', itemId: r.item.id, termId: r.item.termId, text });
    }

    const last = c?.lastOffered?.match(/(\d{4})$/)?.[1];
    if (last && Number(last) < now.getFullYear() - 1)
      flags.push({ level: 'info', itemId: r.item.id, termId: r.item.termId, text: `${r.code} hasn't been offered since ${c!.lastOffered} (SIS).` });

    if (c?.prereqs && r.season !== 'PRE') {
      for (const group of c.prereqs) {
        const ords = group.flatMap(ordOfCode);
        const seq = c.seqOnly ? ' (planning sequence; confirm in SIS)' : '';
        const names = group.join(' or ');
        if (!ords.length) flags.push({ level: c.seqOnly ? 'info' : 'warn', itemId: r.item.id, termId: r.item.termId, text: `${r.code} needs ${names} first, but it isn't in the plan${seq}.` });
        else if (!ords.some((o) => o < r.ord)) flags.push({ level: c.seqOnly ? 'info' : 'warn', itemId: r.item.id, termId: r.item.termId, text: `${r.code} needs ${names} in an earlier term; it's planned for the same term or later${seq}.` });
      }
    }

    if (r.code.startsWith('PH.')) {
      if (!FINAL_YEAR.includes(r.item.termId))
        flags.push({ level: 'error', itemId: r.item.id, termId: r.item.termId, text: 'BSPH courses must be in your final academic year (Fall 2029 or Spring 2030), not in summer or winter.' });
      const notBefore = PHS_CORE.filter((code) => !ordOfCode(code).some((o) => o < r.ord));
      if (notBefore.length)
        flags.push({ level: 'error', itemId: r.item.id, termId: r.item.termId, text: `BSPH courses come after all six PHS core courses. Not done before ${TERM_BY_ID[r.item.termId]?.label}: ${notBefore.join(', ')}.` });
    }

    if (r.item.su && (a.countsFor.get(r.item.id) ?? []).some((m) => m !== PREMED.id))
      flags.push({ level: 'warn', itemId: r.item.id, termId: r.item.termId, text: `${r.code} is marked S/U, but major courses must be letter-graded.` });
  }

  const seen = new Map<string, number>();
  for (const r of all) if (!isRepeatable(r.code)) seen.set(r.code, (seen.get(r.code) ?? 0) + 1);
  for (const [code, n] of seen) if (n > 1) flags.push({ level: 'warn', text: `${code} is in the plan ${n} times.` });

  for (const t of TERMS) {
    const cr = a.termCredits[t.id] ?? 0;
    if (t.season !== 'PRE' && cr >= 18)
      flags.push({ level: 'warn', termId: t.id, verify: true, text: `${t.label} has ${cr} credits. Check the per-term credit limit with your advisor.` });
  }

  if (a.total < 120) flags.push({ level: 'warn', text: `The plan has ${a.total} counted credits; a KSAS bachelor's degree needs at least 120.` });
  if (a.externalCredits > 20) flags.push({ level: 'info', termId: 'PRE', text: `${a.externalCredits} exam/transfer credits planned, but only 20 count toward the 120.` });
  if (a.jhuCredits < 100) flags.push({ level: 'warn', text: `Only ${a.jhuCredits} credits at JHU; at least 100 are required.` });

  if (!all.some((r) => r.code.startsWith('AS.001.') && r.item.termId === 'F26'))
    flags.push({ level: 'info', termId: 'F26', text: 'First-Year Foundation: plan a First-Year Seminar (AS.001.xxx) in Fall 2026.' });
  if (!all.some((r) => r.code === 'AS.004.101' && r.ord >= 0 && r.ord <= 1))
    flags.push({ level: 'info', text: 'First-Year Foundation: AS.004.101 Reintroduction to Writing belongs in your first year (letter grade, C- or better).' });

  if (s.premed && a.premed) flags.push(...premedFlags(s, a));
  return flags;
}

function premedFlags(s: Scenario, a: ScenarioAnalysis): Flag[] {
  const flags: Flag[] = [];
  const all = a.resolved;
  const mcatId = s.mcatAfterTermId ?? 'S29';
  const mcatOrd = termOrd(mcatId);
  const mcatLabel = TERM_BY_ID[mcatId]?.label ?? mcatId;
  const premedIds = a.premed!.claimed;

  for (const r of all) {
    if (r.item.su && premedIds.has(r.item.id))
      flags.push({ level: 'warn', premed: true, itemId: r.item.id, text: `${r.code} is marked S/U; pre-med courses need a letter grade (C or better).` });
    if (r.season === 'U' && PREMED_SCIENCE.test(r.code))
      flags.push({ level: 'warn', premed: true, itemId: r.item.id, termId: r.item.termId, text: `${r.code} is a pre-med science course in a summer term. JHU advises taking prerequisites during the academic year.` });
    if (r.ord > mcatOrd && MCAT_RELEVANT.some((m) => matches(m, r)))
      flags.push({ level: 'warn', premed: true, itemId: r.item.id, termId: r.item.termId, text: `${label(r)} is MCAT content but lands after your MCAT (after ${mcatLabel}).` });
    if (r.ord > mcatOrd && MCAT_HELPFUL.includes(r.code))
      flags.push({ level: 'info', premed: true, itemId: r.item.id, termId: r.item.termId, text: `${label(r)} is MCAT-helpful but scheduled after your test date.` });
  }

  const summers = new Set(all.filter((r) => r.season === 'U').map((r) => r.item.termId));
  if (summers.size > 1) flags.push({ level: 'warn', premed: true, text: `Coursework in ${summers.size} summers. Medical schools look closely at heavy summer course loads.` });

  const areas: [string, RegExp][] = [
    ['chemistry', /^AS\.030\./],
    ['biology', /^AS\.(020|250)\./],
    ['physics', /^AS\.17[13]\./],
  ];
  for (const [name, re] of areas) {
    const exam = all.filter((r) => r.season === 'PRE' && re.test(r.code));
    if (exam.length && !all.some((r) => r.season !== 'PRE' && re.test(r.code)))
      flags.push({ level: 'warn', premed: true, termId: 'PRE', text: `You have exam credit in ${name}. Medical schools expect at least one more JHU course in that area.` });
  }
  if (all.some((r) => r.season === 'PRE' && /^AS\.020\./.test(r.code)))
    flags.push({ level: 'info', premed: true, termId: 'PRE', text: 'AP Biology is in your exam lane: you still need two JHU biology courses with labs.' });

  if (a.total >= 130)
    flags.push({
      level: 'info',
      premed: true,
      text: `Pre-med squeeze: ${a.total} credits with few free slots. Levers: AP credit (Calculus, Chemistry), non-science courses in summer, courses that fill a major slot and an FA or pre-med slot at once, or a gap year.`,
    });
  return flags;
}

// ── Auto-fill ──────────────────────────────────────────────────────────────

const MAX_TERM_CREDITS = 17;
const UPPER_PLACEHOLDERS = ['BIOLUL', 'RES-BIO', 'NEUR-FOCUS', 'NEUR-OUT'];
let seq = 0;
export const newItemId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Codes to add so one requirement is met, using its `fill` list or its cheapest option. */
function neededFor(r: ReqResult, inPlan: Set<string>, planned: string[]): string[] {
  const req = r.req;
  const free = (code: string) => isRepeatable(code) || (!inPlan.has(code) && !planned.includes(code));
  const credits = (code: string) => COURSE[code]?.credits ?? 3;

  if (req.type === 'set') {
    const have = (code: string) => r.items.some((x) => x.code === code);
    const complete = req.options.filter((o) => o.every(have)).length;
    // Options not yet complete, as the codes each still needs: partly done first, then cheapest.
    const open = req.options
      .filter((o) => !o.every(have))
      .map((o) => ({ found: o.filter(have).length, missing: o.filter((code) => !have(code)) }))
      .filter((o) => o.missing.every(free))
      .sort((x, y) => y.found - x.found || x.missing.reduce((n, c) => n + credits(c), 0) - y.missing.reduce((n, c) => n + credits(c), 0));
    const out: string[] = [];
    for (const o of open.slice(0, Math.max(0, (req.n ?? 1) - complete))) out.push(...o.missing.filter((c) => !out.includes(c)));
    return out;
  }
  if (req.type === 'pick' || req.type === 'cred') {
    const out: string[] = [];
    let count = r.items.length;
    let cr = r.items.reduce((n, x) => n + x.credits, 0);
    const depts = new Set(r.items.map((x) => deptOf(x.code)));
    const done = () => (req.type === 'pick' ? count >= req.n && cr >= (req.minCredits ?? 0) : cr >= req.credits);
    for (const code of req.fill ?? []) {
      if (done()) break;
      if (!free(code) || (!isRepeatable(code) && out.includes(code))) continue;
      if (req.type === 'pick' && req.distinctDept && depts.has(deptOf(code))) continue;
      out.push(code);
      count++;
      cr += credits(code);
      depts.add(deptOf(code));
    }
    return out;
  }
  return [];
}

/** Adds missing prerequisites (first listed alternative), recursively. */
function withPrereqs(codes: string[], inPlan: Set<string>): string[] {
  const out = [...codes];
  const have = (code: string) => inPlan.has(code) || out.includes(code);
  for (let i = 0; i < out.length; i++) {
    for (const group of COURSE[out[i]]?.prereqs ?? []) {
      if (group.some(have)) continue;
      const pick = group.find((g) => COURSE[g]);
      if (pick) out.push(pick);
    }
  }
  return out;
}

/** Orders codes so prerequisites come first. */
function prereqOrder(codes: string[]): string[] {
  const depth = new Map<string, number>();
  const d = (code: string, stack: string[] = []): number => {
    if (depth.has(code)) return depth.get(code)!;
    if (stack.includes(code)) return 0;
    const pre = (COURSE[code]?.prereqs ?? []).flat().filter((p) => codes.includes(p));
    const v = pre.length ? 1 + Math.max(...pre.map((p) => d(p, [...stack, code]))) : 0;
    depth.set(code, v);
    return v;
  };
  return codes.map((c, i) => ({ c, i, d: d(c) })).sort((a, b) => a.d - b.d || a.i - b.i).map((x) => x.c);
}

/** Earliest valid semester for a code: offered then, prereqs earlier, ≤17 credits; else the lightest valid one. */
export function placeTerm(code: string, plan: PlanItem[], now = new Date()): string {
  const c = COURSE[code];
  const cur = termOrd(currentTermId(now));
  const resolved = resolve(plan);
  const load = (id: string) => resolved.filter((r) => r.item.termId === id).reduce((n, r) => n + r.credits, 0);
  const prereqOk = (ord: number) => (c?.prereqs ?? []).every((g) => resolved.some((r) => g.includes(r.code) && r.ord < ord));
  const coreOk = (ord: number) => !code.startsWith('PH.') || PHS_CORE.every((p) => resolved.some((r) => r.code === p && r.ord < ord));
  // Planning heuristic beyond the spec: 300-level and higher courses wait until sophomore year.
  const upper = numOf(code) >= 300 || UPPER_PLACEHOLDERS.includes(code);
  const earliest = Math.max(cur + 1, upper ? 2 : 0);
  const future = SEMESTERS.filter((t) => t.ord >= earliest && (!code.startsWith('PH.') || FINAL_YEAR.includes(t.id)));
  const offered = future.filter((t) => offeredIn(c, t) !== false);
  const valid = offered.filter((t) => prereqOk(t.ord) && coreOk(t.ord));
  const credits = c?.credits ?? 3;
  const roomy = valid.find((t) => load(t.id) + credits <= MAX_TERM_CREDITS);
  const lightest = (ts: typeof SEMESTERS) => ts.reduce((best, t) => (load(t.id) < load(best.id) ? t : best));
  if (roomy) return roomy.id;
  if (valid.length) return lightest(valid).id;
  if (offered.length) return offered[offered.length - 1].id;
  return future[future.length - 1]?.id ?? 'S30';
}

export interface AutofillResult {
  plan: PlanItem[];
  added: PlanItem[];
  addedCredits: number;
  /** Requirements auto-fill couldn't complete. */
  unresolved: string[];
}

/** Adds a major's missing courses (and their prerequisites) to a plan. */
export function autofill(plan: PlanItem[], major: Major, waivers?: Scenario['waivers'], now = new Date()): AutofillResult {
  let next = [...plan];
  const added: PlanItem[] = [];
  for (let round = 0; round < 6; round++) {
    const res = evaluate(major, resolve(next), waivers);
    const inPlan = new Set(next.map((p) => p.code));
    const planned: string[] = [];
    for (const r of res.reqs) if (r.status === 'partial' || r.status === 'missing') planned.push(...neededFor(r, inPlan, planned));
    if (!planned.length) break;
    for (const code of prereqOrder(withPrereqs(planned, inPlan))) {
      const item: PlanItem = { id: newItemId(), code, termId: placeTerm(code, next, now), addedByAutofill: true };
      next = [...next, item];
      added.push(item);
    }
  }
  const final = evaluate(major, resolve(next), waivers);
  return {
    plan: next,
    added,
    addedCredits: resolve(added).reduce((n, r) => n + r.credits, 0),
    unresolved: final.reqs.filter((r) => r.status === 'partial' || r.status === 'missing').map((r) => r.req.label),
  };
}

/** For each pair (A, B): credits of A's auto-filled standard path that also count for B. */
export function overlapMatrix(majors: Major[], now = new Date()): number[][] {
  const paths = majors.map((a) => resolve(autofill([], a, undefined, now).plan));
  return majors.map((_, i) => majors.map((b, j) => (i === j ? NaN : evaluate(b, paths[i]).credits)));
}
