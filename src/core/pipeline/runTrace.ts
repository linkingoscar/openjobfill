/** Value-free runtime events. A sink keeps low-level execution independent of storage. */
export type RunTraceStage = 'ai-request' | 'ai-response' | 'execution-plan' | 'field-gate' | 'adapter-route' | 'adapter-attempt' | 'read-back' | 'execution-result' | 'section-plan' | 'section-transition' | 'section-result' | 'context-invalidated';
export type RunTraceSink = (stage: RunTraceStage, payload: unknown, runId: string) => void;
let sink: RunTraceSink | undefined;
export function setRunTraceSink(next: RunTraceSink) { sink = next; }
export function recordRunTrace(stage: RunTraceStage, payload: unknown, runId?: string) {
  if (!runId) return; // Never attribute a concurrent/background operation to the current run implicitly.
  try { sink?.(stage, payload, runId); } catch { /* Diagnostics must not interrupt filling. */ }
}
