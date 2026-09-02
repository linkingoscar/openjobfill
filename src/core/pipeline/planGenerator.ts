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
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }
  return curr;
}

export function hasUsableValue(val: any): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  return true;
}

function legacyAction(decision: FillDecision): FillPlanItem['action'] {
  if (decision === 'FILL_HIGH_CONFIDENCE' || decision === 'FILL_REVIEW_REQUIRED') return 'FILL';
  if (decision === 'NEEDS_USER') return 'NEEDS_USER';
  return 'SKIP';
}

export class PlanGenerator {
  generatePlan(
    fields: FieldDescriptor[],
    resume: StandardResume,
    enhancer?: PlatformEnhancer | null,
    customRules?: CustomFieldMapping[]
  ): FillPlan {
    const items: FillPlanItem[] = [];
    const matchedSemanticKeys = new Set<string>();
    const customRuleResolution = resolveCustomRuleMappings(fields, customRules);
    let highConfidenceCount = 0;
    let reviewRequiredCount = 0;
    let optionalUnmatchedCount = 0;
    let needsUserCount = 0;
    let blockedCount = 0;
    let skipCount = 0;

    const push = (item: Omit<FillPlanItem, 'action' | 'decision' | 'riskLevel'> & {
      source?: FillPlanItem['source'];
      hasValue?: boolean;
      hasUserValue?: boolean;
      safetyBlocked?: boolean;
      firstVisit?: boolean;
      forcedDecision?: FillDecision;
    }) => {
      const policySource = item.source === 'ai' ? 'ai' : item.source;
      const policy = item.forcedDecision
        ? { decision: item.forcedDecision, risk: decideFill({ field: item.field, resumeKey: item.semanticKey, confidence: item.confidence, source: policySource, hasValue: item.hasValue ?? hasUsableValue(item.targetValue) }).risk, reason: item.reason || '' }
        : decideFill({
            field: item.field,
            resumeKey: item.semanticKey,
            confidence: item.confidence,
            source: policySource,
            hasValue: item.hasValue ?? hasUsableValue(item.targetValue),
            hasUserValue: item.hasUserValue,
            safetyBlocked: item.safetyBlocked,
            firstVisit: item.firstVisit,
          });
      const decision = policy.decision;
      const planned: FillPlanItem = {
        id: item.id,
        field: item.field,
        semanticKey: item.semanticKey,
        targetValue: item.targetValue,
        confidence: item.confidence,
        action: legacyAction(decision),
        decision,
        riskLevel: policy.risk,
        reason: item.reason || policy.reason,
        source: item.source,
        driverType: item.driverType,
        requiresExplicitReview: decision === 'FILL_REVIEW_REQUIRED',
      };
      items.push(planned);
      if (decision === 'FILL_HIGH_CONFIDENCE') highConfidenceCount++;
      else if (decision === 'FILL_REVIEW_REQUIRED') reviewRequiredCount++;
      else if (decision === 'OPTIONAL_UNMATCHED') { optionalUnmatchedCount++; skipCount++; }
      else if (decision === 'NEEDS_USER') needsUserCount++;
      else if (decision === 'BLOCKED') { blockedCount++; skipCount++; }
      else skipCount++;
      return planned;
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

      let isAlreadyFilledByUser = false;
      let skipReason = '字段已有内容，自动保护跳过';
      if (field.type === 'checkbox') {
        if (isInputElement(field.element) && field.element.checked) {
          isAlreadyFilledByUser = true;
          skipReason = '复选框已被勾选，自动保护跳过';
        }
      } else if (field.type === 'radio') {
        const el = field.element;
        if (isInputElement(el)) {
          const name = el.getAttribute('name');
          const doc = el.ownerDocument || document;
          const container = el.closest('.radio-group, .el-radio-group, .ant-radio-group, .form-item, .form-group, fieldset') || el.parentElement || doc;
          const groupRadios = name
            ? Array.from(doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`))
            : Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
          if (groupRadios.some((radio) => radio.checked)) {
            isAlreadyFilledByUser = true;
            skipReason = '单选框组已有选定项，自动保护跳过';
          }
        }
      } else if (field.currentValue && String(field.currentValue).trim().length > 0) {
        isAlreadyFilledByUser = true;
      }
      if (isAlreadyFilledByUser) {
        push({ id: `plan_${field.id}`, field, confidence: 1, reason: skipReason, driverType: this.resolveDriverType(field), hasUserValue: true, forcedDecision: 'SKIP' });
        continue;
      }

      if (field.disabled || field.readOnly) {
        push({ id: `plan_${field.id}`, field, confidence: 1, reason: field.disabled ? '字段已禁用，自动跳过' : '字段只读，自动跳过', driverType: this.resolveDriverType(field), forcedDecision: 'SKIP' });
        continue;
      }

      const resolvedCustomMatch = customRuleResolution.matches.get(field.id);
      const customMatch = resolvedCustomMatch?.mapping || null;
      if (customMatch) {
        let customResumeKey = customMatch.resumeKey;
        if (field.section && field.section.index > 0 && customResumeKey.includes('.0.')) customResumeKey = customResumeKey.replace('.0.', `.${field.section.index}.`);
        const val = getValueByPath(resume, customResumeKey);
        if (hasUsableValue(val)) {
          const planned = push({
            id: `plan_${field.id}`, field, semanticKey: customResumeKey,
            targetValue: this.toFieldTargetValue(field, resume, customResumeKey, val), confidence: 1,
            source: 'user_rule', reason: `命中用户自定义规则（${resolvedCustomMatch?.method || 'selector'}）: ${customMatch.description || customMatch.resumeKey}`,
            driverType: this.resolveDriverType(field), firstVisit: false,
          });
          if (planned.action === 'FILL') matchedSemanticKeys.add(customResumeKey);
          continue;
        }
      }

      let platformMatched = false;
      if (enhancer?.fieldMappings) {
        for (const [selector, resumeKey] of Object.entries(enhancer.fieldMappings)) {
          if (!field.element.matches?.(selector)) continue;
          let targetKey = resumeKey;
          if (field.section && field.section.index > 0 && targetKey.includes('.0.')) targetKey = targetKey.replace('.0.', `.${field.section.index}.`);
          const val = getValueByPath(resume, targetKey);
          if (!hasUsableValue(val)) continue;
          push({
            id: `plan_${field.id}`, field, semanticKey: targetKey,
            targetValue: this.toFieldTargetValue(field, resume, targetKey, val), confidence: 0.98,
            source: 'platform_rule', reason: `命中 ${enhancer.name} 专属增强规则`, driverType: this.resolveDriverType(field), firstVisit: true,
          });
          matchedSemanticKeys.add(targetKey);
          platformMatched = true;
          break;
        }
      }
      if (platformMatched) continue;

      if (resume.qaBank?.length && (field.type === 'textarea' || field.type === 'text')) {
        const qaMatch = this.matchQABank(field, resume.qaBank, matchedSemanticKeys);
        if (qaMatch && hasUsableValue(qaMatch.item.answer)) {
          push({
            id: `plan_${field.id}`, field, semanticKey: `qaBank.${qaMatch.item.id}`, targetValue: qaMatch.item.answer,
            confidence: qaMatch.score, source: 'qa_bank', reason: `命中问答库关键词: ${qaMatch.item.keyword}`,
            driverType: this.resolveDriverType(field), firstVisit: true,
          });
          matchedSemanticKeys.add(`qaBank.${qaMatch.item.id}`);
          continue;
        }
      }

      const semanticMatch = this.matchSemanticDictionary(field, resume, matchedSemanticKeys);
      if (semanticMatch && hasUsableValue(semanticMatch.targetValue)) {
        const planned = push({
          id: `plan_${field.id}`, field, semanticKey: semanticMatch.resumeKey, targetValue: semanticMatch.targetValue,
          confidence: semanticMatch.confidence, source: 'semantic_dictionary',
          reason: `语义匹配: ${semanticMatch.name} (${(semanticMatch.confidence * 100).toFixed(0)}%)`,
          driverType: this.resolveDriverType(field), firstVisit: true,
        });
        if (planned.action === 'FILL') {
          matchedSemanticKeys.add(semanticMatch.resumeKey);
          for (const relatedKey of semanticMatch.relatedKeys || []) matchedSemanticKeys.add(relatedKey);
        }
        continue;
      }

      push({
        id: `plan_${field.id}`, field, confidence: 0,
        reason: field.required ? '必填项未找到可靠映射，需人工确认' : '非必填陌生字段，保留为可选映射建议',
        driverType: this.resolveDriverType(field), hasValue: false,
      });
    }

    return {
      items, highConfidenceCount, reviewRequiredCount, optionalUnmatchedCount, needsUserCount, blockedCount, skipCount,
      totalFieldsCount: fields.length,
      diagnostics: { customRules: {
        matchedCount: customRuleResolution.matches.size,
        staleMappingIds: customRuleResolution.staleMappingIds,
        unmatchedMappingIds: customRuleResolution.unmatchedMappingIds,
        methodCounts: customRuleResolution.methodCounts,
      } },
    };
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
      const baseKey = resumeKey.replace(/\.(startDate|endDate)$/, '');
      return { startDate: String(getValueByPath(resume, `${baseKey}.startDate`) || ''), endDate: String(getValueByPath(resume, `${baseKey}.endDate`) || '') };
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
    const evaluateQA = (qaList: CustomQABankItem[]) => {
      let bestItem: CustomQABankItem | null = null;
      let highestScore = 0;
      for (const qa of qaList) {
        if (!qa.keyword || !qa.answer) continue;
        const keyId = `qaBank.${qa.id}`;
        if (alreadyMatchedKeys.has(keyId)) continue;
        const keywords = qa.keyword.split(/[,，/、\s|]+/).map((key) => key.trim()).filter(Boolean);
        const score = Math.max(calculateTextMatchScore(field.label, keywords), calculateTextMatchScore(field.placeholder, keywords), calculateTextMatchScore(field.contextText, keywords) * 0.8);
        if (score > highestScore && score >= 0.5) { highestScore = score; bestItem = qa; }
      }
      return bestItem ? { item: bestItem, score: highestScore } : null;
    };
    if (currentHostname) {
      const domainQAs = qaBank.filter((qa) => qa.scope === 'domain' && qa.domain && (currentHostname.includes(qa.domain) || qa.domain.includes(currentHostname)));
      const domainMatch = evaluateQA(domainQAs);
      if (domainMatch) return domainMatch;
    }
    return evaluateQA(qaBank.filter((qa) => qa.scope !== 'domain' || !qa.domain));
  }

  private matchSemanticDictionary(field: FieldDescriptor, resume: StandardResume, alreadyMatchedKeys: Set<string>): { resumeKey: string; name: string; targetValue: any; confidence: number; relatedKeys?: string[] } | null {
    let bestKey = '';
    let bestName = '';
    let highestScore = 0;
    const queryText = field.label || field.placeholder || field.name || field.ariaLabel;

    for (const item of RESUME_DICTIONARY) {
      let targetResumeKey = item.resumeKey;
      if (field.section && field.section.index > 0) {
        if (field.section.type === 'education' && targetResumeKey.startsWith('educations.')) targetResumeKey = targetResumeKey.replace('educations.0.', `educations.${field.section.index}.`);
        else if (field.section.type === 'experience' && targetResumeKey.startsWith('experiences.')) targetResumeKey = targetResumeKey.replace('experiences.0.', `experiences.${field.section.index}.`);
        else if (field.section.type === 'project' && targetResumeKey.startsWith('projects.')) targetResumeKey = targetResumeKey.replace('projects.0.', `projects.${field.section.index}.`);
        else if (field.section.type === 'family' && targetResumeKey.startsWith('familyMembers.')) targetResumeKey = targetResumeKey.replace('familyMembers.0.', `familyMembers.${field.section.index}.`);
      }
      if (alreadyMatchedKeys.has(targetResumeKey) || this.shouldExclude(targetResumeKey, field.contextText)) continue;
      const totalScore = Math.max(calculateSemanticSimilarity(queryText, item.resumeKey), calculateTextMatchScore(queryText, item.keywords));
      if (totalScore > highestScore && totalScore >= 0.6) { highestScore = totalScore; bestKey = targetResumeKey; bestName = item.name; }
    }

    if (!bestKey || highestScore < 0.6) return null;
    const val = getValueByPath(resume, bestKey);
    if (!hasUsableValue(val)) return null;
    let stringVal: any = this.toFieldTargetValue(field, resume, bestKey, val);
    if (field.type !== 'cascader' && typeof val === 'object' && val !== null && ('province' in val || 'city' in val)) {
      const loc = val as any;
      stringVal = [loc.province, loc.city, loc.district].filter(Boolean).join('-');
    } else if (field.type === 'cascader' && bestKey.startsWith('basics.') && (bestKey.includes('Location') || bestKey.includes('nativePlace'))) {
      const parentLocKey = bestKey.replace(/\.(city|province|district)$/, '');
      const parentLoc = getValueByPath(resume, parentLocKey) as any;
      if (parentLoc && typeof parentLoc === 'object') stringVal = [parentLoc.province, parentLoc.city, parentLoc.district].filter(Boolean).join('-');
    }
    if (field.type === 'date-range' && /\.(startDate|endDate)$/.test(bestKey)) {
      const baseKey = bestKey.replace(/\.(startDate|endDate)$/, '');
      const startKey = `${baseKey}.startDate`;
      const endKey = `${baseKey}.endDate`;
      const startDate = getValueByPath(resume, startKey);
      const endDate = getValueByPath(resume, endKey);
      if (hasUsableValue(startDate) || hasUsableValue(endDate)) return { resumeKey: startKey, name: bestName, targetValue: { startDate: String(startDate || ''), endDate: String(endDate || '') }, confidence: highestScore, relatedKeys: [endKey] };
    }
    return { resumeKey: bestKey, name: bestName, targetValue: stringVal, confidence: highestScore };
  }

  private shouldExclude(resumeKey: string, contextText: string): boolean {
    const exclusions = CONTEXT_EXCLUSION_RULES[resumeKey];
    if (!exclusions || !contextText) return false;
    return exclusions.some((word) => contextText.toLowerCase().includes(word.toLowerCase()));
  }
}

export const planGenerator = new PlanGenerator();
