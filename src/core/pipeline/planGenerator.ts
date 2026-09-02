import type { StandardResume, CustomQABankItem } from '../../types/resume';
import type { FieldDescriptor, FillPlan, FillPlanItem, PlatformEnhancer, DriverType } from '../../types/pipeline';
import { calculateSemanticSimilarity } from '../matcher/similarityEngine';
import { RESUME_DICTIONARY } from '../matcher/dictionary';
import { calculateTextMatchScore } from '../matcher/heuristic';
import { isInputElement } from '../../utils/dom';
import { inferLocationPath, inferMajorHierarchy } from '../resolvers/profileNormalizer';
import { deriveLanguageSummary } from '../derivation/profileDeriver';
import { inspectFieldSafety } from './fieldSafety';
import type { CustomFieldMapping } from '../../types/rule';
import { resolveCustomRuleMappings } from './customRuleMatcher';
import { decideFill, type FillDecision } from './decisionPolicy';

const CONTEXT_EXCLUSION_RULES: Record<string, string[]> = {
  'basics.name': ['紧急联系人', '证明人', '推荐人', '担保人', '家属', '父亲', '母亲', '配偶', '亲属', 'emergency', 'reference', 'referral'],
  'basics.phone': ['紧急联系人', '证明人', '推荐人', '担保人', '家属', '父亲', '母亲', '配偶', '亲属', 'emergency', 'reference'],
  'basics.email': ['紧急联系人', '证明人', '推荐人', '担保人', '家属', '父亲', '母亲', '配偶', '亲属', 'emergency', 'reference'],
};

function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  if (path === 'derived.languageSummary') return deriveLanguageSummary(obj as StandardResume);
  let current = obj;
  for (const part of path.split('.')) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

export function hasUsableValue(value: any): boolean {
  if (value === undefined || value === null) return false;
  return typeof value !== 'string' || value.trim().length > 0;
}

function legacyAction(decision: FillDecision): FillPlanItem['action'] {
  if (decision === 'FILL_HIGH_CONFIDENCE' || decision === 'FILL_REVIEW_REQUIRED') return 'FILL';
  if (decision === 'NEEDS_USER') return 'NEEDS_USER';
  return 'SKIP';
}

export class PlanGenerator {
  generatePlan(fields: FieldDescriptor[], resume: StandardResume, enhancer?: PlatformEnhancer | null, customRules?: CustomFieldMapping[]): FillPlan {
    const items: FillPlanItem[] = [];
    const matchedSemanticKeys = new Set<string>();
    const customRuleResolution = resolveCustomRuleMappings(fields, customRules);
    let directlyHighConfidenceCount = 0;
    let reviewRequiredCount = 0;
    let optionalUnmatchedCount = 0;
    let needsUserCount = 0;
    let blockedCount = 0;
    let skipCount = 0;

    const push = (input: Omit<FillPlanItem, 'action' | 'decision' | 'riskLevel'> & {
      hasValue?: boolean;
      hasUserValue?: boolean;
      safetyBlocked?: boolean;
      firstVisit?: boolean;
      forcedDecision?: FillDecision;
    }): FillPlanItem => {
      const policy = input.forcedDecision
        ? {
            decision: input.forcedDecision,
            risk: decideFill({ field: input.field, resumeKey: input.semanticKey, confidence: input.confidence, source: input.source, hasValue: input.hasValue ?? hasUsableValue(input.targetValue) }).risk,
            reason: input.reason || '',
          }
        : decideFill({
            field: input.field,
            resumeKey: input.semanticKey,
            confidence: input.confidence,
            source: input.source,
            hasValue: input.hasValue ?? hasUsableValue(input.targetValue),
            hasUserValue: input.hasUserValue,
            safetyBlocked: input.safetyBlocked,
            firstVisit: input.firstVisit,
          });

      const item: FillPlanItem = {
        id: input.id,
        field: input.field,
        semanticKey: input.semanticKey,
        targetValue: input.targetValue,
        confidence: input.confidence,
        action: legacyAction(policy.decision),
        decision: policy.decision,
        riskLevel: policy.risk,
        reason: input.reason || policy.reason,
        source: input.source,
        driverType: input.driverType,
        requiresExplicitReview: policy.decision === 'FILL_REVIEW_REQUIRED',
        learnedRuleMappingId: input.learnedRuleMappingId,
      };
      items.push(item);
      if (policy.decision === 'FILL_HIGH_CONFIDENCE') directlyHighConfidenceCount++;
      else if (policy.decision === 'FILL_REVIEW_REQUIRED') reviewRequiredCount++;
      else if (policy.decision === 'OPTIONAL_UNMATCHED') { optionalUnmatchedCount++; skipCount++; }
      else if (policy.decision === 'NEEDS_USER') needsUserCount++;
      else if (policy.decision === 'BLOCKED') { blockedCount++; skipCount++; }
      else skipCount++;
      return item;
    };

    for (const field of fields) {
      if (enhancer?.enhanceField) {
        const enhancement = enhancer.enhanceField(field);
        if (enhancement) Object.assign(field, enhancement);
      }

      const safety = field.safety || inspectFieldSafety(field.element, field.label, field.contextText);
      field.safety = safety;
      if (safety.blocked) {
        push({ id: `plan_${field.id}`, field, confidence: 1, reason: safety.reason || '安全策略禁止自动填写', driverType: this.resolveDriverType(field), safetyBlocked: true });
        continue;
      }

      if (this.hasUserValue(field)) {
        push({ id: `plan_${field.id}`, field, confidence: 1, reason: '字段已有内容，自动保护跳过', driverType: this.resolveDriverType(field), hasUserValue: true, forcedDecision: 'SKIP' });
        continue;
      }
      if (field.disabled || field.readOnly) {
        push({ id: `plan_${field.id}`, field, confidence: 1, reason: field.disabled ? '字段已禁用，自动跳过' : '字段只读，自动跳过', driverType: this.resolveDriverType(field), forcedDecision: 'SKIP' });
        continue;
      }

      const resolved = customRuleResolution.matches.get(field.id);
      if (resolved?.mapping) {
        let resumeKey = resolved.mapping.resumeKey;
        if (field.section && field.section.index > 0 && resumeKey.includes('.0.')) resumeKey = resumeKey.replace('.0.', `.${field.section.index}.`);
        const value = getValueByPath(resume, resumeKey);
        if (hasUsableValue(value)) {
          const item = push({
            id: `plan_${field.id}`, field, semanticKey: resumeKey,
            targetValue: this.toFieldTargetValue(field, resume, resumeKey, value), confidence: 1,
            source: 'user_rule', reason: `命中用户自定义规则（${resolved.method || 'selector'}）: ${resolved.mapping.description || resolved.mapping.resumeKey}`,
            driverType: this.resolveDriverType(field), firstVisit: false,
            learnedRuleMappingId: resolved.mapping.id,
          });
          if (item.action === 'FILL') matchedSemanticKeys.add(resumeKey);
          continue;
        }
      }

      let platformMatched = false;
      if (enhancer?.fieldMappings) {
        for (const [selector, originalKey] of Object.entries(enhancer.fieldMappings)) {
          if (!field.element.matches?.(selector)) continue;
          let resumeKey = originalKey;
          if (field.section && field.section.index > 0 && resumeKey.includes('.0.')) resumeKey = resumeKey.replace('.0.', `.${field.section.index}.`);
          const value = getValueByPath(resume, resumeKey);
          if (!hasUsableValue(value)) continue;
          push({ id: `plan_${field.id}`, field, semanticKey: resumeKey, targetValue: this.toFieldTargetValue(field, resume, resumeKey, value), confidence: 0.98, source: 'platform_rule', reason: `命中 ${enhancer.name} 专属增强规则`, driverType: this.resolveDriverType(field), firstVisit: true });
          matchedSemanticKeys.add(resumeKey);
          platformMatched = true;
          break;
        }
      }
      if (platformMatched) continue;

      if (resume.qaBank?.length && (field.type === 'textarea' || field.type === 'text')) {
        const match = this.matchQABank(field, resume.qaBank, matchedSemanticKeys);
        if (match && hasUsableValue(match.item.answer)) {
          push({ id: `plan_${field.id}`, field, semanticKey: `qaBank.${match.item.id}`, targetValue: match.item.answer, confidence: match.score, source: 'qa_bank', reason: `命中问答库关键词: ${match.item.keyword}`, driverType: this.resolveDriverType(field), firstVisit: true });
          matchedSemanticKeys.add(`qaBank.${match.item.id}`);
          continue;
        }
      }

      const semantic = this.matchSemanticDictionary(field, resume, matchedSemanticKeys);
      if (semantic && hasUsableValue(semantic.targetValue)) {
        const item = push({ id: `plan_${field.id}`, field, semanticKey: semantic.resumeKey, targetValue: semantic.targetValue, confidence: semantic.confidence, source: 'semantic_dictionary', reason: `语义匹配: ${semantic.name} (${(semantic.confidence * 100).toFixed(0)}%)`, driverType: this.resolveDriverType(field), firstVisit: true });
        if (item.action === 'FILL') {
          matchedSemanticKeys.add(semantic.resumeKey);
          for (const related of semantic.relatedKeys || []) matchedSemanticKeys.add(related);
        }
        continue;
      }

      push({ id: `plan_${field.id}`, field, confidence: 0, reason: field.required ? '必填项未找到可靠映射，需人工确认' : '非必填陌生字段，保留为可选映射建议', driverType: this.resolveDriverType(field), hasValue: false });
    }

    return {
      items,
      // Compatibility: historical callers used this as “preview-fillable mappings”.
      // New callers must inspect decision/reviewRequiredCount to distinguish review-required items.
      highConfidenceCount: directlyHighConfidenceCount + reviewRequiredCount,
      reviewRequiredCount,
      optionalUnmatchedCount,
      needsUserCount,
      blockedCount,
      skipCount,
      totalFieldsCount: fields.length,
      diagnostics: { customRules: {
        matchedCount: customRuleResolution.matches.size,
        staleMappingIds: customRuleResolution.staleMappingIds,
        unmatchedMappingIds: customRuleResolution.unmatchedMappingIds,
        methodCounts: customRuleResolution.methodCounts,
      } },
    };
  }

  private hasUserValue(field: FieldDescriptor): boolean {
    if (field.type === 'checkbox') return isInputElement(field.element) && field.element.checked;
    if (field.type === 'radio') {
      const el = field.element;
      if (!isInputElement(el)) return false;
      const name = el.getAttribute('name');
      const doc = el.ownerDocument || document;
      const container = el.closest('.radio-group, .el-radio-group, .ant-radio-group, .form-item, .form-group, fieldset') || el.parentElement || doc;
      const radios = name ? Array.from(doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`)) : Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
      return radios.some((radio) => radio.checked);
    }
    return !!field.currentValue && String(field.currentValue).trim().length > 0;
  }

  private resolveDriverType(field: FieldDescriptor): DriverType {
    if (field.type === 'select') return 'select';
    if (field.type === 'cascader') return 'cascader';
    if (field.type === 'date') return 'date';
    if (field.type === 'date-range') return 'date-range';
    if (field.type === 'radio') return 'radio';
    if (field.type === 'checkbox') return 'checkbox';
    if (field.type === 'contenteditable') return 'contenteditable';
    return 'input';
  }

  private toFieldTargetValue(field: FieldDescriptor, resume: StandardResume, resumeKey: string, value: any): any {
    if (field.type === 'date-range' && /\.(startDate|endDate)$/.test(resumeKey)) {
      const base = resumeKey.replace(/\.(startDate|endDate)$/, '');
      return { startDate: String(getValueByPath(resume, `${base}.startDate`) || ''), endDate: String(getValueByPath(resume, `${base}.endDate`) || '') };
    }
    if (typeof value === 'boolean') return field.type === 'checkbox' ? value : value ? '是' : '否';
    if (field.type === 'cascader' && /educations\.\d+\.major$/.test(resumeKey)) return inferMajorHierarchy(String(value)).join('-');
    if (field.type === 'cascader' && value && typeof value === 'object' && ('city' in value || 'province' in value)) {
      const location = value as { province?: string; city?: string; district?: string };
      const path = location.province ? [location.province, location.city, location.district].filter(Boolean) : [...inferLocationPath(location.city || ''), location.district].filter(Boolean);
      return path.join('-');
    }
    return String(value);
  }

  private matchQABank(field: FieldDescriptor, qaBank: CustomQABankItem[], alreadyMatchedKeys: Set<string>): { item: CustomQABankItem; score: number } | null {
    const currentHostname = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
    const evaluate = (items: CustomQABankItem[]) => {
      let best: CustomQABankItem | null = null;
      let highestScore = 0;
      for (const qa of items) {
        if (!qa.keyword || !qa.answer || alreadyMatchedKeys.has(`qaBank.${qa.id}`)) continue;
        const keywords = qa.keyword.split(/[,，/、\s|]+/).map((key) => key.trim()).filter(Boolean);
        const score = Math.max(calculateTextMatchScore(field.label, keywords), calculateTextMatchScore(field.placeholder, keywords), calculateTextMatchScore(field.contextText, keywords) * 0.8);
        if (score > highestScore && score >= 0.5) { highestScore = score; best = qa; }
      }
      return best ? { item: best, score: highestScore } : null;
    };
    if (currentHostname) {
      const scoped = evaluate(qaBank.filter((qa) => qa.scope === 'domain' && qa.domain && (currentHostname.includes(qa.domain) || qa.domain.includes(currentHostname))));
      if (scoped) return scoped;
    }
    return evaluate(qaBank.filter((qa) => qa.scope !== 'domain' || !qa.domain));
  }

  private matchSemanticDictionary(field: FieldDescriptor, resume: StandardResume, alreadyMatchedKeys: Set<string>): { resumeKey: string; name: string; targetValue: any; confidence: number; relatedKeys?: string[] } | null {
    const queryText = field.label || field.placeholder || field.name || field.ariaLabel;
    let bestKey = '';
    let bestName = '';
    let highestScore = 0;

    for (const entry of RESUME_DICTIONARY) {
      let targetKey = entry.resumeKey;
      if (field.section && field.section.index > 0) {
        if (field.section.type === 'education' && targetKey.startsWith('educations.')) targetKey = targetKey.replace('educations.0.', `educations.${field.section.index}.`);
        else if (field.section.type === 'experience' && targetKey.startsWith('experiences.')) targetKey = targetKey.replace('experiences.0.', `experiences.${field.section.index}.`);
        else if (field.section.type === 'project' && targetKey.startsWith('projects.')) targetKey = targetKey.replace('projects.0.', `projects.${field.section.index}.`);
        else if (field.section.type === 'family' && targetKey.startsWith('familyMembers.')) targetKey = targetKey.replace('familyMembers.0.', `familyMembers.${field.section.index}.`);
      }
      if (alreadyMatchedKeys.has(targetKey) || this.shouldExclude(targetKey, field.contextText)) continue;
      const score = Math.max(calculateSemanticSimilarity(queryText, entry.resumeKey), calculateTextMatchScore(queryText, entry.keywords));
      if (score > highestScore && score >= 0.6) { highestScore = score; bestKey = targetKey; bestName = entry.name; }
    }

    if (!bestKey || highestScore < 0.6) return null;
    const value = getValueByPath(resume, bestKey);
    if (!hasUsableValue(value)) return null;
    let targetValue: any = this.toFieldTargetValue(field, resume, bestKey, value);

    if (field.type !== 'cascader' && typeof value === 'object' && value !== null && ('province' in value || 'city' in value)) {
      const location = value as any;
      targetValue = [location.province, location.city, location.district].filter(Boolean).join('-');
    } else if (field.type === 'cascader' && bestKey.startsWith('basics.') && (bestKey.includes('Location') || bestKey.includes('nativePlace'))) {
      const parent = getValueByPath(resume, bestKey.replace(/\.(city|province|district)$/, '')) as any;
      if (parent && typeof parent === 'object') targetValue = [parent.province, parent.city, parent.district].filter(Boolean).join('-');
    }

    if (field.type === 'date-range' && /\.(startDate|endDate)$/.test(bestKey)) {
      const base = bestKey.replace(/\.(startDate|endDate)$/, '');
      const startKey = `${base}.startDate`;
      const endKey = `${base}.endDate`;
      const startDate = getValueByPath(resume, startKey);
      const endDate = getValueByPath(resume, endKey);
      if (hasUsableValue(startDate) || hasUsableValue(endDate)) return { resumeKey: startKey, name: bestName, targetValue: { startDate: String(startDate || ''), endDate: String(endDate || '') }, confidence: highestScore, relatedKeys: [endKey] };
    }

    return { resumeKey: bestKey, name: bestName, targetValue, confidence: highestScore };
  }

  private shouldExclude(resumeKey: string, contextText: string): boolean {
    const exclusions = CONTEXT_EXCLUSION_RULES[resumeKey];
    if (!exclusions || !contextText) return false;
    return exclusions.some((word) => contextText.toLowerCase().includes(word.toLowerCase()));
  }
}

export const planGenerator = new PlanGenerator();
