import type { AISettings, AIFieldMappingResponse, ResumeKeyOption, UnmatchedFieldDescriptor } from './ai';
import type { StandardResume } from './resume';
import type { FillResult } from './adapter';
import type { RemoteFramePlan } from './pipeline';

export interface FrameTarget {
  frameId: number;
  analysisId: string;
}

export type ExtensionMessage =
  | { type: 'TRIGGER_AUTO_FILL'; payload?: { resumeId?: string } }
  | { type: 'RECRUITMENT_PAGE_DETECTED' }
  | { type: 'ENSURE_RUNTIME_AND_FORWARD'; payload?: { resumeId?: string } }
  | { type: 'RUNTIME_TRIGGER_AUTO_FILL'; payload?: { resumeId?: string } }
  | { type: 'GET_ACTIVE_RESUME_REQUEST' }
  | { type: 'GET_ACTIVE_RESUME_RESPONSE'; payload: StandardResume | null }
  | { type: 'AUTO_FILL_COMPLETED'; payload: FillResult }
  | { type: 'OPEN_OPTIONS_PAGE' }
  | { type: 'GET_SITE_INFO_REQUEST' }
  | { type: 'GET_SITE_INFO_RESPONSE'; payload: { siteName: string; isMatched: boolean; url: string } }
  | { type: 'ANALYZE_CROSS_ORIGIN_FRAMES'; payload: { resumeId: string } }
  | { type: 'EXECUTE_CROSS_ORIGIN_FRAMES'; payload: { targets: FrameTarget[] } }
  | { type: 'CANCEL_CROSS_ORIGIN_FRAMES'; payload: { targets: FrameTarget[] } }
  | { type: 'FRAME_ANALYZE'; payload: { analysisId: string; resumeId?: string } }
  | { type: 'FRAME_EXECUTE'; payload: { analysisId: string } }
  | { type: 'FRAME_CANCEL_ANALYSIS'; payload: { analysisId: string } }
  | { type: 'AI_MAP_FIELDS'; payload: { settings: AISettings; fields: UnmatchedFieldDescriptor[]; options: ResumeKeyOption[] } }
  | { type: 'RESUME_STORAGE_SAVE'; payload: { resume: StandardResume } }
  | { type: 'RESUME_STORAGE_UPDATE_FIELDS'; payload: { id: string; updates: Record<string, unknown> } }
  | { type: 'RESUME_STORAGE_APPEND_ARRAY_ITEM'; payload: { id: string; path: string; item: unknown } }
  | { type: 'RESUME_STORAGE_REPLACE_ALL'; payload: { resumes: StandardResume[] } }
  | { type: 'RESUME_STORAGE_DELETE'; payload: { id: string } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isFrameTargets(value: unknown): value is FrameTarget[] {
  return Array.isArray(value) && value.every((target) =>
    isRecord(target)
    && Number.isInteger(target.frameId)
    && isNonEmptyString(target.analysisId),
  );
}

/**
 * 轻量运行时协议校验。消息来自扩展边界，不能只依赖 TypeScript：旧版 content
 * script、损坏的 payload 或其它扩展发来的消息都应在入口被拒绝。
 */
export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!isRecord(value) || !isString(value.type)) return false;
  const payload = value.payload;

  switch (value.type) {
    case 'OPEN_OPTIONS_PAGE':
    case 'GET_ACTIVE_RESUME_REQUEST':
    case 'GET_SITE_INFO_REQUEST':
    case 'RECRUITMENT_PAGE_DETECTED':
      return payload === undefined;
    case 'TRIGGER_AUTO_FILL':
    case 'ENSURE_RUNTIME_AND_FORWARD':
    case 'RUNTIME_TRIGGER_AUTO_FILL':
      return payload === undefined || (isRecord(payload) && (payload.resumeId === undefined || isString(payload.resumeId)));
    case 'GET_ACTIVE_RESUME_RESPONSE':
      return payload === null || isRecord(payload);
    case 'AUTO_FILL_COMPLETED':
      return isRecord(payload);
    case 'GET_SITE_INFO_RESPONSE':
      return isRecord(payload)
        && isString(payload.siteName)
        && typeof payload.isMatched === 'boolean'
        && isString(payload.url);
    case 'ANALYZE_CROSS_ORIGIN_FRAMES':
      return isRecord(payload) && isNonEmptyString(payload.resumeId);
    case 'EXECUTE_CROSS_ORIGIN_FRAMES':
    case 'CANCEL_CROSS_ORIGIN_FRAMES':
      return isRecord(payload) && isFrameTargets(payload.targets);
    case 'FRAME_ANALYZE':
      return isRecord(payload)
        && isNonEmptyString(payload.analysisId)
        && (payload.resumeId === undefined || isString(payload.resumeId));
    case 'FRAME_EXECUTE':
    case 'FRAME_CANCEL_ANALYSIS':
      return isRecord(payload) && isNonEmptyString(payload.analysisId);
    case 'AI_MAP_FIELDS':
      return isRecord(payload)
        && isRecord(payload.settings)
        && Array.isArray(payload.fields)
        && Array.isArray(payload.options);
    case 'RESUME_STORAGE_SAVE':
      return isRecord(payload)
        && isRecord(payload.resume)
        && isString(payload.resume.id)
        && isRecord(payload.resume.basics);
    case 'RESUME_STORAGE_UPDATE_FIELDS':
      return isRecord(payload)
        && isString(payload.id)
        && isRecord(payload.updates);
    case 'RESUME_STORAGE_APPEND_ARRAY_ITEM':
      return isRecord(payload)
        && isString(payload.id)
        && isString(payload.path)
        && Object.prototype.hasOwnProperty.call(payload, 'item');
    case 'RESUME_STORAGE_REPLACE_ALL':
      return isRecord(payload)
        && Array.isArray(payload.resumes)
        && payload.resumes.every((resume) => isRecord(resume) && isString(resume.id) && isRecord(resume.basics));
    case 'RESUME_STORAGE_DELETE':
      return isRecord(payload) && isString(payload.id) && payload.id.length > 0;
    default:
      return false;
  }
}

/** 保留给调用方的响应类型，避免各入口重复定义 success/error 结构。 */
export interface ExtensionResponse {
  success: boolean;
  error?: string;
  plans?: RemoteFramePlan[];
  mapping?: AIFieldMappingResponse['mapping'];
}
