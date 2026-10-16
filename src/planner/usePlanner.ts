import { useMemo, useSyncExternalStore } from 'react';
import { setState, useStore } from '../store/useStore';
import { analyze } from './engine';
import { blankPlanner } from './scenarios';
import { liveVersion, subscribeLive } from './live';
import type { PlannerState, Scenario } from './types';

// Built once so ids stay stable until the first edit saves it.
let blank: PlannerState | undefined;
const blankOnce = () => (blank ??= blankPlanner());

export function updatePlanner(f: (p: PlannerState) => PlannerState) {
  setState((s) => ({ ...s, planner: f(s.planner ?? blankOnce()) }));
}

export function usePlanner() {
  const planner = useStore().planner ?? blankOnce();
  const active = planner.scenarios.find((x) => x.id === planner.activeId) ?? planner.scenarios[0];
  // Re-run the analysis when live SIS course data arrives.
  const live = useSyncExternalStore(subscribeLive, liveVersion);
  const analysis = useMemo(() => analyze(active), [active, live]);

  const updateScenario = (f: (s: Scenario) => Scenario) =>
    updatePlanner((p) => ({ ...p, scenarios: p.scenarios.map((x) => (x.id === active.id ? f(x) : x)) }));

  return { active, analysis, live, updateScenario };
}

/** Clears your plan: no courses, no majors. */
export function startOver() {
  blank = blankPlanner();
  setState((s) => ({ ...s, planner: blank }));
}
