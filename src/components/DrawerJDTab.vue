<script setup lang="ts">
import { computed, ref } from 'vue';
import { Sparkles, MapPin, Banknote, GraduationCap, Briefcase, CalendarClock, ExternalLink, Archive, RefreshCw, CheckCircle2, Bot, ShieldCheck } from 'lucide-vue-next';
import type { JDMatchResult } from '@/core/matcher/jdMatcher';
import type { ApplicationDraft } from '@/core/storage/applicationDraftStorage';
import type { JobVariantSuggestion } from '@/core/ai/contentAssistant';
import { requestAIJobVariantSuggestions } from '@/core/ai/jobVariantAssistant';
import { resumeStorage } from '@/core/storage/resumeStorage';
import { migrateToResumeV5, setResumeValue } from '@/core/schema/trustedResume';
import type { ResumeV5 } from '@/types/trustedResume';

const props = defineProps<{
  jdResult: JDMatchResult | null;
  jdLoading: boolean;
  jdError: string;
  applicationDraft: ApplicationDraft | null;
  applicationArchiveFeedback: string;
  isApplicationArchived: boolean;
}>();

const emit = defineEmits<{
  (event: 'refresh'): void;
  (event: 'archive'): void;
}>();

const topMatched = computed(() => props.jdResult?.matchedSkills.slice(0, 16) || []);
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
  if (!props.jdResult) return;
  const approved = window.confirm('本次 AI 岗位版本建议会发送当前 JD，以及非敏感的项目、经历、技能和作品链接事实摘要。AI 不能新增事实，所有建议仍需逐项点击采用。是否继续？');
  if (!approved) return;
  aiLoading.value = true;
  aiError.value = '';
  suggestions.value = [];
  try {
    const resume = await resumeStorage.getActiveResume();
    suggestions.value = await requestAIJobVariantSuggestions({
      resume,
      job: {
        company: currentCompany(),
        role: props.jdResult.jobTitle,
        jdText: props.jdResult.rawText,
      },
      confirmedExternalProcessing: true,
    });
    if (!suggestions.value.length) aiError.value = '模型没有返回通过本地证据校验的岗位版本建议';
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
    role: props.jdResult?.jobTitle || active.basics.expectedRole,
  });
  await resumeStorage.setActiveResumeId(variant.id);
  return variant;
}

function reordered<T extends { id: string }>(items: T[], orderedIds: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return orderedIds.map((id) => byId.get(id)).filter((item): item is T => !!item);
}

async function applySuggestion(suggestion: JobVariantSuggestion) {
  if (appliedIds.value.has(suggestion.id)) return;
  const approved = window.confirm(`采用这条“${suggestionTypeLabel[suggestion.type]}”建议并保存到当前岗位版本？主档案不会被修改。`);
  if (!approved) return;
  aiError.value = '';
  try {
    const variant = await ensureJobVariant();
    variant.variantContext = {
      ...variant.variantContext,
      company: currentCompany() || variant.variantContext?.company,
      role: props.jdResult?.jobTitle || variant.variantContext?.role,
    };
    variant.variantOverrides ||= [];
    variant.variantOrdering ||= {};
    variant.variantPresentation ||= {};

    if (suggestion.type === 'project-order' && suggestion.orderedIds) {
      variant.projects = reordered(variant.projects, suggestion.orderedIds);
      variant.variantOrdering.projects = [...suggestion.orderedIds];
    } else if (suggestion.type === 'experience-order' && suggestion.orderedIds) {
      variant.experiences = reordered(variant.experiences, suggestion.orderedIds);
      variant.variantOrdering.experiences = [...suggestion.orderedIds];
    } else if ((suggestion.type === 'short-description' || suggestion.type === 'self-evaluation') && suggestion.resumeKey && suggestion.proposedValue) {
      setResumeValue(variant, suggestion.resumeKey, suggestion.proposedValue);
      if (!variant.variantOverrides.includes(suggestion.resumeKey)) variant.variantOverrides.push(suggestion.resumeKey);
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
  <div id="drawer-panel-jd" role="tabpanel" aria-labelledby="drawer-tab-jd" class="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h3 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Sparkles class="w-4 h-4 text-violet-600" aria-hidden="true" />
          当前职位 JD
        </h3>
        <p class="text-[10px] text-slate-400 mt-0.5">自动读取当前职位页公开文字，只在本地浏览器中分析</p>
      </div>
      <button type="button" @click="emit('refresh')" :disabled="jdLoading" class="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="重新分析当前职位 JD" title="重新分析">
        <RefreshCw :class="['w-3.5 h-3.5', jdLoading ? 'animate-spin' : '']" aria-hidden="true" />
      </button>
    </div>

    <div v-if="jdLoading" role="status" class="py-8 text-center text-xs text-slate-500">
      <div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
      正在读取职位页面并提取关键信息…
    </div>

    <div v-else-if="jdError" role="alert" class="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800">
      {{ jdError }}
    </div>

    <template v-else-if="jdResult">
      <section class="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-bold text-slate-900 truncate" :title="jdResult.jobTitle">{{ jdResult.jobTitle }}</div>
            <div class="mt-1 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
              <span v-if="jdResult.location" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100"><MapPin class="w-3 h-3" />{{ jdResult.location }}</span>
              <span v-if="jdResult.salaryRange" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700"><Banknote class="w-3 h-3" />{{ jdResult.salaryRange }}</span>
              <span v-if="jdResult.educationRequirement" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-100 text-blue-700"><GraduationCap class="w-3 h-3" />{{ jdResult.educationRequirement }}</span>
              <span v-if="jdResult.experienceRequirement" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-50 border border-violet-100 text-violet-700"><Briefcase class="w-3 h-3" />{{ jdResult.experienceRequirement }}</span>
              <span v-if="jdResult.jobType" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-700"><CalendarClock class="w-3 h-3" />{{ jdResult.jobType }}</span>
            </div>
          </div>
          <a :href="jdResult.sourceUrl" target="_blank" rel="noopener noreferrer" class="text-slate-400 hover:text-blue-600" aria-label="打开当前职位页面"><ExternalLink class="w-3.5 h-3.5" /></a>
        </div>
        <div class="text-[10px] text-slate-400">分析置信度 {{ Math.round(jdResult.confidence * 100) }}% · {{ jdResult.sourceType }}</div>
      </section>

      <section v-if="topMatched.length" class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div class="text-[11px] font-bold text-slate-700 mb-2">技能与要求关键词</div>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="skill in topMatched" :key="skill.name" class="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[10px] text-slate-700">{{ skill.name }} <span class="text-violet-600 font-bold">{{ Math.round(skill.score * 100) }}%</span></span>
        </div>
      </section>

      <section v-if="jdResult.responsibilities.length" class="rounded-xl border border-slate-200 bg-white p-3">
        <div class="text-[11px] font-bold text-slate-700 mb-1.5">职位职责</div>
        <ul class="space-y-1 text-[11px] text-slate-600 list-disc pl-4"><li v-for="(item, index) in jdResult.responsibilities.slice(0, 8)" :key="index">{{ item }}</li></ul>
      </section>

      <section v-if="jdResult.requirements.length" class="rounded-xl border border-slate-200 bg-white p-3">
        <div class="text-[11px] font-bold text-slate-700 mb-1.5">任职要求</div>
        <ul class="space-y-1 text-[11px] text-slate-600 list-disc pl-4"><li v-for="(item, index) in jdResult.requirements.slice(0, 8)" :key="index">{{ item }}</li></ul>
      </section>

      <section class="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="text-[11px] font-bold text-violet-900 flex items-center gap-1"><Bot class="w-3.5 h-3.5" />AI 岗位版本建议</div>
            <p class="text-[10px] text-violet-700 mt-0.5">仅排序、裁剪、强调已有事实；模型返回后再经本地证据/ID 白名单校验。</p>
          </div>
          <button type="button" @click="generateVariantSuggestions" :disabled="aiLoading" class="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-[10px] font-bold focus-visible:ring-2 focus-visible:ring-violet-500">
            {{ aiLoading ? '生成中…' : '生成建议' }}
          </button>
        </div>
        <p v-if="aiError" class="text-[10px] text-rose-700">{{ aiError }}</p>
        <div v-if="suggestions.length" class="space-y-1.5">
          <div v-for="suggestion in suggestions" :key="suggestion.id" class="rounded-lg border border-violet-100 bg-white p-2 text-[10px]">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="font-bold text-slate-800">{{ suggestionTypeLabel[suggestion.type] }}</div>
                <div class="mt-0.5 text-slate-600">{{ suggestion.suggestion }}</div>
              </div>
              <button type="button" @click="applySuggestion(suggestion)" :disabled="appliedIds.has(suggestion.id)" class="px-2 py-1 rounded border font-bold flex-shrink-0 disabled:opacity-70" :class="appliedIds.has(suggestion.id) ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-violet-200 text-violet-700 hover:bg-violet-50'">
                <span v-if="appliedIds.has(suggestion.id)" class="inline-flex items-center gap-0.5"><CheckCircle2 class="w-3 h-3" />已采用</span><span v-else>逐项采用</span>
              </button>
            </div>
            <div v-if="suggestion.jdEvidence" class="mt-1 text-violet-700"><span class="font-semibold">JD 依据：</span>{{ suggestion.jdEvidence }}</div>
            <div class="mt-1 text-slate-400 break-all"><span class="font-semibold">档案证据：</span>{{ suggestion.evidenceResumeKeys.join('、') }}</div>
            <div v-if="suggestion.proposedValue" class="mt-1 p-1.5 rounded bg-slate-50 text-slate-700 whitespace-pre-wrap max-h-24 overflow-y-auto">{{ suggestion.proposedValue }}</div>
            <div v-if="suggestion.highlightSkills?.length" class="mt-1 text-emerald-700">高亮：{{ suggestion.highlightSkills.join('、') }}</div>
            <div v-if="suggestion.selectedLinks?.length" class="mt-1 text-blue-700">使用链接：{{ suggestion.selectedLinks.join('、') }}</div>
          </div>
          <div class="flex items-start gap-1 text-[10px] text-violet-700"><ShieldCheck class="w-3 h-3 flex-shrink-0 mt-0.5" />采用建议时自动创建/更新岗位版本；主档案事实不被 AI 直接修改。</div>
        </div>
      </section>

      <section v-if="applicationDraft" class="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-[11px] font-bold text-blue-900 flex items-center gap-1.5"><Archive class="w-3.5 h-3.5" />投递归档</div>
            <p class="text-[10px] text-blue-700 mt-0.5 truncate" :title="applicationDraft.job.companyName">{{ applicationDraft.job.companyName }} · {{ applicationDraft.job.jobTitle }}</p>
          </div>
          <button type="button" @click="emit('archive')" :disabled="isApplicationArchived" class="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-emerald-600 disabled:cursor-default text-white text-[10px] font-bold focus-visible:ring-2 focus-visible:ring-blue-500">
            {{ isApplicationArchived ? '已归档' : '归档本次投递' }}
          </button>
        </div>
        <p v-if="applicationDraft.reasons.length" class="text-[10px] text-blue-700">{{ applicationDraft.reasons.join('；') }}</p>
        <p v-if="applicationArchiveFeedback" role="status" aria-live="polite" class="text-[10px] text-emerald-700 font-semibold">{{ applicationArchiveFeedback }}</p>
      </section>

      <details class="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
        <summary class="cursor-pointer px-3 py-2 text-[10px] font-semibold text-slate-500 hover:text-slate-700">查看本地提取的 JD 原文片段</summary>
        <div class="border-t border-slate-200 p-3 text-[10px] text-slate-600 whitespace-pre-wrap max-h-56 overflow-y-auto">{{ jdResult.rawText.slice(0, 6000) }}</div>
      </details>
    </template>
  </div>
</template>
