import type { AppState, Experience } from '../types';
import { defaultState, localDate, uid } from '../store/useStore';

/** Example profile so you can see how the planner behaves before entering your own data. */
export function sampleState(): AppState {
  const s = defaultState();
  const y = new Date().getFullYear();
  const exp = (p: Partial<Experience>): Experience => ({
    id: uid(),
    title: '',
    organization: '',
    category: 'other',
    startDate: `${y - 1}-09-01`,
    ongoing: false,
    baseHours: 0,
    logs: [],
    description: '',
    meaningful: false,
    underserved: false,
    ...p,
  });
  const logs = (n: number, hours: number) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i * 7 - 1);
      return { id: uid(), date: localDate(d), hours };
    });

  return {
    ...s,
    profile: { name: 'Sample Student', school: 'State University', gradYear: y + 2, applicationYear: y + 1 },
    academics: { ...s.academics, gpa: 3.72, scienceGpa: 3.65, mcatTarget: 515 },
    experiences: [
      exp({
        title: 'Emergency department volunteer',
        organization: 'City General Hospital',
        category: 'clinical-volunteer',
        startDate: `${y - 1}-01-15`,
        ongoing: true,
        hoursPerWeek: 4,
        baseHours: 120,
        logs: logs(6, 4),
        description: 'Assist ED staff with patient transport, room turnover and comfort rounds.',
      }),
      exp({ title: 'Shadowed orthopedic surgeon', organization: 'Ortho Associates', category: 'shadowing', specialty: 'Orthopedic surgery', startDate: `${y - 1}-06-01`, endDate: `${y - 1}-07-31`, baseHours: 32 }),
      exp({
        title: 'Undergraduate researcher, neurobiology lab',
        organization: 'State University',
        category: 'research',
        startDate: `${y - 1}-09-01`,
        ongoing: true,
        hoursPerWeek: 10,
        baseHours: 280,
        logs: logs(4, 10),
        meaningful: true,
      }),
      exp({ title: 'Habitat for Humanity build days', organization: 'Habitat Campus Chapter', category: 'nonclinical-volunteer', startDate: `${y - 1}-03-01`, endDate: `${y - 1}-05-01`, baseHours: 30 }),
      exp({ title: 'Organic chemistry tutor', organization: 'Learning Center', category: 'teaching', startDate: `${y}-01-10`, ongoing: true, hoursPerWeek: 3, baseHours: 60 }),
    ],
  };
}
