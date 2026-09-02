import type { VerificationStatus } from '../pipeline/strictVerification';

export interface AttachmentMetadata {
  id: string;
  fileName: string;
  mimeType?: string;
  fingerprint?: string;
  resumeVariantId?: string;
  lastUsedAt?: number;
}

export interface AttachmentTarget {
  element: HTMLElement;
  label: string;
  confidence: number;
  rejectedReason?: string;
}

const RESUME_HINTS = [/简历/i, /resume/i, /\bcv\b/i];
const EXCLUDED_HINTS = [/头像/i, /证件照/i, /生活照/i, /照片/i, /photo/i, /avatar/i, /作品/i, /portfolio/i];

function targetText(element: HTMLElement): string {
  const input = element as HTMLInputElement;
  const container = element.closest('label, .form-item, .ant-form-item, .el-form-item, [class*="upload"]') || element.parentElement || element;
  return [input.name, input.id, input.accept, element.getAttribute('aria-label'), container.textContent].filter(Boolean).join(' ');
}

export function classifyAttachmentTarget(element: HTMLElement): AttachmentTarget {
  const label = targetText(element).replace(/\s+/g, ' ').trim();
  if (EXCLUDED_HINTS.some((pattern) => pattern.test(label))) return { element, label, confidence: 0, rejectedReason: '目标区域疑似头像/照片/作品附件' };
  const resumeHits = RESUME_HINTS.filter((pattern) => pattern.test(label)).length;
  return { element, label, confidence: resumeHits ? Math.min(1, 0.7 + resumeHits * 0.15) : 0.2 };
}

export function selectUniqueResumeTarget(elements: HTMLElement[]): { target?: AttachmentTarget; requiresUserSelection: boolean; candidates: AttachmentTarget[] } {
  const candidates = elements.map(classifyAttachmentTarget).filter((item) => !item.rejectedReason);
  const strong = candidates.filter((item) => item.confidence >= 0.7).sort((a, b) => b.confidence - a.confidence);
  if (strong.length === 1) return { target: strong[0], requiresUserSelection: false, candidates };
  return { requiresUserSelection: candidates.length > 0, candidates };
}

export function verifyAttachmentUpload(target: HTMLElement, file: Pick<File, 'name' | 'size' | 'type'>): { status: VerificationStatus; reason: string } {
  const input = target instanceof HTMLInputElement ? target : target.querySelector<HTMLInputElement>('input[type="file"]');
  if (input?.files?.length) {
    const found = Array.from(input.files).some((candidate) => candidate.name === file.name && candidate.size === file.size);
    return found ? { status: 'VERIFIED', reason: '原生 input.files 与目标文件一致' } : { status: 'MISMATCH', reason: 'input.files 与目标文件不一致' };
  }

  const container = target.closest('[class*="upload"], .form-item, .ant-form-item, .el-form-item') || target.parentElement || target;
  const text = (container.textContent || '').replace(/\s+/g, ' ').trim();
  if (text.includes(file.name)) return { status: 'VERIFIED', reason: '页面上传组件显示目标文件名' };
  if (/上传成功|已上传|upload(ed)?|complete|完成/i.test(text) && /删除|移除|delete|remove/i.test(text)) {
    return { status: 'PARTIALLY_VERIFIED', reason: '页面显示完成状态但无法确认文件名' };
  }
  if (/上传中|uploading|progress/i.test(text)) return { status: 'PARTIALLY_VERIFIED', reason: '上传仍在进行中' };
  return { status: 'UNREADABLE', reason: '页面没有提供可验证的上传状态，需人工确认' };
}
