import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import {
  importPastedResume, importResumeDocument, importResumeImage,
  type DocumentImportOptions, type ResumeImportOutcome,
} from '@/core/importers/resumeImportService';

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

  onScopeDispose(() => { disposed = true; reset(); });
  return {
    isParsing: computed(() => busy.value),
    errorMessage: computed(() => error.value),
    parsedResume: computed(() => outcome.value?.resume || null),
    enhancementNotice: computed(() => outcome.value?.notice || ''),
    reset,
    reportError: (message: string) => { error.value = message; },
    importDocument: (file: File, options: DocumentImportOptions) => run((signal) => importResumeDocument(file, options, signal)),
    importImage: (file: File, consent: boolean) => run((signal) => importResumeImage(file, consent, signal)),
    importText: (text: string) => run(() => importPastedResume(text)),
  };
}
