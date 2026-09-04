import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApplicationArchive } from '@/components/composables/useApplicationArchive';
import { applicationDraftStorage } from '@/core/storage/applicationDraftStorage';
import { trackerStorage } from '@/core/storage/trackerStorage';
import { EMPTY_RESUME } from '@/core/storage/defaultData';
import { extractPageJobSnapshot, isApplicationSuccessPage } from '@/core/tracker/pageJobExtractor';

vi.mock('@/core/tracker/pageJobExtractor', () => ({ extractPageJobSnapshot: vi.fn(), isApplicationSuccessPage: vi.fn() }));
const a = { companyName: '公司 A', jobTitle: '岗位 A', jobUrl: 'https://jobs.example.com/success?id=A' };
const b = { companyName: '公司 B', jobTitle: '岗位 B', jobUrl: 'https://jobs.example.com/success?id=B' };
const options = () => ({ getResume: () => ({ ...EMPTY_RESUME, title: '当前其他简历' }), getJD: () => ({ pageUrl: a.jobUrl, jobTitle: '错误的旧 JD', matchScore: 80, matchedKeywords: [], missingKeywords: [], allDetectedJDKeywords: [], diagnosticTips: [] }), notify: vi.fn(), presentDraft: vi.fn() });
beforeEach(() => { localStorage.clear(); vi.resetAllMocks(); vi.mocked(isApplicationSuccessPage).mockReturnValue(false); });
afterEach(() => vi.unstubAllGlobals());

describe('投递草稿来源隔离', () => {
  it('同域不同查询岗位各自保留草稿，清除一个不影响另一个', async () => {
    await applicationDraftStorage.create(a);
    await applicationDraftStorage.create(b);
    await applicationDraftStorage.clear(b.jobUrl);
    expect((await applicationDraftStorage.get(a.jobUrl))?.job.jobTitle).toBe('岗位 A');
    expect(await applicationDraftStorage.get(b.jobUrl)).toBeNull();
  });
  it('A草稿在B页不出现，也不与旧JD标题或期望薪资混合', async () => {
    await applicationDraftStorage.create(a, undefined, 'A 投递时简历');
    vi.stubGlobal('window', { location: new URL(b.jobUrl), confirm: vi.fn(() => true) });
    vi.mocked(extractPageJobSnapshot).mockReturnValue(b);
    const archive = useApplicationArchive(options());
    await archive.initialize();
    expect(archive.applicationDraft.value).toBeNull();
    await archive.handleArchiveJob();
    expect(await trackerStorage.getAllApplications()).toEqual([expect.objectContaining({ companyName: '公司 B', jobTitle: '岗位 B', jobUrl: b.jobUrl, salary: undefined })]);
    expect(await applicationDraftStorage.get(a.jobUrl)).not.toBeNull();
  });
  it('回到A归档时使用A的岗位和投递时简历，不挪用当前简历', async () => {
    await applicationDraftStorage.create(a, undefined, 'A 投递时简历');
    vi.stubGlobal('window', { location: new URL(a.jobUrl), confirm: vi.fn(() => true) });
    const archive = useApplicationArchive(options());
    await archive.initialize();
    await archive.handleArchiveJob();
    expect((await trackerStorage.getAllApplications())[0]).toMatchObject({ jobTitle: '岗位 A', resumeVersionTitle: 'A 投递时简历' });
  });
});
