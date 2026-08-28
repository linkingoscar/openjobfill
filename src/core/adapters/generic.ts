import type { SiteAdapter, FillResult, FillLogItem } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { matchElementToResumeField } from '../matcher/heuristic';
import { setNativeValue, setNativeRadioChecked } from '../engine/dispatcher';
import { selectCustomOption, selectCascaderOptions } from '../engine/selector';
import { fillDatePicker } from '../engine/datepicker';
import { autoExpandHeuristicSections } from '../engine/repeater';
import { decorateElement } from '../engine/badgeDecorator';
import { DomScheduler } from '../engine/scheduler';
import { getAllFormElementsAcrossIframes } from '../../utils/dom';

/**
 * 通过点路径读取对象内部值 (如 'basics.name', 'educations.0.schoolName', 'educations.1.major')
 */
function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

export const genericAdapter: SiteAdapter = {
  id: 'generic-adapter',
  name: '通用智能启发式适配器',
  description: '自动扫描未识别站点的 DOM 表单元素（含同源 iframe），通过分块容器嗅探 + 加权语义匹配 + 问答库匹配 + 智能多段增行进行精准回填',
  priority: 1,
  matches: () => true,

  async customFill(resume: StandardResume): Promise<FillResult> {
    const startTime = Date.now();
    const logs: FillLogItem[] = [];
    let filledCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // 1. 智能多段经历自动增行：如果简历中有多个教育/工作/项目经历，尝试点击页面上的"添加"按钮展开更多行
    try {
      if (resume.educations && resume.educations.length > 1) {
        await autoExpandHeuristicSections(['教育', '学历', '学习'], resume.educations.length);
      }
      if (resume.experiences && resume.experiences.length > 1) {
        await autoExpandHeuristicSections(['工作', '实习', '经历'], resume.experiences.length);
      }
      if (resume.projects && resume.projects.length > 1) {
        await autoExpandHeuristicSections(['项目'], resume.projects.length);
      }
    } catch (e) {
      console.warn('[OpenJobFill] Repeater auto-expand warning:', e);
    }

    // 2. 扫描页面所有可见的输入控件 (跨 iframe 穿透支持)
    const inputs = getAllFormElementsAcrossIframes();
    const filledElements = new Set<HTMLElement>();
    const matchedKeys = new Set<string>(); // 已匹配到的简历字段 Key (去重用)

    // 3. 采用科研级 DomScheduler.runChunked 时间切片分批填充，保障 60fps 帧率与主线程响应
    await DomScheduler.runChunked(inputs, async (el) => {
      if (filledElements.has(el)) return;

      const match = matchElementToResumeField(el, matchedKeys, resume.qaBank);
      if (!match) return;

      let strValue = '';
      if (match.qaAnswer) {
        strValue = match.qaAnswer;
      } else {
        const rawValue = getValueByPath(resume, match.resumeKey);
        if (rawValue === undefined || rawValue === null || rawValue === '') {
          skippedCount++;
          logs.push({
            status: 'skipped',
            label: match.matchedName,
            field: match.resumeKey,
            value: '',
            message: '简历中该字段为空',
          });
          return;
        }
        strValue = typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue);
      }

      try {
        let success = false;

        if (el instanceof HTMLInputElement) {
          if (el.type === 'radio') {
            if (el.value === strValue || (el.nextSibling?.textContent || '').trim().includes(strValue)) {
              setNativeRadioChecked(el, true);
              success = true;
            }
          } else if (el.type === 'date' || el.name?.toLowerCase().includes('date') || el.name?.toLowerCase().includes('birth') || match.resumeKey.includes('Date')) {
            await fillDatePicker(el, strValue);
            success = true;
          } else {
            setNativeValue(el, strValue);
            success = true;
          }
        } else if (el instanceof HTMLTextAreaElement) {
          setNativeValue(el, strValue);
          success = true;
        } else {
          // 尝试下拉组件选择或级联选择
          if (strValue.includes('-') || strValue.includes('/') || strValue.includes(' ')) {
            const cascaderSuccess = await selectCascaderOptions(el, strValue);
            if (cascaderSuccess) {
              success = true;
            } else {
              success = await selectCustomOption(el, strValue);
            }
          } else {
            success = await selectCustomOption(el, strValue);
          }
        }

        if (success) {
          filledCount++;
          filledElements.add(el);
          matchedKeys.add(match.resumeKey);
          logs.push({ status: 'success', label: match.matchedName, field: match.resumeKey, value: strValue });
          decorateElement(el, {
            status: 'success',
            label: match.matchedName,
            value: strValue
          });
        } else {
          failedCount++;
          logs.push({
            status: 'failed',
            label: match.matchedName,
            field: match.resumeKey,
            value: strValue,
            message: '填充执行返回失败（可能是下拉选项未匹配）',
          });
          decorateElement(el, {
            status: 'warning',
            label: match.matchedName,
            value: strValue,
            message: '未完全确认成功'
          });
        }
      } catch (err: any) {
        failedCount++;
        logs.push({
          status: 'failed',
          label: match.matchedName,
          field: match.resumeKey,
          value: strValue,
          message: err?.message || '填充异常',
        });
      }
    }, 6);

    return {
      success: filledCount > 0,
      adapterName: '通用智能启发式适配器',
      filledCount,
      skippedCount,
      failedCount,
      logs,
      durationMs: Date.now() - startTime,
    };
  },
};

