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
    expect(isExtensionMessage({
      type: 'AI_PARSE_RESUME_IMAGE',
      payload: { settings: { enabled: true }, imageDataUrl: 'data:image/jpeg;base64,YQ==', fileName: 'resume.jpg', confirmedExternalProcessing: true },
    })).toBe(true);
    expect(isExtensionMessage({
      type: 'AI_PARSE_RESUME_DOCUMENT',
      payload: {
        settings: { enabled: true },
        imageDataUrls: ['data:image/jpeg;base64,YQ=='],
        documentText: '本地提取文本',
        fileName: 'resume.pdf',
        confirmedExternalProcessing: true,
      },
    })).toBe(true);
  });

  it('rejects malformed or unknown payloads before they reach handlers', () => {
    expect(isExtensionMessage({ type: 'RESUME_STORAGE_UPDATE_FIELDS', payload: { id: 'resume-1', updates: [] } })).toBe(false);
    expect(isExtensionMessage({ type: 'FRAME_EXECUTE', payload: { analysisId: '' } })).toBe(false);
    expect(isExtensionMessage({ type: 'EXECUTE_CROSS_ORIGIN_FRAMES', payload: { targets: [{ frameId: '3', analysisId: 'x' }] } })).toBe(false);
    expect(isExtensionMessage({ type: 'UNKNOWN_MESSAGE', payload: {} })).toBe(false);
    expect(isExtensionMessage({
      type: 'AI_PARSE_RESUME_IMAGE',
      payload: { settings: {}, imageDataUrl: 'https://example.com/resume.jpg', fileName: 'resume.jpg' },
    })).toBe(false);
    expect(isExtensionMessage({
      type: 'AI_PARSE_RESUME_DOCUMENT',
      payload: { settings: {}, imageDataUrls: [], documentText: '', fileName: 'resume.docx', confirmedExternalProcessing: true },
    })).toBe(false);
  });
});
