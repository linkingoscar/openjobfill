<script setup lang="ts">
import { ref } from 'vue';
import { Sparkles, AlertCircle, Target, CheckCircle2, XCircle, Archive, RefreshCw, ExternalLink, Bot, ShieldCheck } from 'lucide-vue-next';
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
  applicationArchiveFeedback: string;
  isApplicationArchived: boolean;
  isAnalyzing: boolean;
  error: string;
}>();

const emit = defineEmits<{
  (event: 'reanalyze'): void;
  (event: 'archive-application'): void;
  (event: 'open-tracker'): void;
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
  if (!props.jdAnalysis) return;
  const approved = window.confirm('本次 AI 岗位版本建议会发送当前 JD，以及非敏感的项目、经历、技能和作品链接事实摘要。AI 不能新增事实，所有建议仍需逐项点击采用。是否继续？');
  if (!approved) return;
  aiLoading.value = true;
  aiError.value = '';
  suggestions.value = [];
  try {
    const resume = await resumeStorage.getActiveResume();
    const extracted = extractJDFromPage();
    suggestions.value = await requestAIJobVariantSuggestions({
      resume,
      job: {
        company: currentCompany(),
        role: props.jdAnalysis.jobTitle,
        jdText: extracted.jdText,
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
    role: props.jdAnalysis?.jobTitle || active.basics.expectedRole,
  });
  await resumeStorage.setActiveResumeId(variant.id);
  return variant;
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
      role: props.jdAnalysis?.jobTitle || variant.variantContext?.role,
    };
    variant.variantOverrides ||= [];
    variant.variantOrdering ||= {};
    variant.variantPresentation ||= {};

    if (suggestion.type === 'project-order' && suggestion.orderedIds) {
      variant.variantOrdering.projects = [...suggestion.orderedIds];
    } else if (suggestion.type === 'experience-order' && suggestion.orderedIds) {
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
  <div id="drawer-panel-jd" role="tabpanel" aria-labelledby="drawer-tab-jd" class="flex-1 flex flex-col min-h-0 overflow-hidden">
    <div class="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
      <span class="flex items-center gap-1.5"><Sparkles class="w-3.5 h-3.5 text-violet-500" />职位匹配分析</span>
      <button type="button" @click="emit('reanalyze')" :disabled="isAnalyzing" class="p-1 rounded-md hover:bg-slate-200 disabled:opacity-40" aria-label="重新分析当前职位"><RefreshCw :class="['w-3.5 h-3.5', isAnalyzing ? 'animate-spin' : '']" /></button>
    </div>

    <div class="p-4 flex-1 overflow-y-auto space-y-3">
      <div v-if="isAnalyzing" role="status" class="text-center py-8 text-slate-500 text-xs">
        <div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        正在读取当前页面职位描述并本地匹配…
      </div>

      <div v-else-if="error" role="alert" class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2"><AlertCircle class="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{{ error }}</span></div>

      <template v-else-if="jdAnalysis">
        <section class="p-3 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0"><p class="text-[10px] text-slate-400">当前职位</p><h3 class="text-sm font-bold text-slate-900 truncate" :title="jdAnalysis.jobTitle">{{ jdAnalysis.jobTitle }}</h3></div>
            <div class="text-right flex-shrink-0"><p class="text-[10px] text-slate-400">匹配度</p><p class="text-lg font-bold" :class="jdAnalysis.matchScore >= 70 ? 'text-emerald-600' : jdAnalysis.matchScore >= 45 ? 'text-amber-600' : 'text-rose-600'">{{ jdAnalysis.matchScore }}%</p></div>
          </div>
          <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full rounded-full transition-all" :class="jdAnalysis.matchScore >= 70 ? 'bg-emerald-500' : jdAnalysis.matchScore >= 45 ? 'bg-amber-500' : 'bg-rose-500'" :style="{ width: `${jdAnalysis.matchScore}%` }"></div></div>
        </section>

        <section v-if="jdAnalysis.jdKeywords.length" class="space-y-1.5">
          <h4 class="text-[11px] font-bold text-slate-700 flex items-center gap-1"><Target class="w-3.5 h-3.5 text-violet-500" />JD 关键词</h4>
          <div class="flex flex-wrap gap-1"><span v-for="keyword in jdAnalysis.jdKeywords" :key="keyword" class="px-2 py-0.5 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-[10px]">{{ keyword }}</span></div>
        </section>

        <section class="grid grid-cols-2 gap-2">
          <div class="p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60">
            <h4 class="text-[11px] font-bold text-emerald-800 flex items-center gap-1 mb-1.5"><CheckCircle2 class="w-3.5 h-3.5" />已匹配 {{ jdAnalysis.matchedKeywords.length }}</h4>
            <p v-if="!jdAnalysis.matchedKeywords.length" class="text-[10px] text-emerald-700/70">暂无明显命中</p>
            <div v-else class="flex flex-wrap gap-1"><span v-for="keyword in jdAnalysis.matchedKeywords" :key="keyword" class="px-1.5 py-0.5 rounded bg-white border border-emerald-100 text-emerald-700 text-[10px]">{{ keyword }}</span></div>
          </div>
          <div class="p-2.5 rounded-xl border border-rose-100 bg-rose-50/60">
            <h4 class="text-[11px] font-bold text-rose-800 flex items-center gap-1 mb-1.5"><XCircle class="w-3.5 h-3.5" />缺口 {{ jdAnalysis.missingKeywords.length }}</h4>
            <p v-if="!jdAnalysis.missingKeywords.length" class="text-[10px] text-rose-700/70">暂无明显缺口</p>
            <div v-else class="flex flex-wrap gap-1"><span v-for="keyword in jdAnalysis.missingKeywords" :key="keyword" class="px-1.5 py-0.5 rounded bg-white border border-rose-100 text-rose-700 text-[10px]">{{ keyword }}</span></div>
          </div>
        </section>

        <section v-if="jdAnalysis.matchedSkills.length" class="p-3 rounded-xl border border-blue-100 bg-blue-50/50">
          <h4 class="text-[11px] font-bold text-blue-800 mb-2">简历证据</h4>
          <div class="space-y-1.5"><div v-for="skill in jdAnalysis.matchedSkills.slice(0, 8)" :key="`${skill.keyword}-${skill.source}`" class="flex items-start justify-between gap-2 text-[10px]"><span class="font-semibold text-blue-700 flex-shrink-0">{{ skill.keyword }}</span><span class="text-slate-500 text-right">{{ skill.source }} · {{ skill.evidence }}</span></div></div>
        </section>

        <section class="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="text-[11px] font-bold text-violet-900 flex items-center gap-1"><Bot class="w-3.5 h-3.5" />AI 岗位版本建议</div>
              <p class="text-[10px] text-violet-700 mt-0.5">只排序、裁剪、强调已有事实；返回后再做本地证据、记录 ID、技能和链接白名单校验。</p>
            </div>
            <button type="button" @click="generateVariantSuggestions" :disabled="aiLoading" class="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-[10px] font-bold focus-visible:ring-2 focus-visible:ring-violet-500">{{ aiLoading ? '生成中…' : '生成建议' }}</button>
          </div>
          <p v-if="aiError" class="text-[10px] text-rose-700">{{ aiError }}</p>
          <div v-if="suggestions.length" class="space-y-1.5">
            <div v-for="suggestion in suggestions" :key="suggestion.id" class="rounded-lg border border-violet-100 bg-white p-2 text-[10px]">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0"><div class="font-bold text-slate-800">{{ suggestionTypeLabel[suggestion.type] }}</div><div class="mt-0.5 text-slate-600">{{ suggestion.suggestion }}</div></div>
                <button type="button" @click="applySuggestion(suggestion)" :disabled="appliedIds.has(suggestion.id)" class="px-2 py-1 rounded border font-bold flex-shrink-0 disabled:opacity-70" :class="appliedIds.has(suggestion.id) ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-violet-200 text-violet-700 hover:bg-violet-50'"><span v-if="appliedIds.has(suggestion.id)" class="inline-flex items-center gap-0.5"><CheckCircle2 class="w-3 h-3" />已采用</span><span v-else>逐项采用</span></button>
              </div>
              <div v-if="suggestion.jdEvidence" class="mt-1 text-violet-700"><span class="font-semibold">JD 依据：</span>{{ suggestion.jdEvidence }}</div>
              <div class="mt-1 text-slate-400 break-all"><span class="font-semibold">档案证据：</span>{{ suggestion.evidenceResumeKeys.join('、') }}</div>
              <div v-if="suggestion.proposedValue" class="mt-1 p-1.5 rounded bg-slate-50 text-slate-700 whitespace-pre-wrap max-h-24 overflow-y-auto">{{ suggestion.proposedValue }}</div>
              <div v-if="suggestion.highlightSkills?.length" class="mt-1 text-emerald-700">高亮：{{ suggestion.highlightSkills.join('、') }}</div>
              <div v-if="suggestion.selectedLinks?.length" class="mt-1 text-blue-700">使用链接：{{ suggestion.selectedLinks.join('、') }}</div>
            </div>
            <div class="flex items-start gap-1 text-[10px] text-violet-700"><ShieldCheck class="w-3 h-3 flex-shrink-0 mt-0.5" />采用时自动创建/更新岗位版本；主档案事实不被 AI 直接修改。</div>
          </div>
        </section>

        <section v-if="applicationDraft" class="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
          <div class="flex items-center justify-between gap-2"><div><h4 class="text-[11px] font-bold text-slate-700 flex items-center gap-1"><Archive class="w-3.5 h-3.5 text-blue-500" />投递归档草稿</h4><p class="text-[10px] text-slate-500 mt-0.5">{{ applicationDraft.job.companyName }} · {{ applicationDraft.job.jobTitle }}</p></div><a :href="applicationDraft.job.jobUrl" target="_blank" rel="noopener" class="p-1 rounded text-slate-400 hover:text-blue-600" aria-label="打开职位原页面"><ExternalLink class="w-3.5 h-3.5" /></a></div>
          <p class="text-[10px] text-slate-500">{{ applicationDraft.reasons.join('；') }}</p>
          <p v-if="applicationArchiveFeedback" class="text-[10px] text-emerald-700 font-semibold" role="status">{{ applicationArchiveFeedback }}</p>
        </section>
      </template>

      <div v-else class="text-center py-8 text-slate-400 text-xs"><Target class="w-8 h-8 mx-auto mb-2 opacity-40" /><p>暂未识别到可分析的职位描述</p><p class="mt-1 text-[10px]">请在职位详情页重新打开或点击右上角刷新</p></div>
    </div>

    <footer class="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
      <button type="button" @click="emit('archive-application')" :disabled="!applicationDraft || isApplicationArchived" class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"><Archive class="w-3.5 h-3.5" />{{ isApplicationArchived ? '已归档本次投递' : '归档到投递看板' }}</button>
      <button type="button" @click="emit('open-tracker')" class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs">看板</button>
    </footer>
  </div>
</template>
