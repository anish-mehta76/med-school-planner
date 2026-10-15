import type { Mentor } from '../types';
import { MENTORS } from '../data/mentors';

/** Fictional mentors for tests, so CI passes without the local-only tracker data. */
export const cited = (text: string) => ({ text, links: [] });

export function mentor(p: Partial<Mentor> = {}): Mentor {
  return {
    id: 'RX',
    priority: 'Start',
    name: 'Jane Q. Doe',
    institution: cited('Johns Hopkins, Baltimore'),
    diseaseFit: cited('Endometrial cancer'),
    strength: cited('Tumor characterization'),
    publications: [],
    contact: cited(''),
    evidenceGate: '',
    lastVerified: '2026-10-12',
    undergradOpening: cited('Unverified'),
    mentorshipEvidence: cited('Unverified'),
    ...p,
  };
}

const SAMPLE: Mentor[] = [
  mentor({ id: 'T01', name: 'Alex Doe', diseaseFit: cited('Endometrial cancer cohort'), mentorshipEvidence: cited('Lists 3 undergraduate co-authors') }),
  mentor({ id: 'T02', name: 'Sam Roe', diseaseFit: cited('Cervical cancer screening trial'), institution: cited('NCI, Rockville') }),
  mentor({ id: 'T03', name: 'Pat Poe', diseaseFit: cited('Ovarian and gynecologic pathology') }),
  mentor({ id: 'T04', name: 'Lee Moe', diseaseFit: cited('Liquid biopsy methods'), institution: cited('Georgetown, Washington DC') }),
];

/** The real tracker when it's on this computer, otherwise the fictional sample. */
export const TEST_MENTORS: Mentor[] = MENTORS.length ? MENTORS : SAMPLE;
export const HAS_PRIVATE_MENTORS = MENTORS.length > 0;
