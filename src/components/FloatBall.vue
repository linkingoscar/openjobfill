<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { 
  Zap, 
  Sparkles, 
  X, 
  Copy, 
  Settings, 
  Layers,
  Download,
  Target,
  EyeOff,
  AlertTriangle,
  BookmarkPlus,
  Pipette,
  RefreshCw,
} from 'lucide-vue-next';
import { resumeStorage } from '@/core/storage/resumeStorage';
import { ruleStorage } from '@/core/storage/ruleStorage';
import { useFillHistory } from './composables/useFillHistory';
import { useFillSession } from './composables/useFillSession';
import { useApplicationArchive } from './composables/useApplicationArchive';
import { useJDAnalysis } from './composables/useJDAnalysis';
import DrawerHistoryTab from './DrawerHistoryTab.vue';
import DrawerFillTab from './DrawerFillTab.vue';
import DrawerJDTab from './DrawerJDTab.vue';
import DrawerReviewTab from './DrawerReviewTab.vue';
import DrawerClipboardTab from './DrawerClipboardTab.vue';
import { getEnhancerForUrl } from '@/core/adapters';
import { setNativeValue } from '@/core/engine/dispatcher';
import { clearAllBadges } from '@/core/engine/badgeDecorator';
import { startElementPicking } from '@/core/engine/elementPicker';
import { startManualFill } from '@/core/engine/manualFill';
import { uploadResumeToPage } from '@/core/engine/attachmentUploader';
import { inspectFieldSafety } from '@/core/pipeline/fieldSafety';
import { canImportPlatformProfile, extractPlatformProfile, mergePlatformProfile } from '@/core/importers/platformProfileImporter';
import { generateOptimalSelector } from '@/utils/dom';
import type { StandardResume } from '@/types/resume';
import { createPageFocusTracker } from '@/core/ui/pageFocus';
import { buildResumeClipboardItems, buildResumeBindingGroups } from '@/core/schema/resumeFieldRegistry';
import type { ClipboardItem, DrawerTab } from '@/types/floatingBall';
import type { RemainingTaskItem } from '@/types/pipeline';
import { useFloatingPosition } from './composables/useFloatingPosition';

const isDrawerOpen = ref(false);
const drawerTab = ref<DrawerTab>('logs');
const currentAdapterName = ref('');
const currentResume = ref<StandardResume | null>(null);
const allResumes = ref<StandardResume[]>([]);
const selectedResumeId = ref('');
const isHiddenOnCurrentPage = ref(false);
const canSyncCurrentPlatform = computed(() => canImportPlatformProfile(window.location.href));

const handleHideFloatingBall = () => {
  isDrawerOpen.value = false;
  isHiddenOnCurrentPage.value = true;
};

// 多步向导与待办核对提示
const copyToastMessage = ref('');

const handleFocusTaskElement = (task: RemainingTaskItem) => {
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

const availableBindingFields = computed(() =>
  currentResume.value ? buildResumeBindingGroups(currentResume.value) : [],
);

const handleToggleTaskMapping = (task: RemainingTaskItem) => {
  if (activeTaskMappingId.value === task.id) {
    activeTaskMappingId.value = null;
  } else {
    activeTaskMappingId.value = task.id;
    selectedMappingKey.value = '';
  }
};

const handleSaveTaskMapping = async (task: RemainingTaskItem) => {
  if (!task.element || !availableBindingFields.value.some((group) =>
    group.options.some((option) => option.value === selectedMappingKey.value))) return;
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

const notifyStepChange = (newUrl: string, changedNodes: HTMLElement[] = []) => {
  fillSession.notifyStepChange(newUrl, changedNodes);
  void detectApplicationSuccessDraft();
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
  handleRunReplay,
  handleClearFillHistory,
} = useFillHistory(copyToastMessage, currentAdapterName);

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isDrawerOpen.value) {
    void fillSession.cancel('用户按下 Esc 取消填写');
    isDrawerOpen.value = false;
  }
};

const loadActiveResume = async () => {
  allResumes.value = await resumeStorage.getAllResumes();
  const active = await resumeStorage.getActiveResume();
  currentResume.value = active;
  selectedResumeId.value = active.id;
  return active;
};

const handleSwitchResume = async (e: Event) => {
  const target = e.target as HTMLSelectElement;
  const newId = target.value;
  if (!newId) return;
  await fillSession.invalidateResume();
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

const pageFocus = createPageFocusTracker();
onMounted(async () => {
  pageFocus.start();
  loadFloatingPosition();
  const enhancer = getEnhancerForUrl(window.location.href, document);
  currentAdapterName.value = enhancer?.name || '智能通用决策引擎 (Pipeline v2)';
  await Promise.all([loadActiveResume(), loadFillHistory()]);
  await initializeArchive();
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', handleViewportResize);
});

onUnmounted(() => {
  pageFocus.stop();
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('resize', handleViewportResize);
  cleanupFloatingPosition();
});

const handleQuickFill = () => {
  isHiddenOnCurrentPage.value = false;
  return fillSession.analyze();
};

const handleStepNotification = () => { void fillSession.analyzeChangedPage(); };

const handleCancelActiveRun = async () => {
  await fillSession.cancel('用户取消填写');
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

const handleSyncPlatformProfile = async () => {
  const active = await resumeStorage.getActiveResume();
  const extracted = extractPlatformProfile(document, window.location.href);
  const count = Object.keys(extracted.basics).length + extracted.educations.length + extracted.experiences.length;
  if (!count) {
    copyToastMessage.value = '当前页面没有识别到可同步的个人资料，请先打开平台的简历详情页';
    return;
  }
  if (!window.confirm(`识别到 ${count} 组资料。是否合并到当前简历“${active.title}”？现有非空基本信息不会被空值覆盖。`)) return;
  await fillSession.invalidateResume();
  await resumeStorage.saveResume(mergePlatformProfile(active, extracted));
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
const flatResumeFields = computed<ClipboardItem[]>(() =>
  currentResume.value ? buildResumeClipboardItems(currentResume.value) : [],
);

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
    const target = pageFocus.getTarget();
    await navigator.clipboard.writeText(item.value);
    copiedFieldKey.value = item.id;
    copyToastMessage.value = `已复制【${item.label}】`;

    // 智能点填：如果当前页面有聚焦的输入框，顺手写入
    const activeEl = target === pageFocus.getTarget() ? target : null;
    if (activeEl) {
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

// UI owns presentation; the session owns all writable fill state.
const fillSession = useFillSession({
  loadResume: loadActiveResume,
  present: (adapterName) => {
    if (adapterName) currentAdapterName.value = adapterName;
    drawerTab.value = 'logs';
    isDrawerOpen.value = true;
  },
  persistResult: persistFillHistory,
  persistError: persistOperationError,
});
const {
  isFilling, fillResult, operationError, stepNotification,
  previewPlan, previewFillItems, previewNeedsUserItems, previewWorkflowItems, confirmFill,
} = fillSession;
const cancelPreview = () => fillSession.cancel();
const handlePreviewManualFill = async () => {
  await fillSession.cancel();
  await handleManualFill();
};

const {
  applicationDraft, detectApplicationSuccessDraft, dismissApplicationDraft, handleArchiveJob,
  initialize: initializeArchive,
} = useApplicationArchive({
  getResume: () => currentResume.value,
  getJD: () => {
    if (!jdAnalysis.value && currentResume.value) handleAnalyzeJD();
    return jdAnalysis.value;
  },
  presentDraft: () => { isDrawerOpen.value = true; drawerTab.value = 'jdMatch'; },
  notify: (message) => {
    copyToastMessage.value = message;
    setTimeout(() => { copyToastMessage.value = ''; }, 3500);
  },
});

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

        <DrawerFillTab
          v-if="drawerTab === 'logs'"
          :current-adapter-name="currentAdapterName"
          :operation-error="operationError"
          :is-filling="isFilling"
          :has-preview="!!previewPlan"
          :fill-result="fillResult"
          :preview-fill-items="previewFillItems"
          :preview-needs-user-items="previewNeedsUserItems"
          :preview-workflow-items="previewWorkflowItems"
          @clear-badges="handleClearBadges"
          @confirm="confirmFill"
          @preview-manual="handlePreviewManualFill"
          @analyze="handleQuickFill"
          @manual="handleManualFill"
          @upload="handleUploadResume"
          @cancel="isFilling ? handleCancelActiveRun() : cancelPreview()"
        >
          <template #history>
            <DrawerHistoryTab
              :records="fillHistoryRecords"
              :loading="isHistoryLoading"
              :max-records="MAX_FILL_HISTORY_RECORDS"
              :format-time="formatHistoryTime"
              :feedback="copyToastMessage"
              @copy="handleCopyDiagnosticHistory"
              @export="handleExportDiagnosticHistory"
              @replay-export="handleExportReplayPackage"
              @replay-import="handleImportReplayPackage"
              @replay-run="handleRunReplay"
              @clear="handleClearFillHistory"
            />
          </template>
        </DrawerFillTab>

        <!-- TAB: 待办与核对 (Review) -->
        <DrawerReviewTab
          v-if="drawerTab === 'review'"
          :fill-result="fillResult"
          :active-task-mapping-id="activeTaskMappingId"
          :selected-mapping-key="selectedMappingKey"
          :available-binding-fields="availableBindingFields"
          @focus-task="handleFocusTaskElement"
          @toggle-mapping="handleToggleTaskMapping"
          @save-mapping="handleSaveTaskMapping"
          @update:selected-mapping-key="selectedMappingKey = $event"
        />

        <DrawerJDTab
          v-if="drawerTab === 'jdMatch'"
          :jd-analysis="jdAnalysis"
          :application-draft="applicationDraft"
          :is-highlighting-j-d="isHighlightingJD"
          @archive="handleArchiveJob"
          @dismiss-draft="dismissApplicationDraft"
          @analyze="handleAnalyzeJD"
          @toggle-highlight="handleToggleJDHighlight"
          @copy-keyword="handleCopyKeyword"
        />

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
