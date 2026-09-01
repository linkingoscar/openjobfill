import { getAllDocumentsAcrossIframes, isElementVisible, sleep } from '../../utils/dom';

const UPLOAD_SELECTOR = [
  'input[type="file"]',
  '.ant-upload-drag',
  '.el-upload-dragger',
  '[class*="resume-upload"]',
  '[class*="file-upload"]',
  '[class*="dropzone"]',
].join(',');

function describeUploadTarget(target: HTMLElement): string {
  const input = target instanceof HTMLInputElement
    ? target
    : target.querySelector<HTMLInputElement>('input[type="file"]');
  return [
    target.getAttribute('aria-label'),
    target.getAttribute('title'),
    target.textContent,
    input?.name,
    input?.accept,
    input?.getAttribute('aria-label'),
    input?.closest('label')?.textContent,
  ].filter(Boolean).join(' ').toLowerCase();
}

function uploadPriority(target: HTMLElement): number {
  const hint = describeUploadTarget(target);
  let score = 0;
  if (/简历|resume|cv/.test(hint)) score += 100;
  if (/附件|attachment|文件|upload/.test(hint)) score += 20;
  if (/头像|照片|证件照|avatar|photo|image/.test(hint)) score -= 100;
  return score;
}

function createTransfer(target: HTMLElement, file: File): DataTransfer | null {
  const view = target.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  const Transfer = view?.DataTransfer || globalThis.DataTransfer;
  if (!Transfer) return null;
  const transfer = new Transfer();
  transfer.items.add(file);
  return transfer;
}

/** 把用户明确选择的文件注入指定上传控件。不会自行读取磁盘。 */
export async function injectAttachment(target: HTMLElement, sourceFile: File): Promise<boolean> {
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
      return input.files?.length === 1;
    }

    const view = target.ownerDocument.defaultView as (Window & typeof globalThis) | null;
    const Drag = view?.DragEvent || globalThis.DragEvent;
    if (!Drag) return false;
    for (const type of ['dragenter', 'dragover', 'drop']) {
      target.dispatchEvent(new Drag(type, {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }));
    }
    await sleep(200);
    return true;
  } catch (error) {
    console.warn('[OpenJobFill] 附件注入失败:', error);
    return false;
  }
}

/** 优先寻找带“简历 / Resume / CV”语义的上传区，避免误传到头像控件。 */
export async function uploadResumeToPage(file: File): Promise<boolean> {
  const targets = getAllDocumentsAcrossIframes()
    .flatMap((doc) => Array.from(doc.querySelectorAll<HTMLElement>(UPLOAD_SELECTOR)))
    .filter((target) => target instanceof HTMLInputElement || isElementVisible(target))
    .sort((a, b) => uploadPriority(b) - uploadPriority(a));

  for (const target of targets) {
    if (uploadPriority(target) < 0) continue;
    if (await injectAttachment(target, file)) return true;
  }
  return false;
}
