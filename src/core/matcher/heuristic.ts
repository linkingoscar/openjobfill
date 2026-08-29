import { findAssociatedLabelText } from '../../utils/dom';
import { RESUME_DICTIONARY, type FieldSynonymItem } from './dictionary';
import type { CustomQABankItem } from '../../types/resume';
import { calculateSemanticSimilarity } from './similarityEngine';

export interface MatchedFieldResult {
  element: HTMLElement;
  resumeKey: string;
  confidence: number;
  matchedName: string;
  qaAnswer?: string; // 如果命中了自定义问答库
}

/**
 * 上下文排斥关键词表
 * 如果输入框附近的文本包含这些排斥词，则降低或排除对应简历字段的匹配
 * 防止"紧急联系人姓名"被误填为求职者本人姓名等问题
 */
const CONTEXT_EXCLUSION_RULES: Record<string, string[]> = {
  'basics.name': ['紧急联系人', '证明人', '推荐人', '担保人', '家属', '父亲', '母亲', '配偶', '亲属', 'emergency', 'reference', 'referral'],
  'basics.phone': ['紧急联系人', '证明人', '推荐人', '担保人', '家属', '父亲', '母亲', '配偶', '亲属', 'emergency', 'reference'],
  'basics.email': ['紧急联系人', '证明人', '推荐人', '担保人', '家属', '父亲', '母亲', '配偶', '亲属', 'emergency', 'reference'],
};

/**
 * 计算文本与关键词列表的最佳相似度/匹配分数 (0 ~ 1)
 */
export function calculateTextMatchScore(rawText: string, keywords: string[]): number {
  if (!rawText || !keywords || keywords.length === 0) return 0;
  const normalized = rawText.toLowerCase().replace(/[:：*※\s_\-()（）【】\[\]·•]/g, '');

  let maxScore = 0;
  for (const kw of keywords) {
    const cleanKw = kw.toLowerCase().replace(/[\s_\-]/g, '');
    if (!cleanKw) continue;
    if (normalized === cleanKw) {
      return 1.0; // 完全匹配直接返回最大分 1.0
    }
    if (normalized.startsWith(cleanKw) || normalized.endsWith(cleanKw)) {
      maxScore = Math.max(maxScore, 0.9);
    } else if (normalized.includes(cleanKw) || cleanKw.includes(normalized)) {
      maxScore = Math.max(maxScore, 0.75);
    }
  }

  return maxScore;
}

/**
 * 检测元素的"上下文环境"是否包含排斥词
 * 向上查找最近的表单行/section 容器，读取整段文本
 */
function getContextText(el: HTMLElement): string {
  const candidates = [
    el.closest('.el-form-item, .ant-form-item, .semi-form-item, .form-item, .form-group, [class*="form-item"], [class*="FormItem"], fieldset, .section, [class*="section"], tr'),
    el.parentElement,
    el.parentElement?.parentElement,
  ];

  for (const ancestor of candidates) {
    if (ancestor && ancestor.textContent) {
      return ancestor.textContent.trim().toLowerCase();
    }
  }

  return '';
}

/**
 * 检查是否应该排斥此匹配 (防止误填)
 */
function shouldExcludeMatch(resumeKey: string, contextText: string): boolean {
  const exclusions = CONTEXT_EXCLUSION_RULES[resumeKey];
  if (!exclusions || !contextText) return false;

  for (const word of exclusions) {
    if (contextText.toLowerCase().includes(word.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * 智能嗅探元素所在的分组容器类别 (教育/工作/项目/家庭) 与同胞卡片序号 (Index)
 */
function detectElementSectionScope(el: HTMLElement): { category: string; index: number } | null {
  // 查找常见的经历卡片/容器
  const cardSelectors = [
    { cat: 'educations', sel: '[class*="education-item"], [class*="edu-item"], [class*="education_item"], [class*="education-card"], [class*="educationCard"], [data-section="education"]' },
    { cat: 'experiences', sel: '[class*="experience-item"], [class*="work-item"], [class*="exp-item"], [class*="work-card"], [class*="job-item"], [data-section="experience"]' },
    { cat: 'projects', sel: '[class*="project-item"], [class*="proj-item"], [class*="project-card"], [class*="projectCard"], [data-section="project"]' },
    { cat: 'familyMembers', sel: '[class*="family-item"], [class*="family_item"], [class*="contact-item"], [data-section="family"]' },
  ];

  for (const item of cardSelectors) {
    const card = el.closest(item.sel);
    if (card && card.parentElement) {
      const siblings = Array.from(card.parentElement.querySelectorAll(item.sel));
      const idx = siblings.indexOf(card);
      return { category: item.cat, index: Math.max(0, idx) };
    }
  }

  // 向上查找通用 Section (基于 Section 标题文本和包裹容器)
  const genericSection = el.closest('fieldset, .section, [class*="section"], [class*="block"], .ant-card, .el-card');
  if (genericSection) {
    const headerText = (genericSection.querySelector('h1, h2, h3, h4, .title, [class*="title"], legend')?.textContent || '').toLowerCase();
    let cat = '';
    if (/教育|学历|就读|学习经历|education/i.test(headerText)) cat = 'educations';
    else if (/工作|实习|工作经历|任职|experience|work/i.test(headerText)) cat = 'experiences';
    else if (/项目|项目经历|主要项目|project/i.test(headerText)) cat = 'projects';
    else if (/家庭|亲属|紧急联系|family|contact/i.test(headerText)) cat = 'familyMembers';

    if (cat && genericSection.parentElement) {
      const allSameSections = Array.from(genericSection.parentElement.children).filter(c => c.tagName === genericSection.tagName);
      const idx = allSameSections.indexOf(genericSection);
      if (idx >= 0) {
        return { category: cat, index: idx };
      }
    }
  }

  return null;
}

/**
 * 启发式扫描并识别页面上的表单输入元素
 */
export function matchElementToResumeField(
  el: HTMLElement,
  alreadyMatchedKeys?: Set<string>,
  qaBank?: CustomQABankItem[]
): MatchedFieldResult | null {
  // 排除隐藏输入框、提交按钮、禁用输入框
  if (el instanceof HTMLInputElement) {
    if (['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(el.type)) {
      return null;
    }
    if (el.disabled) return null;
  }

  // 跳过已有内容的输入框 (仅填空白)
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.value && el.value.trim().length > 0) {
      return null;
    }
  }

  const labelText = findAssociatedLabelText(el);
  const placeholder = el.getAttribute('placeholder') || '';
  const nameAttr = el.getAttribute('name') || '';
  const ariaLabel = el.getAttribute('aria-label') || '';
  const contextText = getContextText(el);

  // 1. 如果是 Textarea 或大输入框，优先尝试匹配自定义问答库 (Q&A Bank)
  if (qaBank && qaBank.length > 0 && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type === 'text'))) {
    let bestQA: CustomQABankItem | null = null;
    let highestQAScore = 0;

    for (const qa of qaBank) {
      if (!qa.keyword || !qa.answer) continue;
      const keyId = 'qaBank.' + qa.id;
      if (alreadyMatchedKeys && alreadyMatchedKeys.has(keyId)) continue;

      const keywords = qa.keyword.split(/[,，/、\s|]+/).map(k => k.trim()).filter(Boolean);
      const score = Math.max(
        calculateTextMatchScore(labelText, keywords),
        calculateTextMatchScore(placeholder, keywords),
        calculateTextMatchScore(contextText, keywords) * 0.8
      );

      if (score > highestQAScore && score >= 0.5) {
        highestQAScore = score;
        bestQA = qa;
      }
    }

    if (bestQA) {
      return {
        element: el,
        resumeKey: 'qaBank.' + bestQA.id,
        confidence: highestQAScore,
        matchedName: `问答库: ${bestQA.keyword}`,
        qaAnswer: bestQA.answer,
      };
    }
  }

  // 2. 嗅探分块容器层级 (如属于第 2 个工作经历块，则自动映射为 experiences.1.*)
  const scope = detectElementSectionScope(el);

  let bestMatch: FieldSynonymItem | null = null;
  let highestScore = 0;

  for (const item of RESUME_DICTIONARY) {
    let targetResumeKey = item.resumeKey;

    // 如果嗅探到了具体的经历分组且序号 > 0，将对应的 .0. 动态替换为检测到的序号
    if (scope && targetResumeKey.startsWith(`${scope.category}.`)) {
      targetResumeKey = targetResumeKey.replace(`${scope.category}.0.`, `${scope.category}.${scope.index}.`);
    }

    // 如果该字段已被前面的元素匹配过，跳过 (去重)
    if (alreadyMatchedKeys && alreadyMatchedKeys.has(targetResumeKey)) {
      continue;
    }

    // 综合加权评分：Label 权重最高 (0.6)，Placeholder 权重 (0.25)，Name/Aria 权重 (0.15)
    const labelScore = calculateTextMatchScore(labelText, item.keywords);
    const placeholderScore = calculateTextMatchScore(placeholder, item.keywords);
    const attrScore = Math.max(
      calculateTextMatchScore(nameAttr, item.keywords),
      calculateTextMatchScore(ariaLabel, item.keywords)
    );

    // 引入空间压缩 Levenshtein / 2-Gram / 同义词词图融合的语义相似度打分
    const semanticScore = calculateSemanticSimilarity(labelText || placeholder || nameAttr, item.resumeKey);

    const heuristicScore = labelScore * 0.6 + placeholderScore * 0.25 + attrScore * 0.15;
    const totalScore = Math.max(heuristicScore, semanticScore);

    if (totalScore > highestScore && totalScore >= 0.45) {
      highestScore = totalScore;
      bestMatch = {
        ...item,
        resumeKey: targetResumeKey,
      };
    }
  }

  if (bestMatch) {
    // 上下文排斥检测：防止"紧急联系人姓名"误填为自己的名字
    if (shouldExcludeMatch(bestMatch.resumeKey, contextText)) {
      return null;
    }

    return {
      element: el,
      resumeKey: bestMatch.resumeKey,
      confidence: highestScore,
      matchedName: bestMatch.name,
    };
  }

  return null;
}

