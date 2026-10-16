import type { PlanItem, PlannerState, Scenario } from './types';
import { autofill, newItemId } from './engine';
import { MAJOR_BY_ID } from './majors';

/*
 * The spec's sample plans (sections 7 and 7b). They are test fixtures now: the app
 * itself starts everyone from a blank plan.
 */

/** Builds plan items from "term: code code code" rows. PH.BSPH and other catalog credits apply. */
function plan(rows: Record<string, string>): PlanItem[] {
  return Object.entries(rows).flatMap(([termId, codes]) => codes.split(/\s+/).filter(Boolean).map((code) => ({ id: newItemId(), code, termId })));
}

const Y1_FALL = 'AS.001.1XX AS.030.101 AS.030.105 AS.110.108 AS.280.101';

/** Spec section 7: Chemistry BS + Public Health BA, 130 credits. Fall 2026 is a placeholder. */
export function chemPhs(): Scenario {
  return {
    id: 'chem-phs',
    name: 'Sample: Chem BS + PHS BA',
    sample: true,
    majorIds: ['chem', 'phs'],
    premed: false,
    mcatAfterTermId: 'S29',
    plan: plan({
      F26: Y1_FALL,
      S27: 'AS.030.102 AS.030.106 AS.110.109 AS.004.101 AS.140.105 AS.280.380',
      F27: 'AS.030.205 AS.030.227 AS.171.101 AS.173.111 AS.280.345',
      S28: 'AS.030.206 AS.030.228 AS.171.102 AS.173.112 AS.180.102',
      F28: 'AS.030.301 AS.030.246 AS.280.240 AS.280.335 AS.020.303',
      S29: 'AS.030.302 AS.030.307 AS.280.340 AS.280.350 AS.280.355',
      U29: 'AS.280.500',
      F29: 'AS.030.449 AS.020.305 AS.020.315 AS.020.304 PH.BSPH',
      S30: 'AS.030.356 AS.020.306 AS.280.347 AS.180.289 PH.BSPH',
    }),
  };
}

/** Spec section 7b: Chem BS + PHS BA + pre-med, 133 credits, MCAT after Spring 2029. */
export function chemPhsPremed(): Scenario {
  return {
    id: 'chem-phs-premed',
    name: 'Sample: Chem BS + PHS BA + Pre-med',
    sample: true,
    majorIds: ['chem', 'phs'],
    premed: true,
    mcatAfterTermId: 'S29',
    plan: plan({
      F26: Y1_FALL,
      S27: 'AS.030.102 AS.030.106 AS.110.109 AS.004.101 AS.200.101 AS.280.380',
      F27: 'AS.030.205 AS.030.227 AS.171.101 AS.173.111 AS.280.345',
      S28: 'AS.030.206 AS.030.228 AS.171.102 AS.173.112 AS.230.101 AS.280.347',
      F28: 'AS.030.301 AS.030.246 AS.020.305 AS.280.240 AS.280.335',
      S29: 'AS.030.302 AS.030.307 AS.280.340 AS.280.350 AS.280.355',
      U29: 'AS.280.500',
      F29: 'AS.030.449 AS.020.303 AS.020.306 AS.020.316 AS.020.315 PH.BSPH',
      S30: 'AS.030.356 AS.020.304 AS.020.340 AS.280.314 PH.BSPH',
    }),
  };
}

/** Spanish BA auto-filled onto the default plan (placement waiver on). */
export function chemPhsSpanish(now = new Date()): Scenario {
  const base = chemPhs();
  return { ...base, id: 'chem-phs-spanish', name: 'Sample: Chem + PHS + Spanish (draft)', majorIds: [...base.majorIds, 'span'], plan: autofill(base.plan, MAJOR_BY_ID.span, undefined, now).plan };
}

export function samplePlanner(now = new Date()): PlannerState {
  return { scenarios: [chemPhs(), chemPhsSpanish(now), chemPhsPremed()], activeId: 'chem-phs' };
}

/** What a new visitor starts with: one empty plan. */
export function blankScenario(id = 'my-plan'): Scenario {
  return { id, name: 'My plan', majorIds: [], plan: [], premed: false, mcatAfterTermId: 'S29' };
}

export function blankPlanner(): PlannerState {
  return { scenarios: [blankScenario()], activeId: 'my-plan' };
}
