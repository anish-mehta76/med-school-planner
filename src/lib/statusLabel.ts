import { STAGE_LABELS, type PipelineStage } from '../engine/outreach';

/** Tracker status text tidied for display: "Replied - declined" → "Replied – declined", "Drafted; not sent" → "Drafted, not sent". */
export function stageLabel(s: PipelineStage): string {
  return STAGE_LABELS[s].replace(/ - /g, ' – ').replace(/; /g, ', ');
}
