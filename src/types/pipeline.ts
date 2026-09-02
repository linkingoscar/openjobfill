import type { CustomQABankItem } from './resume';
import type { FillLogItem } from './adapter';
import type { FieldSafetyInfo } from '../core/pipeline/fieldSafety';
import type { CustomRuleMatchMethod } from './rule';
import type { RepeatableWorkflowConfig, SiteProfileControlKind, SiteProfileVerificationStatus } from './siteProfile';
import type { FillDecision, FieldRiskLevel } from '../core/pipeline/decisionPolicy';
import type { VerificationStatus } from '../core/pipeline/strictVerification';

export type FieldType = 'text' | 'textarea' | 'radio' | 'checkbox' | 'select' | 'cascader' | 'date' | 'date-range' | 'contenteditable' | 'file' | 'unknown';

export interface FieldSectionInfo {
  type: 'basic' | 'education' | 'experience' | 'project' | 'family' | 'qa' | 'unknown';
  index: number;
  rawTitle?: string;
}

export interface FieldLocatorEvidence {
  fingerprint: string;
  host: string;
  path: string;
  sectionType?: FieldSectionInfo['type'];
  sectionIndex: number;
  sectionTitle?: string;
  label: string;
  tagName: string;
  inputType?: string;
  name?: string;
  id?: string;
  automationId?: string;
  testId?: string;
  role?: string;
  selectors: string[];
  xpath?: string;
}

export interface FieldDescriptor {
  id: string;
  element: HTMLElement;
  type: FieldType;
  label: string;
  placeholder: string;
  name: string;
  ariaLabel: string;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  currentValue: any;
  options?: string[];
  section?: FieldSectionInfo;
  contextText: string;
  fingerprint?: string;
  locator?: FieldLocatorEvidence;
  safety?: FieldSafetyInfo;
  nearbyLabels?: string[];
}

/** Legacy execution action retained for compatibility. decision is the authoritative preview state. */
export type PlanAction = 'FILL' | 'NEEDS_USER' | 'SKIP';
export type DriverType = 'input' | 'select' | 'cascader' | 'date' | 'date-range' | 'radio' | 'checkbox' | 'contenteditable';

export interface FillPlanItem {
  id: string;
  field: FieldDescriptor;
  semanticKey?: string;
  targetValue?: any;
  confidence: number;
  action: PlanAction;
  decision?: FillDecision;
  riskLevel?: FieldRiskLevel;
  reason?: string;
  source?: 'platform_rule' | 'user_rule' | 'qa_bank' | 'semantic_dictionary' | 'fallback' | 'ai';
  driverType: DriverType;
  verificationStatus?: VerificationStatus;
  actualValue?: unknown;
  requiresExplicitReview?: boolean;
  /** When source=user_rule, identify the exact learned mapping for health feedback. */
  learnedRuleMappingId?: string;
}

export interface FillPlan {
  items: FillPlanItem[];
  highConfidenceCount: number;
  needsUserCount: number;
  skipCount: number;
  totalFieldsCount: number;
  reviewRequiredCount?: number;
  optionalUnmatchedCount?: number;
  blockedCount?: number;
  diagnostics?: { customRules: FillPlanCustomRuleDiagnostics };
}

export interface FillPlanCustomRuleDiagnostics {
  matchedCount: number;
  staleMappingIds: string[];
  unmatchedMappingIds: string[];
  methodCounts: Record<CustomRuleMatchMethod, number>;
}

export interface RemoteFillPlanItem {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  action: PlanAction;
  decision?: FillDecision;
  riskLevel?: FieldRiskLevel;
  targetValue?: any;
  confidence: number;
  reason?: string;
  semanticKey?: string;
  source?: FillPlanItem['source'];
  fingerprint?: string;
  locator?: FieldLocatorEvidence;
  learnedRuleMappingId?: string;
}

export interface RemoteFramePlan {
  frameId: number;
  analysisId: string;
  runId?: string;
  pageFingerprint?: string;
  resumeId: string;
  resumeUpdatedAt: number;
  pageUrl: string;
  url: string;
  adapterName: string;
  items: RemoteFillPlanItem[];
  highConfidenceCount: number;
  needsUserCount: number;
  skipCount: number;
}

export interface RemainingTaskItem {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  reason: string;
  element?: HTMLElement;
  frameUrl?: string;
  fingerprint?: string;
  locator?: FieldLocatorEvidence;
  failureCode?: string;
}

export interface PipelineExecutionResult {
  success: boolean;
  filledCount: number;
  skippedCount: number;
  failedCount: number;
  verifiedCount: number;
  logs: FillLogItem[];
  remainingTasks: RemainingTaskItem[];
  durationMs: number;
  plan: FillPlan;
}

export interface PlatformRepeaterConfig {
  sectionRoot?: string;
  itemSelector?: string;
  addButton?: string;
}

export interface PlatformEnhancer {
  id: string;
  name: string;
  description?: string;
  priority: number;
  siteProfile?: { id: string; version: number; verificationStatus: SiteProfileVerificationStatus };
  formRootSelectors?: string[];
  controlSelectors?: Partial<Record<SiteProfileControlKind, string[]>>;
  matches(url: string, doc?: Document): boolean;
  enhanceField?(field: FieldDescriptor): Partial<FieldDescriptor> | null;
  fieldMappings?: Record<string, string>;
  repeaterConfigs?: {
    education?: PlatformRepeaterConfig;
    experience?: PlatformRepeaterConfig;
    project?: PlatformRepeaterConfig;
    family?: PlatformRepeaterConfig;
  };
  workflowConfigs?: RepeatableWorkflowConfig[];
}

export interface QAMatchCandidate {
  item: CustomQABankItem;
  score: number;
}
