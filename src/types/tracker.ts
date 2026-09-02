export type ApplicationStatus = 
  | 'applied'       // 已投递
  | 'screening'     // 简历初筛
  | 'assessment'    // 笔试/测评
  | 'interview1'    // 技术一面
  | 'interview2'    // 业务/技术复试
  | 'hr'            // HR 终面
  | 'offer'         // 已收 Offer
  | 'rejected';     // 流程结束

export interface JobApplicationRecord {
  id: string;
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
  confirmedAt?: string;
  updatedAt: string;
}
