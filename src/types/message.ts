import type { StandardResume } from './resume';
import type { FillResult } from './adapter';

export type ExtensionMessage =
  | { type: 'TRIGGER_AUTO_FILL'; payload?: { resumeId?: string } }
  | { type: 'GET_ACTIVE_RESUME_REQUEST' }
  | { type: 'GET_ACTIVE_RESUME_RESPONSE'; payload: StandardResume | null }
  | { type: 'AUTO_FILL_COMPLETED'; payload: FillResult }
  | { type: 'OPEN_OPTIONS_PAGE' }
  | { type: 'GET_SITE_INFO_REQUEST' }
  | { type: 'GET_SITE_INFO_RESPONSE'; payload: { siteName: string; isMatched: boolean; url: string } };
