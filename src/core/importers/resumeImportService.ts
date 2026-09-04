import { extractTextFromFile, renderPdfPagesForVision } from '../parser/textExtractor';
import { importResumeText } from './jsonResumeImporter';
import { mergeResumeImports } from './visionResumeImporter';
import { prepareResumeImage } from './resumeImagePreparation';
import { getAISettings } from '../storage/aiSettingsStorage';
import type { StandardResume } from '../../types/resume';
import { enumerateResumeFields } from '../schema/resumeFieldRegistry';

export interface ResumeImportOutcome {
  resume: StandardResume;
  text: string;
  fileName: string;
  notice: string;
  localResume?: StandardResume;
  aiChanges?: { added: number; changed: number; labels: string[] };
}

function describeAIChanges(local: StandardResume | null, merged: StandardResume) {
  const before = new Map(local ? enumerateResumeFields(local).map((field) => [field.path, field.value]) : []);
  const result = { added: 0, changed: 0, labels: [] as string[] };
  for (const field of enumerateResumeFields(merged)) {
    if (!field.definition.fillable) continue;
    if (!before.has(field.path)) result.added++;
    else if (before.get(field.path) !== field.value) result.changed++;
    else continue;
    result.labels.push(field.label);
  }
  return result;
}

export interface DocumentImportOptions {
  enhance: boolean;
  consent: boolean;
}

function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('导入已取消', 'AbortError');
}

async function enabledSettings() {
  const settings = await getAISettings();
  if (!settings.enabled) throw new Error('请先在“设置 → AI 智能兜底”中启用并配置模型');
  return settings;
}

/** Orchestration only: no Vue state, file-picker events, dialogs or persistence. */
export async function importResumeDocument(
  file: File, options: DocumentImportOptions, signal?: AbortSignal,
): Promise<ResumeImportOutcome> {
  checkCancelled(signal);
  if (options.enhance && !options.consent) throw new Error('请先确认 AI 补强的数据发送方式');
  const text = await extractTextFromFile(file);
  checkCancelled(signal);
  const localResume = text?.trim() ? importResumeText(text, file.name.replace(/\.[^/.]+$/, '')) : null;
  if (!options.enhance) {
    if (!localResume) throw new Error('未能在文件中提取到有效文本，请确认该 PDF 不是纯图片扫描件');
    return { resume: localResume, text, fileName: file.name, notice: '本次仅使用本地解析，未调用 AI；请核对识别结果。' };
  }

  try {
    const settings = await enabledSettings();
    checkCancelled(signal);
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    const imageDataUrls = isPdf ? await renderPdfPagesForVision(file, 4) : [];
    checkCancelled(signal);
    const response = await chrome.runtime.sendMessage({
      type: 'AI_PARSE_RESUME_DOCUMENT',
      payload: { settings, imageDataUrls, documentText: text.slice(0, 60_000), fileName: file.name, confirmedExternalProcessing: true },
    });
    checkCancelled(signal);
    if (!response?.success || !response.resume) throw new Error(response?.error || 'AI 没有返回简历数据');
    const aiResume = response.resume as StandardResume;
    const resume = localResume ? mergeResumeImports(localResume, aiResume) : aiResume;
    return {
      resume, localResume: localResume || undefined,
      aiChanges: describeAIChanges(localResume, resume),
      text, fileName: file.name,
      notice: isPdf ? `AI 已结合本地文本和 PDF 页面图补强（最多前 ${Math.min(4, imageDataUrls.length)} 页）`
        : 'AI 已结合 Word/文本的本地提取内容补强结构化结果',
    };
  } catch (error) {
    checkCancelled(signal);
    if (!localResume) throw error;
    return {
      resume: localResume, text, fileName: file.name,
      notice: `AI 补强未完成，已保留本地解析结果：${error instanceof Error ? error.message : '未知错误'}。你可以直接核对并导入，或更换模型后重新上传；扫描 PDF 请使用视觉模型。`,
    };
  }
}

export async function importResumeImage(file: File, consent: boolean, signal?: AbortSignal): Promise<ResumeImportOutcome> {
  checkCancelled(signal);
  if (!consent) throw new Error('请确认本次图片处理方式后再开始识别');
  const settings = await enabledSettings();
  checkCancelled(signal);
  const imageDataUrl = await prepareResumeImage(file);
  checkCancelled(signal);
  const response = await chrome.runtime.sendMessage({
    type: 'AI_PARSE_RESUME_IMAGE',
    payload: { settings, imageDataUrl, fileName: file.name, confirmedExternalProcessing: true },
  });
  checkCancelled(signal);
  if (!response?.success || !response.resume) throw new Error(response?.error || '视觉模型没有返回简历数据');
  const resume = response.resume as StandardResume;
  return { resume, text: '', fileName: file.name, notice: '本次结果来自 AI 图片识别，没有本地文本结果可对照。请逐项核对，尤其是联系方式、日期、学历和经历。', aiChanges: describeAIChanges(null, resume) };
}

export function importPastedResume(text: string): ResumeImportOutcome {
  if (!text.trim()) throw new Error('请先粘贴简历文本内容');
  return { resume: importResumeText(text, '粘贴文本导入简历'), text, fileName: '粘贴文本', notice: '' };
}
