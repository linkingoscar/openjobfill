import type { FieldInputType } from './adapter';
import type { FieldLocatorEvidence } from './pipeline';

export interface CustomFieldMapping {
  id: string;
  selector: string;
  resumeKey: string;
  type?: FieldInputType;
  description?: string;
  /** Optional value-free evidence captured when the user confirms a mapping. */
  fingerprint?: string;
  locator?: FieldLocatorEvidence;
}

export interface CustomSiteRule {
  id: string;
  name: string;
  domainPattern: string; // e.g. "zhipin.com", "liepin.com", "example.com"
  enabled: boolean;
  fields: CustomFieldMapping[];
  updatedAt?: string;
}
