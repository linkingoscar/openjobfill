import type { AIFieldMappingSuggestion, AIDocumentParseResponse, ResumeKeyOption, UnmatchedFieldDescriptor } from '../../types/ai';
import { classifyFieldRisk } from '../pipeline/decisionPolicy';
import type { FieldDescriptor } from '../../types/pipeline';

export interface ValidatedAIMapping extends AIFieldMappingSuggestion {
  disposition: 'high-confidence' | 'review-required' | 'manual';
}

export function sanitizeFieldMappingSuggestions(
  suggestions: AIFieldMappingSuggestion[] | undefined,
  fields: UnmatchedFieldDescriptor[],
  options: ResumeKeyOption[],
): ValidatedAIMapping[] {
  if (!Array.isArray(suggestions)) return [];
  const allowedFields = new Map(fields.map((field) => [field.index, field]));
  const allowedOptions = new Map(options.filter((option) => option.hasValue !== false).map((option) => [option.resumeKey, option]));
  const seen = new Set<number>();
  const result: ValidatedAIMapping[] = [];

  for (const suggestion of suggestions) {
    if (!suggestion || !Number.isInteger(suggestion.fieldIndex) || seen.has(suggestion.fieldIndex)) continue;
    const field = allowedFields.get(suggestion.fieldIndex);
    const option = allowedOptions.get(suggestion.resumeKey);
    if (!field || !option) continue;
    const confidence = Number(suggestion.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) continue;
    if (!suggestion.reasonCode || typeof suggestion.reasonCode !== 'string') continue;

    const isOtherPersonContext = /紧急联系人|证明人|推荐人|家属|父亲|母亲|配偶|emergency|reference/i.test(
      [field.label, field.placeholder, field.name, field.ariaLabel, ...(field.nearbyLabels || [])].join(' '),
    );
    if (isOtherPersonContext && ['basics.name', 'basics.phone', 'basics.email', 'basics.idCardNumber'].some((key) => suggestion.resumeKey.startsWith(key))) continue;

    const risk = option.riskLevel || field.riskLevel || 'LOW';
    const disposition = confidence < 0.70
      ? 'manual'
      : confidence < 0.90 || risk === 'CRITICAL' || risk === 'HIGH' || risk === 'LONG_TEXT'
        ? 'review-required'
        : 'high-confidence';

    result.push({ ...suggestion, confidence, disposition });
    seen.add(suggestion.fieldIndex);
  }
  return result;
}

export function validateDocumentParseResponse(
  response: unknown,
  allowedPaths: Set<string>,
): AIDocumentParseResponse {
  const raw = response && typeof response === 'object' ? response as Record<string, unknown> : {};
  const rawCandidates = Array.isArray(raw.candidates) ? raw.candidates : [];
  const candidates = rawCandidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const item = candidate as Record<string, unknown>;
    if (typeof item.path !== 'string' || !allowedPaths.has(item.path)) return [];
    const confidence = Number(item.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return [];
    const evidence = item.evidence && typeof item.evidence === 'object' ? item.evidence as Record<string, unknown> : undefined;
    return [{
      path: item.path,
      value: item.value,
      confidence,
      evidence: evidence ? {
        page: typeof evidence.page === 'number' ? evidence.page : undefined,
        quote: typeof evidence.quote === 'string' ? evidence.quote.slice(0, 500) : undefined,
      } : undefined,
    }];
  });
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.filter((item): item is string => typeof item === 'string').slice(0, 50) : [];
  return { candidates, warnings };
}

/** Helper used by page-analyzer callers to derive a privacy-safe risk label for AI context. */
export function riskForAIContext(field: Pick<FieldDescriptor, 'type'>, resumeKey?: string): ReturnType<typeof classifyFieldRisk> {
  return classifyFieldRisk(field as FieldDescriptor, resumeKey);
}
