import type { PlatformRepeaterConfig } from './pipeline';

export type SiteProfileVerificationStatus =
  | 'REGISTERED'
  | 'ROUTE_VERIFIED'
  | 'FIXTURE_VERIFIED'
  | 'SITE_VERIFIED';

export type RepeatableSectionKey = 'education' | 'experience' | 'project' | 'family';
export type RepeatableWorkflowMode = 'parallel' | 'save-before-next' | 'single-card';
export type SiteProfileControlKind =
  | 'input'
  | 'textarea'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'cascader'
  | 'date'
  | 'upload';

/** Structural evidence extracted from a known application form implementation. */
export interface SiteProfileStructure {
  formRootSelectors: string[];
  titleSelectors?: string[];
  labelSelectors?: string[];
  controlSelectors?: Partial<Record<SiteProfileControlKind, string[]>>;
  evidenceSource?: 'offerlink-static-1.8.5';
}

/**
 * Declarative, non-executable workflow description. Action controls are selected
 * by exact visible text; profiles can never inject JavaScript or submit a form.
 */
export interface RepeatableWorkflowConfig {
  sectionKey: RepeatableSectionKey;
  mode: RepeatableWorkflowMode;
  rootSelectors: string[];
  itemSelectors: string[];
  titleSelectors?: string[];
  titleLabels?: string[];
  editButtonSelectors?: string[];
  saveButtonSelectors?: string[];
  addButtonSelectors?: string[];
  editButtonLabels?: string[];
  saveButtonLabels?: string[];
  addButtonLabels?: string[];
  saveAfterLast?: boolean;
  maxRecords?: number;
}

export interface SiteProfileCompatibility {
  status: SiteProfileVerificationStatus;
  fixtureIds: string[];
  lastVerifiedAt?: string;
  notes?: string;
}

export interface SiteProfile {
  id: string;
  version: 1;
  name: string;
  domains: string[];
  pathPrefixes?: string[];
  /** DOM evidence used for shared ATS/template detection when no domain matches. */
  detectAny?: string[];
  /** All selectors must exist; use this for otherwise generic framework classes. */
  detectAll?: string[];
  baseEnhancerId?: string;
  structure?: SiteProfileStructure;
  fieldMappings?: Record<string, string>;
  repeaterConfigs?: Partial<Record<RepeatableSectionKey, PlatformRepeaterConfig>>;
  workflows?: RepeatableWorkflowConfig[];
  compatibility: SiteProfileCompatibility;
}

export interface SiteProfileMatchTrace {
  id: string;
  name: string;
  version: number;
  matchedBy: 'domain' | 'template' | null;
  status: SiteProfileVerificationStatus;
}
