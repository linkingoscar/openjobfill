<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { resumeStorage } from '@/core/storage/resumeStorage';
import { DEFAULT_RESUME } from '@/core/storage/defaultData';
import type { StandardResume } from '@/types/resume';
import { saveCustomDomains } from '@/core/whitelist';

import ResumeImportModal from '@/components/ResumeImportModal.vue';
import Toast, { type ToastMessage } from './components/Toast.vue';
import ConfirmModal from './components/ConfirmModal.vue';
import ResumeSidebar from './components/ResumeSidebar.vue';
import BasicsTab from './components/BasicsTab.vue';
import ApplicationExtraTab from './components/ApplicationExtraTab.vue';
import EducationTab from './components/EducationTab.vue';
import ExperienceTab from './components/ExperienceTab.vue';
import ProjectTab from './components/ProjectTab.vue';
import QABankTab from './components/QABankTab.vue';
import CustomRulesTab from './components/CustomRulesTab.vue';
import JobTrackerTab from './components/JobTrackerTab.vue';
import SettingsTab from './components/SettingsTab.vue';

import { 
  Zap, 
  Save, 
  Download, 
  Upload, 
  User, 
  GraduationCap, 
  Briefcase, 
  FolderGit2, 
  HelpCircle, 
  Settings,
  Sparkles,
  Sliders,
  TrendingUp,
  ShieldCheck
} from 'lucide-vue-next';

const resumes = ref<StandardResume[]>([]);
const currentResume = ref<StandardResume>(JSON.parse(JSON.stringify(DEFAULT_RESUME)));
const activeTab = ref<'basics' | 'appExtra' | 'education' | 'experience' | 'projects' | 'qa' | 'tracker' | 'customRules' | 'settings'>('basics');
const saveSuccess = ref(false);

// Toast 状态管理
const toasts = ref<ToastMessage[]>([]);
const showToast = (type: 'success' | 'error' | 'info', text: string) => {
  const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  toasts.value.push({ id, type, text });
  setTimeout(() => {
    dismissToast(id);
  }, 3000);
};
const dismissToast = (id: string) => {
  const idx = toasts.value.findIndex(t => t.id === id);
  if (idx !== -1) toasts.value.splice(idx, 1);
};

// Confirm Modal 状态管理 (替代 window.confirm)
const isConfirmOpen = ref(false);
const pendingDeleteResumeId = ref<string | null>(null);

const requestDeleteResume = (id: string) => {
  pendingDeleteResumeId.value = id;
  isConfirmOpen.value = true;
};

const handleConfirmDelete = async () => {
  if (pendingDeleteResumeId.value) {
    await resumeStorage.deleteResume(pendingDeleteResumeId.value);
    await loadResumes();
    showToast('success', '简历已成功删除');
  }
  isConfirmOpen.value = false;
  pendingDeleteResumeId.value = null;
};

// 自定义域名白名单
const customDomains = ref<string[]>([]);
const domainSaveSuccess = ref(false);
const STORAGE_KEY_CUSTOM_DOMAINS = 'openjobfill_custom_domains';

const loadCustomDomains = async () => {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get([STORAGE_KEY_CUSTOM_DOMAINS], (result) => {
      customDomains.value = result[STORAGE_KEY_CUSTOM_DOMAINS] || [];
    });
  }
};

const handleAddDomain = async (domain: string) => {
  if (customDomains.value.includes(domain)) {
    showToast('error', '该域名已存在于白名单中');
    return;
  }
  customDomains.value.push(domain);
  await saveCustomDomains(customDomains.value);
  domainSaveSuccess.value = true;
  showToast('success', `已添加域名: ${domain}`);
  setTimeout(() => { domainSaveSuccess.value = false; }, 2000);
};

const handleRemoveDomain = async (index: number) => {
  const removed = customDomains.value.splice(index, 1)[0];
  await saveCustomDomains(customDomains.value);
  showToast('info', `已移除域名: ${removed}`);
};

const loadResumes = async () => {
  resumes.value = await resumeStorage.getAllResumes();
  const active = await resumeStorage.getActiveResume();
  currentResume.value = JSON.parse(JSON.stringify(active));
};

onMounted(() => {
  loadResumes();
  loadCustomDomains();

  const hash = window.location.hash.replace('#', '');
  if (hash && ['basics', 'education', 'experience', 'projects', 'qa', 'tracker', 'customRules', 'settings'].includes(hash)) {
    activeTab.value = hash as any;
  }
});

const selectResume = async (r: StandardResume) => {
  await resumeStorage.setActiveResumeId(r.id);
  currentResume.value = JSON.parse(JSON.stringify(r));
};

const handleSave = async () => {
  await resumeStorage.saveResume(currentResume.value);
  await loadResumes();
  saveSuccess.value = true;
  showToast('success', '简历配置已成功保存！');
  setTimeout(() => {
    saveSuccess.value = false;
  }, 2500);
};

const showImportModal = ref(false);

const handleResumeImported = async (imported: StandardResume) => {
  try {
    showImportModal.value = false;
    currentResume.value = JSON.parse(JSON.stringify(imported));
    await resumeStorage.saveResume(imported);
    await resumeStorage.setActiveResumeId(imported.id);
    await loadResumes();
    saveSuccess.value = true;
    showToast('success', `已成功解析并导入新简历：${imported.title}`);
    setTimeout(() => { saveSuccess.value = false; }, 2500);
  } catch (e: any) {
    console.error('[OpenJobFill] Import resume failed:', e);
    showToast('error', `导入简历失败: ${e?.message || '未知异常'}`);
  }
};

const handleCreateNewResume = async () => {
  const newResume: StandardResume = {
    ...JSON.parse(JSON.stringify(DEFAULT_RESUME)),
    id: 'resume-' + Date.now(),
    title: '新建求职简历 (' + (resumes.value.length + 1) + ')',
    isDefault: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await resumeStorage.saveResume(newResume);
  await resumeStorage.setActiveResumeId(newResume.id);
  await loadResumes();
  currentResume.value = JSON.parse(JSON.stringify(newResume));
  showToast('success', `已创建新简历：${newResume.title}`);
};

const handleExportJson = () => {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentResume.value, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `${currentResume.value.title || 'resume'}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('info', '简历 JSON 配置文件已导出');
};

const handleImportJson = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const content = event.target?.result as string;
      const imported = await resumeStorage.importResumeFromJson(content);
      await loadResumes();
      currentResume.value = imported;
      showToast('success', '简历 JSON 导入成功！');
    } catch (err) {
      showToast('error', '导入失败，请检查 JSON 数据格式是否完整');
    }
  };
  reader.readAsText(file);
};
</script>

<template>
  <div class="min-h-screen min-w-[960px] flex flex-col bg-slate-100 text-slate-800 font-sans">
    <!-- Navbar -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
            <Zap class="w-5 h-5 fill-white" aria-hidden="true" />
          </div>
          <div>
            <h1 class="text-base font-bold text-slate-900 leading-tight">OpenJobFill 简历管理中心</h1>
            <p class="text-xs text-slate-500">自用版智能填表数据配置台 (100% 浏览器本地存储)</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            @click="showImportModal = true"
            class="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Sparkles class="w-3.5 h-3.5 fill-white" aria-hidden="true" />
            <span>智能解析导入 (PDF/Word)</span>
          </button>

          <label class="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition focus-within:ring-2 focus-within:ring-blue-500">
            <Upload class="w-3.5 h-3.5" aria-hidden="true" />
            <span>导入 JSON</span>
            <input type="file" accept=".json" @change="handleImportJson" aria-label="选择 JSON 格式的简历文件" class="hidden" />
          </label>

          <button
            type="button"
            @click="handleExportJson"
            class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Download class="w-3.5 h-3.5" aria-hidden="true" />
            <span>导出 JSON</span>
          </button>

          <button
            type="button"
            @click="handleSave"
            class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Save class="w-4 h-4" aria-hidden="true" />
            <span>{{ saveSuccess ? '已保存！' : '保存简历配置' }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content Grid -->
    <div class="max-w-7xl mx-auto px-6 py-6 flex-1 flex gap-6 w-full">
      <!-- Left Sidebar: Resumes List -->
      <ResumeSidebar
        :resumes="resumes"
        :current-resume-id="currentResume.id"
        @select="selectResume"
        @create="handleCreateNewResume"
        @delete="requestDeleteResume"
      />

      <!-- Right Main Editor -->
      <main class="flex-1 bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col gap-5 shadow-sm min-w-0">
        <!-- Header: Version Title & Global Tab Navigation -->
        <header class="flex flex-col gap-4 border-b border-slate-100 pb-4">
          <!-- Row 1: Resume Version Title Input -->
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 flex-1 max-w-xl">
              <label for="current-resume-title" class="text-xs font-bold text-slate-700 shrink-0">
                当前简历版本:
              </label>
              <input
                id="current-resume-title"
                v-model="currentResume.title"
                type="text"
                placeholder="如: 前端开发-默认主简历"
                class="flex-1 text-sm font-bold text-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs transition"
              />
            </div>
            <div class="flex items-center gap-2">
              <span v-if="currentResume.isDefault" class="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1">
                <Zap class="w-3 h-3 fill-blue-600" />
                <span>默认填表简历</span>
              </span>
            </div>
          </div>

          <!-- Row 2: Full-Width Navigation ARIA Tabs -->
          <div 
            role="tablist" 
            aria-label="简历编辑各个模块"
            class="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-xl text-xs font-semibold overflow-x-auto"
          >
            <button
              id="tab-basics"
              role="tab"
              type="button"
              :aria-selected="activeTab === 'basics'"
              aria-controls="panel-basics"
              @click="activeTab = 'basics'"
              :class="['px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500 whitespace-nowrap', activeTab === 'basics' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900']"
            >
              <User class="w-3.5 h-3.5" aria-hidden="true" />
              <span>基本信息</span>
            </button>
            <button
              id="tab-app-extra"
              role="tab"
              type="button"
              :aria-selected="activeTab === 'appExtra'"
              aria-controls="panel-app-extra"
              @click="activeTab = 'appExtra'"
              :class="['px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500 whitespace-nowrap', activeTab === 'appExtra' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900']"
            >
              <ShieldCheck class="w-3.5 h-3.5" aria-hidden="true" />
              <span>网申常用信息</span>
            </button>
            <button
              id="tab-education"
              role="tab"
              type="button"
              :aria-selected="activeTab === 'education'"
              aria-controls="panel-education"
              @click="activeTab = 'education'"
              :class="['px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500 whitespace-nowrap', activeTab === 'education' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900']"
            >
              <GraduationCap class="w-3.5 h-3.5" aria-hidden="true" />
              <span>教育背景</span>
            </button>
            <button
              id="tab-experience"
              role="tab"
              type="button"
              :aria-selected="activeTab === 'experience'"
              aria-controls="panel-experience"
              @click="activeTab = 'experience'"
              :class="['px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500 whitespace-nowrap', activeTab === 'experience' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900']"
            >
              <Briefcase class="w-3.5 h-3.5" aria-hidden="true" />
              <span>工作实习</span>
            </button>
            <button
              id="tab-projects"
              role="tab"
              type="button"
              :aria-selected="activeTab === 'projects'"
              aria-controls="panel-projects"
              @click="activeTab = 'projects'"
              :class="['px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500 whitespace-nowrap', activeTab === 'projects' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900']"
            >
              <FolderGit2 class="w-3.5 h-3.5" aria-hidden="true" />
              <span>项目经历</span>
            </button>
            <button
              id="tab-qa"
              role="tab"
              type="button"
              :aria-selected="activeTab === 'qa'"
              aria-controls="panel-qa"
              @click="activeTab = 'qa'"
              :class="['px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500 whitespace-nowrap', activeTab === 'qa' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900']"
            >
              <HelpCircle class="w-3.5 h-3.5" aria-hidden="true" />
              <span>问答库</span>
            </button>

            <!-- Separator -->
            <div class="h-4 w-px bg-slate-300 mx-1 shrink-0"></div>

            <button
              id="tab-tracker"
              role="tab"
              type="button"
              :aria-selected="activeTab === 'tracker'"
              aria-controls="panel-tracker"
              @click="activeTab = 'tracker'"
              :class="['px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500 whitespace-nowrap', activeTab === 'tracker' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900']"
            >
              <TrendingUp class="w-3.5 h-3.5" aria-hidden="true" />
              <span>投递看板</span>
            </button>
            <button
              id="tab-custom-rules"
              role="tab"
              type="button"
              :aria-selected="activeTab === 'customRules'"
              aria-controls="panel-custom-rules"
              @click="activeTab = 'customRules'"
              :class="['px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500 whitespace-nowrap', activeTab === 'customRules' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900']"
            >
              <Sliders class="w-3.5 h-3.5" aria-hidden="true" />
              <span>自定义规则</span>
            </button>
            <button
              id="tab-settings"
              role="tab"
              type="button"
              :aria-selected="activeTab === 'settings'"
              aria-controls="panel-settings"
              @click="activeTab = 'settings'"
              :class="['px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500 whitespace-nowrap', activeTab === 'settings' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900']"
            >
              <Settings class="w-3.5 h-3.5" aria-hidden="true" />
              <span>偏好设置</span>
            </button>
          </div>
        </header>

        <!-- Tab Panels -->
        <div 
          id="panel-basics" 
          role="tabpanel" 
          aria-labelledby="tab-basics" 
          v-if="activeTab === 'basics'"
        >
          <BasicsTab :resume="currentResume" />
        </div>

        <div 
          id="panel-app-extra" 
          role="tabpanel" 
          aria-labelledby="tab-app-extra" 
          v-if="activeTab === 'appExtra'"
        >
          <ApplicationExtraTab :resume="currentResume" />
        </div>

        <div 
          id="panel-education" 
          role="tabpanel" 
          aria-labelledby="tab-education" 
          v-if="activeTab === 'education'"
        >
          <EducationTab :educations="currentResume.educations" />
        </div>

        <div 
          id="panel-experience" 
          role="tabpanel" 
          aria-labelledby="tab-experience" 
          v-if="activeTab === 'experience'"
        >
          <ExperienceTab :experiences="currentResume.experiences" />
        </div>

        <div 
          id="panel-projects" 
          role="tabpanel" 
          aria-labelledby="tab-projects" 
          v-if="activeTab === 'projects'"
        >
          <ProjectTab :projects="currentResume.projects" />
        </div>

        <div 
          id="panel-qa" 
          role="tabpanel" 
          aria-labelledby="tab-qa" 
          v-if="activeTab === 'qa'"
        >
          <QABankTab :qa-bank="currentResume.qaBank" />
        </div>

        <div 
          id="panel-tracker" 
          role="tabpanel" 
          aria-labelledby="tab-tracker" 
          v-if="activeTab === 'tracker'"
        >
          <JobTrackerTab @show-toast="(msg) => showToast('success', msg)" />
        </div>

        <div 
          id="panel-custom-rules" 
          role="tabpanel" 
          aria-labelledby="tab-custom-rules" 
          v-if="activeTab === 'customRules'"
        >
          <CustomRulesTab @show-toast="(msg, type) => showToast(type || 'success', msg)" />
        </div>

        <div 
          id="panel-settings" 
          role="tabpanel" 
          aria-labelledby="tab-settings" 
          v-if="activeTab === 'settings'"
        >
          <SettingsTab
            :custom-domains="customDomains"
            :domain-save-success="domainSaveSuccess"
            @add-domain="handleAddDomain"
            @remove-domain="handleRemoveDomain"
          />
        </div>
      </main>
    </div>

    <!-- Resume Intelligent Import Modal -->
    <ResumeImportModal
      v-if="showImportModal"
      @close="showImportModal = false"
      @import="handleResumeImported"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmModal
      :is-open="isConfirmOpen"
      title="删除简历确认"
      message="确定要彻底删除这份求职简历吗？此操作不可撤销。"
      confirm-text="确认删除"
      cancel-text="取消"
      @confirm="handleConfirmDelete"
      @cancel="isConfirmOpen = false"
    />

    <!-- Global Toast Floating Notifications -->
    <Toast :toasts="toasts" @dismiss="dismissToast" />
  </div>
</template>
