import type { PlatformRepeaterConfig } from './pipeline';

export type SiteProfileVerificationStatus =
  | 'REGISTERED'
  | 'ROUTE_VERIFIED'
  | 'FIXTURE_VERIFIED'
  | 'SITE_VERIFIED';

export type RepeatableSectionKey = 'education' | 'experience' | 'project' | 'family';
export type RepeatableWorkflowMode = 'parallel' | 'save-before-next' | 'single-card';

/**
 * Declarative, non-executable workflow description. Action controls are selected
 * by exact visible text; profiles can never inject JavaScript or submit a form.
 */
export interface RepeatableWorkflowConfig {
  sectionKey: RepeatableSectionKey;
  mode: RepeatableWorkflowMode;
  rootSelectors: string[];
  itemSelectors: string[];
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
