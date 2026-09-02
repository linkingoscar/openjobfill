<script setup lang="ts">
import { reactive } from 'vue';
import { AlertTriangle, CheckCircle, Sparkles, Bot } from 'lucide-vue-next';
import type { FillResult } from '@/types/adapter';
import { requestAIAnswerDraft } from '@/core/ai/answerDraftService';
import { extractJDFromPage } from '@/core/matcher/jdMatcher';
import { resumeStorage } from '@/core/storage/resumeStorage';
import { setNativeValue } from '@/core/engine/dispatcher';

interface BindingOption { label: string; value: string }
interface BindingGroup { group: string; options: BindingOption[] }
type RemainingTask = NonNullable<FillResult['remainingTasks']>[number];

const props = defineProps<{
  fillResult: FillResult | null;
  activeTaskMappingId: string | null;
  selectedMappingKey: string;
  availableBindingFields: BindingGroup[];
}>();

const emit = defineEmits<{
  (event: 'focus-task', task: RemainingTask): void;
  (event: 'toggle-mapping', task: RemainingTask): void;
  (event: 'save-mapping', task: RemainingTask): void;
  (event: 'update:selectedMappingKey', value: string): void;
}>();

interface DraftState { loading: boolean; text: string; warnings: string[]; error: string }
const drafts = reactive<Record<string, DraftState>>({});

const handleSelectionChange = (event: Event) => {
  emit('update:selectedMappingKey', (event.target as HTMLSelectElement).value);
};

function canDraft(task: RemainingTask): boolean {
  return !!task.element
    && ['text', 'textarea', 'contenteditable'].includes(task.type)
    && task.failureCode !== 'safety_blocked';
}

function maxCharsFor(task: RemainingTask): number | undefined {
  const element = task.element as HTMLInputElement | HTMLTextAreaElement | undefined;
  return element && typeof element.maxLength === 'number' && element.maxLength > 0 ? element.maxLength : undefined;
}

async function generateDraft(task: RemainingTask) {
  if (!canDraft(task)) return;
  const approved = window.confirm('本次 AI 草稿会发送当前开放题、当前岗位 JD，以及非敏感的项目/经历/技能事实摘要。是否继续？');
  if (!approved) return;
  const state = drafts[task.id] ||= { loading: false, text: '', warnings: [], error: '' };
  state.loading = true;
  state.error = '';
  state.warnings = [];
  try {
    const resume = await resumeStorage.getActiveResume();
    const jd = extractJDFromPage();
    const variant = resume as typeof resume & { variantContext?: { company?: string; role?: string; jobFamily?: string } };
    const response = await requestAIAnswerDraft({
      resume,
      question: task.label,
      maxChars: maxCharsFor(task),
      job: {
        company: variant.variantContext?.company,
        role: variant.variantContext?.role || jd.jobTitle,
        jobFamily: variant.variantContext?.jobFamily,
        jdText: jd.jdText,
      },
      confirmedExternalProcessing: true,
    });
    state.text = response.draft.text;
    state.warnings = response.warnings;
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'AI 草稿生成失败';
  } finally {
    state.loading = false;
  }
}

function writeConfirmedDraft(task: RemainingTask, text: string): boolean {
  const element = task.element;
  if (!element || !text.trim()) return false;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return setNativeValue(element, text);
  if (element.isContentEditable) {
    element.focus();
    element.textContent = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();
    return true;
  }
  return false;
}

async function applyDraft(task: RemainingTask, remember: boolean) {
  const state = drafts[task.id];
  if (!state?.text) return;
  const edited = window.prompt('确认或编辑 AI 草稿。只有点击确定后才会写入当前字段：', state.text);
  if (edited === null || !edited.trim()) return;
  if (!writeConfirmedDraft(task, edited)) {
    state.error = '当前控件无法可靠写入，请复制草稿后手动填写';
    return;
  }
  state.text = edited;
  if (!remember) return;

  const resume = await resumeStorage.getActiveResume();
  const now = Date.now();
  await resumeStorage.appendResumeArrayItem(resume.id, 'qaBank', {
    id: `qa-${now}`,
    keyword: task.label,
    question: task.label,
    answer: edited,
    scope: 'company-domain',
    companyDomain: window.location.hostname,
    versions: [{
      id: `qa-answer-${now}`,
      answer: edited,
      createdAt: now,
      lastUsedAt: now,
      lastUsedUrl: `${window.location.origin}${window.location.pathname}`,
      confirmedByUser: true,
      source: 'ai-confirmed',
    }],
  });
}
</script>

<template>
  <div id="drawer-panel-review" role="tabpanel" aria-labelledby="drawer-tab-review" class="flex-1 flex flex-col min-h-0 overflow-hidden">
    <div class="p-3 bg-amber-50/70 border-b border-amber-100 flex items-center justify-between">
      <div class="flex items-center gap-1.5 text-amber-900 font-bold">
        <AlertTriangle class="w-4 h-4 text-amber-600 flex-shrink-0" aria-hidden="true" />
        <span>需人工确认 / 待办清单 ({{ fillResult?.remainingTasks?.length || 0 }})</span>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-3 space-y-2.5">
      <div v-if="!fillResult || !fillResult.remainingTasks || fillResult.remainingTasks.length === 0" class="text-center py-10 text-slate-400">
        <CheckCircle class="w-10 h-10 mx-auto text-emerald-500/40 mb-2" aria-hidden="true" />
        <p class="font-bold text-slate-600">当前没有需要人工确认的待办项</p>
        <p class="text-[11px] mt-1 text-slate-400">点击“一键填表”后，未匹配的必填项将在此展示并支持一键定位</p>
      </div>

      <div v-for="task in fillResult?.remainingTasks || []" :key="task.id" class="p-2.5 rounded-xl border border-amber-200/80 bg-amber-50/30 hover:bg-amber-50 transition flex flex-col gap-2">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span v-if="task.required" class="px-1 py-0.2 bg-red-100 text-red-700 rounded text-[10px] font-bold">必填</span>
              <span class="font-bold text-slate-800 text-xs truncate">{{ task.label }}</span>
            </div>
            <p class="text-[11px] text-amber-800/80 mt-1 font-medium">{{ task.reason }}</p>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span v-if="!task.element" class="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold" :title="task.frameUrl || '位于跨域子页面'">子页面待办</span>
            <button v-if="canDraft(task)" type="button" @click="generateDraft(task)" :disabled="drafts[task.id]?.loading" class="px-2 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold transition shadow-xs" title="逐次确认后调用已配置模型生成开放题草稿"><Sparkles class="w-3 h-3 inline" /> {{ drafts[task.id]?.loading ? '生成中' : 'AI 草稿' }}</button>
            <button v-if="task.element" type="button" @click="emit('focus-task', task)" class="px-2 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-[11px] font-bold transition shadow-xs" title="在网页中滚动并高亮定位此输入框">定位</button>
            <button v-if="task.element" type="button" @click="emit('toggle-mapping', task)" class="px-2 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-[11px] font-bold transition shadow-xs" title="将此未识别字段永久绑定到简历属性">记住映射</button>
          </div>
        </div>

        <div v-if="drafts[task.id]?.text || drafts[task.id]?.error" class="rounded-lg border border-violet-200 bg-violet-50 p-2 text-[11px]">
          <div class="font-bold text-violet-800 flex items-center gap-1"><Bot class="w-3.5 h-3.5" />AI 仅生成候选，不会自动写入</div>
          <p v-if="drafts[task.id]?.text" class="mt-1 text-slate-700 whitespace-pre-wrap max-h-28 overflow-y-auto">{{ drafts[task.id].text }}</p>
          <p v-if="drafts[task.id]?.warnings?.length" class="mt-1 text-amber-700">风险提示：{{ drafts[task.id].warnings.join('；') }}</p>
          <p v-if="drafts[task.id]?.error" class="mt-1 text-rose-700">{{ drafts[task.id].error }}</p>
          <div v-if="drafts[task.id]?.text" class="mt-2 flex gap-1.5">
            <button type="button" @click="applyDraft(task, false)" class="px-2 py-1 rounded bg-violet-600 text-white font-bold">编辑并采用</button>
            <button type="button" @click="applyDraft(task, true)" class="px-2 py-1 rounded bg-white border border-violet-200 text-violet-700 font-bold">采用并记入公司问答库</button>
          </div>
        </div>

        <div v-if="activeTaskMappingId === task.id" class="pt-2 mt-1 border-t border-amber-200/60 flex items-center gap-2 text-xs">
          <select
            :value="selectedMappingKey"
            @change="handleSelectionChange"
            class="flex-1 px-2 py-1 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
          >
            <option value="" disabled>请选择此字段对应的简历属性...</option>
            <optgroup v-for="group in availableBindingFields" :key="group.group" :label="group.group">
              <option v-for="option in group.options" :key="option.value" :value="option.value">{{ option.label }}</option>
            </optgroup>
          </select>
          <button type="button" :disabled="!selectedMappingKey" @click="emit('save-mapping', task)" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs transition">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>
