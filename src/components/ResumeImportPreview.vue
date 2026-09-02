<script setup lang="ts">
import { computed } from 'vue';
import { Activity, AlertCircle, AlertTriangle, User, GraduationCap, Briefcase, FolderGit2, Trophy, ShieldCheck, FileSearch } from 'lucide-vue-next';
import type { StandardResume } from '@/types/resume';
import type { ImportConflict, ParsedCandidate } from '@/types/trustedResume';
import { assessResumeImport } from '@/core/importers/resumeImportQuality';

const props = defineProps<{
  parsedResume: StandardResume;
  localCandidates?: ParsedCandidate[];
  aiCandidates?: ParsedCandidate[];
  conflicts?: ImportConflict[];
  acceptedPaths?: string[];
}>();
const emit = defineEmits<{
  (event: 'reset'): void;
  (event: 'resolve-conflict', path: string, decision: 'keep-current' | 'accept-candidate'): void;
}>();
const healthReport = computed(() => assessResumeImport(props.parsedResume));
const reviewRows = computed(() => [
  ...(props.localCandidates || []).map((candidate) => ({ candidate, source: '本地解析' })),
  ...(props.aiCandidates || []).map((candidate) => ({ candidate, source: 'AI 建议' })),
].sort((a, b) => b.candidate.confidence - a.candidate.confidence).slice(0, 40));
const highConfidenceCount = computed(() => reviewRows.value.filter((row) => row.candidate.confidence >= 0.9).length);
const evidenceText = (candidate: ParsedCandidate) => candidate.evidence?.[0]?.text || '暂无可定位原文证据';
const formatValue = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value);
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
        导入文件和 AI 结果只作为候选。字段来源、置信度与原文证据会随档案保存；已确认或锁定字段出现不同候选时不会自动覆盖，必须在下方明确选择。
      </div>

      <div v-if="healthReport.missingItems.length > 0" class="space-y-1.5">
        <div class="text-[11px] font-bold text-slate-600 flex items-center gap-1"><AlertCircle class="w-3.5 h-3.5 text-amber-500" /><span>网申高频缺失项 ({{ healthReport.missingItems.length }} 项)</span></div>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="item in healthReport.missingItems" :key="item" class="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-lg text-[11px] font-medium">○ {{ item }}</span>
        </div>
      </div>

      <div v-if="healthReport.warnings.length > 0" class="space-y-1">
        <div class="text-[11px] font-bold text-slate-600 flex items-center gap-1"><AlertTriangle class="w-3.5 h-3.5 text-amber-600" /><span>建议核对项</span></div>
        <ul class="text-[11px] text-slate-500 list-disc list-inside space-y-0.5"><li v-for="(warn, i) in healthReport.warnings" :key="i">{{ warn }}</li></ul>
      </div>
    </div>

    <section v-if="conflicts?.length" class="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
      <header class="px-4 py-2.5 border-b border-amber-200 text-xs font-bold text-amber-900 flex items-center gap-1.5"><ShieldCheck class="w-4 h-4" />必须处理的字段冲突</header>
      <div class="divide-y divide-amber-100 max-h-72 overflow-y-auto">
        <div v-for="conflict in conflicts" :key="`${conflict.path}-${conflict.reason}`" class="p-3 grid grid-cols-[150px_1fr_1fr_130px] gap-3 text-[11px] items-start">
          <div><div class="font-bold text-slate-800 break-all">{{ conflict.path }}</div><div class="mt-1 text-amber-700">{{ conflict.reason === 'locked' ? '已锁定，禁止静默覆盖' : conflict.reason === 'confirmed-different' ? '已确认值不同' : conflict.reason === 'invalid' ? '候选路径无效' : '解析结果不一致' }}</div></div>
          <div><div class="text-slate-500 mb-1">当前档案</div><div class="font-medium text-slate-800 break-words">{{ formatValue(conflict.currentValue) }}</div></div>
          <div><div class="text-slate-500 mb-1">导入候选</div><div class="font-medium text-amber-900 break-words">{{ formatValue(conflict.candidateValue) }}</div><div class="mt-1 text-slate-500">置信度 {{ Math.round((conflict.candidateMeta.confidence || 0) * 100) }}%</div></div>
          <div class="space-y-1.5">
            <button type="button" @click="emit('resolve-conflict', conflict.path, 'keep-current')" class="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500">保留当前值</button>
            <button v-if="conflict.reason !== 'invalid'" type="button" @click="emit('resolve-conflict', conflict.path, 'accept-candidate')" class="w-full px-2 py-1.5 rounded-lg border border-amber-300 bg-amber-100 text-amber-900 font-semibold hover:bg-amber-200 focus-visible:ring-2 focus-visible:ring-amber-500">采用候选值</button>
          </div>
        </div>
      </div>
    </section>

    <section v-if="reviewRows.length" class="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <header class="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <div class="text-xs font-bold text-slate-800 flex items-center gap-1.5"><FileSearch class="w-4 h-4 text-blue-600" />字段级候选与证据</div>
        <div class="text-[10px] text-slate-500">仅展示前 {{ reviewRows.length }} 项；无冲突且可信度足够的候选已按本地合并策略采用</div>
      </header>
      <div class="max-h-72 overflow-y-auto divide-y divide-slate-100">
        <div v-for="row in reviewRows" :key="`${row.source}-${row.candidate.path}`" class="p-3 grid grid-cols-[150px_110px_1fr] gap-3 text-[11px]">
          <div class="min-w-0"><div class="font-bold text-slate-800 break-all">{{ row.candidate.path }}</div><span :class="['inline-block mt-1 px-1.5 py-0.5 rounded border', row.source === 'AI 建议' ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-blue-50 border-blue-200 text-blue-700']">{{ row.source }}</span></div>
          <div><div class="font-medium text-slate-800 break-words">{{ formatValue(row.candidate.value) }}</div><div :class="['mt-1 font-bold', row.candidate.confidence >= 0.9 ? 'text-emerald-700' : row.candidate.confidence >= 0.7 ? 'text-amber-700' : 'text-rose-700']">{{ Math.round(row.candidate.confidence * 100) }}%</div></div>
          <div class="text-slate-500 leading-relaxed break-words"><span class="font-semibold text-slate-700">证据：</span>{{ evidenceText(row.candidate) }}<div class="mt-1 text-[10px]">规则：{{ row.candidate.parserRule }}</div></div>
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
