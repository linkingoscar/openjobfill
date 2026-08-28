import type { FieldInputType } from './adapter';

export interface CustomFieldMapping {
  id: string;
  selector: string;
  resumeKey: string;
  type?: FieldInputType;
  description?: string;
}

export interface CustomSiteRule {
  id: string;
  name: string;
  domainPattern: string; // e.g. "zhipin.com", "liepin.com", "example.com"
  enabled: boolean;
  fields: CustomFieldMapping[];
  updatedAt?: string;
}
