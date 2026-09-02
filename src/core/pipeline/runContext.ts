import type { FieldDescriptor } from '../../types/pipeline';
import { isInputElement } from '../../utils/dom';

/**
 * A single fill attempt owns one cancellation boundary.  The fingerprint is
 * deliberately structural (labels, control metadata and section headings),
 * so typing a value does not invalidate a run while a SPA step replacement
 * does.
 */
export interface FillRunMetadata {
  runId: string;
  pageUrl: string;
  pageFingerprint: string;
  startedAt: number;
}

export class FillRunAbortedError extends Error {
  constructor(reason = '填写已取消') {
    super(reason);
    this.name = 'FillRunAbortedError';
  }
}

export function isFillRunAbortedError(error: unknown): error is FillRunAbortedError {
  return error instanceof FillRunAbortedError || (error instanceof Error && error.name === 'FillRunAbortedError');
}

function hashText(value: string): string {
  // Small deterministic hash; this is a change detector, not a security token.
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeText(value: string | null | undefined, limit = 80): string {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, limit);
}

/**
 * Build a privacy-safe structural page signature. Values are intentionally
 * excluded so user edits do not invalidate an otherwise valid preview.
 */
export function createPageFingerprint(doc: Document = document): string {
  if (!doc) return '';
  const controls = Array.from(doc.querySelectorAll<HTMLElement>(
    'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="radio"], [role="checkbox"]',
  )).slice(0, 300).map((el) => {
    const input = isInputElement(el) ? el : null;
    return [
      el.tagName.toLowerCase(),
      input?.type || '',
      normalizeText(el.getAttribute('name')),
      normalizeText(el.id),
      normalizeText(el.getAttribute('aria-label')),
      normalizeText(el.getAttribute('placeholder')),
      normalizeText(el.getAttribute('role')),
      normalizeText(el.className),
    ].join(':');
  });
  const headings = Array.from(doc.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, h5, h6, legend, [class*="section-title"], [class*="form-title"]',
  )).slice(0, 80).map((el) => normalizeText(el.textContent, 120));
  const raw = `${controls.join('|')}##${headings.join('|')}`;
  return `dom-${hashText(raw)}-${controls.length}-${headings.length}`;
}

/** Stable locator evidence for one control; never includes its live value. */
export function createElementFingerprint(el: HTMLElement, sectionTitle = '', index = 0): string {
  const input = isInputElement(el) ? el : null;
  const raw = [
    sectionTitle,
    index,
    el.tagName.toLowerCase(),
    input?.type || '',
    normalizeText(el.getAttribute('name')),
    normalizeText(el.id),
    normalizeText(el.getAttribute('aria-label')),
    normalizeText(el.getAttribute('placeholder')),
    normalizeText(el.className),
  ].join('|');
  return `field-${hashText(raw)}`;
}

export function getCurrentPageUrl(): string {
  return typeof window !== 'undefined' ? window.location.href : '';
}

export class FillRunContext implements FillRunMetadata {
  readonly runId: string;
  readonly pageUrl: string;
  pageFingerprint: string;
  readonly startedAt: number;
  readonly controller: AbortController;

  constructor(options: { runId?: string; pageUrl?: string; doc?: Document } = {}) {
    const doc = options.doc || (typeof document !== 'undefined' ? document : undefined);
    this.runId = options.runId || `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.pageUrl = options.pageUrl ?? getCurrentPageUrl();
    this.pageFingerprint = createPageFingerprint(doc);
    this.startedAt = Date.now();
    this.controller = new AbortController();
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  abort(reason = '填写已取消'): void {
    if (!this.controller.signal.aborted) this.controller.abort(reason);
  }

  refreshPageFingerprint(doc: Document = typeof document !== 'undefined' ? document : (null as unknown as Document)): void {
    this.pageFingerprint = createPageFingerprint(doc);
  }

  throwIfAborted(): void {
    if (this.controller.signal.aborted) {
      throw new FillRunAbortedError(
        typeof this.controller.signal.reason === 'string'
          ? this.controller.signal.reason
          : '填写已取消',
      );
    }
  }

  isPageCurrent(doc: Document = typeof document !== 'undefined' ? document : (null as unknown as Document)): boolean {
    if (!doc) return true;
    return this.pageUrl === getCurrentPageUrl() && this.pageFingerprint === createPageFingerprint(doc);
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new FillRunAbortedError(
    typeof signal.reason === 'string' ? signal.reason : '填写已取消',
  );
}

export function isAbortSignalLike(value: unknown): value is AbortSignal {
  return !!value && typeof value === 'object' && 'aborted' in value && 'addEventListener' in value;
}
