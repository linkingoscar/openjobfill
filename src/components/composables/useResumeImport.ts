import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import {
  importPastedResume, importResumeDocument, importResumeImage,
  type DocumentImportOptions, type ResumeImportOutcome,
} from '@/core/importers/resumeImportService';
import { confirmField, getResumeValue, resolveImportConflict, setResumeValue } from '@/core/schema/trustedResume';
import type { StandardResume } from '@/types/resume';

export type ImportConflictDecision =
  | 'keep-current'
  | 'keep-current-lock'
  | 'accept-candidate'
  | 'accept-candidate-lock';

/** Owns import progress and results; late responses cannot restore a discarded preview. */
export function useResumeImport() {
  const outcome = shallowRef<ResumeImportOutcome | null>(null);
  const busy = ref(false);
  const error = ref('');
  let controller: AbortController | undefined;
  let disposed = false;

  function reset() {
    controller?.abort();
    controller = undefined;
    outcome.value = null;
    error.value = '';
    busy.value = false;
  }

  async function run(operation: (signal: AbortSignal) => ResumeImportOutcome | Promise<ResumeImportOutcome>) {
    if (disposed) return;
    reset();
    const current = new AbortController();
    controller = current;
    busy.value = true;
    try {
      const next = await operation(current.signal);
      if (current.signal.aborted) return;
      outcome.value = next;
      return next;
    } catch (cause) {
      if (!current.signal.aborted) error.value = cause instanceof Error ? cause.message : '简历解析失败';
    } finally {
      if (controller === current) busy.value = false;
    }
  }

  function resolveConflict(path: string, decision: ImportConflictDecision) {
    const current = outcome.value;
    if (!current) return;
    const conflict = current.conflicts.find((item) => item.path === path);
    if (!conflict) return;
    const now = Date.now();
    const acceptCandidate = decision.startsWith('accept-candidate');
    const shouldLock = decision.endsWith('-lock');
    let resume = resolveImportConflict(current.resume, conflict, acceptCandidate ? 'accept-candidate' : 'keep-current', now);
    if (shouldLock) resume = confirmField(resume, path, { lock: true, now });
    outcome.value = {
      ...current,
      resume,
      conflicts: current.conflicts.filter((item) => item !== conflict),
      acceptedPaths: acceptCandidate
        ? Array.from(new Set([...current.acceptedPaths, path]))
        : current.acceptedPaths,
    };
  }

  function lockField(path: string) {
    const current = outcome.value;
    if (!current) return;
    try {
      outcome.value = { ...current, resume: confirmField(current.resume, path, { lock: true, now: Date.now() }) };
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '字段锁定失败';
    }
  }

  function updateField(path: string, rawValue: string | number | boolean) {
    const current = outcome.value;
    if (!current) return;
    try {
      const previousValue = getResumeValue(current.resume, path);
      let value: unknown = rawValue;
      if (typeof previousValue === 'number' && typeof rawValue === 'string') {
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed)) throw new Error('该字段需要有效数字');
        value = parsed;
      } else if (typeof previousValue === 'boolean' && typeof rawValue === 'string') {
        if (!['true', 'false'].includes(rawValue)) throw new Error('该字段需要布尔值');
        value = rawValue === 'true';
      }
      const next = structuredClone(current.resume);
      setResumeValue(next, path, value);
      const confirmed = confirmField(next, path, { now: Date.now() });
      outcome.value = {
        ...current,
        resume: confirmed,
        conflicts: current.conflicts.filter((item) => item.path !== path),
        acceptedPaths: Array.from(new Set([...current.acceptedPaths, path])),
      };
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '字段修改失败';
    }
  }

  onScopeDispose(() => { disposed = true; reset(); });
  return {
    isParsing: computed(() => busy.value),
    errorMessage: computed(() => error.value),
    parsedResume: computed(() => outcome.value?.resume || null),
    enhancementNotice: computed(() => outcome.value?.notice || ''),
    localCandidates: computed(() => outcome.value?.localCandidates || []),
    aiCandidates: computed(() => outcome.value?.aiCandidates || []),
    importConflicts: computed(() => outcome.value?.conflicts || []),
    acceptedPaths: computed(() => outcome.value?.acceptedPaths || []),
    canConfirmImport: computed(() => (outcome.value?.conflicts.length || 0) === 0),
    reset,
    resolveConflict,
    lockField,
    updateField,
    reportError: (message: string) => { error.value = message; },
    importDocument: (file: File, options: DocumentImportOptions) => run((signal) => importResumeDocument(file, options, signal)),
    importImage: (file: File, consent: boolean, baseResume?: StandardResume | null) => run((signal) => importResumeImage(file, consent, signal, baseResume)),
    importText: (text: string, baseResume?: StandardResume | null) => run(() => importPastedResume(text, baseResume)),
  };
}
