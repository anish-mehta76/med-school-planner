import { useMemo } from 'react';
import { setState, uid, useStore } from '../store/useStore';
import { analyze } from './engine';
import { samplePlanner } from './scenarios';
import type { PlannerState, Scenario } from './types';

// Built once so item ids stay stable until the first edit saves it.
let samples: PlannerState | undefined;
const sampleOnce = () => (samples ??= samplePlanner());

export function updatePlanner(f: (p: PlannerState) => PlannerState) {
  setState((s) => ({ ...s, planner: f(s.planner ?? sampleOnce()) }));
}

export function usePlanner() {
  const planner = useStore().planner ?? sampleOnce();
  const active = planner.scenarios.find((x) => x.id === planner.activeId) ?? planner.scenarios[0];
  const analysis = useMemo(() => analyze(active), [active]);

  const updateScenario = (f: (s: Scenario) => Scenario) =>
    updatePlanner((p) => ({ ...p, scenarios: p.scenarios.map((x) => (x.id === active.id ? f(x) : x)) }));

  const addScenario = (s: Omit<Scenario, 'id'>) => {
    const id = uid();
    updatePlanner((p) => ({ scenarios: [...p.scenarios, { ...s, id }], activeId: id }));
  };

  return { planner, active, analysis, updateScenario, addScenario };
}

export function resetPlanner() {
  samples = samplePlanner();
  setState((s) => ({ ...s, planner: samples }));
}
