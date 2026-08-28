<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { 
  Zap, 
  Sparkles, 
  CheckCircle, 
  X, 
  Copy, 
  Check, 
  Search, 
  Settings, 
  ExternalLink,
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
  EyeOff,
  AlertTriangle,
  Lightbulb,
  BookmarkPlus,
  TrendingUp,
  Pipette,
  Highlighter
} from 'lucide-vue-next';
import { resumeStorage } from '@/core/storage/resumeStorage';
import { ruleStorage } from '@/core/storage/ruleStorage';
import { trackerStorage } from '@/core/storage/trackerStorage';
import { formFillerEngine } from '@/core/engine/filler';
import { getAdapterForUrl } from '@/core/adapters';
import { setNativeValue } from '@/core/engine/dispatcher';
import { clearAllBadges } from '@/core/engine/badgeDecorator';
import { startElementPicking } from '@/core/engine/elementPicker';
import { analyzeJDMatch, highlightJDOnWebpage, clearJDHighlights, type JDAnalysisResult } from '@/core/matcher/jdMatcher';
import { generateOptimalSelector } from '@/utils/dom';
import type { FillResult } from '@/types/adapter';
import type { StandardResume } from '@/types/resume';
import type { JobApplicationRecord } from '@/types/tracker';

const isFilling = ref(false);
const isDrawerOpen = ref(false);
const drawerTab = ref<'logs' | 'review' | 'clipboard' | 'jdMatch'>('logs');
const currentAdapterName = ref('');
const fillResult = ref<FillResult | null>(null);
const currentResume = ref<StandardResume | null>(null);
const allResumes = ref<StandardResume[]>([]);
const selectedResumeId = ref('');

// 多步向导与待办核对提示
const stepNotification = ref({ show: false, text: '' });

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
    { label: '户籍 / 户口所在地', value: 'basics.hukouLocation.detail' },
    { label: '现居城市', value: 'basics.currentLocation.city' },
    { label: '现居详细地址', value: 'basics.currentLocation.detail' },
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
    task.label
  );
  activeTaskMappingId.value = null;
  copyToastMessage.value = `🎯 已为当前网站记住映射【${task.label} -> ${selectedMappingKey.value}】！下次自动填表将精准命中。`;
  setTimeout(() => { copyToastMessage.value = ''; }, 3500);
};

const notifyStepChange = (newUrl: string) => {
  stepNotification.value = {
    show: true,
    text: '💡 检测到网申已进入新步骤，点击可一键规划并填充当前页'
  };
  setTimeout(() => {
    stepNotification.value.show = false;
  }, 8000);
};

// 岗位 JD 分析与荧光笔状态
const jdAnalysis = ref<JDAnalysisResult | null>(null);
const isAnalyzingJD = ref(false);
const isHighlightingJD = ref(false);

// 剪贴板快速搜索与复制提示
const searchQuery = ref('');
const copiedFieldKey = ref<string | null>(null);
const copyToastMessage = ref('');

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isDrawerOpen.value) {
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

// 抽屉尺寸自定义与拖拽调节
const drawerWidth = ref(Number(localStorage.getItem('openjobfill_drawer_width')) || 384);
const drawerHeight = ref(Number(localStorage.getItem('openjobfill_drawer_height')) || 620);
let isResizing = false;
let resizeStartX = 0;
let resizeStartY = 0;
let initialWidth = 384;
let initialHeight = 620;

const startResize = (e: MouseEvent) => {
  isResizing = true;
  resizeStartX = e.clientX;
  resizeStartY = e.clientY;
  initialWidth = drawerWidth.value;
  initialHeight = drawerHeight.value;
  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', stopResize);
  e.preventDefault();
};

const handleResizeMove = (e: MouseEvent) => {
  if (!isResizing) return;
  const deltaX = resizeStartX - e.clientX;
  const deltaY = resizeStartY - e.clientY;
  drawerWidth.value = Math.max(320, Math.min(680, initialWidth + deltaX));
  drawerHeight.value = Math.max(400, Math.min(window.innerHeight - 80, initialHeight + deltaY));
};

const stopResize = () => {
  if (!isResizing) return;
  isResizing = false;
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', stopResize);
  localStorage.setItem('openjobfill_drawer_width', String(drawerWidth.value));
  localStorage.setItem('openjobfill_drawer_height', String(drawerHeight.value));
};

onMounted(async () => {
  const adapter = getAdapterForUrl(window.location.href);
  currentAdapterName.value = adapter.name;
  await loadActiveResume();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', stopResize);
});

const handleQuickFill = async () => {
  if (isFilling.value) return;
  isFilling.value = true;
  fillResult.value = null;

  try {
    const activeResume = await resumeStorage.getActiveResume();
    currentResume.value = activeResume;
    selectedResumeId.value = activeResume.id;
    const result = await formFillerEngine.fill(activeResume);
    fillResult.value = result;
    drawerTab.value = 'logs';
    isDrawerOpen.value = true; // 填表完成后自动展开日志抽屉
  } catch (err: any) {
    console.error('[OpenJobFill] Autofill error:', err);
  } finally {
    isFilling.value = false;
  }
};

const handleAnalyzeJD = () => {
  if (!currentResume.value) return;
  isAnalyzingJD.value = true;
  try {
    jdAnalysis.value = analyzeJDMatch(currentResume.value);
  } catch (e) {
    console.error('JD Match error:', e);
  } finally {
    isAnalyzingJD.value = false;
  }
};

const handleSwitchToJDTab = () => {
  drawerTab.value = 'jdMatch';
  if (!jdAnalysis.value) {
    handleAnalyzeJD();
  }
};

const handleClearBadges = () => {
  clearAllBadges();
  copyToastMessage.value = '已清除页面上的所有状态高亮与徽标';
  setTimeout(() => { copyToastMessage.value = ''; }, 2000);
};

const handleArchiveJob = async () => {
  if (!jdAnalysis.value && currentResume.value) {
    handleAnalyzeJD();
  }
  const jobTitle = jdAnalysis.value?.jobTitle || document.title.replace(/[-_].*$/, '').trim() || '求职岗位';
  const companyGuess = document.title.includes('-') ? document.title.split('-')[1].trim() : window.location.hostname.replace('www.', '');

  const record: JobApplicationRecord = {
    id: `app-${Date.now()}`,
    companyName: companyGuess || '目标企业',
    jobTitle: jobTitle,
    appliedDate: new Date().toISOString().slice(0, 10),
    status: 'applied',
    jobUrl: window.location.href,
    salary: currentResume.value?.basics.expectedSalaryMin ? `${currentResume.value.basics.expectedSalaryMin}k` : '',
    resumeVersionTitle: currentResume.value?.title || '默认简历',
    notes: `通过 OpenJobFill 一键填表完成投递。综合技能匹配度: ${jdAnalysis.value?.matchScore || 0}%`,
    updatedAt: new Date().toISOString()
  };

  await trackerStorage.saveApplication(record);
  copyToastMessage.value = `📌 已归档【${record.companyName} - ${record.jobTitle}】至投递看板！`;
  setTimeout(() => { copyToastMessage.value = ''; }, 3000);
};

const handleToggleJDHighlight = () => {
  if (!currentResume.value) return;
  if (!isHighlightingJD.value) {
    const res = highlightJDOnWebpage(currentResume.value);
    isHighlightingJD.value = true;
    copyToastMessage.value = `🖍️ 已在网页标注技能词 (命中 ${res.matchedCount} / 缺失 ${res.missingCount})`;
  } else {
    clearJDHighlights();
    isHighlightingJD.value = false;
    copyToastMessage.value = '已清除网页 JD 荧光笔标记';
  }
  setTimeout(() => { copyToastMessage.value = ''; }, 2500);
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
    await loadActiveResume();
    if (drawerTab.value === 'jdMatch' && !jdAnalysis.value) {
      handleAnalyzeJD();
    }
  }
};

// 提取结构化简历平铺字段 (供速查剪贴板使用)
interface ClipboardItem {
  id: string;
  category: '基本信息' | '教育经历' | '工作实习' | '项目经历' | '技能证书' | '家庭成员' | '问答与评价';
  label: string;
  value: string;
}

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
  if (r.basics.expectedRole) list.push({ id: 'b-role', category: '基本信息', label: '期望职位', value: r.basics.expectedRole });
  if (r.basics.expectedCity) list.push({ id: 'b-exp-city', category: '基本信息', label: '期望工作城市', value: r.basics.expectedCity });
  if (r.basics.expectedSalaryMin) list.push({ id: 'b-salary', category: '基本信息', label: '期望月薪(k)', value: `${r.basics.expectedSalaryMin}k` });
  if (r.basics.githubUrl) list.push({ id: 'b-github', category: '基本信息', label: 'GitHub', value: r.basics.githubUrl });
  if (r.basics.linkedinUrl) list.push({ id: 'b-linkedin', category: '基本信息', label: 'LinkedIn', value: r.basics.linkedinUrl });
  if (r.basics.blogUrl) list.push({ id: 'b-blog', category: '基本信息', label: '个人网站/博客', value: r.basics.blogUrl });

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
    if (skill.name) list.push({ id: `skill-${idx}`, category: '技能证书', label: `专业技能: ${skill.name}`, value: `${skill.name} (${skill.level || '熟练'})` });
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
    if (activeEl && (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement)) {
      setNativeValue(activeEl, item.value);
      copyToastMessage.value = `已复制并自动填入当前输入框！`;
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

defineExpose({
  handleQuickFill,
  notifyStepChange,
});
</script>

<template>
  <aside class="openjobfill-root fixed right-5 bottom-24 z-[2147483647] font-sans select-none flex items-end gap-3 pointer-events-auto" aria-label="OpenJobFill 悬浮填表工具">
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
          width: `${drawerWidth}px`,
          maxHeight: `${drawerHeight}px`,
          height: `${drawerHeight}px`
        }"
        class="bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden text-slate-800 text-xs backdrop-blur-md relative transition-[width,height] duration-75"
      >
        <!-- Left/Top Resizing Handles -->
        <div 
          @mousedown="startResize"
          class="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors z-40 group"
          title="拖拽调节面板宽度"
        >
          <div class="w-0.5 h-8 bg-slate-300 group-hover:bg-blue-500 rounded-full absolute left-0.5 top-1/2 -translate-y-1/2"></div>
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
            <div v-if="!fillResult && !isFilling" class="text-center py-8 text-slate-500">
              <Sparkles class="w-8 h-8 mx-auto mb-2 text-blue-400 opacity-60" aria-hidden="true" />
              <p class="font-medium text-xs text-slate-700">点击下方按钮或按 <kbd class="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-xs text-slate-800">Alt+Shift+F</kbd></p>
              <p class="text-xs text-slate-500 mt-1">一键智能秒填并点亮页面绿色已填徽标</p>
            </div>

            <div v-if="isFilling" role="status" aria-live="polite" class="text-center py-8 text-slate-600">
              <div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p class="font-medium text-xs">正在分析页面结构并注入行内徽标...</p>
            </div>

            <!-- Result Logs -->
            <div v-if="fillResult" class="space-y-2">
              <div class="flex items-center justify-between p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs">
                <span class="font-bold flex items-center gap-1">
                  <CheckCircle class="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  成功填入 {{ fillResult.filledCount }} 项 (已高亮)
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
          </div>

          <!-- Footer Action Button -->
          <footer class="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
            <button
              type="button"
              @click="handleQuickFill"
              :disabled="isFilling"
              class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Sparkles class="w-3.5 h-3.5" aria-hidden="true" />
              <span>{{ isFilling ? '正在填写...' : '一键自动填写本页 (Alt+Shift+F)' }}</span>
            </button>
          </footer>
        </div>

        <!-- TAB: 待办与核对 (Review) -->
        <div 
          id="drawer-panel-review"
          role="tabpanel"
          aria-labelledby="drawer-tab-review"
          v-if="drawerTab === 'review'" 
          class="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div class="p-3 bg-amber-50/70 border-b border-amber-100 flex items-center justify-between">
            <div class="flex items-center gap-1.5 text-amber-900 font-bold">
              <AlertTriangle class="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>需人工确认 / 待办清单 ({{ fillResult?.remainingTasks?.length || 0 }})</span>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-3 space-y-2.5">
            <div v-if="!fillResult || !fillResult.remainingTasks || fillResult.remainingTasks.length === 0" class="text-center py-10 text-slate-400">
              <CheckCircle class="w-10 h-10 mx-auto text-emerald-500/40 mb-2" />
              <p class="font-bold text-slate-600">当前没有需要人工确认的待办项</p>
              <p class="text-[11px] mt-1 text-slate-400">点击“一键填表”后，未匹配的必填项将在此展示并支持一键定位</p>
            </div>

            <div 
              v-for="task in fillResult?.remainingTasks || []" 
              :key="task.id"
              class="p-2.5 rounded-xl border border-amber-200/80 bg-amber-50/30 hover:bg-amber-50 transition flex flex-col gap-2"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span v-if="task.required" class="px-1 py-0.2 bg-red-100 text-red-700 rounded text-[10px] font-bold">必填</span>
                    <span class="font-bold text-slate-800 text-xs truncate">{{ task.label }}</span>
                  </div>
                  <p class="text-[11px] text-amber-800/80 mt-1 font-medium">{{ task.reason }}</p>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    @click="handleFocusTaskElement(task)"
                    class="px-2 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-[11px] font-bold transition shadow-xs"
                    title="在网页中滚动并高亮定位此输入框"
                  >
                    定位
                  </button>
                  <button
                    type="button"
                    @click="handleToggleTaskMapping(task)"
                    class="px-2 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-[11px] font-bold transition shadow-xs"
                    title="将此未识别字段永久绑定到简历属性"
                  >
                    记住映射
                  </button>
                </div>
              </div>

              <!-- 内嵌字段绑定选择器 -->
              <div 
                v-if="activeTaskMappingId === task.id"
                class="pt-2 mt-1 border-t border-amber-200/60 flex items-center gap-2 text-xs"
              >
                <select 
                  v-model="selectedMappingKey"
                  class="flex-1 px-2 py-1 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                >
                  <option value="" disabled>请选择此字段对应的简历属性...</option>
                  <optgroup v-for="grp in AVAILABLE_BINDING_FIELDS" :key="grp.group" :label="grp.group">
                    <option v-for="opt in grp.options" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </optgroup>
                </select>
                <button
                  type="button"
                  :disabled="!selectedMappingKey"
                  @click="handleSaveTaskMapping(task)"
                  class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs transition"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 2: 岗位 JD 匹配度分析 -->
        <div 
          id="drawer-panel-jd"
          role="tabpanel"
          aria-labelledby="drawer-tab-jd"
          v-if="drawerTab === 'jdMatch'" 
          class="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div class="p-4 flex-1 overflow-y-auto space-y-3.5">
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
        <div 
          id="drawer-panel-clipboard"
          role="tabpanel"
          aria-labelledby="drawer-tab-clipboard"
          v-if="drawerTab === 'clipboard'" 
          class="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <!-- Search Bar -->
          <div class="p-3 border-b border-slate-100 bg-slate-50">
            <div class="relative flex items-center">
              <Search class="w-3.5 h-3.5 absolute left-2.5 text-slate-400" aria-hidden="true" />
              <input
                v-model="searchQuery"
                type="text"
                aria-label="搜索简历字段"
                placeholder="搜索字段 (如: 姓名, 电话, GPA, 问答, 自我评价)..."
                class="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <!-- Copy Toast Banner -->
          <div 
            v-if="copyToastMessage" 
            role="status" 
            aria-live="polite" 
            class="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold text-center animate-fade-in flex items-center justify-center gap-1"
          >
            <Check class="w-3.5 h-3.5" aria-hidden="true" />
            <span>{{ copyToastMessage }}</span>
          </div>

          <!-- Fields List -->
          <div class="p-3 flex-1 overflow-y-auto space-y-2">
            <div v-if="filteredFields.length === 0" class="text-center py-8 text-slate-500 text-xs">
              没有找到匹配的简历字段
            </div>

            <button
              v-for="item in filteredFields"
              :key="item.id"
              type="button"
              @click="handleCopyField(item)"
              class="w-full text-left p-2.5 bg-slate-50 hover:bg-blue-50/80 border border-slate-100 hover:border-blue-200 rounded-xl cursor-pointer transition flex items-center justify-between group focus-visible:ring-2 focus-visible:ring-blue-500"
              :title="`点击复制【${item.label}】(若输入框聚焦则自动填入)`"
              :aria-label="`复制 ${item.category} ${item.label}: ${item.value}`"
            >
              <div class="min-w-0 flex-1 pr-2">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-slate-500 font-medium px-1.5 py-0.5 bg-white border border-slate-200 rounded">
                    {{ item.category }}
                  </span>
                  <span class="font-bold text-slate-800 text-xs">{{ item.label }}</span>
                </div>
                <div class="text-xs text-slate-600 truncate mt-0.5">
                  {{ item.value }}
                </div>
              </div>

              <div class="w-6 h-6 rounded-lg bg-white border border-slate-200 group-hover:border-blue-300 group-hover:text-blue-600 flex items-center justify-center text-slate-400 shadow-xs flex-shrink-0">
                <Check v-if="copiedFieldKey === item.id" class="w-3.5 h-3.5 text-emerald-600 animate-scale" aria-hidden="true" />
                <Copy v-else class="w-3.5 h-3.5" aria-hidden="true" />
              </div>
            </button>
          </div>

          <footer class="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>💡 点击任意字段直接复制或点填</span>
            <button 
              type="button"
              @click="handleOpenOptions" 
              class="text-blue-600 font-semibold hover:underline flex items-center gap-0.5 focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              <span>编辑简历</span>
              <ExternalLink class="w-3 h-3" aria-hidden="true" />
            </button>
          </footer>
        </div>
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
        @click="handleQuickFill"
        class="cursor-pointer max-w-[220px] bg-slate-900/95 text-white text-xs px-3 py-2 rounded-xl shadow-2xl border border-blue-500/40 backdrop-blur flex items-center gap-2 hover:bg-blue-900 transition mb-1"
      >
        <Sparkles class="w-4 h-4 text-amber-400 flex-shrink-0 animate-bounce" />
        <span class="text-[11px] font-medium leading-tight">{{ stepNotification.text }}</span>
      </div>
    </transition>

    <!-- Main Floating Bubble Button -->
    <div class="flex flex-col items-center gap-1.5">
      <button
        type="button"
        @click="handleQuickFill"
        :class="[
          'w-12 h-12 rounded-full shadow-2xl flex items-center justify-center text-white transition-all transform hover:scale-110 active:scale-95 group relative focus-visible:ring-4 focus-visible:ring-blue-400',
          isFilling ? 'bg-blue-700 animate-pulse' : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:shadow-blue-500/50 shadow-blue-600/30'
        ]"
        title="点击一键自动填表 (Alt+Shift+F)"
        aria-label="一键自动填写当前页面 (快捷键 Alt+Shift+F)"
      >
        <Zap v-if="!isFilling" class="w-6 h-6 fill-white" aria-hidden="true" />
        <div v-else class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>

        <!-- Tooltip -->
        <span class="absolute right-14 whitespace-nowrap bg-slate-900 text-white text-xs px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition shadow-lg pointer-events-none">
          点击一键填表 (Alt+Shift+F)
        </span>
      </button>

      <!-- Toggle Drawer Button -->
      <button
        type="button"
        @click="toggleDrawer"
        :aria-expanded="isDrawerOpen"
        aria-controls="openjobfill-drawer-panel"
        class="px-2.5 py-1 min-h-[26px] bg-white/90 backdrop-blur border border-slate-200/80 rounded-full shadow-md text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-white flex items-center justify-center gap-0.5 transition focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span>{{ isDrawerOpen ? '收起' : '面板' }}</span>
      </button>
    </div>
  </aside>
</template>


