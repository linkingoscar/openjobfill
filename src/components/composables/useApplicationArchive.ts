import { computed, shallowRef } from 'vue';
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
  const detectApplicationSuccessDraft = async () => {
    if (!isApplicationSuccessPage()) return;
    const job = extractPageJobSnapshot();
    if (applicationDraft.value?.job.jobUrl === job.jobUrl) return;
    applicationDraft.value = await applicationDraftStorage.create(job);
    options.presentDraft();
    options.notify('检测到申请成功页面，已生成投递归档草稿，请确认后保存');
  };

  const dismissApplicationDraft = async () => {
    applicationDraft.value = null;
    await applicationDraftStorage.clear();
  };

  const handleArchiveJob = async () => {
    const pageJob = applicationDraft.value?.job || extractPageJobSnapshot();
    const successDetected = !!applicationDraft.value || isApplicationSuccessPage();
    const currentResume = options.getResume();
    const jdAnalysis = options.getJD();
    const jobTitle = jdAnalysis?.jobTitle || pageJob.jobTitle;

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
      clientRequestId: applicationDraft.value?.clientRequestId || createApplicationId('application'),
      companyName: pageJob.companyName,
      jobTitle: jobTitle,
      appliedDate: new Date().toISOString().slice(0, 10),
      status: 'applied',
      jobUrl: pageJob.jobUrl,
      salary: pageJob.salary || (currentResume?.basics.expectedSalaryMin ? `${currentResume.basics.expectedSalaryMin}k` : ''),
      resumeVersionTitle: currentResume?.title || '默认简历',
      jdSummary: pageJob.description,
      notes: `用户确认${successDetected ? '申请成功页面' : '已完成投递'}后由 OpenJobFill 建档。综合技能匹配度: ${jdAnalysis?.matchScore || 0}%`,
      source: successDetected ? 'success_detection' : 'manual',
      sourceDomain: window.location.hostname,
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
    await applicationDraftStorage.clear();
    options.notify(`📌 已归档【${record.companyName} - ${record.jobTitle}】至投递看板！`);
  };


  return {
    applicationDraft: computed(() => applicationDraft.value),
    detectApplicationSuccessDraft, dismissApplicationDraft, handleArchiveJob,
    initialize: async () => {
      applicationDraft.value = await applicationDraftStorage.get();
      await detectApplicationSuccessDraft();
    },
  };
}
