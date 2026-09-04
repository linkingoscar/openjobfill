import type { AnalyzedPlan } from '../engine/filler';
import type { FillPlan } from '../../types/pipeline';

/** Keep the original field order while adding newly discovered fields to run history. */
export function mergeAnalyzedPlans(base: AnalyzedPlan, incremental: AnalyzedPlan): AnalyzedPlan {
  const key = (item: FillPlan['items'][number]) =>
    `${item.field.fingerprint || item.field.id}|${item.field.label}|${item.field.section?.type || ''}:${item.field.section?.index || 0}`;
  const seen = new Set<string>();
  const items = [...base.plan.items, ...incremental.plan.items].filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return {
    ...incremental,
    plan: {
      aiFeedback: incremental.plan.aiFeedback,
      items, totalFieldsCount: items.length,
      highConfidenceCount: items.filter((item) => item.action === 'FILL').length,
      needsUserCount: items.filter((item) => item.action === 'NEEDS_USER').length,
      skipCount: items.filter((item) => item.action === 'SKIP').length,
    },
    remoteFrames: base.remoteFrames || incremental.remoteFrames,
  };
}
