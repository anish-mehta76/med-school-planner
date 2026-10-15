import { MENTORS } from './mentors';
import { NYC_PROGRAMS } from './nycPrograms';

/** True only on a local checkout that has the private tracker data. */
export const HAS_RESEARCH_DATA = MENTORS.length > 0 || NYC_PROGRAMS.length > 0;
