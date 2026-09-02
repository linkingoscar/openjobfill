import type { AISettings, AIFieldMappingResponse, ResumeKeyOption, UnmatchedFieldDescriptor } from './ai';
import type { StandardResume } from './resume';
import type { FillResult } from './adapter';
import type { RemoteFramePlan } from './pipeline';
import type { ApplicationStatus, JobApplicationRecord } from './tracker';

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
  | { type: 'ANALYZE_CROSS_ORIGIN_FRAMES'; payload: { resumeId: string; runId?: string } }
  | { type: 'EXECUTE_CROSS_ORIGIN_FRAMES'; payload: { targets: FrameTarget[] } }
  | { type: 'CANCEL_CROSS_ORIGIN_FRAMES'; payload: { targets: FrameTarget[] } }
  | { type: 'FRAME_ANALYZE'; payload: { analysisId: string; resumeId?: string; runId?: string } }
  | { type: 'FRAME_EXECUTE'; payload: { analysisId: string } }
  | { type: 'FRAME_CANCEL_ANALYSIS'; payload: { analysisId: string } }
  | { type: 'AUTHORIZE_MAIN_WORLD_CONTROL'; payload: { runId: string; requestId: string } }
  | {
      type: 'EXECUTE_MAIN_WORLD_CONTROL';
      payload: {
        runId: string;
        requestId: string;
        token: string;
        adapterId: string;
        action: 'TYPE' | 'SELECT_TEXT' | 'SELECT_PATH';
        selectors: string[];
        value: string | string[];
      };
    }
  | { type: 'AI_MAP_FIELDS'; payload: { settings: AISettings; fields: UnmatchedFieldDescriptor[]; options: ResumeKeyOption[] } }
  | { type: 'AI_PARSE_RESUME_IMAGE'; payload: { settings: AISettings; imageDataUrl: string; fileName: string; confirmedExternalProcessing: true } }
  | { type: 'AI_PARSE_RESUME_DOCUMENT'; payload: { settings: AISettings; imageDataUrls: string[]; documentText: string; fileName: string; confirmedExternalProcessing: true } }
  | { type: 'RESUME_STORAGE_SAVE'; payload: { resume: StandardResume } }
  | { type: 'RESUME_STORAGE_UPDATE_FIELDS'; payload: { id: string; updates: Record<string, unknown> } }
  | { type: 'RESUME_STORAGE_APPEND_ARRAY_ITEM'; payload: { id: string; path: string; item: unknown } }
  | { type: 'RESUME_STORAGE_REPLACE_ALL'; payload: { resumes: StandardResume[] } }
  | { type: 'RESUME_STORAGE_DELETE'; payload: { id: string } }
  | { type: 'TRACKER_STORAGE_GET' }
  | { type: 'TRACKER_STORAGE_SAVE'; payload: { application: JobApplicationRecord } }
  | { type: 'TRACKER_STORAGE_REPLACE_ALL'; payload: { applications: JobApplicationRecord[] } }
  | { type: 'TRACKER_STORAGE_DELETE'; payload: { id: string } }
  | { type: 'TRACKER_STORAGE_UPDATE_STATUS'; payload: { id: string; status: ApplicationStatus } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return isNonEmptyString(value) && value.length <= maxLength;
}

function isMainWorldValue(value: unknown): value is string | string[] {
  return (isString(value) && value.length <= 2_000)
    || (Array.isArray(value)
      && value.length > 0
      && value.length <= 6
      && value.every((item) => isString(item) && item.length > 0 && item.length <= 240));
}

const MAIN_WORLD_CONTROL_ADAPTER_IDS = new Set([
  'PhoenixInput',
  'HcSuperSelector',
  'PhoenixSelect',
  'Job51SetdayDate',
  'My97Date',
]);

function isFrameTargets(value: unknown): value is FrameTarget[] {
  return Array.isArray(value) && value.every((target) =>
    isRecord(target)
    && Number.isInteger(target.frameId)
    && isNonEmptyString(target.analysisId),
  );
}

const APPLICATION_STATUSES = new Set([
  'applied', 'screening', 'assessment', 'interview1', 'interview2', 'hr', 'offer', 'rejected',
]);

function isTrackerApplication(value: unknown): value is JobApplicationRecord {
  return isRecord(value)
    && isBoundedString(value.id, 240)
    && isBoundedString(value.companyName, 160)
    && isBoundedString(value.jobTitle, 200)
    && isBoundedString(value.appliedDate, 10)
    && APPLICATION_STATUSES.has(String(value.status))
    && isString(value.jobUrl)
    && value.jobUrl.length <= 2_000
    && isString(value.updatedAt)
    && value.updatedAt.length <= 64;
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
      return isRecord(payload) && isNonEmptyString(payload.resumeId)
        && (payload.runId === undefined || isNonEmptyString(payload.runId));
    case 'EXECUTE_CROSS_ORIGIN_FRAMES':
    case 'CANCEL_CROSS_ORIGIN_FRAMES':
      return isRecord(payload) && isFrameTargets(payload.targets);
    case 'FRAME_ANALYZE':
      return isRecord(payload)
        && isNonEmptyString(payload.analysisId)
        && (payload.resumeId === undefined || isString(payload.resumeId))
        && (payload.runId === undefined || isNonEmptyString(payload.runId));
    case 'FRAME_EXECUTE':
    case 'FRAME_CANCEL_ANALYSIS':
      return isRecord(payload) && isNonEmptyString(payload.analysisId);
    case 'AUTHORIZE_MAIN_WORLD_CONTROL':
      return isRecord(payload)
        && isBoundedString(payload.runId, 200)
        && isBoundedString(payload.requestId, 260);
    case 'EXECUTE_MAIN_WORLD_CONTROL':
      return isRecord(payload)
        && isBoundedString(payload.runId, 200)
        && isBoundedString(payload.requestId, 260)
        && isBoundedString(payload.token, 200)
        && isBoundedString(payload.adapterId, 80)
        && MAIN_WORLD_CONTROL_ADAPTER_IDS.has(payload.adapterId)
        && ['TYPE', 'SELECT_TEXT', 'SELECT_PATH'].includes(String(payload.action))
        && Array.isArray(payload.selectors)
        && payload.selectors.length > 0
        && payload.selectors.length <= 8
        && payload.selectors.every((selector) => isBoundedString(selector, 512))
        && isMainWorldValue(payload.value);
    case 'AI_MAP_FIELDS':
      return isRecord(payload)
        && isRecord(payload.settings)
        && Array.isArray(payload.fields)
        && Array.isArray(payload.options);
    case 'AI_PARSE_RESUME_IMAGE':
      return isRecord(payload)
        && isRecord(payload.settings)
        && isString(payload.imageDataUrl)
        && payload.imageDataUrl.length <= 12_000_000
        && /^data:image\/(?:jpeg|png|webp);base64,/i.test(payload.imageDataUrl)
        && isNonEmptyString(payload.fileName)
        && payload.fileName.length <= 240
        && payload.confirmedExternalProcessing === true;
    case 'AI_PARSE_RESUME_DOCUMENT':
      return isRecord(payload)
        && isRecord(payload.settings)
        && Array.isArray(payload.imageDataUrls)
        && payload.imageDataUrls.length <= 4
        && payload.imageDataUrls.every((image) => isString(image)
          && image.length <= 12_000_000
          && /^data:image\/(?:jpeg|png|webp);base64,/i.test(image))
        && payload.imageDataUrls.reduce((total, image) => total + image.length, 0) <= 24_000_000
        && isString(payload.documentText)
        && payload.documentText.length <= 60_000
        && (payload.imageDataUrls.length > 0 || payload.documentText.trim().length > 0)
        && isNonEmptyString(payload.fileName)
        && payload.fileName.length <= 240
        && payload.confirmedExternalProcessing === true;
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
    case 'TRACKER_STORAGE_GET':
      return payload === undefined;
    case 'TRACKER_STORAGE_SAVE':
      return isRecord(payload) && isTrackerApplication(payload.application);
    case 'TRACKER_STORAGE_REPLACE_ALL':
      return isRecord(payload)
        && Array.isArray(payload.applications)
        && payload.applications.length <= 10_000
        && payload.applications.every(isTrackerApplication);
    case 'TRACKER_STORAGE_DELETE':
      return isRecord(payload) && isBoundedString(payload.id, 240);
    case 'TRACKER_STORAGE_UPDATE_STATUS':
      return isRecord(payload)
        && isBoundedString(payload.id, 240)
        && APPLICATION_STATUSES.has(String(payload.status));
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
  resume?: StandardResume;
  applications?: JobApplicationRecord[];
}
