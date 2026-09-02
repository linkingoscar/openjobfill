<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Copy, Download, History, Trash2, Upload, Package, Play, Gauge, ShieldCheck, AlertTriangle } from 'lucide-vue-next';
import type { FillHistoryRecord } from '@/types/fillHistory';
import { personalCompatibilityStorage } from '@/core/storage/personalCompatibilityStorage';
import type { PersonalSiteCompatibility } from '@/core/storage/personalSiteLearning';

const props = defineProps<{
  records: FillHistoryRecord[];
  loading: boolean;
  maxRecords: number;
  formatTime: (value: string) => string;
  feedback?: string;
}>();

const emit = defineEmits<{
  (event: 'copy'): void;
  (event: 'export'): void;
  (event: 'replay-export'): void;
  (event: 'replay-import'): void;
  (event: 'replay-run'): void;
  (event: 'clear'): void;
}>();

const compatibility = ref<PersonalSiteCompatibility[]>([]);
const markingHostname = ref('');
const personalVerificationMessage = ref('');
async function loadCompatibility() {
  try { compatibility.value = await personalCompatibilityStorage.getAll(); }
  catch { compatibility.value = []; }
}
onMounted(loadCompatibility);
watch(() => props.records.length, () => { void loadCompatibility(); });

function isCurrentSite(hostname: string): boolean {
  try { return hostname.toLowerCase() === window.location.hostname.toLowerCase(); }
  catch { return false; }
}
function browserVersion(): string | undefined {
  try { return navigator.userAgent.match(/(?:Chrome|Chromium|Edg)\/[\d.]+/)?.[0]; }
  catch { return undefined; }
}
async function markCurrentSitePersonalVerified(site: PersonalSiteCompatibility) {
  if (!isCurrentSite(site.hostname) || markingHostname.value) return;
  const confirmed = window.confirm(
    `只在你本人已经在 ${site.hostname} 的真实招聘申请页面完成并人工核对本次流程后继续。\n\n系统要求至少 3 个已尝试模块全部严格 PASS；Fixture、CI 或仅打开页面不能算真人验收。确认将当前站点标记为 PERSONAL_VERIFIED？`,
  );
  if (!confirmed) return;
  markingHostname.value = site.hostname;
  personalVerificationMessage.value = '';
  try {
    await personalCompatibilityStorage.markPersonalVerified(window.location.href, browserVersion());
    await loadCompatibility();
    personalVerificationMessage.value = `${site.hostname} 已记录真人流程验证。后续若严格读回失败，状态会自动降级为 DEGRADED。`;
  } catch (error) {
    personalVerificationMessage.value = error instanceof Error ? error.message : '真人流程验证记录失败';
  } finally {
    markingHostname.value = '';
  }
}

const executionRecords = computed(() => props.records.filter((record) => record.phase === 'execution'));
const quality = computed(() => {
  const runs = executionRecords.value;
  const verified = runs.reduce((sum, record) => sum + (record.verifiedCount ?? record.filledCount), 0);
  const failed = runs.reduce((sum, record) => sum + record.failedCount, 0);
  const attempted = verified + failed;
  const reviewRequired = runs.reduce((sum, record) => sum + (record.reviewRequiredCount || 0), 0);
  const aiMappings = runs.reduce((sum, record) => sum + (record.aiMappingCount || 0), 0);
  const failureCodes: Record<string, number> = {};
  for (const record of runs) {
    for (const field of record.fields) {
      if (field.failureCode) failureCodes[field.failureCode] = (failureCodes[field.failureCode] || 0) + 1;
    }
  }
  const topFailures = Object.entries(failureCodes).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return {
    runs: runs.length,
    verified,
    failed,
    verificationRate: attempted ? verified / attempted : 0,
    reviewRequired,
    aiMappings,
    topFailures,
  };
});

const moduleLabel: Record<string, string> = {
  basics: '基本', education: '教育', experience: '工作', project: '项目', date: '日期', region: '地区', attachment: '附件', qa: '问答',
};
const compatibilityStatusLabel: Record<string, string> = {
  UNSEEN: '未使用', DETECTED: '已识别', PARTIAL: '开发/使用中', PERSONAL_VERIFIED: '真人流程已验证', DEGRADED: '近期退化',
};
</script>

<template>
  <section class="pt-3 mt-3 border-t border-slate-200" aria-labelledby="fill-history-title">
    <div class="flex items-center justify-between gap-2 mb-2">
      <div class="flex items-center gap-1.5 min-w-0">
        <History class="w-4 h-4 text-blue-600 flex-shrink-0" aria-hidden="true" />
        <h3 id="fill-history-title" class="text-xs font-bold text-slate-700">填表历史（{{ records.length }}/{{ maxRecords }}）</h3>
        <span class="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">已脱敏</span>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <button type="button" @click="emit('copy')" :disabled="records.length === 0" class="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500" title="复制脱敏诊断信息" aria-label="复制脱敏诊断信息"><Copy class="w-3.5 h-3.5" aria-hidden="true" /></button>
        <button type="button" @click="emit('export')" :disabled="records.length === 0" class="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500" title="导出脱敏诊断 JSON" aria-label="导出脱敏诊断 JSON"><Download class="w-3.5 h-3.5" aria-hidden="true" /></button>
        <button type="button" @click="emit('replay-export')" class="p-1.5 rounded-md text-slate-500 hover:text-violet-600 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500" title="导出运行回放问题包" aria-label="导出运行回放问题包"><Package class="w-3.5 h-3.5" aria-hidden="true" /></button>
        <button type="button" @click="emit('replay-import')" class="p-1.5 rounded-md text-slate-500 hover:text-violet-600 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500" title="导入运行回放问题包" aria-label="导入运行回放问题包"><Upload class="w-3.5 h-3.5" aria-hidden="true" /></button>
        <button type="button" @click="emit('replay-run')" class="p-1.5 rounded-md text-slate-500 hover:text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500" title="离线回放最近运行（不写网页）" aria-label="离线回放最近运行（不写网页）"><Play class="w-3.5 h-3.5" aria-hidden="true" /></button>
        <button type="button" @click="emit('clear')" :disabled="records.length === 0" class="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-rose-500" title="清空填表历史" aria-label="清空填表历史"><Trash2 class="w-3.5 h-3.5" aria-hidden="true" /></button>
      </div>
    </div>

    <p v-if="feedback" role="status" aria-live="polite" class="text-xs text-violet-700 bg-violet-50 rounded p-2 mb-2">{{ feedback }}</p>
    <p v-if="personalVerificationMessage" role="status" aria-live="polite" class="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded p-2 mb-2">{{ personalVerificationMessage }}</p>
    <p class="text-[10px] text-slate-400 mb-2 leading-relaxed">不保存字段实际填写值；错误文本中的联系方式、证件号和期望/实际值会自动隐藏。</p>

    <div class="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
      <div class="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 mb-2"><Gauge class="w-3.5 h-3.5 text-blue-600" />本地质量看板</div>
      <div class="grid grid-cols-4 gap-1.5 text-center">
        <div class="rounded-lg bg-white border border-slate-100 p-1.5"><div class="text-[10px] text-slate-400">执行次数</div><div class="font-bold text-slate-700">{{ quality.runs }}</div></div>
        <div class="rounded-lg bg-white border border-slate-100 p-1.5"><div class="text-[10px] text-slate-400">严格验证率</div><div class="font-bold" :class="quality.verificationRate >= 0.95 ? 'text-emerald-700' : 'text-amber-700'">{{ Math.round(quality.verificationRate * 100) }}%</div></div>
        <div class="rounded-lg bg-white border border-slate-100 p-1.5"><div class="text-[10px] text-slate-400">重点核对</div><div class="font-bold text-amber-700">{{ quality.reviewRequired }}</div></div>
        <div class="rounded-lg bg-white border border-slate-100 p-1.5"><div class="text-[10px] text-slate-400">AI 映射</div><div class="font-bold text-violet-700">{{ quality.aiMappings }}</div></div>
      </div>
      <div v-if="quality.topFailures.length" class="mt-2 flex flex-wrap gap-1 text-[10px]"><span class="text-slate-500">常见失败：</span><span v-for="([code, count]) in quality.topFailures" :key="code" class="px-1.5 py-0.5 rounded border border-rose-100 bg-rose-50 text-rose-700">{{ code }} × {{ count }}</span></div>
    </div>

    <details v-if="compatibility.length" class="mb-3 rounded-xl border border-slate-200 bg-white overflow-hidden">
      <summary class="cursor-pointer list-none px-2.5 py-2 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-700">
        <span class="flex items-center gap-1.5"><ShieldCheck class="w-3.5 h-3.5 text-emerald-600" />个人站点兼容性 · {{ compatibility.length }}</span>
        <span class="text-[10px] text-slate-400 font-normal">自动遥测不会升级为 PERSONAL_VERIFIED</span>
      </summary>
      <div class="border-t border-slate-100 divide-y divide-slate-100 max-h-56 overflow-y-auto">
        <div v-for="site in compatibility" :key="site.hostname" class="p-2.5 text-[10px]">
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-slate-700 truncate">{{ site.hostname }}</span>
            <div class="flex items-center gap-1.5">
              <button
                v-if="isCurrentSite(site.hostname) && site.status !== 'PERSONAL_VERIFIED'"
                type="button"
                @click="markCurrentSitePersonalVerified(site)"
                :disabled="!!markingHostname"
                class="px-1.5 py-0.5 rounded border border-emerald-200 bg-white text-emerald-700 font-bold hover:bg-emerald-50 disabled:opacity-50"
                title="仅在本人真实申请流程人工核对完成后使用"
              >
                {{ markingHostname === site.hostname ? '记录中…' : '真人验收当前站点' }}
              </button>
              <span :class="['px-1.5 py-0.5 rounded border font-bold', site.status === 'PERSONAL_VERIFIED' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : site.status === 'DEGRADED' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700']">{{ compatibilityStatusLabel[site.status] || site.status }}</span>
            </div>
          </div>
          <div class="mt-1.5 flex flex-wrap gap-1">
            <span v-for="(status, module) in site.modules" :key="String(module)" :class="['px-1.5 py-0.5 rounded border', status === 'PASS' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : status === 'FAIL' ? 'bg-rose-50 border-rose-100 text-rose-700' : status === 'PARTIAL' ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-400']">{{ moduleLabel[String(module)] || module }}: {{ status }}</span>
          </div>
          <div v-if="site.knownLimitations?.length" class="mt-1 text-rose-600 flex items-start gap-1"><AlertTriangle class="w-3 h-3 flex-shrink-0" />{{ site.knownLimitations.join('、') }}</div>
          <div v-if="site.personalVerifiedAt" class="mt-1 text-emerald-600">真人验收时间：{{ new Date(site.personalVerifiedAt).toLocaleString('zh-CN', { hour12: false }) }}<span v-if="site.browserVersion"> · {{ site.browserVersion }}</span></div>
        </div>
      </div>
    </details>

    <div v-if="loading" role="status" class="text-center py-3 text-xs text-slate-400">正在读取历史记录…</div>
    <div v-else-if="records.length === 0" class="text-center py-3 text-xs text-slate-400 bg-slate-50 rounded-lg">完成一次自动填写后，诊断记录会保存在这里</div>
    <div v-else class="space-y-1.5 max-h-64 overflow-y-auto pr-1">
      <details v-for="record in records" :key="record.id" class="group rounded-lg border border-slate-200 bg-white overflow-hidden">
        <summary class="cursor-pointer list-none p-2 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0"><div class="text-xs font-semibold text-slate-700 truncate" :title="record.pageTitle || record.hostname">{{ record.pageTitle || record.hostname || '未知页面' }}</div><div class="text-[10px] text-slate-400 truncate mt-0.5" :title="record.pageUrl">{{ formatTime(record.createdAt) }} · {{ record.hostname || '本地页面' }}</div></div>
            <div class="flex gap-1 text-[10px] font-bold flex-shrink-0"><span class="text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">成功 {{ record.filledCount }}</span><span v-if="record.failedCount" class="text-rose-700 bg-rose-50 rounded px-1.5 py-0.5">失败 {{ record.failedCount }}</span></div>
          </div>
        </summary>
        <div class="border-t border-slate-100 p-2 bg-slate-50/60 space-y-1">
          <div class="text-[10px] text-slate-500 flex justify-between gap-2"><span class="truncate">引擎：{{ record.adapterName }} · {{ record.phase === 'analysis' ? '页面分析' : '填写执行' }}</span><span class="flex-shrink-0">{{ record.durationMs }}ms</span></div>
          <div class="text-[10px] text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5"><span v-if="record.verifiedCount !== undefined">验证 {{ record.verifiedCount }}</span><span v-if="record.reviewRequiredCount">重点核对 {{ record.reviewRequiredCount }}</span><span v-if="record.aiMappingCount">AI {{ record.aiMappingCount }}</span><span v-if="record.blockedCount">安全阻断 {{ record.blockedCount }}</span></div>
          <p v-if="record.operationError" class="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 rounded px-2 py-1 break-words">{{ record.operationError }}</p>
          <div v-for="(field, fieldIndex) in record.fields" :key="`${record.id}-${fieldIndex}`" class="text-[10px] rounded bg-white border border-slate-100 px-2 py-1">
            <div class="flex items-center justify-between gap-2"><span class="text-slate-700 font-medium truncate">{{ field.label }}</span><span :class="['font-bold flex-shrink-0', field.status === 'success' ? 'text-emerald-600' : field.status === 'failed' ? 'text-rose-600' : 'text-amber-600']">{{ field.status === 'success' ? '成功' : field.status === 'failed' ? '失败' : '跳过' }}</span></div>
            <p v-if="field.message" class="text-slate-400 mt-0.5 break-words">{{ field.message }}</p><p v-if="field.failureCode" class="text-rose-500 mt-0.5">{{ field.failureCode }}</p>
          </div>
        </div>
      </details>
    </div>
  </section>
</template>
