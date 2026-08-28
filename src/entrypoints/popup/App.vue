<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { resumeStorage } from '@/core/storage/resumeStorage';
import type { StandardResume } from '@/types/resume';
import { 
  FileText, 
  Settings, 
  Zap, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Sliders,
  ExternalLink
} from 'lucide-vue-next';

const resumes = ref<StandardResume[]>([]);
const activeResume = ref<StandardResume | null>(null);
const isFilling = ref(false);
const statusMessage = ref('');

onMounted(async () => {
  resumes.value = await resumeStorage.getAllResumes();
  activeResume.value = await resumeStorage.getActiveResume();
});

const handleSelectResume = async (e: Event) => {
  const select = e.target as HTMLSelectElement;
  const id = select.value;
  await resumeStorage.setActiveResumeId(id);
  activeResume.value = resumes.value.find((r) => r.id === id) || null;
};

const handleTriggerFill = async () => {
  isFilling.value = true;
  statusMessage.value = '正在向当前网页发送填表指令...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      await chrome.tabs.sendMessage(tab.id, { 
        type: 'TRIGGER_AUTO_FILL',
        payload: { resumeId: activeResume.value?.id }
      });
      statusMessage.value = '填表指令已发送！请查看页面右侧悬浮面板。';
    }
  } catch (err) {
    statusMessage.value = '请刷新招聘网页后再试（或当前页面不支持注入插件）';
  } finally {
    setTimeout(() => {
      isFilling.value = false;
    }, 2000);
  }
};

const openOptionsPage = (tabName?: string) => {
  const url = tabName ? `/options.html#${tabName}` : '/options.html';
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url });
  } else if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(url, '_blank');
  }
};
</script>

<template>
  <main class="p-4 w-[380px] flex flex-col gap-3.5 font-sans select-none bg-slate-50 text-slate-800" aria-label="OpenJobFill 弹出面板">
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-slate-200/80 pb-3 bg-white -mx-4 -mt-4 px-4 pt-3.5 shadow-xs">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/25">
          <Zap class="w-4.5 h-4.5 fill-white" aria-hidden="true" />
        </div>
        <div>
          <div class="flex items-center gap-1.5">
            <h1 class="text-sm font-bold text-slate-900 leading-tight">OpenJobFill</h1>
            <span class="px-1.5 py-0.2 bg-blue-100 text-blue-700 font-mono text-3xs font-bold rounded">v4.0</span>
          </div>
          <p class="text-2xs text-slate-500">智能简历秒填 & 投递追踪管家</p>
        </div>
      </div>
      <button
        type="button"
        @click="() => openOptionsPage()"
        class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition focus-visible:ring-2 focus-visible:ring-blue-500"
        title="打开全屏简历管理工作台"
        aria-label="打开全屏简历管理工作台"
      >
        <span>工作台</span>
        <ExternalLink class="w-3 h-3 text-slate-500" />
      </button>
    </header>

    <!-- Quick Navigation Hub -->
    <div class="grid grid-cols-2 gap-2">
      <button
        type="button"
        @click="() => openOptionsPage('tracker')"
        class="p-2.5 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 rounded-xl flex items-center gap-2 text-left transition shadow-xs group"
      >
        <div class="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition">
          <TrendingUp class="w-4 h-4" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-bold text-slate-800">求职投递看板</div>
          <div class="text-3xs text-slate-400">8阶段进度管理</div>
        </div>
      </button>

      <button
        type="button"
        @click="() => openOptionsPage('customRules')"
        class="p-2.5 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 rounded-xl flex items-center gap-2 text-left transition shadow-xs group"
      >
        <div class="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition">
          <Sliders class="w-4 h-4" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-bold text-slate-800">自定义规则</div>
          <div class="text-3xs text-slate-400">吸管取词/映射</div>
        </div>
      </button>
    </div>

    <!-- Active Resume Selector -->
    <section class="flex flex-col gap-2 bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs" aria-label="当前填表简历配置">
      <div class="flex items-center justify-between text-xs text-slate-600">
        <label for="active-resume-select" class="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
          <FileText class="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
          <span>当前激活简历</span>
        </label>
        <button 
          type="button"
          @click="() => openOptionsPage()" 
          class="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-0.5 text-xs focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          <span>编辑详情</span>
          <ChevronRight class="w-3 h-3" aria-hidden="true" />
        </button>
      </div>

      <select
        id="active-resume-select"
        :value="activeResume?.id"
        @change="handleSelectResume"
        aria-label="选择当前用于填表的简历版本"
        class="block w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option v-for="r in resumes" :key="r.id" :value="r.id">
          {{ r.title }} ({{ r.basics.name }})
        </option>
      </select>

      <div v-if="activeResume" class="pt-1.5 text-xs text-slate-500 space-y-1 border-t border-slate-100">
        <div class="flex justify-between items-center">
          <span class="text-slate-600">候选人: <strong class="font-bold text-slate-800">{{ activeResume.basics.name }}</strong> ({{ activeResume.basics.gender }})</span>
          <span class="font-mono text-2xs">{{ activeResume.basics.phone }}</span>
        </div>
        <div class="flex justify-between truncate text-2xs text-slate-500">
          <span>{{ activeResume.educations[0]?.schoolName || '高校未填' }}</span>
          <span>{{ activeResume.educations[0]?.major || '' }} · {{ activeResume.educations[0]?.degree || '' }}</span>
        </div>
      </div>
    </section>

    <!-- Quick Fill Action Button -->
    <div class="space-y-1.5">
      <button
        type="button"
        @click="handleTriggerFill"
        :disabled="isFilling"
        class="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-75 focus-visible:ring-2 focus-visible:ring-blue-500"
        :aria-label="isFilling ? '正在执行填表操作' : '一键自动填写当前页面表单'"
      >
        <Zap class="w-4 h-4 fill-white" aria-hidden="true" />
        <span>{{ isFilling ? '正在填表中...' : '一键填入当前页面' }}</span>
        <kbd class="px-1.5 py-0.5 bg-white/20 rounded text-3xs font-mono">Alt+Shift+F</kbd>
      </button>

      <!-- Dynamic Status Message with Live Region -->
      <div
        v-if="statusMessage"
        role="status"
        aria-live="polite"
        class="text-xs text-center text-slate-700 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg animate-fade-in"
      >
        {{ statusMessage }}
      </div>
    </div>

    <!-- Footer Privacy Note -->
    <footer class="flex items-center justify-between text-3xs text-slate-400 pt-0.5 px-1">
      <span class="flex items-center gap-1 text-emerald-600 font-medium">
        <ShieldCheck class="w-3.5 h-3.5" aria-hidden="true" />
        <span>100% 浏览器本地存储</span>
      </span>
      <span>按 Esc 可收起悬浮面板</span>
    </footer>
  </main>
</template>
