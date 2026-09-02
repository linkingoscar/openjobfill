import { getAllDocumentsAcrossIframes, isElementVisible, sleep } from '../../utils/dom';
import { personalCompatibilityStorage } from '../storage/personalCompatibilityStorage';
import { selectUniqueResumeTarget, verifyAttachmentUpload } from './attachmentVerification';
import type { VerificationStatus } from '../pipeline/strictVerification';

const UPLOAD_SELECTOR = [
  'input[type="file"]',
  '.ant-upload-drag',
  '.el-upload-dragger',
  '[class*="resume-upload"]',
  '[class*="file-upload"]',
  '[class*="dropzone"]',
].join(',');

function createTransfer(target: HTMLElement, file: File): DataTransfer | null {
  const view = target.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  const Transfer = view?.DataTransfer || globalThis.DataTransfer;
  if (!Transfer) return null;
  const transfer = new Transfer();
  transfer.items.add(file);
  return transfer;
}

async function injectAttachmentRaw(target: HTMLElement, sourceFile: File): Promise<boolean> {
  try {
    const transfer = createTransfer(target, sourceFile);
    if (!transfer) return false;
    const input = target instanceof HTMLInputElement && target.type === 'file'
      ? target
      : target.querySelector<HTMLInputElement>('input[type="file"]');

    if (input) {
      input.files = transfer.files;
      const EventClass = input.ownerDocument.defaultView?.Event || Event;
      input.dispatchEvent(new EventClass('input', { bubbles: true }));
      input.dispatchEvent(new EventClass('change', { bubbles: true }));
      await sleep(150);
      return true;
    }

    const view = target.ownerDocument.defaultView as (Window & typeof globalThis) | null;
    const Drag = view?.DragEvent || globalThis.DragEvent;
    if (!Drag) return false;
    for (const type of ['dragenter', 'dragover', 'drop']) {
      target.dispatchEvent(new Drag(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }
    await sleep(250);
    return true;
  } catch (error) {
    console.warn('[OpenJobFill] 附件注入失败:', error);
    return false;
  }
}

export interface AttachmentUploadResult {
  status: VerificationStatus;
  reason: string;
  targetLabel?: string;
  requiresUserSelection?: boolean;
}

async function persistAttachmentCompatibility(result: AttachmentUploadResult): Promise<void> {
  if (typeof window === 'undefined' || !window.location?.href) return;
  const compatibilityResult = result.status === 'VERIFIED'
    ? 'PASS'
    : result.status === 'PARTIALLY_VERIFIED' || result.requiresUserSelection
      ? 'PARTIAL'
      : 'FAIL';
  try {
    await personalCompatibilityStorage.recordModuleResult(
      window.location.href,
      'attachment',
      compatibilityResult,
      compatibilityResult === 'FAIL' ? 'attachment_unverified' : undefined,
    );
  } catch (error) {
    console.warn('[OpenJobFill] 附件兼容性结果未能持久化:', error);
  }
}

/**
 * 把用户明确选择的文件注入指定控件，并立即执行页面读回。
 * 纯派发 drop/change 事件从不直接等于成功。
 */
export async function injectAttachmentVerified(target: HTMLElement, sourceFile: File): Promise<AttachmentUploadResult> {
  const attempted = await injectAttachmentRaw(target, sourceFile);
  if (!attempted) return { status: 'NOT_HANDLED', reason: '未能执行附件写入' };
  const verification = verifyAttachmentUpload(target, sourceFile);
  return { ...verification };
}

/** 旧调用兼容：只有严格 VERIFIED 才返回 true。 */
export async function injectAttachment(target: HTMLElement, sourceFile: File): Promise<boolean> {
  return (await injectAttachmentVerified(target, sourceFile)).status === 'VERIFIED';
}

/**
 * 自动上传仅在“简历/Resume/CV”目标可唯一确定时执行。
 * 多上传区或无可靠语义时要求用户点选，不猜头像/作品附件。
 */
export async function uploadResumeToPageVerified(file: File): Promise<AttachmentUploadResult> {
  const elements = getAllDocumentsAcrossIframes()
    .flatMap((doc) => Array.from(doc.querySelectorAll<HTMLElement>(UPLOAD_SELECTOR)))
    .filter((target) => target instanceof HTMLInputElement || isElementVisible(target));

  const selection = selectUniqueResumeTarget(elements);
  if (!selection.target) {
    const result: AttachmentUploadResult = {
      status: 'NOT_HANDLED',
      reason: selection.candidates.length ? '存在多个或语义不明确的上传区，请手动点选简历上传区域' : '未找到可用的简历上传区域',
      requiresUserSelection: selection.requiresUserSelection,
    };
    await persistAttachmentCompatibility(result);
    return result;
  }

  const result = await injectAttachmentVerified(selection.target.element, file);
  const withTarget = { ...result, targetLabel: selection.target.label };
  await persistAttachmentCompatibility(withTarget);
  return withTarget;
}

/** 旧调用兼容：未验证或部分验证均返回 false，避免“假成功”。 */
export async function uploadResumeToPage(file: File): Promise<boolean> {
  return (await uploadResumeToPageVerified(file)).status === 'VERIFIED';
}
