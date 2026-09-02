<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { 
  Zap, 
  Sparkles, 
  CheckCircle, 
  X, 
  Copy, 
  Settings, 
  User,
  GraduationCap,
  Briefcase,
  HelpCircle,
  FileText,
  Layers,
  Award,
  Users,
  Download,
  Target,
  Eye,
  EyeOff,
  AlertTriangle,
  Lightbulb,
  BookmarkPlus,
  TrendingUp,
  Pipette,
  Highlighter,
  Paperclip,
  RefreshCw,
} from 'lucide-vue-next';
import { resumeStorage } from '@/core/storage/resumeStorage';
import { ruleStorage } from '@/core/storage/ruleStorage';
import { trackerStorage } from '@/core/storage/trackerStorage';
import { applicationDraftStorage, type ApplicationTrackerDraft } from '@/core/storage/applicationDraftStorage';
import { useFillHistory } from './composables/useFillHistory';
import { useFillPreview } from './composables/useFillPreview';
import { useJDAnalysis } from './composables/useJDAnalysis';
import DrawerHistoryTab from './DrawerHistoryTab.vue';
import DrawerReviewTab from './DrawerReviewTab.vue';
import DrawerClipboardTab from './DrawerClipboardTab.vue';
import { formFillerEngine, type AnalyzedPlan } from '@/core/engine/filler';
import { analyzeRemoteFrames, cancelRemoteFrames } from '@/core/frames/frameCoordinator';
import { getEnhancerForUrl } from '@/core/adapters';
import { setNativeValue } from '@/core/engine/dispatcher';
import { clearAllBadges } from '@/core/engine/badgeDecorator';
import { startElementPicking } from '@/core/engine/elementPicker';
import { startManualFill } from '@/core/engine/manualFill';
import { uploadResumeToPage } from '@/core/engine/attachmentUploader';
import { inspectFieldSafety } from '@/core/pipeline/fieldSafety';
import { isFillRunAbortedError } from '@/core/pipeline/runContext';
import { extractPageJobSnapshot, isApplicationSuccessPage, type PageJobSnapshot } from '@/core/tracker/pageJobExtractor';
import { canImportPlatformProfile, extractPlatformProfile } from '@/core/importers/platformProfileImporter';
import { generateOptimalSelector, isInputElement, isTextAreaElement } from '@/utils/dom';
import type { FillResult } from '@/types/adapter';
import type { StandardResume } from '@/types/resume';
import type { JobApplicationRecord } from '@/types/tracker';
import { createApplicationId } from '@/core/tracker/trackerSchema';
import type { ClipboardItem } from '@/types/floatingBall';
import { useFloatingPosition } from './composables/useFloatingPosition';

const isFilling = ref(false);
const isDrawerOpen = ref(false);
const drawerTab = ref<'logs' | 'review' | 'clipboard' | 'jdMatch'>('logs');
const currentAdapterName = ref('');
const fillResult = ref<FillResult | null>(null);
const operationError = ref('');
const currentResume = ref<StandardResume | null>(null);
const allResumes = ref<StandardResume[]>([]);
const selectedResumeId = ref('');
const isHiddenOnCurrentPage = ref(false);
const canSyncCurrentPlatform = computed(() => canImportPlatformProfile(window.location.href));

const {
  responsiveDrawerWidth,
  responsiveDrawerHeight,
  floatingLayout,
  floatingRootStyle,
  loadFloatingPosition,
  handleViewportResize,
  startBallDrag,
  stopBallDrag,
  startResize,
  handleResizeMove,
  stopResize,
  cleanup: cleanupFloatingPosition,
  suppressNextBubbleClick,
  clearSuppressNextBubbleClick,
} = useFloatingPosition(isDrawerOpen, isFilling);

const handleHideFloatingBall = () => {
  isDrawerOpen.value = false;
  isHiddenOnCurrentPage.value = true;
};

// 多步向导与待办核对提示
const stepNotification = ref({ show: false, text: '' });
const copyToastMessage = ref('');
const applicationDraft = ref<ApplicationTrackerDraft | null>(null);

const detectApplicationSuccessDraft = async () => {
  if (!isApplicationSuccessPage()) return;
  const job = extractPageJobSnapshot();
  if (applicationDraft.value?.job.jobUrl === job.jobUrl) return;
  applicationDraft.value = await applicationDraftStorage.create(job);
  if (!isDrawerOpen.value) isDrawerOpen.value = true;
  drawerTab.value = 'jdMatch';
  copyToastMessage.value = '检测到申请成功页面，已生成投递归档草稿，请确认后保存';
  setTimeout(() => { copyToastMessage.value = ''; }, 4500);
};

const dismissApplicationDraft = async () => {
  applicationDraft.value = null;
  await applicationDraftStorage.clear();
};

const handleFocusTaskElement = (task: any) => {
  if (task.element) {
    task.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof task.element.focus === 'function') {
      task.element.focus();
    }
    // 触发临时闪烁高亮动画
    task.element.style.outline = '3px solid #f59e0b';
    task.element.style.outlineOffset = '2px';
    setTimeout(() => {
      if (task.element) task.element.style.outline = '';
    }, 2000);
  }
};

const activeTaskMappingId = ref<string | null>(null);
const selectedMappingKey = ref('');

const AVAILABLE_BINDING_FIELDS = [
  { group: '个人基本信息', options: [
    { label: '姓名', value: 'basics.name' },
    { label: '名 (First Name)', value: 'basics.firstName' },
    { label: '姓 (Last Name)', value: 'basics.lastName' },
    { label: '手机号码', value: 'basics.phone' },
    { label: '电子邮箱', value: 'basics.email' },
    { label: '身份证号', value: 'basics.idCardNumber' },
    { label: '出生日期', value: 'basics.birthDate' },
    { label: '性别', value: 'basics.gender' },
    { label: '民族', value: 'basics.ethnicity' },
    { label: '政治面貌', value: 'basics.politicalStatus' },
    { label: '婚姻状况', value: 'basics.maritalStatus' },
    { label: '身高 (cm)', value: 'basics.height' },
    { label: '体重 (kg)', value: 'basics.weight' },
    { label: '健康状况', value: 'basics.healthStatus' },
    { label: '籍贯 / 生源地', value: 'basics.nativePlace.detail' },
    { label: '出生地', value: 'basics.birthPlace.detail' },
    { label: '户籍 / 户口所在地', value: 'basics.hukouLocation.detail' },
    { label: '现居城市', value: 'basics.currentLocation.city' },
    { label: '现居详细地址', value: 'basics.currentLocation.detail' },
    { label: '兴趣爱好 / 特长', value: 'basics.hobbies' },
  ]},
  { group: '求职与意向', options: [
    { label: '期望岗位', value: 'basics.expectedRole' },
    { label: '期望城市', value: 'basics.expectedCity' },
    { label: '期望最低薪资', value: 'basics.expectedSalaryMin' },
    { label: '到岗时间', value: 'basics.availableTime' },
    { label: '当前求职状态', value: 'basics.jobStatus' },
    { label: '工作年限', value: 'basics.workingYears' },
    { label: '自我评价', value: 'basics.selfEvaluation' },
    { label: 'GitHub 地址', value: 'basics.githubUrl' },
    { label: 'LinkedIn', value: 'basics.linkedinUrl' },
    { label: '个人主页/博客', value: 'basics.blogUrl' },
  ]},
  { group: '教育背景 (第一段)', options: [
    { label: '学校名称', value: 'educations.0.schoolName' },
    { label: '学历层次', value: 'educations.0.degree' },
    { label: '主修专业', value: 'educations.0.major' },
    { label: '入学年月', value: 'educations.0.startDate' },
    { label: '毕业年月', value: 'educations.0.endDate' },
    { label: 'GPA / 成绩', value: 'educations.0.gpa' },
  ]},
  { group: '工作实习 (第一段)', options: [
    { label: '公司名称', value: 'experiences.0.company' },
    { label: '职位名称', value: 'experiences.0.title' },
    { label: '工作描述', value: 'experiences.0.description' },
    { label: '入职时间', value: 'experiences.0.startDate' },
    { label: '离职时间', value: 'experiences.0.endDate' },
  ]},
  { group: '成果与校园经历 (第一段)', options: [
    { label: '获奖名称', value: 'awards.0.name' },
    { label: '获奖级别', value: 'awards.0.level' },
    { label: '论文 / 成果标题', value: 'academicAchievements.0.title' },
    { label: '会议 / 期刊', value: 'academicAchievements.0.venue' },
    { label: '校园组织', value: 'campusExperiences.0.organization' },
    { label: '校园职务', value: 'campusExperiences.0.title' },
    { label: '家庭成员姓名', value: 'familyMembers.0.name' },
    { label: '家庭成员关系', value: 'familyMembers.0.relation' },
  ]},
];

const handleToggleTaskMapping = (task: any) => {
  if (activeTaskMappingId.value === task.id) {
    activeTaskMappingId.value = null;
  } else {
    activeTaskMappingId.value = task.id;
    selectedMappingKey.value = '';
  }
};

const handleSaveTaskMapping = async (task: any) => {
  if (!selectedMappingKey.value || !task.element) return;
  const selector = generateOptimalSelector(task.element);
  if (!selector) return;

  await ruleStorage.bindFieldToSite(
    window.location.href,
    selector,
    selectedMappingKey.value,
    task.label,
    { fingerprint: task.fingerprint, locator: task.locator },
  );
  activeTaskMappingId.value = null;
  copyToastMessage.value = `🎯 已为当前网站记住映射【${task.label} -> ${selectedMappingKey.value}】！下次自动填表将精准命中。`;
  setTimeout(() => { copyToastMessage.value = ''; }, 3500);
};

const pendingChangedRoots = ref<HTMLElement[]>([]);

const notifyStepChange = (newUrl: string, changedNodes: HTMLElement[] = []) => {
  void detectApplicationSuccessDraft();
  if (isFilling.value) {
    formFillerEngine.cancelActiveRun('页面步骤已变化');
    void cancelPreview();
  }
  pendingChangedRoots.value = changedNodes;
  const canIncremental = !!lastPlan.value && newUrl === lastPlan.value.pageUrl && changedNodes.length > 0;
  stepNotification.value = {
    show: true,
    text: canIncremental ? '检测到新增字段，点击仅填写新增内容' : '点击即可重新规划并填充当前页',
  };
  setTimeout(() => {
    stepNotification.value.show = false;
  }, 8000);
};

// 剪贴板快速搜索与复制提示
const searchQuery = ref('');
const copiedFieldKey = ref<string | null>(null);
const {
  jdAnalysis,
  isAnalyzingJD,
  isHighlightingJD,
  handleAnalyzeJD,
  handleSwitchToJDTab,
  handleToggleJDHighlight,
} = useJDAnalysis(currentResume, drawerTab, copyToastMessage);
const {
  fillHistoryRecords,
  isHistoryLoading,
  MAX_FILL_HISTORY_RECORDS,
  loadFillHistory,
  persistFillHistory,
  persistOperationError,
  formatHistoryTime,
  handleCopyDiagnosticHistory,
  handleExportDiagnosticHistory,
  handleExportReplayPackage,
  handleImportReplayPackage,
  handleClearFillHistory,
} = useFillHistory(copyToastMessage, currentAdapterName);

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isDrawerOpen.value) {
    if (isFilling.value) formFillerEngine.cancelActiveRun('用户按下 Esc 取消填写');
    isDrawerOpen.value = false;
  }
};

const loadActiveResume = async () => {
  allResumes.value = await resumeStorage.getAllResumes();
  const active = await resumeStorage.getActiveResume();
  currentResume.value = active;
  selectedResumeId.value = active.id;
};

const handleSwitchResume = async (e: Event) => {
  const target = e.target as HTMLSelectElement;
  const newId = target.value;
  if (!newId) return;
  selectedResumeId.value = newId;
  await resumeStorage.setActiveResumeId(newId);
  await loadActiveResume();
  copyToastMessage.value = `已切换当前激活简历：${currentResume.value?.title}`;
  
  // 重新计算当前页面的 JD 匹配度
  if (currentResume.value && drawerTab.value === 'jdMatch') {
    handleAnalyzeJD();
  }

  setTimeout(() => {
    copyToastMessage.value = '';
  }, 2500);
};

onMounted(async () => {
  loadFloatingPosition();
  const enhancer = getEnhancerForUrl(window.location.href, document);
  currentAdapterName.value = enhancer?.name || '智能通用决策引擎 (Pipeline v2)';
  await Promise.all([loadActiveResume(), loadFillHistory()]);
  applicationDraft.value = await applicationDraftStorage.get();
  await detectApplicationSuccessDraft();
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', handleViewportResize);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('resize', handleViewportResize);
  cleanupFloatingPosition();
});

const handleQuickFill = async () => {
  isHiddenOnCurrentPage.value = false;
  if (isFilling.value) return { fillCount: 0, needsUserCount: 0 };
  isFilling.value = true;
  fillResult.value = null;
  if (previewPlan.value?.remoteFrames?.length) {
    await cancelRemoteFrames(previewPlan.value.remoteFrames);
  }
  previewPlan.value = null;
  operationError.value = '';

  try {
    const activeResume = await resumeStorage.getActiveResume();
    currentResume.value = activeResume;
    selectedResumeId.value = activeResume.id;
    // 先扫描生成填表规划并展示预览，用户确认后才真正写入（防误填的事前把关）
    const analyzed = await formFillerEngine.analyze(activeResume);
    analyzed.remoteFrames = await analyzeRemoteFrames(activeResume.id, { runId: analyzed.runId });
    setPreviewPlan(analyzed);
    // 展示实际参与规划的平台增强器；所有站点都通过同一 Pipeline 执行。
    currentAdapterName.value = analyzed.remoteFrames.length > 0
      ? `${analyzed.adapterName} + ${analyzed.remoteFrames.length} 个跨域子页面`
      : analyzed.adapterName;
    drawerTab.value = 'logs';
    isDrawerOpen.value = true; // 展开抽屉展示预览清单
    return {
      fillCount:
        analyzed.plan.items.filter((item) => item.action === 'FILL').length +
        analyzed.remoteFrames.reduce((sum, frame) => sum + frame.highConfidenceCount, 0),
      needsUserCount:
        analyzed.plan.items.filter((item) => item.action === 'NEEDS_USER').length +
        analyzed.remoteFrames.reduce((sum, frame) => sum + frame.needsUserCount, 0),
    };
  } catch (err: any) {
    if (isFillRunAbortedError(err)) {
      operationError.value = '';
      return { fillCount: 0, needsUserCount: 0 };
    }
    console.error('[OpenJobFill] Analyze error:', err);
    operationError.value = err?.message || '页面识别失败，请刷新网页后重试';
    await persistOperationError('analysis', operationError.value);
    drawerTab.value = 'logs';
    isDrawerOpen.value = true;
    throw err;
  } finally {
    isFilling.value = false;
  }
};

const handleIncrementalFill = async () => {
  if (isFilling.value || !lastPlan.value) return;
  isFilling.value = true;
  operationError.value = '';
  stepNotification.value.show = false;
  try {
    const activeResume = await resumeStorage.getActiveResume();
    currentResume.value = activeResume;
    selectedResumeId.value = activeResume.id;
    const previousPlan = lastPlan.value;
    const analyzed = await formFillerEngine.analyzeIncremental(activeResume, previousPlan, {
      changedRoots: pendingChangedRoots.value.map((node) => node.parentElement || node),
    });
    setPreviewPlan(analyzed, previousPlan);
    currentAdapterName.value = analyzed.adapterName;
    drawerTab.value = 'logs';
    isDrawerOpen.value = true;
  } catch (err: any) {
    if (isFillRunAbortedError(err)) return;
    operationError.value = err?.message || '增量识别失败，请重新规划当前页面';
    await persistOperationError('analysis', operationError.value);
    drawerTab.value = 'logs';
    isDrawerOpen.value = true;
  } finally {
    isFilling.value = false;
  }
};

const handleStepNotification = () => {
  const canIncremental = !!lastPlan.value
    && window.location.href === lastPlan.value.pageUrl
    && pendingChangedRoots.value.length > 0;
  if (canIncremental) {
    void handleIncrementalFill();
  } else {
    void handleQuickFill();
  }
};

const handleCancelActiveRun = async () => {
  formFillerEngine.cancelActiveRun('用户取消填写');
  await cancelPreview();
  copyToastMessage.value = '已停止本次填写';
  setTimeout(() => { copyToastMessage.value = ''; }, 2000);
};

const handleBubbleClick = () => {
  if (suppressNextBubbleClick.value) {
    clearSuppressNextBubbleClick();
    return;
  }
  void handleQuickFill();
};

const handleClearBadges = () => {
  clearAllBadges();
  copyToastMessage.value = '已清除页面上的所有状态高亮与徽标';
  setTimeout(() => { copyToastMessage.value = ''; }, 2000);
};

const handleUploadResume = () => {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    if (!file) return;
    const uploaded = await uploadResumeToPage(file);
    copyToastMessage.value = uploaded
      ? `📎 已将【${file.name}】放入页面简历上传区，请核对上传结果`
      : '未找到可用的简历附件上传区，请在网页中手动上传';
    setTimeout(() => { copyToastMessage.value = ''; }, 3500);
  }, { once: true });
  picker.click();
};

const handleArchiveJob = async () => {
  const pageJob = applicationDraft.value?.job || extractPageJobSnapshot();
  const successDetected = !!applicationDraft.value || isApplicationSuccessPage();
  if (!jdAnalysis.value && currentResume.value) handleAnalyzeJD();
  const jobTitle = jdAnalysis.value?.jobTitle || pageJob.jobTitle;

  const confirmationText = successDetected
    ? `检测到申请成功页面：\n${pageJob.companyName} · ${jobTitle}\n\n是否确认归档为“已投递”？`
    : `将当前岗位加入投递看板：\n${pageJob.companyName} · ${jobTitle}\n\n请确认你已经完成投递，确认后才会保存为“已投递”。`;
  if (!window.confirm(confirmationText)) {
    copyToastMessage.value = '已取消归档，岗位草稿仍保留在当前页面';
    setTimeout(() => { copyToastMessage.value = ''; }, 2500);
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
    salary: pageJob.salary || (currentResume.value?.basics.expectedSalaryMin ? `${currentResume.value.basics.expectedSalaryMin}k` : ''),
    resumeVersionTitle: currentResume.value?.title || '默认简历',
    jdSummary: pageJob.description,
    notes: `用户确认${successDetected ? '申请成功页面' : '已完成投递'}后由 OpenJobFill 建档。综合技能匹配度: ${jdAnalysis.value?.matchScore || 0}%`,
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
  copyToastMessage.value = `📌 已归档【${record.companyName} - ${record.jobTitle}】至投递看板！`;
  setTimeout(() => { copyToastMessage.value = ''; }, 3000);
};

const handleSyncPlatformProfile = async () => {
  const active = await resumeStorage.getActiveResume();
  const extracted = extractPlatformProfile(document, window.location.href);
  const count = Object.keys(extracted.basics).length + extracted.educations.length + extracted.experiences.length;
  if (!count) {
    copyToastMessage.value = '当前页面没有识别到可同步的个人资料，请先打开平台的简历详情页';
    return;
  }
  if (!window.confirm(`识别到 ${count} 组资料。是否合并到当前简历“${active.title}”？现有非空基本信息不会被空值覆盖。`)) return;
  const next: StandardResume = {
    ...active,
    basics: { ...active.basics, ...extracted.basics },
    educations: [...active.educations, ...extracted.educations.filter((incoming) => !active.educations.some((item) => item.schoolName === incoming.schoolName && item.degree === incoming.degree))],
    experiences: [...active.experiences, ...extracted.experiences.filter((incoming) => !active.experiences.some((item) => item.company === incoming.company && item.title === incoming.title && item.startDate === incoming.startDate))],
    updatedAt: Date.now(),
  };
  await resumeStorage.saveResume(next);
  await loadActiveResume();
  copyToastMessage.value = `已从${extracted.platform === 'boss' ? ' BOSS 直聘' : '智联招聘'}页面合并 ${count} 组资料`;
  setTimeout(() => { copyToastMessage.value = ''; }, 3500);
};

const handleStartPicker = () => {
  isDrawerOpen.value = false;
  startElementPicking((result) => {
    navigator.clipboard.writeText(result.selector);
    copyToastMessage.value = `🎯 已吸取选择器【${result.selector}】，已复制到剪贴板！`;
    isDrawerOpen.value = true;
    setTimeout(() => { copyToastMessage.value = ''; }, 3500);
  });
};

const toggleDrawer = async () => {
  isDrawerOpen.value = !isDrawerOpen.value;
  if (isDrawerOpen.value) {
    await Promise.all([loadActiveResume(), loadFillHistory()]);
    if (drawerTab.value === 'jdMatch' && !jdAnalysis.value) {
      handleAnalyzeJD();
    }
  }
};

// 提取结构化简历平铺字段 (供速查剪贴板使用)
const flatResumeFields = computed<ClipboardItem[]>(() => {
  if (!currentResume.value) return [];
  const r = currentResume.value;
  const list: ClipboardItem[] = [];

  // 基本信息
  if (r.basics.name) list.push({ id: 'b-name', category: '基本信息', label: '姓名', value: r.basics.name });
  if (r.basics.gender) list.push({ id: 'b-gender', category: '基本信息', label: '性别', value: r.basics.gender });
  if (r.basics.phone) list.push({ id: 'b-phone', category: '基本信息', label: '手机号码', value: r.basics.phone });
  if (r.basics.email) list.push({ id: 'b-email', category: '基本信息', label: '电子邮箱', value: r.basics.email });
  if (r.basics.idCardNumber) list.push({ id: 'b-idcard', category: '基本信息', label: '身份证号', value: r.basics.idCardNumber });
  if (r.basics.birthDate) list.push({ id: 'b-birth', category: '基本信息', label: '出生日期', value: r.basics.birthDate });
  if (r.basics.politicalStatus) list.push({ id: 'b-politics', category: '基本信息', label: '政治面貌', value: r.basics.politicalStatus });
  if (r.basics.ethnicity) list.push({ id: 'b-ethnicity', category: '基本信息', label: '民族', value: r.basics.ethnicity });
  if (r.basics.maritalStatus) list.push({ id: 'b-marital', category: '基本信息', label: '婚姻状况', value: r.basics.maritalStatus });
  if (r.basics.currentLocation?.city) list.push({ id: 'b-city', category: '基本信息', label: '现居城市', value: r.basics.currentLocation.city });
  if (r.basics.nativePlace?.city) list.push({ id: 'b-native', category: '基本信息', label: '籍贯', value: r.basics.nativePlace.city });
  if (r.basics.birthPlace?.city) list.push({ id: 'b-birth-place', category: '基本信息', label: '出生地', value: r.basics.birthPlace.city });
  if (r.basics.expectedRole) list.push({ id: 'b-role', category: '基本信息', label: '期望职位', value: r.basics.expectedRole });
  if (r.basics.expectedCity) list.push({ id: 'b-exp-city', category: '基本信息', label: '期望工作城市', value: r.basics.expectedCity });
  if (r.basics.expectedSalaryMin) list.push({ id: 'b-salary', category: '基本信息', label: '期望月薪(k)', value: `${r.basics.expectedSalaryMin}k` });
  if (r.basics.githubUrl) list.push({ id: 'b-github', category: '基本信息', label: 'GitHub', value: r.basics.githubUrl });
  if (r.basics.linkedinUrl) list.push({ id: 'b-linkedin', category: '基本信息', label: 'LinkedIn', value: r.basics.linkedinUrl });
  if (r.basics.blogUrl) list.push({ id: 'b-blog', category: '基本信息', label: '个人网站/博客', value: r.basics.blogUrl });
  if (r.basics.hobbies) list.push({ id: 'b-hobbies', category: '基本信息', label: '兴趣爱好 / 特长', value: r.basics.hobbies });

  // 教育经历 (支持所有段)
  r.educations?.forEach((edu, idx) => {
    const prefix = `[教育${idx + 1}] `;
    if (edu.schoolName) list.push({ id: `edu-${idx}-school`, category: '教育经历', label: `${prefix}就读学校`, value: edu.schoolName });
    if (edu.degree) list.push({ id: `edu-${idx}-degree`, category: '教育经历', label: `${prefix}学历层次`, value: edu.degree });
    if (edu.major) list.push({ id: `edu-${idx}-major`, category: '教育经历', label: `${prefix}所学专业`, value: edu.major });
    if (edu.startDate || edu.endDate) list.push({ id: `edu-${idx}-date`, category: '教育经历', label: `${prefix}就读起止时间`, value: `${edu.startDate} 至 ${edu.endDate}` });
    if (edu.gpa) list.push({ id: `edu-${idx}-gpa`, category: '教育经历', label: `${prefix}GPA / 成绩排名`, value: edu.gpa });
    if (edu.courses) list.push({ id: `edu-${idx}-courses`, category: '教育经历', label: `${prefix}主修核心课程`, value: edu.courses });
  });

  // 工作与实习经历 (支持所有段)
  r.experiences?.forEach((exp, idx) => {
    const prefix = `[经历${idx + 1}] `;
    if (exp.company) list.push({ id: `exp-${idx}-company`, category: '工作实习', label: `${prefix}公司/单位名称`, value: exp.company });
    if (exp.title) list.push({ id: `exp-${idx}-title`, category: '工作实习', label: `${prefix}职位岗位`, value: exp.title });
    if (exp.startDate || exp.endDate) list.push({ id: `exp-${idx}-date`, category: '工作实习', label: `${prefix}任职时间`, value: `${exp.startDate} 至 ${exp.endDate}` });
    if (exp.description) list.push({ id: `exp-${idx}-desc`, category: '工作实习', label: `${prefix}工作内容与成果`, value: exp.description });
  });

  // 项目经历 (支持所有段)
  r.projects?.forEach((proj, idx) => {
    const prefix = `[项目${idx + 1}] `;
    if (proj.projectName) list.push({ id: `proj-${idx}-name`, category: '项目经历', label: `${prefix}项目名称`, value: proj.projectName });
    if (proj.role) list.push({ id: `proj-${idx}-role`, category: '项目经历', label: `${prefix}担任角色`, value: proj.role });
    if (proj.startDate || proj.endDate) list.push({ id: `proj-${idx}-date`, category: '项目经历', label: `${prefix}项目周期`, value: `${proj.startDate} 至 ${proj.endDate}` });
    if (proj.techStack) list.push({ id: `proj-${idx}-tech`, category: '项目经历', label: `${prefix}涉及技术栈`, value: proj.techStack });
    if (proj.description) list.push({ id: `proj-${idx}-desc`, category: '项目经历', label: `${prefix}项目描述`, value: proj.description });
  });

  // 技能与证书
  r.skills?.forEach((skill, idx) => {
    if (skill.name) list.push({ id: `skill-${idx}`, category: '技能证书', label: `专业技能: ${skill.name}`, value: skill.level ? `${skill.name} (${skill.level})` : skill.name });
  });
  r.languages?.forEach((lang, idx) => {
    if (lang.score || lang.language) list.push({ id: `lang-${idx}`, category: '技能证书', label: `${lang.language || '外语'}成绩`, value: `${lang.certificateName || ''} ${lang.score || ''}`.trim() });
  });
  r.certificates?.forEach((cert, idx) => {
    if (cert.name) list.push({ id: `cert-${idx}`, category: '技能证书', label: `证书: ${cert.name}`, value: cert.name });
  });

  // 家庭与紧急联系人
  r.familyMembers?.forEach((fm, idx) => {
    const prefix = `[联系人${idx + 1}] `;
    if (fm.name) list.push({ id: `fm-${idx}-name`, category: '家庭成员', label: `${prefix}姓名 (${fm.relation})`, value: fm.name });
    if (fm.phone) list.push({ id: `fm-${idx}-phone`, category: '家庭成员', label: `${prefix}联系电话`, value: fm.phone });
    if (fm.company) list.push({ id: `fm-${idx}-company`, category: '家庭成员', label: `${prefix}工作单位`, value: fm.company });
    if (fm.hukouLocation) list.push({ id: `fm-${idx}-hukou`, category: '家庭成员', label: `${prefix}户籍所在地`, value: fm.hukouLocation });
  });

  r.awards?.forEach((award, idx) => {
    if (award.name) list.push({ id: `award-${idx}`, category: '成果荣誉', label: `奖项 ${idx + 1}`, value: award.name });
  });
  r.academicAchievements?.forEach((achievement, idx) => {
    if (achievement.title) list.push({ id: `academic-${idx}`, category: '成果荣誉', label: `学术成果 ${idx + 1}`, value: achievement.title });
  });
  r.campusExperiences?.forEach((campus, idx) => {
    if (campus.organization) list.push({ id: `campus-${idx}`, category: '校园经历', label: `${campus.organization} · ${campus.title}`, value: campus.description || campus.responsibility || campus.title });
  });

  // 问答与自我评价
  if (r.basics.selfEvaluation) {
    list.push({ id: 'qa-self-eval', category: '问答与评价', label: '自我评价 / 个人优势', value: r.basics.selfEvaluation });
  }
  r.qaBank?.forEach((qa, idx) => {
    if (qa.keyword && qa.answer) {
      list.push({ id: `qa-${idx}`, category: '问答与评价', label: `问答: ${qa.keyword}`, value: qa.answer });
    }
  });

  return list;
});

const filteredFields = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return flatResumeFields.value;
  return flatResumeFields.value.filter(
    item => item.label.toLowerCase().includes(q) || 
            item.value.toLowerCase().includes(q) || 
            item.category.toLowerCase().includes(q)
  );
});

// 一键复制或填入当前聚焦元素
const handleCopyField = async (item: ClipboardItem) => {
  try {
    await navigator.clipboard.writeText(item.value);
    copiedFieldKey.value = item.id;
    copyToastMessage.value = `已复制【${item.label}】`;

    // 智能点填：如果当前页面有聚焦的输入框，顺手写入
    const activeEl = document.activeElement;
    if (activeEl && (isInputElement(activeEl) || isTextAreaElement(activeEl))) {
      const safety = inspectFieldSafety(activeEl as HTMLElement, '', activeEl.closest('.el-form-item, .ant-form-item, .form-item, .form-group, fieldset, tr')?.textContent || '');
      if (!safety.blocked && setNativeValue(activeEl, item.value)) {
        copyToastMessage.value = `已复制并自动填入当前输入框！`;
      }
    }

    setTimeout(() => {
      copiedFieldKey.value = null;
      copyToastMessage.value = '';
    }, 2000);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

const handleCopyKeyword = async (keyword: string) => {
  try {
    await navigator.clipboard.writeText(keyword);
    copyToastMessage.value = `已复制关键词【${keyword}】`;
    setTimeout(() => { copyToastMessage.value = ''; }, 2000);
  } catch (e) {
    console.error(e);
  }
};

const handleExportActiveJson = () => {
  if (!currentResume.value) return;
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentResume.value, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `${currentResume.value.title || 'resume'}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  copyToastMessage.value = `已导出当前简历配置 JSON`;
  setTimeout(() => { copyToastMessage.value = ''; }, 2000);
};

const handleOpenOptions = () => {
  chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
};

const handleManualFill = async () => {
  if (!currentResume.value) {
    const activeResume = await resumeStorage.getActiveResume();
    currentResume.value = activeResume;
  }
  if (!currentResume.value) return;
  // 收起抽屉避免遮挡，进入点选手动填充模式
  isDrawerOpen.value = false;
  startManualFill(currentResume.value, (result) => {
    copyToastMessage.value = result.mappingRemembered
      ? `已手动填入并记住映射：${result.label}`
      : `已手动填入：${result.label}（本次映射未保存）`;
    setTimeout(() => { copyToastMessage.value = ''; }, 2200);
  });
};

// ── 填前预览确认（先扫描生成规划，用户核对后再执行写入）──
const {
  previewPlan,
  setPreviewPlan,
  lastPlan,
  previewFillItems,
  previewNeedsUserItems,
  previewWorkflowItems,
  confirmFill,
  cancelPreview,
  handlePreviewManualFill,
} = useFillPreview(
  isFilling,
  fillResult,
  operationError,
  drawerTab,
  persistFillHistory,
  persistOperationError,
  handleManualFill,
);

defineExpose({
  handleQuickFill,
  handleManualFill,
  notifyStepChange,
  isFilling: () => isFilling.value,
});
</script>

<template>
  <aside
    v-if="!isHiddenOnCurrentPage"
    :style="floatingRootStyle"
    :class="floatingLayout.opensLeft ? 'flex-row' : 'flex-row-reverse'"
    class="openjobfill-root fixed z-[2147483647] font-sans select-none flex items-end gap-3 pointer-events-auto"
    aria-label="OpenJobFill 悬浮填表工具"
  >
    <!-- Collapsible Side Drawer Panel -->
    <transition
      enter-active-class="transition duration-300 ease-out transform"
      enter-from-class="translate-x-full opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition duration-200 ease-in transform"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="translate-x-full opacity-0"
    >
      <div
        id="openjobfill-drawer-panel"
        role="region"
        aria-label="OpenJobFill 填表控制面板"
        v-if="isDrawerOpen"
        :style="{
          width: `${responsiveDrawerWidth}px`,
          maxHeight: `${responsiveDrawerHeight}px`,
          height: `${responsiveDrawerHeight}px`
        }"
        class="bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden text-slate-800 text-xs backdrop-blur-md relative transition-[width,height] duration-75"
      >
        <!-- Left/Top Resizing Handles -->
        <div 
          @mousedown="startResize"
          :class="floatingLayout.opensLeft ? 'left-0' : 'right-0'"
          class="absolute top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors z-40 group"
          title="拖拽调节面板宽度"
        >
          <div class="w-0.5 h-8 bg-slate-300 group-hover:bg-blue-500 rounded-full absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"></div>
        </div>
        <div 
          @mousedown="startResize"
          class="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors z-40"
          title="拖拽调节面板高度"
        ></div>

        <!-- Header -->
        <header class="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-sm">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
              <Zap class="w-3.5 h-3.5 fill-white" aria-hidden="true" />
            </div>
            <h2 class="font-bold text-sm">OpenJobFill 填表助手</h2>
          </div>
          <div class="flex items-center gap-1">
            <button 
              type="button"
              @click="handleStartPicker"
              class="p-1 hover:bg-white/20 rounded-md transition focus-visible:ring-2 focus-visible:ring-white"
              title="元素吸管 (点击网页输入框自动生成选择器)"
              aria-label="元素吸管"
            >
              <Pipette class="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              v-if="canSyncCurrentPlatform"
              type="button"
              @click="handleSyncPlatformProfile"
              class="p-1 hover:bg-white/20 rounded-md transition focus-visible:ring-2 focus-visible:ring-white"
              title="从当前平台个人简历页同步可见资料"
              aria-label="从当前平台个人简历页同步可见资料"
            >
              <RefreshCw class="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              type="button"
              @click="handleArchiveJob"
              class="p-1 hover:bg-white/20 rounded-md transition focus-visible:ring-2 focus-visible:ring-white" 
              title="归档当前岗位至投递追踪看板"
              aria-label="归档当前岗位至投递追踪看板"
            >
              <BookmarkPlus class="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              type="button"
              @click="handleClearBadges"
              class="p-1 hover:bg-white/20 rounded-md transition focus-visible:ring-2 focus-visible:ring-white" 
              title="清除页面高亮与状态徽标"
              aria-label="清除页面高亮与状态徽标"
            >
              <EyeOff class="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              type="button"
              @click="handleExportActiveJson"
              class="p-1 hover:bg-white/20 rounded-md transition focus-visible:ring-2 focus-visible:ring-white" 
              title="导出当前简历 JSON"
              aria-label="导出当前简历 JSON"
            >
              <Download class="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              type="button"
              @click="handleOpenOptions" 
              class="p-1 hover:bg-white/20 rounded-md transition focus-visible:ring-2 focus-visible:ring-white" 
              title="打开简历管理中心与投递看板"
              aria-label="打开简历管理中心与投递看板"
            >
              <Settings class="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              type="button"
              @click="isDrawerOpen = false" 
              class="p-1 hover:bg-white/20 rounded-md transition focus-visible:ring-2 focus-visible:ring-white"
              aria-label="收起控制面板"
            >
              <X class="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <!-- Active Resume Switcher Bar -->
        <div class="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 text-slate-600 text-xs font-semibold flex-shrink-0">
            <Layers class="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            <span>当前简历:</span>
          </div>
          <select
            :value="selectedResumeId"
            @change="handleSwitchResume"
            aria-label="切换当前激活的简历版本"
            class="flex-1 max-w-[210px] bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
          >
            <option v-for="r in allResumes" :key="r.id" :value="r.id">
              {{ r.isDefault ? '⭐ ' : '' }}{{ r.title }}
            </option>
          </select>
        </div>

        <!-- Tab Toggle Bar (3 Tabs) -->
        <div 
          role="tablist" 
          aria-label="控制面板功能切换" 
          class="flex items-center border-b border-slate-100 bg-slate-50 text-xs font-bold p-1 gap-1"
        >
          <button
            id="drawer-tab-logs"
            role="tab"
            type="button"
            :aria-selected="drawerTab === 'logs'"
            aria-controls="drawer-panel-logs"
            @click="drawerTab = 'logs'"
            :class="[
              'flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-500',
              drawerTab === 'logs' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            ]"
          >
            <Sparkles class="w-3.5 h-3.5" aria-hidden="true" />
            <span>一键填表</span>
          </button>
          <button
            id="drawer-tab-review"
            role="tab"
            type="button"
            :aria-selected="drawerTab === 'review'"
            aria-controls="drawer-panel-review"
            @click="drawerTab = 'review'"
            :class="[
              'flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-500 relative',
              drawerTab === 'review' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            ]"
          >
            <AlertTriangle class="w-3.5 h-3.5" aria-hidden="true" />
            <span>待办核对</span>
            <span 
              v-if="fillResult?.remainingTasks && fillResult.remainingTasks.length > 0"
              class="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold"
            >
              {{ fillResult.remainingTasks.length }}
            </span>
          </button>
          <button
            id="drawer-tab-jd"
            role="tab"
            type="button"
            :aria-selected="drawerTab === 'jdMatch'"
            aria-controls="drawer-panel-jd"
            @click="handleSwitchToJDTab"
            :class="[
              'flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-500',
              drawerTab === 'jdMatch' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            ]"
          >
            <Target class="w-3.5 h-3.5" aria-hidden="true" />
            <span>岗位匹配</span>
          </button>
          <button
            id="drawer-tab-clipboard"
            role="tab"
            type="button"
            :aria-selected="drawerTab === 'clipboard'"
            aria-controls="drawer-panel-clipboard"
            @click="drawerTab = 'clipboard'"
            :class="[
              'flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-500',
              drawerTab === 'clipboard' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            ]"
          >
            <Copy class="w-3.5 h-3.5" aria-hidden="true" />
            <span>剪贴板 ({{ flatResumeFields.length }})</span>
          </button>
        </div>

        <!-- TAB 1: 填表日志与徽标 -->
        <div 
          id="drawer-panel-logs"
          role="tabpanel"
          aria-labelledby="drawer-tab-logs"
          v-if="drawerTab === 'logs'" 
          class="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div class="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>当前适配引擎:</span>
            <span class="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 truncate max-w-[170px]">
              {{ currentAdapterName }}
            </span>
          </div>

          <div class="p-4 flex-1 overflow-y-auto space-y-3">
            <div
              v-if="operationError && !isFilling"
              role="alert"
              class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs"
            >
              <div class="font-bold flex items-center gap-1.5">
                <AlertTriangle class="w-4 h-4" aria-hidden="true" />
                本次操作没有完成
              </div>
              <p class="mt-1 leading-relaxed">{{ operationError }}</p>
            </div>

            <div v-if="!fillResult && !isFilling && !previewPlan && !operationError" class="text-center py-8 text-slate-500">
              <Sparkles class="w-8 h-8 mx-auto mb-2 text-blue-400 opacity-60" aria-hidden="true" />
              <p class="font-medium text-xs text-slate-700">点击下方按钮或按 <kbd class="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-xs text-slate-800">Alt+Shift+F</kbd></p>
              <p class="text-xs text-slate-500 mt-1">先智能识别生成预览，核对无误后一键确认填写</p>
            </div>

            <div v-if="isFilling" role="status" aria-live="polite" class="text-center py-8 text-slate-600">
              <div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p class="font-medium text-xs">正在分析页面结构并注入行内徽标...</p>
            </div>

            <!-- Preview Plan (填前预览确认：先识别展示，确认后才写入) -->
            <div v-if="previewPlan && !fillResult" class="space-y-2">
              <div
                :class="[
                  'p-2.5 rounded-xl border text-xs',
                  previewFillItems.length > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                ]"
              >
                <span class="font-bold flex items-center gap-1">
                  <Eye class="w-4 h-4 text-blue-600" aria-hidden="true" />
                  {{ previewFillItems.length > 0
                    ? `已识别 ${previewFillItems.length} 个字段，请核对后确认填写`
                    : '当前页面没有可自动填写的字段' }}
                </span>
                <span v-if="previewNeedsUserItems.length > 0" class="block mt-0.5 text-amber-700">
                  另有 {{ previewNeedsUserItems.length }} 项需要你手动补充
                </span>
                <span v-if="previewWorkflowItems.length > 0" class="block mt-1 text-indigo-700">
                  确认后还会执行 {{ previewWorkflowItems.length }} 个重复区块流程；只允许编辑、保存和新增，不会提交申请或进入下一步
                </span>
              </div>

              <div class="max-h-56 overflow-y-auto space-y-1 pr-1">
                <div
                  v-for="item in previewFillItems"
                  :key="item.id"
                  class="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100 flex items-center justify-between text-xs"
                >
                  <span class="font-medium text-slate-700 truncate">{{ item.field.label }}</span>
                  <span class="text-emerald-700 truncate max-w-[110px]" :title="String(item.targetValue ?? '')">
                    {{ item.targetValue }}
                  </span>
                </div>
                <div
                  v-for="action in previewWorkflowItems"
                  :key="`workflow-${action.groupKey}`"
                  class="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-800"
                >
                  <span class="font-medium">{{ action.summary }}</span>
                </div>
                <div
                  v-for="item in previewNeedsUserItems"
                  :key="item.id"
                  class="p-2 rounded-lg bg-amber-50/60 border border-amber-100 flex items-center text-xs"
                >
                  <span class="text-amber-700 truncate">需手动：{{ item.field.label }}</span>
                </div>
              </div>
            </div>

            <!-- Result Logs -->
            <div v-if="fillResult" class="space-y-2">
              <div
                :class="[
                  'flex items-center justify-between p-2.5 rounded-xl border text-xs',
                  fillResult.filledCount > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                ]"
              >
                <span class="font-bold flex items-center gap-1">
                  <CheckCircle class="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  {{ fillResult.filledCount > 0
                    ? `成功填入 ${fillResult.filledCount} 项（已高亮）`
                    : '本次没有字段填写成功' }}
                </span>
                <span class="text-slate-500">耗时 {{ fillResult.durationMs }}ms</span>
              </div>

              <div class="text-xs font-semibold text-slate-700 pt-1 flex items-center justify-between">
                <span>字段填入详情：</span>
                <button
                  type="button"
                  @click="handleClearBadges"
                  class="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
                >
                  <EyeOff class="w-3 h-3" />
                  <span>清除徽标</span>
                </button>
              </div>

              <div class="max-h-56 overflow-y-auto space-y-1 pr-1">
                <div
                  v-for="(log, idx) in fillResult.logs"
                  :key="idx"
                  class="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                >
                  <div class="flex items-center gap-1.5 truncate max-w-[190px]">
                    <span
                      :class="[
                        'w-1.5 h-1.5 rounded-full flex-shrink-0',
                        log.status === 'success' ? 'bg-emerald-500' : 'bg-amber-400'
                      ]"
                    ></span>
                    <span class="font-medium text-slate-700 truncate">{{ log.label }}</span>
                  </div>
                  <span class="text-slate-500 truncate max-w-[110px]" :title="log.value">
                    {{ log.value || log.message }}
                  </span>
                </div>
              </div>
            </div>

            <DrawerHistoryTab
              :records="fillHistoryRecords"
              :loading="isHistoryLoading"
              :max-records="MAX_FILL_HISTORY_RECORDS"
              :format-time="formatHistoryTime"
              @copy="handleCopyDiagnosticHistory"
              @export="handleExportDiagnosticHistory"
              @replay-export="handleExportReplayPackage"
              @replay-import="handleImportReplayPackage"
              @clear="handleClearFillHistory"
            />
          </div>

          <!-- Footer Action Button：预览确认态 -->
          <footer v-if="previewPlan && !fillResult" class="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
            <button
              v-if="previewFillItems.length > 0 || previewWorkflowItems.length > 0"
              type="button"
              @click="confirmFill"
              :disabled="isFilling"
              class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <CheckCircle class="w-3.5 h-3.5" aria-hidden="true" />
              <span>{{ isFilling ? '正在填写...' : `确认填写 ${previewFillItems.length} 项${previewWorkflowItems.length ? '并执行区块流程' : ''}` }}</span>
            </button>
            <button
              v-else
              type="button"
              @click="handlePreviewManualFill"
              class="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <Pipette class="w-3.5 h-3.5" aria-hidden="true" />
              <span>改用手动点选填写</span>
            </button>
            <button
              type="button"
              @click="isFilling ? handleCancelActiveRun() : cancelPreview()"
              class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {{ isFilling ? '停止' : '取消' }}
            </button>
          </footer>

          <!-- Footer Action Button：初始态 -->
          <footer v-else class="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
            <button
              type="button"
              @click="handleQuickFill"
              :disabled="isFilling"
              class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Sparkles class="w-3.5 h-3.5" aria-hidden="true" />
              <span>{{ isFilling ? '正在识别...' : '一键识别并预览填写 (Alt+Shift+F)' }}</span>
            </button>
            <button
              v-if="isFilling"
              type="button"
              @click="handleCancelActiveRun"
              class="px-3 py-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 rounded-xl font-bold transition active:scale-95 focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              停止
            </button>
            <button
              type="button"
              @click="handleManualFill"
              title="点选手动填充：点击网页上的输入框，从简历字段中选一个填入（自动填充漏填/填错时补救）"
              class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Pipette class="w-3.5 h-3.5" aria-hidden="true" />
              <span>手动</span>
            </button>
            <button
              type="button"
              @click="handleUploadResume"
              title="选择本地 PDF/Word 简历，并注入当前网页的简历附件上传区"
              class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Paperclip class="w-3.5 h-3.5" aria-hidden="true" />
              <span>附件</span>
            </button>
          </footer>
        </div>

        <!-- TAB: 待办与核对 (Review) -->
        <DrawerReviewTab
          v-if="drawerTab === 'review'"
          :fill-result="fillResult"
          :active-task-mapping-id="activeTaskMappingId"
          :selected-mapping-key="selectedMappingKey"
          :available-binding-fields="AVAILABLE_BINDING_FIELDS"
          @focus-task="handleFocusTaskElement"
          @toggle-mapping="handleToggleTaskMapping"
          @save-mapping="handleSaveTaskMapping"
          @update:selected-mapping-key="selectedMappingKey = $event"
        />

        <!-- TAB 2: 岗位 JD 匹配度分析 -->
        <div 
          id="drawer-panel-jd"
          role="tabpanel"
          aria-labelledby="drawer-tab-jd"
          v-if="drawerTab === 'jdMatch'" 
          class="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div class="p-4 flex-1 overflow-y-auto space-y-3.5">
            <div
              v-if="applicationDraft"
              class="p-3 rounded-xl border border-emerald-200 bg-emerald-50/80 space-y-2"
              role="status"
              aria-live="polite"
            >
              <div class="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle class="w-4 h-4 text-emerald-600" aria-hidden="true" />
                检测到申请成功，已生成投递草稿
              </div>
              <p class="text-[11px] text-emerald-900 truncate" :title="`${applicationDraft.job.companyName} · ${applicationDraft.job.jobTitle}`">
                {{ applicationDraft.job.companyName }} · {{ applicationDraft.job.jobTitle }}
              </p>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="handleArchiveJob"
                  class="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  确认归档为已投递
                </button>
                <button
                  type="button"
                  @click="dismissApplicationDraft"
                  class="px-2.5 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-800 text-[11px] font-bold hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  稍后
                </button>
              </div>
            </div>

            <!-- Job Title & Score Gauge -->
            <div class="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500">识别到的岗位名称:</span>
                <button 
                  type="button" 
                  @click="handleAnalyzeJD" 
                  class="text-blue-600 font-bold hover:underline"
                >
                  重新分析
                </button>
              </div>
              <div class="font-bold text-slate-900 text-sm truncate">
                {{ jdAnalysis?.jobTitle || '正在识别页面岗位...' }}
              </div>

              <!-- Score Bar -->
              <div class="pt-1">
                <div class="flex items-center justify-between text-xs mb-1">
                  <span class="font-semibold text-slate-700">简历与岗位综合匹配度</span>
                  <span 
                    :class="[
                      'font-extrabold text-sm',
                      (jdAnalysis?.matchScore || 0) >= 80 ? 'text-emerald-600' : (jdAnalysis?.matchScore || 0) >= 60 ? 'text-amber-600' : 'text-rose-600'
                    ]"
                  >
                    {{ jdAnalysis?.matchScore || 0 }}%
                  </span>
                </div>
                <div class="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                  <div 
                    class="h-full transition-all duration-500 rounded-full"
                    :class="(jdAnalysis?.matchScore || 0) >= 80 ? 'bg-emerald-500' : (jdAnalysis?.matchScore || 0) >= 60 ? 'bg-amber-500' : 'bg-rose-500'"
                    :style="{ width: `${jdAnalysis?.matchScore || 0}%` }"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Matched Keywords -->
            <div class="space-y-1.5">
              <div class="text-xs font-bold text-slate-700 flex items-center gap-1">
                <CheckCircle class="w-3.5 h-3.5 text-emerald-600" />
                <span>已命中的核心技能 ({{ jdAnalysis?.matchedKeywords.length || 0 }})</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="kw in jdAnalysis?.matchedKeywords"
                  :key="kw"
                  class="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold"
                >
                  {{ kw }}
                </span>
                <span v-if="!jdAnalysis?.matchedKeywords?.length" class="text-slate-400 text-xs italic">
                  未检测到完全一致的技能标签
                </span>
              </div>
            </div>

            <!-- Missing Keywords (Click to Copy) -->
            <div class="space-y-1.5">
              <div class="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span class="flex items-center gap-1">
                  <AlertTriangle class="w-3.5 h-3.5 text-amber-500" />
                  <span>岗位提及但简历中缺失的关键词 ({{ jdAnalysis?.missingKeywords.length || 0 }})</span>
                </span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="kw in jdAnalysis?.missingKeywords"
                  :key="kw"
                  type="button"
                  @click="handleCopyKeyword(kw)"
                  class="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  :title="`点击复制【${kw}】`"
                >
                  <span>{{ kw }}</span>
                  <Copy class="w-2.5 h-2.5 opacity-60" />
                </button>
                <span v-if="!jdAnalysis?.missingKeywords?.length" class="text-emerald-600 text-xs font-medium">
                  🎉 太棒了，简历已覆盖当前 JD 提及的所有关键技术！
                </span>
              </div>
              <p class="text-xs text-slate-400">💡 提示：点击缺失标签可快速复制，建议在自我介绍或回答中补充以提高 ATS 筛选率。</p>
            </div>

            <!-- Diagnostic Tips -->
            <div class="p-3 bg-blue-50/60 border border-blue-100 rounded-xl space-y-1.5">
              <div class="text-xs font-bold text-blue-900 flex items-center gap-1">
                <Lightbulb class="w-3.5 h-3.5 text-blue-600" />
                <span>智能诊断与优化建议</span>
              </div>
              <ul class="text-xs text-blue-800 space-y-1 list-disc list-inside">
                <li v-for="(tip, idx) in jdAnalysis?.diagnosticTips" :key="idx">
                  {{ tip }}
                </li>
              </ul>
            </div>
          </div>

          <!-- Tab 2 Footer -->
          <footer class="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
            <button
              type="button"
              @click="handleToggleJDHighlight"
              :class="[
                'px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition focus-visible:ring-2 focus-visible:ring-amber-500 border',
                isHighlightingJD ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              ]"
              title="在当前招聘网页原文上用荧光笔标记技能词"
            >
              <Highlighter class="w-3.5 h-3.5" :class="isHighlightingJD ? 'text-amber-600 fill-amber-500' : 'text-slate-500'" />
              <span>{{ isHighlightingJD ? '清除荧光' : '网页荧光笔' }}</span>
            </button>
            <button
              type="button"
              @click="handleArchiveJob"
              class="flex-1 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1 shadow-md shadow-blue-500/20 active:scale-95 transition focus-visible:ring-2 focus-visible:ring-blue-500 text-xs"
            >
              <BookmarkPlus class="w-3.5 h-3.5" />
              <span>归档本岗位</span>
            </button>
          </footer>
        </div>

        <!-- TAB 3: 简历速查剪贴板 -->
        <DrawerClipboardTab
          v-if="drawerTab === 'clipboard'"
          :items="filteredFields"
          :search-query="searchQuery"
          :copied-field-key="copiedFieldKey"
          :copy-toast-message="copyToastMessage"
          @update:search-query="searchQuery = $event"
          @copy-field="handleCopyField"
          @open-options="handleOpenOptions"
        />
      </div>
    </transition>

    <!-- Step Change Mini Notification Toast -->
    <transition
      enter-active-class="transition duration-300 ease-out transform"
      enter-from-class="-translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in transform"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-2 opacity-0"
    >
      <div 
        v-if="stepNotification.show"
        @click="handleStepNotification"
        class="absolute bottom-full right-0 cursor-pointer w-[248px] max-w-[calc(100vw-24px)] bg-slate-900/95 text-white px-3 py-2.5 rounded-xl shadow-2xl border border-blue-500/40 backdrop-blur flex items-start gap-2.5 hover:bg-blue-900 transition mb-2"
        role="button"
        tabindex="0"
        @keydown.enter.prevent="handleStepNotification"
        @keydown.space.prevent="handleStepNotification"
      >
        <Sparkles class="w-4 h-4 mt-0.5 text-amber-400 flex-shrink-0 animate-bounce" aria-hidden="true" />
        <span class="min-w-0 text-left">
          <strong class="block text-xs font-semibold leading-4">检测到网申新步骤</strong>
          <span class="block mt-0.5 text-[11px] text-slate-200 leading-4 whitespace-normal break-words">{{ stepNotification.text }}</span>
        </span>
      </div>
    </transition>

    <!-- Main Floating Bubble Button -->
    <div class="w-[74px] flex flex-col items-center gap-1.5">
      <button
        type="button"
        @pointerdown="startBallDrag"
        @click="handleBubbleClick"
        :class="[
          'w-12 h-12 rounded-full shadow-2xl flex items-center justify-center text-white transition-all transform hover:scale-110 active:scale-95 group relative focus-visible:ring-4 focus-visible:ring-blue-400 touch-none cursor-move',
          isFilling ? 'bg-blue-700 animate-pulse' : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:shadow-blue-500/50 shadow-blue-600/30'
        ]"
        title="点击一键自动填表；按住可拖动位置 (Alt+Shift+F)"
        aria-label="一键自动填写当前页面；按住可拖动位置 (快捷键 Alt+Shift+F)"
      >
        <Zap v-if="!isFilling" class="w-6 h-6 fill-white" aria-hidden="true" />
        <div v-else class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>

        <!-- Tooltip -->
        <span class="absolute right-14 whitespace-nowrap bg-slate-900 text-white text-xs px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition shadow-lg pointer-events-none">
          点击一键填表 (Alt+Shift+F)
        </span>
      </button>

      <!-- Toggle Drawer Button -->
      <div class="flex items-center gap-1">
        <button
          type="button"
          @click="toggleDrawer"
          :aria-expanded="isDrawerOpen"
          aria-controls="openjobfill-drawer-panel"
          class="px-2.5 py-1 min-h-[26px] bg-white/90 backdrop-blur border border-slate-200/80 rounded-full shadow-md text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-white flex items-center justify-center gap-0.5 transition focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span>{{ isDrawerOpen ? '收起' : '面板' }}</span>
        </button>
        <button
          type="button"
          @click="handleHideFloatingBall"
          class="w-6 h-6 bg-white/90 backdrop-blur border border-slate-200/80 rounded-full shadow-md text-slate-500 hover:text-rose-600 hover:bg-white flex items-center justify-center transition focus-visible:ring-2 focus-visible:ring-rose-500"
          title="在当前页面隐藏悬浮球（刷新或使用快捷键可恢复）"
          aria-label="在当前页面隐藏悬浮球"
        >
          <X class="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  </aside>
</template>
