import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { applicationDeadline, findGaps, monthsUntil, scoreAreas } from './gaps';
import { rankOpportunities, suggestMentors } from './recommend';
import { OPPORTUNITIES } from '../data/opportunities';
import { mentorsOf } from '../data/researchData';

export function useAnalysis() {
  const state = useStore();
  return useMemo(() => {
    const now = new Date();
    const areas = scoreAreas(state, now);
    const gaps = findGaps(state, now);
    const ranked = rankOpportunities(OPPORTUNITIES, areas, gaps, now);
    const months = monthsUntil(applicationDeadline(state), now);
    const mentorSuggestions = suggestMentors(mentorsOf(state), areas, gaps, state);
    return { state, areas, gaps, ranked, months, mentorSuggestions };
  }, [state]);
}
