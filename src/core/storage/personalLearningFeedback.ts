import type { FillResult } from '../../types/adapter';
import { personalCompatibilityStorage } from './personalCompatibilityStorage';
import { ruleStorage } from './ruleStorage';

/**
 * Persist value-free feedback from a completed strict-verification run.
 * This never stores target/actual field values; only mapping ids, statuses and failure codes.
 */
export async function recordPersonalLearningFeedback(pageUrl: string, result: FillResult): Promise<void> {
  const plan = result.plan;
  if (!plan) return;

  await personalCompatibilityStorage.recordPlanOutcome(pageUrl, plan, result.logs);

  const rule = await ruleStorage.findMatchingRuleForUrl(pageUrl);
  if (!rule) return;

  const updates = plan.items.filter((item) => item.learnedRuleMappingId && item.action === 'FILL');
  for (const item of updates) {
    const verified = item.verificationStatus === 'VERIFIED';
    const log = result.logs.find((candidate) =>
      (!!item.semanticKey && candidate.field === item.semanticKey) || candidate.label === item.field.label
    );
    const reason = verified
      ? undefined
      : log?.failureCode || item.verificationStatus?.toLowerCase() || 'verification_mismatch';
    await ruleStorage.recordFieldVerification(rule.id, item.learnedRuleMappingId!, verified, reason);
  }
}
