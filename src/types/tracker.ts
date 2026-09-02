export type ApplicationStatus = 
  | 'applied'       // 已投递
  | 'screening'     // 简历初筛
  | 'assessment'    // 笔试/测评
  | 'interview1'    // 技术一面
  | 'interview2'    // 业务/技术复试
  | 'hr'            // HR 终面
  | 'offer'         // 已收 Offer
  | 'rejected';     // 流程结束

export type TrackerFieldSource = 'heuristic' | 'structured_data' | 'user' | 'imported';
export type TrackerSyncState = 'local' | 'pending' | 'synced' | 'failed';
export type TrackerEditableField =
  | 'companyName'
  | 'jobTitle'
  | 'jobUrl'
  | 'salary'
  | 'jdSummary'
  | 'notes';

export interface JobApplicationRecord {
  schemaVersion?: 2;
  id: string;
  /** Stable idempotency key; unlike id it survives retries/import merges. */
  clientRequestId?: string;
  companyName: string;
  jobTitle: string;
  appliedDate: string; // YYYY-MM-DD
  status: ApplicationStatus;
  jobUrl: string;
  salary?: string;
  resumeVersionTitle?: string;
  jdSummary?: string;
  notes?: string;
  /** 建档来源，便于区分用户确认的成功页草稿与普通手动归档。 */
  source?: 'manual' | 'success_detection' | 'user_confirmed';
  sourceDomain?: string;
  fieldSources?: Partial<Record<TrackerEditableField, TrackerFieldSource>>;
  lockedFields?: TrackerEditableField[];
  syncState?: TrackerSyncState;
  createdAt?: string;
  confirmedAt?: string;
  updatedAt: string;
}
