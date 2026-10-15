import type { AppState, Experience, Mentor, ResearchOutput } from '../types';
import { localDate, uid } from '../store/useStore';

/** Creates a research Experience and a placeholder output for a mentor you joined, and links them. */
export function joinMentor(state: AppState, m: Mentor): AppState {
  const exp: Experience = {
    id: uid(),
    title: `Undergraduate researcher, ${m.name} lab`,
    organization: m.institution.text,
    category: 'research',
    startDate: localDate(),
    ongoing: true,
    baseHours: 0,
    logs: [],
    contactName: m.name,
    contactEmail: m.email,
    description: '',
    meaningful: false,
    underserved: false,
  };
  const output: ResearchOutput = {
    id: uid(),
    type: 'abstract',
    title: `Project with ${m.name} lab (placeholder — rename when the project is defined)`,
    venue: '',
    status: 'in-prep',
    experienceId: exp.id,
  };
  return {
    ...state,
    experiences: [...state.experiences, exp],
    outputs: [...state.outputs, output],
    outreach: { ...state.outreach, [m.id]: { ...state.outreach[m.id], status: 'joined', experienceId: exp.id } },
  };
}
