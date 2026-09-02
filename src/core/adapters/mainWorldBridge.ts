import type { FieldDescriptor } from '../../types/pipeline';
import type { ControlAdapterId } from './controlAdapters';

export type MainWorldControlAction = 'TYPE' | 'SELECT_TEXT' | 'SELECT_PATH';

export interface MainWorldControlRequest {
  adapterId: ControlAdapterId;
  action: MainWorldControlAction;
  field: FieldDescriptor;
  value: string | string[];
  runId?: string;
}

interface MainWorldResponse {
  success?: boolean;
  token?: string;
  error?: string;
}

function escapeAttribute(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildBridgeSelectors(field: FieldDescriptor): string[] {
  const selectors = [...(field.locator?.selectors || [])];
  const el = field.element;
  if (el.id) selectors.unshift(`#${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(el.id) : escapeAttribute(el.id)}`);
  const automationId = el.getAttribute('data-automation-id');
  if (automationId) selectors.push(`[data-automation-id="${escapeAttribute(automationId)}"]`);
  const testId = el.getAttribute('data-testid');
  if (testId) selectors.push(`[data-testid="${escapeAttribute(testId)}"]`);
  if (field.name) selectors.push(`[name="${escapeAttribute(field.name)}"]`);
  return [...new Set(selectors.filter((selector) => !selector.startsWith('/') && selector.length > 0 && selector.length <= 512))].slice(0, 8);
}

/**
 * 请求 Background 在消息来源所在 frame 的 MAIN world 执行固定动作。
 * 每次动作先领取一次性 token；桥不接受任意脚本，也不提供提交/保存动作。
 */
export async function executeMainWorldControlAction(request: MainWorldControlRequest): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return false;
  const selectors = buildBridgeSelectors(request.field);
  if (selectors.length === 0) return false;

  const runId = request.runId || `control-${Date.now()}`;
  const requestId = `${runId}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const authorization = await chrome.runtime.sendMessage({
      type: 'AUTHORIZE_MAIN_WORLD_CONTROL',
      payload: { runId, requestId },
    }) as MainWorldResponse;
    if (!authorization?.success || !authorization.token) return false;

    const result = await chrome.runtime.sendMessage({
      type: 'EXECUTE_MAIN_WORLD_CONTROL',
      payload: {
        runId,
        requestId,
        token: authorization.token,
        adapterId: request.adapterId,
        action: request.action,
        selectors,
        value: request.value,
      },
    }) as MainWorldResponse;
    return result?.success === true;
  } catch {
    return false;
  }
}
