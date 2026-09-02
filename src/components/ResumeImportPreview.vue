<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Briefcase,
  FileSearch,
  FolderGit2,
  GraduationCap,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  User,
} from 'lucide-vue-next';
import type { StandardResume } from '@/types/resume';
import type { ImportConflict, ParsedCandidate } from '@/types/trustedResume';
import type { ImportConflictDecision } from './composables/useResumeImport';
import { assessResumeImport } from '@/core/importers/resumeImportQuality';

const props = defineProps<{
  parsedResume: StandardResume;
  baseResume?: StandardResume | null;
  localCandidates?: ParsedCandidate[];
  aiCandidates?: ParsedCandidate[];
  conflicts?: ImportConflict[];
  acceptedPaths?: string[];
}>();
const emit = defineEmits<{
  (event: 'reset'): void;
  (event: 'resolve-conflict', path: string, decision: ImportConflictDecision): void;
  (event: 'lock-field', path: string): void;
  (event: 'update-field', path: string, value: string | number | boolean): void;
}>();

const viewMode = ref<'review' | 'conflicts' | 'all'>('review');
const healthReport = computed(() => assessResumeImport(props.parsedResume));
const acceptedSet = computed(() => new Set(props.acceptedPaths || []));

function getValueByPath(source: unknown, path: string): unknown {
  let current = source;
  for (const part of path.split('.').filter(Boolean)) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function candidateMap(candidates: ParsedCandidate[] | undefined) {
  const result = new Map<string, ParsedCandidate>();
  for (const candidate of candidates || []) {
    const existing = result.get(candidate.path);
    if (!existing || candidate.confidence > existing.confidence) result.set(candidate.path, candidate);
  }
  return result;
}

const highRiskPath = (path: string) => /^(?:basics\.(?:name|phone|email|idCard|politicalStatus|birthDate|expectedSalary)|familyMembers\.|.*\.(?:startDate|endDate)$)/i.test(path);
const candidateNeedsReview = (candidate?: ParsedCandidate) => !!candidate && (
  candidate.confidence < 0.9 || !candidate.evidence?.length
);

const comparisonRows = computed(() => {
  const local = candidateMap(props.localCandidates);
  const ai = candidateMap(props.aiCandidates);
  const conflicts = new Map((props.conflicts || []).map((conflict) => [conflict.path, conflict]));
  const paths = new Set<string>([
    ...local.keys(),
    ...ai.keys(),
    ...conflicts.keys(),
    ...(props.acceptedPaths || []),
  ]);
  return [...paths].map((path) => {
    const localCandidate = local.get(path);
    const aiCandidate = ai.get(path);
    const conflict = conflicts.get(path);
    const isHighRisk = highRiskPath(path);
    return {
      path,
      currentValue: props.baseResume ? getValueByPath(props.baseResume, path) : conflict?.currentValue,
      localCandidate,
      aiCandidate,
      conflict,
      finalValue: getValueByPath(props.parsedResume, path),
      accepted: acceptedSet.value.has(path),
      isHighRisk,
      needsReview: !!conflict || isHighRisk || candidateNeedsReview(localCandidate) || candidateNeedsReview(aiCandidate),
    };
  }).sort((a, b) => Number(b.isHighRisk) - Number(a.isHighRisk) || Number(!!b.conflict) - Number(!!a.conflict) || a.path.localeCompare(b.path));
});

const visibleRows = computed(() => {
  if (viewMode.value === 'all') return comparisonRows.value;
  if (viewMode.value === 'conflicts') return comparisonRows.value.filter((row) => !!row.conflict);
  return comparisonRows.value.filter((row) => row.needsReview);
});
const highRiskRows = computed(() => comparisonRows.value.filter((row) => row.isHighRisk));
const highConfidenceCount = computed(() => comparisonRows.value.filter((row) =>
  Math.max(row.localCandidate?.confidence || 0, row.aiCandidate?.confidence || 0) >= 0.9,
).length);

const formatValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return typeof value === 'string' ? value : JSON.stringify(value);
};
const evidenceText = (candidate?: ParsedCandidate) => {
  if (!candidate?.evidence?.length) return '无可定位证据';
  return candidate.evidence.slice(0, 2).map((evidence) => {
    const location = evidence.page ? `第 ${evidence.page} 页` : evidence.start !== undefined ? `字符 ${evidence.start}-${evidence.end ?? evidence.start}` : '';
    const text = evidence.text || evidence.locator || '';
    return [location, text].filter(Boolean).join(' · ');
  }).join('；');
};
const confidenceLabel = (candidate?: ParsedCandidate) => candidate ? `${Math.round(candidate.confidence * 100)}%` : '—';
const conflictReasonLabel = (conflict?: ImportConflict) => {
  if (!conflict) return '';
  return ({
    locked: '已锁定，禁止静默覆盖',
    'confirmed-different': '已确认值不同',
    'parser-disagreement': '可信来源优先级冲突',
    'low-confidence': 'AI 置信度低，必须人工确认',
    'no-evidence': 'AI 无证据，必须人工确认',
    invalid: '候选路径或结构无效',
  } as Record<ImportConflict['reason'], string>)[conflict.reason];
};

function editFinalValue(path: string, currentValue: unknown, event: Event) {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (typeof currentValue === 'boolean') emit('update-field', path, target.value === 'true');
  else if (typeof currentValue === 'number') emit('update-field', path, Number(target.value));
  else emit('update-field', path, target.value);
}
</script>

<template>
  <div v-if="parsedResume && healthReport" class="space-y-4 animate-fade-in">
    <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 flex-wrap">
          <Activity class="w-4 h-4 text-blue-600" />
          <span class="font-bold text-slate-900 text-xs">可信导入审核</span>
          <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px]">高置信候选 {{ highConfidenceCount }} 项</span>
          <span v-if="acceptedPaths?.length" class="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold text-[11px]">已采用 {{ acceptedPaths.length }} 项</span>
          <span v-if="conflicts?.length" class="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full font-bold text-[11px]">待处理冲突 {{ conflicts.length }} 项</span>
        </div>
        <button type="button" @click="emit('reset')" class="text-xs text-slate-500 hover:text-slate-900 underline font-medium focus-visible:ring-2 focus-visible:ring-blue-500 rounded">重新上传</button>
      </div>

      <div class="p-2.5 rounded-xl border border-blue-200 bg-blue-50 text-[11px] text-blue-900 leading-relaxed">
        当前档案、本地解析和 AI 建议按字段并排审核。高置信无冲突项可直接进入最终差异；锁定、已确认、低置信或无证据候选必须显式处理。修改最终值会标记为人工确认。
      </div>

      <div v-if="healthReport.missingItems.length > 0" class="space-y-1.5">
        <div class="text-[11px] font-bold text-slate-600 flex items-center gap-1"><AlertCircle class="w-3.5 h-3.5 text-amber-500" /><span>网申高频缺失项 ({{ healthReport.missingItems.length }} 项)</span></div>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="item in healthReport.missingItems" :key="item" class="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-lg text-[11px] font-medium">○ {{ item }}</span>
        </div>
      </div>

      <div v-if="highRiskRows.length" class="p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-[11px] text-rose-900">
        <div class="font-bold flex items-center gap-1"><ShieldAlert class="w-3.5 h-3.5" />高风险字段单独核对 · {{ highRiskRows.length }} 项</div>
        <div class="mt-1 flex flex-wrap gap-1"><span v-for="row in highRiskRows" :key="row.path" class="px-1.5 py-0.5 rounded bg-white border border-rose-200 font-mono">{{ row.path }}</span></div>
      </div>

      <div v-if="healthReport.warnings.length > 0" class="space-y-1">
        <div class="text-[11px] font-bold text-slate-600 flex items-center gap-1"><AlertTriangle class="w-3.5 h-3.5 text-amber-600" /><span>建议核对项</span></div>
        <ul class="text-[11px] text-slate-500 list-disc list-inside space-y-0.5"><li v-for="(warn, i) in healthReport.warnings" :key="i">{{ warn }}</li></ul>
      </div>
    </div>

    <section class="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <header class="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-3">
        <div class="text-xs font-bold text-slate-800 flex items-center gap-1.5"><FileSearch class="w-4 h-4 text-blue-600" />字段级三方对比与最终差异</div>
        <div class="flex gap-1 text-[10px] font-semibold">
          <button type="button" @click="viewMode = 'review'" :class="['px-2 py-1 rounded border', viewMode === 'review' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500']">待审核 {{ comparisonRows.filter(row => row.needsReview).length }}</button>
          <button type="button" @click="viewMode = 'conflicts'" :class="['px-2 py-1 rounded border', viewMode === 'conflicts' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-500']">仅冲突 {{ conflicts?.length || 0 }}</button>
          <button type="button" @click="viewMode = 'all'" :class="['px-2 py-1 rounded border', viewMode === 'all' ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-500']">全部 {{ comparisonRows.length }}</button>
        </div>
      </header>

      <div class="overflow-x-auto max-h-[420px] overflow-y-auto">
        <div class="min-w-[1180px]">
          <div class="sticky top-0 z-10 grid grid-cols-[150px_150px_180px_180px_190px_1fr_170px] gap-2 px-3 py-2 bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600">
            <span>字段</span><span>当前档案</span><span>本地解析</span><span>AI 建议</span><span>最终将写入</span><span>原文 / 页面证据</span><span>操作</span>
          </div>
          <div v-if="visibleRows.length === 0" class="py-8 text-center text-xs text-slate-400">当前筛选下没有待审核字段</div>
          <div v-for="row in visibleRows" :key="row.path" :class="['grid grid-cols-[150px_150px_180px_180px_190px_1fr_170px] gap-2 p-3 border-b border-slate-100 text-[11px] items-start', row.conflict ? 'bg-amber-50/50' : row.isHighRisk ? 'bg-rose-50/30' : 'bg-white']">
            <div class="min-w-0">
              <div class="font-bold text-slate-800 break-all">{{ row.path }}</div>
              <span v-if="row.isHighRisk" class="inline-block mt-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">高风险</span>
              <div v-if="row.conflict" class="mt-1 text-amber-800 font-semibold">{{ conflictReasonLabel(row.conflict) }}</div>
            </div>
            <div class="text-slate-700 break-words">{{ formatValue(row.currentValue) }}</div>
            <div>
              <div class="text-slate-800 break-words">{{ formatValue(row.localCandidate?.value) }}</div>
              <div v-if="row.localCandidate" :class="['mt-1 font-bold', row.localCandidate.confidence >= 0.9 ? 'text-emerald-700' : row.localCandidate.confidence >= 0.7 ? 'text-amber-700' : 'text-rose-700']">{{ confidenceLabel(row.localCandidate) }} · 本地</div>
            </div>
            <div>
              <div class="text-slate-800 break-words">{{ formatValue(row.aiCandidate?.value) }}</div>
              <div v-if="row.aiCandidate" :class="['mt-1 font-bold', row.aiCandidate.confidence >= 0.9 ? 'text-emerald-700' : row.aiCandidate.confidence >= 0.7 ? 'text-amber-700' : 'text-rose-700']">{{ confidenceLabel(row.aiCandidate) }} · AI</div>
            </div>
            <div>
              <select v-if="typeof row.finalValue === 'boolean'" :value="String(row.finalValue)" @change="editFinalValue(row.path, row.finalValue, $event)" class="w-full px-2 py-1 rounded border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500"><option value="true">是</option><option value="false">否</option></select>
              <input v-else-if="typeof row.finalValue === 'string' || typeof row.finalValue === 'number'" :value="String(row.finalValue ?? '')" @change="editFinalValue(row.path, row.finalValue, $event)" class="w-full px-2 py-1 rounded border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div v-else class="text-slate-700 break-words">{{ formatValue(row.finalValue) }}</div>
              <div v-if="row.accepted" class="mt-1 text-[10px] text-blue-600 font-semibold">已进入最终差异</div>
            </div>
            <div class="space-y-1 text-slate-500 leading-relaxed">
              <div v-if="row.localCandidate"><span class="font-semibold text-blue-700">本地：</span>{{ evidenceText(row.localCandidate) }}</div>
              <div v-if="row.aiCandidate"><span class="font-semibold text-violet-700">AI：</span>{{ evidenceText(row.aiCandidate) }}</div>
              <div v-if="!row.localCandidate && !row.aiCandidate">—</div>
            </div>
            <div class="space-y-1">
              <template v-if="row.conflict">
                <button type="button" @click="emit('resolve-conflict', row.path, 'keep-current')" class="w-full px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50">保留当前</button>
                <button type="button" @click="emit('resolve-conflict', row.path, 'keep-current-lock')" class="w-full px-2 py-1 rounded border border-slate-300 bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200">保留并锁定</button>
                <button v-if="row.conflict.reason !== 'invalid'" type="button" @click="emit('resolve-conflict', row.path, 'accept-candidate')" class="w-full px-2 py-1 rounded border border-amber-300 bg-amber-50 text-amber-900 font-semibold hover:bg-amber-100">采用候选</button>
                <button v-if="row.conflict.reason !== 'invalid'" type="button" @click="emit('resolve-conflict', row.path, 'accept-candidate-lock')" class="w-full px-2 py-1 rounded border border-amber-400 bg-amber-100 text-amber-950 font-bold hover:bg-amber-200">采用并锁定</button>
              </template>
              <button v-else-if="row.finalValue !== undefined && row.finalValue !== ''" type="button" @click="emit('lock-field', row.path)" class="w-full px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 inline-flex items-center justify-center gap-1"><LockKeyhole class="w-3 h-3" />锁定最终值</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="grid grid-cols-2 gap-4 text-xs">
      <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
        <h3 class="font-bold text-slate-800 flex items-center gap-1.5 pb-1.5 border-b border-slate-200"><User class="w-4 h-4 text-blue-600" /> 基本信息</h3>
        <div class="grid grid-cols-2 gap-2 text-slate-700">
          <div><span class="text-slate-500">姓名:</span> {{ parsedResume.basics.name || '未提取到' }}</div>
          <div><span class="text-slate-500">性别:</span> {{ parsedResume.basics.gender }}</div>
          <div><span class="text-slate-500">电话:</span> {{ parsedResume.basics.phone || '未提取到' }}</div>
          <div><span class="text-slate-500">邮箱:</span> {{ parsedResume.basics.email || '未提取到' }}</div>
          <div><span class="text-slate-500">生日:</span> {{ parsedResume.basics.birthDate || '未提取到' }}</div>
          <div><span class="text-slate-500">政治面貌:</span> {{ parsedResume.basics.politicalStatus }}</div>
          <div class="col-span-2"><span class="text-slate-500">求职意向:</span> {{ parsedResume.basics.expectedRole || '未提取到' }}</div>
        </div>
      </div>

      <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
        <h3 class="font-bold text-slate-800 flex items-center gap-1.5 pb-1.5 border-b border-slate-200"><GraduationCap class="w-4 h-4 text-indigo-600" /> 教育背景 ({{ parsedResume.educations.length }} 条)</h3>
        <div v-if="parsedResume.educations.length === 0" class="text-slate-500 italic">未识别到教育经历</div>
        <div v-for="(edu, idx) in parsedResume.educations" :key="idx" class="text-slate-700"><span class="font-semibold text-slate-900">{{ edu.schoolName }}</span> · {{ edu.degree }} · {{ edu.major }}<div class="text-xs text-slate-500">{{ edu.startDate }} ~ {{ edu.endDate }}</div></div>
      </div>

      <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
        <h3 class="font-bold text-slate-800 flex items-center gap-1.5 pb-1.5 border-b border-slate-200"><Briefcase class="w-4 h-4 text-blue-600" /> 工作与实习 ({{ parsedResume.experiences.length }} 条)</h3>
        <div v-if="parsedResume.experiences.length === 0" class="text-slate-500 italic">未识别到工作经历</div>
        <div v-for="(exp, idx) in parsedResume.experiences" :key="idx" class="text-slate-700 truncate"><span class="font-semibold text-slate-900">{{ exp.company }}</span> - {{ exp.title }}<div class="text-xs text-slate-500">{{ exp.startDate }} ~ {{ exp.endDate }}</div></div>
      </div>

      <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
        <h3 class="font-bold text-slate-800 flex items-center gap-1.5 pb-1.5 border-b border-slate-200"><FolderGit2 class="w-4 h-4 text-amber-600" /> 项目经历 ({{ parsedResume.projects.length }} 条)</h3>
        <div v-if="parsedResume.projects.length === 0" class="text-slate-500 italic">未识别到项目经历</div>
        <div v-for="(proj, idx) in parsedResume.projects" :key="idx" class="text-slate-700 truncate"><span class="font-semibold text-slate-900">{{ proj.projectName }}</span> ({{ proj.role }})</div>
      </div>

      <div class="col-span-2 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
        <h3 class="font-bold text-slate-800 flex items-center gap-1.5 pb-1.5 border-b border-slate-200"><Trophy class="w-4 h-4 text-orange-600" /> 校招扩展信息</h3>
        <div class="grid grid-cols-4 gap-2 text-slate-700">
          <div>家庭成员：<b>{{ parsedResume.familyMembers?.length || 0 }}</b> 条</div><div>语言成绩：<b>{{ parsedResume.languages?.length || 0 }}</b> 条</div><div>证书：<b>{{ parsedResume.certificates?.length || 0 }}</b> 条</div><div>获奖荣誉：<b>{{ parsedResume.awards?.length || 0 }}</b> 条</div><div>学术成果：<b>{{ parsedResume.academicAchievements?.length || 0 }}</b> 条</div><div>学生干部：<b>{{ parsedResume.campusExperiences?.length || 0 }}</b> 条</div><div class="col-span-2 truncate">兴趣爱好：{{ parsedResume.basics.hobbies || '未提取到' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
