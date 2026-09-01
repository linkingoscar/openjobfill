import { describe, expect, it } from 'vitest';
import { isExtensionMessage } from '@/types/message';

describe('Extension message protocol', () => {
  it('accepts the storage and cross-frame messages used by current callers', () => {
    expect(isExtensionMessage({
      type: 'RESUME_STORAGE_UPDATE_FIELDS',
      payload: { id: 'resume-1', updates: { 'basics.name': '候选人' } },
    })).toBe(true);
    expect(isExtensionMessage({
      type: 'EXECUTE_CROSS_ORIGIN_FRAMES',
      payload: { targets: [{ frameId: 3, analysisId: 'analysis-1' }] },
    })).toBe(true);
    expect(isExtensionMessage({
      type: 'AI_MAP_FIELDS',
      payload: { settings: { enabled: false }, fields: [], options: [] },
    })).toBe(true);
  });

  it('rejects malformed or unknown payloads before they reach handlers', () => {
    expect(isExtensionMessage({ type: 'RESUME_STORAGE_UPDATE_FIELDS', payload: { id: 'resume-1', updates: [] } })).toBe(false);
    expect(isExtensionMessage({ type: 'FRAME_EXECUTE', payload: { analysisId: '' } })).toBe(false);
    expect(isExtensionMessage({ type: 'EXECUTE_CROSS_ORIGIN_FRAMES', payload: { targets: [{ frameId: '3', analysisId: 'x' }] } })).toBe(false);
    expect(isExtensionMessage({ type: 'UNKNOWN_MESSAGE', payload: {} })).toBe(false);
  });
});
