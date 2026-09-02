import { describe, expect, it } from 'vitest';
import {
  BUILTIN_RECRUITMENT_MATCHES,
  customDomainPermissionPattern,
  normalizeCustomDomain,
  permissionPatternForBaseUrl,
} from '@/core/recruitmentPermissions';

describe('recruitment permission policy', () => {
  it('never treats all websites as a built-in recruitment origin', () => {
    expect(BUILTIN_RECRUITMENT_MATCHES).not.toContain('<all_urls>');
    expect(BUILTIN_RECRUITMENT_MATCHES).not.toContain('*://*/*');
    expect(BUILTIN_RECRUITMENT_MATCHES).not.toContain('https://*/*');
    expect(BUILTIN_RECRUITMENT_MATCHES).toContain('http://localhost/*');
    expect(BUILTIN_RECRUITMENT_MATCHES.some((pattern) => pattern.includes('myworkdayjobs.com'))).toBe(true);
  });

  it('normalizes and bounds custom recruitment domain permissions', () => {
    expect(normalizeCustomDomain('https://HR.Example.com/careers/apply')).toBe('hr.example.com');
    expect(customDomainPermissionPattern('hr.example.com')).toBe('*://*.hr.example.com/*');
    expect(customDomainPermissionPattern('https://jobs.example.com/apply')).toBe('*://*.jobs.example.com/*');
    expect(customDomainPermissionPattern('bad domain.example.com')).toBeNull();
    expect(customDomainPermissionPattern('../example.com')).toBeNull();
  });

  it('requests only the configured AI origin instead of a global host permission', () => {
    expect(permissionPatternForBaseUrl('https://api.example.com/v1')).toBe('https://api.example.com/*');
    expect(permissionPatternForBaseUrl('http://localhost:11434/api')).toBe('http://localhost:11434/*');
    expect(permissionPatternForBaseUrl('file:///tmp/model')).toBeNull();
    expect(permissionPatternForBaseUrl('not-a-url')).toBeNull();
  });
});
