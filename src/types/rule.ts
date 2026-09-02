import type { FieldInputType } from './adapter';
import type { FieldLocatorEvidence } from './pipeline';

export type CustomRuleStatus = 'ACTIVE' | 'STALE';
export type CustomRuleOccurrenceMode = 'NONE' | 'FIELD_REPEAT_INDEX' | 'STATIC';
export type CustomRuleMatchMethod = 'selector' | 'fingerprint' | 'locator';

export interface CustomRuleSiteScope {
  hostname: string;
  /** Optional pathname boundary. Query strings and hashes never participate in matching. */
  pathPrefix?: string;
}

export interface CustomFieldMapping {
  id: string;
  selector: string;
  resumeKey: string;
  type?: FieldInputType;
  description?: string;
  /** Optional value-free evidence captured when the user confirms a mapping. */
  fingerprint?: string;
  locator?: FieldLocatorEvidence;
  status?: CustomRuleStatus;
  occurrenceMode?: CustomRuleOccurrenceMode;
  staticIndex?: number;
  /** Read-back verification health. No field values are stored here. */
  successCount?: number;
  failureCount?: number;
  lastVerifiedAt?: number;
  lastFailureReason?: string;
}

export interface CustomSiteRule {
  id: string;
  /** Version 2 adds structured site scope and evidence-aware field status. */
  version?: 2;
  name: string;
  domainPattern: string; // e.g. "zhipin.com", "liepin.com", "example.com"
  site?: CustomRuleSiteScope;
  enabled: boolean;
  fields: CustomFieldMapping[];
  updatedAt?: string;
}
