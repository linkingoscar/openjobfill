<script setup lang="ts">
import { ref } from 'vue';
import {
  AlertTriangle,
  Bot,
  BookmarkPlus,
  CheckCircle,
  CheckCircle2,
  Copy,
  Highlighter,
  Lightbulb,
  ShieldCheck,
} from 'lucide-vue-next';
import { extractJDFromPage, type JDAnalysisResult } from '@/core/matcher/jdMatcher';
import type { ApplicationTrackerDraft } from '@/core/storage/applicationDraftStorage';
import type { JobVariantSuggestion } from '@/core/ai/contentAssistant';
import { requestAIJobVariantSuggestions } from '@/core/ai/jobVariantAssistant';
import { resumeStorage } from '@/core/storage/resumeStorage';
import { migrateToResumeV5, setResumeValue } from '@/core/schema/trustedResume';
import type { ResumeV5 } from '@/types/trustedResume';

const props = defineProps<{
  jdAnalysis: JDAnalysisResult | null;
  applicationDraft: ApplicationTrackerDraft | null;
  isHighlightingJD: boolean;
}>();

const emit = defineEmits<{
  (event: 'archive' | 'dismiss-draft' | 'analyze' | 'toggle-highlight'): void;
  (event: 'copy-keyword', keyword: string): void;
}>();

const aiLoading = ref(false);
const aiError = ref('');
const suggestions = ref<JobVariantSuggestion[]>([]);
const appliedIds = ref(new Set<string>());

const suggestionTypeLabel: Record<JobVariantSuggestion['type'], string> = {
  'project-order': '项目排序',
  'experience-order': '经历排序',
  'skill-highlight': '技能高亮',
  'short-description': '描述短版',
  'self-evaluation': '自我评价',
  'link-selection': '链接选择',
};

function currentCompany(): string | undefined {
  return props.applicationDraft?.job.companyName || undefined;
}

async function generateVariantSuggestions() {
  if (!props.jdAnalysis || aiLoading.value) return;
  const approved = window.confirm(
    '本次 AI 岗位版本建议会发送当前 JD，以及非敏感的项目、经历、技能和作品链接事实摘要。AI 不能新增事实，所有建议仍需逐项点击采用。是否继续？',
  );
  if (!approved) return;

  aiLoading.value = true;
  aiError.value = '';
  suggestions.value = [];
  try {
    const resume = await resumeStorage.getActiveResume();
    const { jdText } = extractJDFromPage();
    suggestions.value = await requestAIJobVariantSuggestions({
      resume,
      job: {
        company: currentCompany(),
        role: props.jdAnalysis.jobTitle,
        jdText,
      },
      confirmedExternalProcessing: true,
    });
    if (!suggestions.value.length) {
      aiError.value = '模型没有返回通过本地证据校验的岗位版本建议';
    }
  } catch (error) {
    aiError.value = error instanceof Error ? error.message : 'AI 岗位版本建议生成失败';
  } finally {
    aiLoading.value = false;
  }
}

async function ensureJobVariant(): Promise<ResumeV5> {
  const active = migrateToResumeV5(await resumeStorage.getActiveResume());
  if (active.variantType === 'job-variant' && active.parentResumeId) return active;

  const variant = await resumeStorage.createJobVariant(active.id, {
    company: currentCompany(),
    role: props.jdAnalysis?.jobTitle || active.basics.expectedRole,
  });
  await resumeStorage.setActiveResumeId(variant.id);
  return variant;
}

async function applySuggestion(suggestion: JobVariantSuggestion) {
  if (appliedIds.value.has(suggestion.id)) return;
  const approved = window.confirm(
    `采用这条“${suggestionTypeLabel[suggestion.type]}”建议并保存到当前岗位版本？主档案不会被修改。`,
  );
  if (!approved) return;

  aiError.value = '';
  try {
    const variant = await ensureJobVariant();
    variant.variantContext = {
      ...variant.variantContext,
      company: currentCompany() || variant.variantContext?.company,
      role: props.jdAnalysis?.jobTitle || variant.variantContext?.role,
    };
    variant.variantOverrides ||= [];
    variant.variantOrdering ||= {};
    variant.variantPresentation ||= {};

    if (suggestion.type === 'project-order' && suggestion.orderedIds) {
      variant.variantOrdering.projects = [...suggestion.orderedIds];
    } else if (suggestion.type === 'experience-order' && suggestion.orderedIds) {
      variant.variantOrdering.experiences = [...suggestion.orderedIds];
    } else if (
      (suggestion.type === 'short-description' || suggestion.type === 'self-evaluation')
      && suggestion.resumeKey
      && suggestion.proposedValue
    ) {
      setResumeValue(variant, suggestion.resumeKey, suggestion.proposedValue);
      if (!variant.variantOverrides.includes(suggestion.resumeKey)) {
        variant.variantOverrides.push(suggestion.resumeKey);
      }
    } else if (suggestion.type === 'skill-highlight' && suggestion.highlightSkills) {
      variant.variantPresentation.highlightSkills = [...suggestion.highlightSkills];
    } else if (suggestion.type === 'link-selection' && suggestion.selectedLinks) {
      variant.variantPresentation.selectedLinkKeys = [...suggestion.selectedLinks];
    } else {
      throw new Error('该建议没有可安全采用的结构化变更');
    }

    await resumeStorage.saveResume(variant);
    const next = new Set(appliedIds.value);
    next.add(suggestion.id);
    appliedIds.value = next;
  } catch (error) {
    aiError.value = error instanceof Error ? error.message : '岗位版本建议保存失败';
  }
}
</script>

<template>
  <div
    id="drawer-panel-jd"
    role="tabpanel"
    aria-labelledby="drawer-tab-jd"
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
        <p
          class="text-[11px] text-emerald-900 truncate"
          :title="`${applicationDraft.job.companyName} · ${applicationDraft.job.jobTitle}`"
        >
          {{ applicationDraft.job.companyName }} · {{ applicationDraft.job.jobTitle }}
        </p>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="emit('archive')"
            class="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            确认归档为已投递
          </button>
          <button
            type="button"
            @click="emit('dismiss-draft')"
            class="px-2.5 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-800 text-[11px] font-bold hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            稍后
          </button>
        </div>
      </div>

      <div class="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-500">识别到的岗位名称:</span>
          <button type="button" @click="emit('analyze')" class="text-blue-600 font-bold hover:underline">
            重新分析
          </button>
        </div>
        <div class="font-bold text-slate-900 text-sm truncate">
          {{ jdAnalysis?.jobTitle || '正在识别页面岗位...' }}
        </div>

        <div class="pt-1">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="font-semibold text-slate-700">简历与岗位综合匹配度</span>
            <span
              :class="[
                'font-extrabold text-sm',
                (jdAnalysis?.matchScore || 0) >= 80
                  ? 'text-emerald-600'
                  : (jdAnalysis?.matchScore || 0) >= 60
                    ? 'text-amber-600'
                    : 'text-rose-600'
              ]"
            >
              {{ jdAnalysis?.matchScore || 0 }}%
            </span>
          </div>
          <div class="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
            <div
              class="h-full transition-all duration-500 rounded-full"
              :class="
                (jdAnalysis?.matchScore || 0) >= 80
                  ? 'bg-emerald-500'
                  : (jdAnalysis?.matchScore || 0) >= 60
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              "
              :style="{ width: `${jdAnalysis?.matchScore || 0}%` }"
            ></div>
          </div>
        </div>
      </div>

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
            @click="emit('copy-keyword', kw)"
            class="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
            :title="`点击复制【${kw}】`"
          >
            <span>{{ kw }}</span>
            <Copy class="w-2.5 h-2.5 opacity-60" />
          </button>
          <span v-if="!jdAnalysis?.missingKeywords?.length" class="text-emerald-600 text-xs font-medium">
            当前简历已覆盖页面检测到的关键技术词
          </span>
        </div>
      </div>

      <div class="p-3 bg-blue-50/60 border border-blue-100 rounded-xl space-y-1.5">
        <div class="text-xs font-bold text-blue-900 flex items-center gap-1">
          <Lightbulb class="w-3.5 h-3.5 text-blue-600" />
          <span>确定性诊断建议</span>
        </div>
        <ul class="text-xs text-blue-800 space-y-1 list-disc list-inside">
          <li v-for="(tip, idx) in jdAnalysis?.diagnosticTips" :key="idx">{{ tip }}</li>
        </ul>
      </div>

      <section v-if="jdAnalysis" class="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="text-[11px] font-bold text-violet-900 flex items-center gap-1">
              <Bot class="w-3.5 h-3.5" />AI 岗位版本建议
            </div>
            <p class="text-[10px] text-violet-700 mt-0.5">
              只排序、裁剪、强调已有事实；返回后再经本地证据、记录 ID、技能和链接白名单校验。
            </p>
          </div>
          <button
            type="button"
            @click="generateVariantSuggestions"
            :disabled="aiLoading"
            class="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-[10px] font-bold focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {{ aiLoading ? '生成中…' : '生成建议' }}
          </button>
        </div>

        <p v-if="aiError" class="text-[10px] text-rose-700">{{ aiError }}</p>

        <div v-if="suggestions.length" class="space-y-1.5">
          <div
            v-for="suggestion in suggestions"
            :key="suggestion.id"
            class="rounded-lg border border-violet-100 bg-white p-2 text-[10px]"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="font-bold text-slate-800">{{ suggestionTypeLabel[suggestion.type] }}</div>
                <div class="mt-0.5 text-slate-600">{{ suggestion.suggestion }}</div>
              </div>
              <button
                type="button"
                @click="applySuggestion(suggestion)"
                :disabled="appliedIds.has(suggestion.id)"
                class="px-2 py-1 rounded border font-bold flex-shrink-0 disabled:opacity-70"
                :class="
                  appliedIds.has(suggestion.id)
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-white border-violet-200 text-violet-700 hover:bg-violet-50'
                "
              >
                <span v-if="appliedIds.has(suggestion.id)" class="inline-flex items-center gap-0.5">
                  <CheckCircle2 class="w-3 h-3" />已采用
                </span>
                <span v-else>逐项采用</span>
              </button>
            </div>
            <div v-if="suggestion.jdEvidence" class="mt-1 text-violet-700">
              <span class="font-semibold">JD 依据：</span>{{ suggestion.jdEvidence }}
            </div>
            <div class="mt-1 text-slate-400 break-all">
              <span class="font-semibold">档案证据：</span>{{ suggestion.evidenceResumeKeys.join('、') }}
            </div>
            <div
              v-if="suggestion.proposedValue"
              class="mt-1 p-1.5 rounded bg-slate-50 text-slate-700 whitespace-pre-wrap max-h-24 overflow-y-auto"
            >
              {{ suggestion.proposedValue }}
            </div>
            <div v-if="suggestion.highlightSkills?.length" class="mt-1 text-emerald-700">
              高亮：{{ suggestion.highlightSkills.join('、') }}
            </div>
            <div v-if="suggestion.selectedLinks?.length" class="mt-1 text-blue-700">
              使用链接：{{ suggestion.selectedLinks.join('、') }}
            </div>
          </div>
          <div class="flex items-start gap-1 text-[10px] text-violet-700">
            <ShieldCheck class="w-3 h-3 flex-shrink-0 mt-0.5" />
            采用时自动创建/更新岗位版本；主档案事实不被 AI 直接修改。
          </div>
        </div>
      </section>
    </div>

    <footer class="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
      <button
        type="button"
        @click="emit('toggle-highlight')"
        :class="[
          'px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition focus-visible:ring-2 focus-visible:ring-amber-500 border',
          isHighlightingJD
            ? 'bg-amber-100 text-amber-900 border-amber-300'
            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
        ]"
        title="在当前招聘网页原文上用荧光笔标记技能词"
      >
        <Highlighter
          class="w-3.5 h-3.5"
          :class="isHighlightingJD ? 'text-amber-600 fill-amber-500' : 'text-slate-500'"
        />
        <span>{{ isHighlightingJD ? '清除荧光' : '网页荧光笔' }}</span>
      </button>
      <button
        type="button"
        @click="emit('archive')"
        class="flex-1 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1 shadow-md shadow-blue-500/20 active:scale-95 transition focus-visible:ring-2 focus-visible:ring-blue-500 text-xs"
      >
        <BookmarkPlus class="w-3.5 h-3.5" />
        <span>归档本岗位</span>
      </button>
    </footer>
  </div>
</template>
