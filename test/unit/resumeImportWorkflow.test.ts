import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { extractTextFromFile, renderPdfPagesForVision } from '@/core/parser/textExtractor';
import { getAISettings } from '@/core/storage/aiSettingsStorage';
import { importResumeDocument, importResumeImage } from '@/core/importers/resumeImportService';
import { useResumeImport } from '@/components/composables/useResumeImport';
import { importResumeText } from '@/core/importers/jsonResumeImporter';

vi.mock('@/core/parser/textExtractor', () => ({ extractTextFromFile: vi.fn(), renderPdfPagesForVision: vi.fn() }));
vi.mock('@/core/storage/aiSettingsStorage', () => ({ getAISettings: vi.fn() }));

const file = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });
const sendMessage = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('chrome', { runtime: { sendMessage } });
  vi.mocked(extractTextFromFile).mockResolvedValue('张三\n13800138000\nlocal@example.com');
  vi.mocked(renderPdfPagesForVision).mockResolvedValue(['data:image/png;base64,YQ==']);
  vi.mocked(getAISettings).mockResolvedValue({ enabled: true, provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'local' });
});
afterEach(() => vi.unstubAllGlobals());

describe('resume import workflow boundaries', () => {
  it('requires explicit consent for both external-processing paths', async () => {
    await expect(importResumeDocument(file, { enhance: true, consent: false })).rejects.toThrow('确认');
    await expect(importResumeImage(file, false)).rejects.toThrow('确认');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('keeps local parsing independent of AI and preserves it when enhancement fails', async () => {
    const local = await importResumeDocument(file, { enhance: false, consent: false });
    expect(local.resume.basics.phone).toBe('13800138000');
    expect(getAISettings).not.toHaveBeenCalled();
    sendMessage.mockResolvedValue({ success: false, error: '模型不可用' });
    const fallback = await importResumeDocument(file, { enhance: true, consent: true });
    expect(fallback.resume.basics.phone).toBe('13800138000');
    expect(fallback.notice).toContain('本地候选');
    expect(fallback.notice).toContain('模型不可用');
    expect(fallback.localCandidates.length).toBeGreaterThan(0);
  });

  it('keeps local high-confidence facts and exposes conflicting AI candidates instead of overwriting', async () => {
    const ai = importResumeText('李四', 'AI');
    ai.basics.phone = '';
    sendMessage.mockResolvedValue({ success: true, resume: ai });
    const result = await importResumeDocument(file, { enhance: true, consent: true });
    expect(result.resume.basics.name).toBe('张三');
    expect(result.resume.basics.phone).toBe('13800138000');
    expect(result.aiCandidates.some((candidate) => candidate.path === 'basics.name' && candidate.value === '李四')).toBe(true);
    expect(result.conflicts.some((conflict) => conflict.path === 'basics.name' && conflict.candidateValue === '李四')).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'AI_PARSE_RESUME_DOCUMENT',
      payload: expect.objectContaining({ confirmedExternalProcessing: true, imageDataUrls: ['data:image/png;base64,YQ=='] }),
    }));
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('does not start an AI request after import has been discarded during extraction', async () => {
    let finish!: (text: string) => void;
    vi.mocked(extractTextFromFile).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const scope = effectScope();
    try {
      const importer = scope.run(() => useResumeImport())!;
      const pending = importer.importDocument(file, { enhance: true, consent: true });
      importer.reset();
      finish('张三\n13800138000');
      await pending;
      expect(sendMessage).not.toHaveBeenCalled();
      expect(importer.parsedResume.value).toBeNull();
      expect(importer.isParsing.value).toBe(false);
    } finally { scope.stop(); }
  });

  it('a late AI response cannot overwrite a newer pasted-text preview', async () => {
    let finish!: (response: unknown) => void;
    sendMessage.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const scope = effectScope();
    try {
      const importer = scope.run(() => useResumeImport())!;
      const pending = importer.importDocument(file, { enhance: true, consent: true });
      await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled());
      await importer.importText('王五\n13900139000');
      finish({ success: true, resume: importResumeText('旧简历', '旧结果') });
      await pending;
      expect(importer.parsedResume.value?.basics.name).toBe('王五');
      expect(importer.errorMessage.value).toBe('');
    } finally { scope.stop(); }
  });
});
