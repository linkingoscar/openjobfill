import { extractTextFromFile, renderPdfPagesForVision } from '../parser/textExtractor';
import { importResumeText } from './jsonResumeImporter';
import { prepareResumeImage } from './resumeImagePreparation';
import { getAISettings } from '../storage/aiSettingsStorage';
import type { StandardResume } from '../../types/resume';
import type { ImportConflict, ParsedCandidate, ResumeV5 } from '../../types/trustedResume';
import { buildTrustedImportReview } from './trustedImport';

export interface ResumeImportOutcome {
  resume: ResumeV5;
  text: string;
  fileName: string;
  notice: string;
  localCandidates: ParsedCandidate[];
  aiCandidates: ParsedCandidate[];
  conflicts: ImportConflict[];
  acceptedPaths: string[];
}

export interface DocumentImportOptions {
  enhance: boolean;
  consent: boolean;
  /** Existing trusted profile. Locked/confirmed facts are preserved and conflicts are surfaced. */
  baseResume?: StandardResume | null;
}

function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('导入已取消', 'AbortError');
}

async function enabledSettings() {
  const settings = await getAISettings();
  if (!settings.enabled) throw new Error('请先在“设置 → AI 智能兜底”中启用并配置模型');
  return settings;
}

function reviewOutcome(input: {
  localResume?: StandardResume | null;
  aiResume?: StandardResume | null;
  baseResume?: StandardResume | null;
  text: string;
  fileName: string;
  notice?: string;
}): ResumeImportOutcome {
  const review = buildTrustedImportReview({
    localResume: input.localResume,
    aiResume: input.aiResume,
    baseResume: input.baseResume,
    documentText: input.text,
    fileName: input.fileName,
  });
  return { ...review, text: input.text, fileName: input.fileName, notice: input.notice || '' };
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
    if (!localResume) throw new Error('未能在文件中提取到有效文本。若这是扫描 PDF，请明确启用 AI 视觉解析；系统不会生成伪结构化结果。');
    return reviewOutcome({ localResume, baseResume: options.baseResume, text, fileName: file.name });
  }

  try {
    const settings = await enabledSettings();
    checkCancelled(signal);
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    const imageDataUrls = isPdf ? await renderPdfPagesForVision(file, 4) : [];
    checkCancelled(signal);
    const response = await chrome.runtime.sendMessage({
      type: 'AI_PARSE_RESUME_DOCUMENT',
      payload: {
        settings,
        imageDataUrls,
        documentText: text.slice(0, 60_000),
        fileName: file.name,
        confirmedExternalProcessing: true,
      },
    });
    checkCancelled(signal);
    if (!response?.success || !response.resume) throw new Error(response?.error || 'AI 没有返回可校验的简历候选');
    const aiResume = response.resume as StandardResume;
    return reviewOutcome({
      localResume,
      aiResume,
      baseResume: options.baseResume,
      text,
      fileName: file.name,
      notice: isPdf
        ? `AI 已生成字段候选并结合本地文本/PDF 页面图补强（最多前 ${Math.min(4, imageDataUrls.length)} 页）；冲突不会自动覆盖。`
        : 'AI 已生成字段候选并结合 Word/文本本地结果补强；冲突不会自动覆盖。',
    });
  } catch (error) {
    checkCancelled(signal);
    if (!localResume) throw error;
    return reviewOutcome({
      localResume,
      baseResume: options.baseResume,
      text,
      fileName: file.name,
      notice: `AI 补强未完成，已完整保留本地候选：${error instanceof Error ? error.message : '未知错误'}`,
    });
  }
}

export async function importResumeImage(
  file: File,
  consent: boolean,
  signal?: AbortSignal,
  baseResume?: StandardResume | null,
): Promise<ResumeImportOutcome> {
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
  if (!response?.success || !response.resume) throw new Error(response?.error || '视觉模型没有返回可校验的简历候选');
  return reviewOutcome({
    aiResume: response.resume as StandardResume,
    baseResume,
    text: '',
    fileName: file.name,
    notice: '扫描/图片简历由 AI 生成字段候选；无证据或低置信项必须在导入审核中确认。',
  });
}

export function importPastedResume(text: string, baseResume?: StandardResume | null): ResumeImportOutcome {
  if (!text.trim()) throw new Error('请先粘贴简历文本内容');
  const localResume = importResumeText(text, '粘贴文本导入简历');
  return reviewOutcome({ localResume, baseResume, text, fileName: '粘贴文本' });
}
