import { computed, shallowRef, ref } from 'vue';
import { applicationDraftStorage, type ApplicationTrackerDraft } from '@/core/storage/applicationDraftStorage';
import { trackerStorage } from '@/core/storage/trackerStorage';
import { extractPageJobSnapshot, isApplicationSuccessPage } from '@/core/tracker/pageJobExtractor';
import { createApplicationId } from '@/core/tracker/trackerSchema';
import type { StandardResume } from '@/types/resume';
import type { JobApplicationRecord } from '@/types/tracker';
import type { JDAnalysisResult } from '@/core/matcher/jdMatcher';

interface ArchiveOptions {
  getResume: () => StandardResume | null;
  getJD: () => JDAnalysisResult | null;
  notify: (message: string) => void;
  presentDraft: () => void;
}

/** Application drafts and confirmed archiving are independent of filling sessions. */
export function useApplicationArchive(options: ArchiveOptions) {
  const applicationDraft = shallowRef<ApplicationTrackerDraft | null>(null);
  const isArchiving = ref(false);
  const detectApplicationSuccessDraft = async () => {
    const pageUrl = window.location.href;
    applicationDraft.value = await applicationDraftStorage.get(pageUrl);
    if (window.location.href !== pageUrl) { applicationDraft.value = null; return; }
    if (!isApplicationSuccessPage()) return;
    const job = extractPageJobSnapshot();
    if (applicationDraft.value?.job.jobUrl === job.jobUrl) return;
    applicationDraft.value = await applicationDraftStorage.create(job, undefined, options.getResume()?.title);
    if (window.location.href !== pageUrl) { applicationDraft.value = null; return; }
    options.presentDraft();
    options.notify('检测到申请成功页面，已生成投递归档草稿，请确认后保存');
  };

  const dismissApplicationDraft = async () => {
    const pageUrl = applicationDraft.value?.job.jobUrl;
    applicationDraft.value = null;
    if (pageUrl) await applicationDraftStorage.clear(pageUrl);
  };

  const handleArchiveJob = async () => {
    if (isArchiving.value) return;
    isArchiving.value = true;
    try {
      const pageUrl = window.location.href;
      const draft = await applicationDraftStorage.get(pageUrl);
      if (pageUrl !== window.location.href) { options.notify('页面已切换，请在当前岗位重新归档'); return; }
      applicationDraft.value = draft;
      const pageJob = draft?.job || extractPageJobSnapshot();
      const successDetected = !!draft || isApplicationSuccessPage();
      const currentResume = options.getResume();
      const analysis = options.getJD();
      const jdAnalysis = !draft && analysis?.pageUrl === pageUrl ? analysis : null;
      const jobTitle = pageJob.jobTitle;

      const confirmationText = successDetected
        ? `检测到申请成功页面：\n${pageJob.companyName} · ${jobTitle}\n\n是否确认归档为“已投递”？`
        : `将当前岗位加入投递看板：\n${pageJob.companyName} · ${jobTitle}\n\n请确认你已经完成投递，确认后才会保存为“已投递”。`;
      if (!window.confirm(confirmationText)) {
        options.notify('已取消归档，岗位草稿仍保留在当前页面');
        return;
      }

      const record: JobApplicationRecord = {
        schemaVersion: 2,
        id: createApplicationId(),
        clientRequestId: draft?.clientRequestId || createApplicationId('application'),
        companyName: pageJob.companyName,
        jobTitle: jobTitle,
        appliedDate: (draft?.detectedAt || new Date().toISOString()).slice(0, 10),
        status: 'applied',
        jobUrl: pageJob.jobUrl,
        salary: pageJob.salary || '',
        resumeVersionTitle: draft ? (draft.resumeVersionTitle || '未记录') : (currentResume?.title || '未记录'),
        jdSummary: pageJob.description,
        notes: `用户确认${successDetected ? '申请成功页面' : '已完成投递'}后由 OpenJobFill 建档。${jdAnalysis?.matchScore != null ? `关键词覆盖率: ${jdAnalysis.matchScore}%（非录用概率）` : '关键词覆盖率未评估。'}`,
        source: successDetected ? 'success_detection' : 'manual',
        sourceDomain: new URL(pageJob.jobUrl).hostname,
        fieldSources: {
          companyName: pageJob.fieldSources?.companyName === 'structured_data' ? 'structured_data' : 'heuristic',
          jobTitle: pageJob.fieldSources?.jobTitle === 'structured_data' ? 'structured_data' : 'heuristic',
          ...(pageJob.salary ? { salary: pageJob.fieldSources?.salary === 'structured_data' ? 'structured_data' as const : 'heuristic' as const } : {}),
          ...(pageJob.description ? { jdSummary: pageJob.fieldSources?.description === 'structured_data' ? 'structured_data' as const : 'heuristic' as const } : {}),
        },
        lockedFields: [],
        syncState: 'local',
        createdAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await trackerStorage.saveApplication(record);
      applicationDraft.value = null;
      await applicationDraftStorage.clear(pageJob.jobUrl);
      options.notify(`📌 已归档【${record.companyName} - ${record.jobTitle}】至投递看板！`);
    } catch (error) {
      options.notify(`归档未完成：${error instanceof Error ? error.message : '请重试'}`);
    } finally { isArchiving.value = false; }
  };


  return {
    applicationDraft: computed(() => applicationDraft.value),
    detectApplicationSuccessDraft, dismissApplicationDraft, handleArchiveJob,
    initialize: async () => {
      await detectApplicationSuccessDraft();
    },
  };
}
