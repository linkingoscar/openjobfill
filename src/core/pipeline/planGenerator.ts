import type { StandardResume, CustomQABankItem } from '../../types/resume';
import type { FieldDescriptor, FillPlan, FillPlanItem, PlatformEnhancer, DriverType } from '../../types/pipeline';
import { calculateSemanticSimilarity } from '../matcher/similarityEngine';
import { RESUME_DICTIONARY } from '../matcher/dictionary';
import { calculateTextMatchScore } from '../matcher/heuristic';

const CONTEXT_EXCLUSION_RULES: Record<string, string[]> = {
  'basics.name': ['紧急联系人', '证明人', '推荐人', '担保人', '家属', '父亲', '母亲', '配偶', '亲属', 'emergency', 'reference', 'referral'],
  'basics.phone': ['紧急联系人', '证明人', '推荐人', '担保人', '家属', '父亲', '母亲', '配偶', '亲属', 'emergency', 'reference'],
  'basics.email': ['紧急联系人', '证明人', '推荐人', '担保人', '家属', '父亲', '母亲', '配偶', '亲属', 'emergency', 'reference'],
};

function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
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
  if (typeof val === 'string') {
    return val.trim().length > 0;
  }
  return true;
}

export class PlanGenerator {
  /**
   * 基于页面字段列表、简历数据与平台增强器，生成两阶段 FillPlan
   */
  generatePlan(
    fields: FieldDescriptor[],
    resume: StandardResume,
    enhancer?: PlatformEnhancer | null,
    customRules?: { selector: string; resumeKey: string; description?: string }[]
  ): FillPlan {
    const items: FillPlanItem[] = [];
    const matchedSemanticKeys = new Set<string>();

    let highConfidenceCount = 0;
    let needsUserCount = 0;
    let skipCount = 0;

    for (const field of fields) {
      // 0. 调用 PlatformEnhancer.enhanceField Hook 进行字段增强
      if (enhancer && enhancer.enhanceField) {
        const enhancement = enhancer.enhanceField(field);
        if (enhancement) {
          Object.assign(field, enhancement);
        }
      }

      // 1. 如果字段已被填入有效值且非 radio/checkbox，默认跳过以保护用户输入
      if (
        field.type !== 'radio' &&
        field.type !== 'checkbox' &&
        field.currentValue &&
        String(field.currentValue).trim().length > 0
      ) {
        items.push({
          id: `plan_${field.id}`,
          field,
          action: 'SKIP',
          confidence: 1.0,
          reason: '字段已有内容，自动保护跳过',
          driverType: this.resolveDriverType(field),
        });
        skipCount++;
        continue;
      }

      // 2. 优先检查用户自定义网站规则 (User Rules)
      let customMatch: { resumeKey: string; description?: string } | null = null;
      if (customRules && customRules.length > 0) {
        for (const cr of customRules) {
          if (field.element.matches && field.element.matches(cr.selector)) {
            customMatch = cr;
            break;
          }
        }
      }

      if (customMatch) {
        const val = getValueByPath(resume, customMatch.resumeKey);
        if (hasUsableValue(val)) {
          items.push({
            id: `plan_${field.id}`,
            field,
            semanticKey: customMatch.resumeKey,
            targetValue: String(val),
            confidence: 1.0,
            action: 'FILL',
            source: 'user_rule',
            reason: `命中用户自定义规则: ${customMatch.description || customMatch.resumeKey}`,
            driverType: this.resolveDriverType(field),
          });
          highConfidenceCount++;
          matchedSemanticKeys.add(customMatch.resumeKey);
          continue;
        }
      }

      // 3. 检查平台专属增强映射 (Platform Enhancer)
      let platformMatched = false;
      if (enhancer && enhancer.fieldMappings) {
        for (const [selector, resumeKey] of Object.entries(enhancer.fieldMappings)) {
          if (field.element.matches && field.element.matches(selector)) {
            let targetKey = resumeKey;
            if (field.section && field.section.index > 0 && targetKey.includes('.0.')) {
              targetKey = targetKey.replace('.0.', `.${field.section.index}.`);
            }
            const val = getValueByPath(resume, targetKey);
            if (hasUsableValue(val)) {
              items.push({
                id: `plan_${field.id}`,
                field,
                semanticKey: targetKey,
                targetValue: String(val),
                confidence: 0.98,
                action: 'FILL',
                source: 'platform_rule',
                reason: `命中 ${enhancer.name} 专属增强规则`,
                driverType: this.resolveDriverType(field),
              });
              highConfidenceCount++;
              matchedSemanticKeys.add(targetKey);
              platformMatched = true;
              break;
            }
          }
        }
      }
      if (platformMatched) {
        continue;
      }

      // 4. 检查问答库 (Q&A Bank)
      if (resume.qaBank && resume.qaBank.length > 0 && (field.type === 'textarea' || field.type === 'text')) {
        const qaMatch = this.matchQABank(field, resume.qaBank, matchedSemanticKeys);
        if (qaMatch && hasUsableValue(qaMatch.item.answer)) {
          items.push({
            id: `plan_${field.id}`,
            field,
            semanticKey: `qaBank.${qaMatch.item.id}`,
            targetValue: qaMatch.item.answer,
            confidence: qaMatch.score,
            action: 'FILL',
            source: 'qa_bank',
            reason: `命中问答库关键词: ${qaMatch.item.keyword}`,
            driverType: this.resolveDriverType(field),
          });
          highConfidenceCount++;
          matchedSemanticKeys.add(`qaBank.${qaMatch.item.id}`);
          continue;
        }
      }

      // 5. 通用启发式与语义字典匹配
      const semanticMatch = this.matchSemanticDictionary(field, resume, matchedSemanticKeys);
      if (semanticMatch && semanticMatch.confidence >= 0.65 && hasUsableValue(semanticMatch.targetValue)) {
        items.push({
          id: `plan_${field.id}`,
          field,
          semanticKey: semanticMatch.resumeKey,
          targetValue: semanticMatch.targetValue,
          confidence: semanticMatch.confidence,
          action: 'FILL',
          source: 'semantic_dictionary',
          reason: `高置信度语义匹配: ${semanticMatch.name} (${(semanticMatch.confidence * 100).toFixed(0)}%)`,
          driverType: this.resolveDriverType(field),
        });
        highConfidenceCount++;
        matchedSemanticKeys.add(semanticMatch.resumeKey);
        continue;
      }

      // 6. 如果未匹配成功，但该字段为必填项 (Required)，标记为 NEEDS_USER (待办补漏)
      if (field.required) {
        items.push({
          id: `plan_${field.id}`,
          field,
          action: 'NEEDS_USER',
          confidence: 0,
          reason: '必填项未在简历中找到对应高置信度信息，需人工确认',
          driverType: this.resolveDriverType(field),
        });
        needsUserCount++;
      } else {
        items.push({
          id: `plan_${field.id}`,
          field,
          action: 'SKIP',
          confidence: 0,
          reason: '非必填且未匹配字段',
          driverType: this.resolveDriverType(field),
        });
        skipCount++;
      }
    }

    return {
      items,
      highConfidenceCount,
      needsUserCount,
      skipCount,
      totalFieldsCount: fields.length,
    };
  }

  private resolveDriverType(field: FieldDescriptor): DriverType {
    if (field.type === 'select') return 'select';
    if (field.type === 'cascader') return 'cascader';
    if (field.type === 'date') return 'date';
    if (field.type === 'radio') return 'radio';
    if (field.type === 'checkbox') return 'checkbox';
    if (field.type === 'contenteditable') return 'contenteditable';
    return 'input';
  }

  private matchQABank(
    field: FieldDescriptor,
    qaBank: CustomQABankItem[],
    alreadyMatchedKeys: Set<string>
  ): { item: CustomQABankItem; score: number } | null {
    let bestItem: CustomQABankItem | null = null;
    let highestScore = 0;

    for (const qa of qaBank) {
      if (!qa.keyword || !qa.answer) continue;
      const keyId = `qaBank.${qa.id}`;
      if (alreadyMatchedKeys.has(keyId)) continue;

      const keywords = qa.keyword.split(/[,，/、\s|]+/).map((k) => k.trim()).filter(Boolean);
      const score = Math.max(
        calculateTextMatchScore(field.label, keywords),
        calculateTextMatchScore(field.placeholder, keywords),
        calculateTextMatchScore(field.contextText, keywords) * 0.8
      );

      if (score > highestScore && score >= 0.5) {
        highestScore = score;
        bestItem = qa;
      }
    }

    return bestItem ? { item: bestItem, score: highestScore } : null;
  }

  private matchSemanticDictionary(
    field: FieldDescriptor,
    resume: StandardResume,
    alreadyMatchedKeys: Set<string>
  ): { resumeKey: string; name: string; targetValue: any; confidence: number } | null {
    let bestKey = '';
    let bestName = '';
    let highestScore = 0;

    const queryText = field.label || field.placeholder || field.name || field.ariaLabel;

    for (const item of RESUME_DICTIONARY) {
      let targetResumeKey = item.resumeKey;

      // 如果字段属于多段经历卡片且序号 > 0，将 .0. 动态替换为检测到的序号
      if (field.section && field.section.index > 0) {
        if (field.section.type === 'education' && targetResumeKey.startsWith('educations.')) {
          targetResumeKey = targetResumeKey.replace('educations.0.', `educations.${field.section.index}.`);
        } else if (field.section.type === 'experience' && targetResumeKey.startsWith('experiences.')) {
          targetResumeKey = targetResumeKey.replace('experiences.0.', `experiences.${field.section.index}.`);
        } else if (field.section.type === 'project' && targetResumeKey.startsWith('projects.')) {
          targetResumeKey = targetResumeKey.replace('projects.0.', `projects.${field.section.index}.`);
        } else if (field.section.type === 'family' && targetResumeKey.startsWith('familyMembers.')) {
          targetResumeKey = targetResumeKey.replace('familyMembers.0.', `familyMembers.${field.section.index}.`);
        }
      }

      if (alreadyMatchedKeys.has(targetResumeKey)) {
        continue;
      }

      // 排斥上下文检测
      if (this.shouldExclude(targetResumeKey, field.contextText)) {
        continue;
      }

      const semanticScore = calculateSemanticSimilarity(queryText, item.resumeKey);
      const textScore = calculateTextMatchScore(queryText, item.keywords);
      const totalScore = Math.max(semanticScore, textScore);

      if (totalScore > highestScore && totalScore >= 0.6) {
        highestScore = totalScore;
        bestKey = targetResumeKey;
        bestName = item.name;
      }
    }

    if (bestKey && highestScore >= 0.6) {
      const val = getValueByPath(resume, bestKey);
      if (hasUsableValue(val)) {
        return {
          resumeKey: bestKey,
          name: bestName,
          targetValue: String(val),
          confidence: highestScore,
        };
      }
    }

    return null;
  }

  private shouldExclude(resumeKey: string, contextText: string): boolean {
    const exclusions = CONTEXT_EXCLUSION_RULES[resumeKey];
    if (!exclusions || !contextText) return false;

    for (const word of exclusions) {
      if (contextText.toLowerCase().includes(word.toLowerCase())) {
        return true;
      }
    }
    return false;
  }
}

export const planGenerator = new PlanGenerator();
