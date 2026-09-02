<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle, Sparkles, Eye, CheckCircle, EyeOff, Pipette, Paperclip, ShieldAlert, Bot } from 'lucide-vue-next';
import type { FillResult } from '@/types/adapter';
import type { FillDecision, FieldRiskLevel } from '@/core/pipeline/decisionPolicy';

interface PreviewItem {
  id: string;
  field: { label: string };
  targetValue?: unknown;
  semanticKey?: string;
  confidence?: number;
  decision?: FillDecision;
  riskLevel?: FieldRiskLevel;
  source?: 'platform_rule' | 'user_rule' | 'qa_bank' | 'semantic_dictionary' | 'fallback' | 'ai';
  reason?: string;
}

const props = defineProps<{
  currentAdapterName: string;
  operationError: string;
  isFilling: boolean;
  hasPreview: boolean;
  fillResult: FillResult | null;
  previewFillItems: PreviewItem[];
  previewNeedsUserItems: PreviewItem[];
  previewWorkflowItems: Array<{ groupKey: string; summary: string }>;
}>();

const emit = defineEmits<{
  (event: 'clear-badges' | 'confirm' | 'preview-manual' | 'analyze' | 'manual' | 'upload' | 'cancel'): void;
}>();

const highConfidenceItems = computed(() => props.previewFillItems.filter((item) => item.decision !== 'FILL_REVIEW_REQUIRED'));
const reviewRequiredItems = computed(() => props.previewFillItems.filter((item) => item.decision === 'FILL_REVIEW_REQUIRED'));
const aiItems = computed(() => props.previewFillItems.filter((item) => item.source === 'ai'));
const blockedItems = computed(() => props.previewNeedsUserItems.filter((item) => item.decision === 'BLOCKED'));
const optionalItems = computed(() => props.previewNeedsUserItems.filter((item) => item.decision === 'OPTIONAL_UNMATCHED'));
const manualItems = computed(() => props.previewNeedsUserItems.filter((item) => item.decision !== 'BLOCKED' && item.decision !== 'OPTIONAL_UNMATCHED'));
const consistencyBlockers = computed(() => props.fillResult?.consistencyIssues?.filter((issue) => issue.severity === 'BLOCKER') || []);
const consistencyWarnings = computed(() => props.fillResult?.consistencyIssues?.filter((issue) => issue.severity !== 'BLOCKER') || []);

const sourceLabel = (source?: PreviewItem['source']) => ({
  user_rule: '个人规则', platform_rule: '平台规则', qa_bank: '问答库', semantic_dictionary: '确定性语义', fallback: '兜底', ai: 'AI 建议',
}[source || 'fallback'] || '未知');

const riskLabel = (risk?: FieldRiskLevel) => ({ CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LONG_TEXT: '长文本', LOW: 'Low' }[risk || 'LOW']);
</script>

<template>
  <div id="drawer-panel-logs" role="tabpanel" aria-labelledby="drawer-tab-logs" class="flex-1 flex flex-col min-h-0 overflow-hidden">
    <div class="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
      <span>当前适配引擎:</span>
      <span class="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 truncate max-w-[170px]">{{ currentAdapterName }}</span>
    </div>

    <div class="p-4 flex-1 overflow-y-auto space-y-3">
      <div v-if="operationError && !isFilling" role="alert" class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
        <div class="font-bold flex items-center gap-1.5"><AlertTriangle class="w-4 h-4" />本次操作没有完成</div>
        <p class="mt-1 leading-relaxed">{{ operationError }}</p>
      </div>

      <div v-if="!fillResult && !isFilling && !hasPreview && !operationError" class="text-center py-8 text-slate-500">
        <Sparkles class="w-8 h-8 mx-auto mb-2 text-blue-400 opacity-60" />
        <p class="font-medium text-xs text-slate-700">点击下方按钮或按 <kbd class="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-xs text-slate-800">Alt+Shift+F</kbd></p>
        <p class="text-xs text-slate-500 mt-1">先生成可解释预览；只有确认后才写入页面，永不自动提交或进入下一步</p>
      </div>

      <div v-if="isFilling" role="status" aria-live="polite" class="text-center py-8 text-slate-600">
        <div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p class="font-medium text-xs">正在分析页面、生成风险分级并验证执行条件...</p>
      </div>

      <div v-if="hasPreview && !fillResult" class="space-y-3">
        <div class="p-2.5 rounded-xl border bg-blue-50 border-blue-200 text-blue-800 text-xs">
          <span class="font-bold flex items-center gap-1"><Eye class="w-4 h-4" />填写预览：{{ previewFillItems.length }} 个可执行项</span>
          <span v-if="reviewRequiredItems.length" class="block mt-1 text-amber-700">其中 {{ reviewRequiredItems.length }} 项必须重点核对后再整体确认</span>
          <span v-if="previewNeedsUserItems.length" class="block mt-1 text-slate-700">另有 {{ previewNeedsUserItems.length }} 项不会自动执行，保留在人工/安全待办中</span>
          <span v-if="previewWorkflowItems.length" class="block mt-1 text-indigo-700">确认后会执行 {{ previewWorkflowItems.length }} 个重复区块流程；仅编辑/新增/保存，不会提交申请或进入下一步</span>
        </div>

        <section v-if="highConfidenceItems.length" class="space-y-1">
          <h3 class="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">高置信填写 · {{ highConfidenceItems.length }}</h3>
          <div v-for="item in highConfidenceItems" :key="item.id" class="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-slate-700 truncate">{{ item.field.label }}</span>
              <span class="text-emerald-700 truncate max-w-[110px]" :title="String(item.targetValue ?? '')">{{ item.targetValue }}</span>
            </div>
            <div class="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
              <span class="px-1.5 py-0.5 bg-white rounded border">{{ sourceLabel(item.source) }}</span>
              <span class="px-1.5 py-0.5 bg-white rounded border">{{ riskLabel(item.riskLevel) }}</span>
              <span v-if="typeof item.confidence === 'number'" class="px-1.5 py-0.5 bg-white rounded border">{{ Math.round(item.confidence * 100) }}%</span>
              <span v-if="item.semanticKey" class="truncate max-w-[190px]" :title="item.semanticKey">{{ item.semanticKey }}</span>
            </div>
          </div>
        </section>

        <section v-if="reviewRequiredItems.length" class="space-y-1">
          <h3 class="text-[11px] font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1"><ShieldAlert class="w-3.5 h-3.5" />必须重点核对 · {{ reviewRequiredItems.length }}</h3>
          <div v-for="item in reviewRequiredItems" :key="item.id" class="p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold text-slate-800 truncate">{{ item.field.label }}</span>
              <span class="text-amber-800 truncate max-w-[110px]" :title="String(item.targetValue ?? '')">{{ item.targetValue }}</span>
            </div>
            <div class="mt-1 text-[10px] text-amber-800">{{ item.reason || '高风险或置信度不足，必须人工重点核对' }}</div>
            <div class="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
              <span class="px-1.5 py-0.5 bg-white rounded border">{{ sourceLabel(item.source) }}</span>
              <span class="px-1.5 py-0.5 bg-white rounded border">{{ riskLabel(item.riskLevel) }}</span>
              <span v-if="typeof item.confidence === 'number'" class="px-1.5 py-0.5 bg-white rounded border">{{ Math.round(item.confidence * 100) }}%</span>
              <span v-if="item.source === 'ai'" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded border border-violet-200"><Bot class="w-3 h-3" />AI</span>
            </div>
          </div>
        </section>

        <section v-if="previewWorkflowItems.length" class="space-y-1">
          <h3 class="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">重复区块动作 · {{ previewWorkflowItems.length }}</h3>
          <div v-for="action in previewWorkflowItems" :key="`workflow-${action.groupKey}`" class="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-800">{{ action.summary }}</div>
        </section>

        <section v-if="manualItems.length || optionalItems.length || blockedItems.length" class="space-y-1">
          <h3 class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">人工与安全待办 · {{ previewNeedsUserItems.length }}</h3>
          <div v-for="item in manualItems" :key="item.id" class="p-2 rounded-lg bg-amber-50/60 border border-amber-100 text-xs">
            <div class="text-amber-800 font-medium">需人工：{{ item.field.label }}</div>
            <div v-if="item.reason" class="text-[10px] mt-1 text-slate-600">{{ item.reason }}</div>
          </div>
          <div v-for="item in optionalItems" :key="item.id" class="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <div class="text-slate-700 font-medium">可选未匹配：{{ item.field.label }}</div>
            <div class="text-[10px] mt-1 text-slate-500">保留供 AI 建议或手动映射，默认不会为了覆盖率自动填写</div>
          </div>
          <div v-for="item in blockedItems" :key="item.id" class="p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs">
            <div class="text-rose-700 font-bold flex items-center gap-1"><ShieldAlert class="w-3.5 h-3.5" />安全阻断：{{ item.field.label }}</div>
            <div class="text-[10px] mt-1 text-rose-600">{{ item.reason || '该控件永不进入自动执行计划' }}</div>
          </div>
        </section>

        <div v-if="aiItems.length" class="p-2 rounded-lg bg-violet-50 border border-violet-200 text-[11px] text-violet-800 flex items-start gap-1.5">
          <Bot class="w-4 h-4 flex-shrink-0" />AI 建议共 {{ aiItems.length }} 项。AI 仅参与语义候选，不直接操作网页；低置信建议不会自动执行。
        </div>
      </div>

      <div v-if="fillResult" class="space-y-2">
        <div :class="['flex items-center justify-between p-2.5 rounded-xl border text-xs', fillResult.failedCount === 0 && fillResult.filledCount > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800']">
          <span class="font-bold flex items-center gap-1"><CheckCircle class="w-4 h-4" />{{ fillResult.filledCount > 0 ? `严格验证成功 ${fillResult.filledCount} 项` : '本次没有字段通过严格验证' }}</span>
          <span class="text-slate-500">耗时 {{ fillResult.durationMs }}ms</span>
        </div>
        <div v-if="fillResult.failedCount > 0" class="p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">{{ fillResult.failedCount }} 项未通过读回验证或无法可靠处理，已进入待办。</div>

        <section v-if="consistencyBlockers.length || consistencyWarnings.length" class="space-y-1">
          <div class="text-[11px] font-bold text-slate-700 flex items-center gap-1"><ShieldAlert class="w-3.5 h-3.5 text-rose-600" />自行提交前一致性检查</div>
          <div v-for="issue in consistencyBlockers" :key="`${issue.code}-${issue.resumeKey || issue.pageLabel || issue.message}`" class="p-2 rounded-lg border border-rose-200 bg-rose-50 text-[11px] text-rose-800">
            <div class="font-bold">阻断项 · {{ issue.code }}</div>
            <div class="mt-0.5">{{ issue.message }}</div>
            <div v-if="issue.resumeKey || issue.pageLabel" class="mt-0.5 text-[10px] text-rose-600">{{ issue.pageLabel || issue.resumeKey }}<span v-if="issue.pageLabel && issue.resumeKey"> · {{ issue.resumeKey }}</span></div>
          </div>
          <div v-for="issue in consistencyWarnings" :key="`${issue.code}-${issue.resumeKey || issue.pageLabel || issue.message}`" class="p-2 rounded-lg border border-amber-200 bg-amber-50 text-[11px] text-amber-800">
            <div class="font-semibold">{{ issue.severity === 'WARNING' ? '警告项' : '提示项' }} · {{ issue.code }}</div>
            <div class="mt-0.5">{{ issue.message }}</div>
          </div>
          <p class="text-[10px] text-slate-500">这些检查只提供定位与阻断提示；OpenJobFill 不会点击提交或下一步。</p>
        </section>

        <div class="text-xs font-semibold text-slate-700 pt-1 flex items-center justify-between">
          <span>字段执行详情：</span>
          <button type="button" @click="emit('clear-badges')" class="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-0.5"><EyeOff class="w-3 h-3" />清除徽标</button>
        </div>
        <div class="max-h-56 overflow-y-auto space-y-1 pr-1">
          <div v-for="(log, idx) in fillResult.logs" :key="idx" class="p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 truncate max-w-[190px]">
                <span :class="['w-1.5 h-1.5 rounded-full flex-shrink-0', log.status === 'success' ? 'bg-emerald-500' : log.status === 'failed' ? 'bg-rose-500' : 'bg-amber-400']"></span>
                <span class="font-medium text-slate-700 truncate">{{ log.label }}</span>
              </div>
              <span class="text-slate-500 truncate max-w-[110px]" :title="log.value">{{ log.value || log.message }}</span>
            </div>
            <div v-if="log.failureCode" class="mt-1 text-[10px] text-rose-600">失败码：{{ log.failureCode }}</div>
            <div v-if="log.attempts?.length" class="mt-1 text-[10px] text-slate-500">策略：{{ log.attempts.map(a => `${a.strategy}:${a.outcome}`).join(' → ') }}</div>
          </div>
        </div>
      </div>

      <slot name="history" />
    </div>

    <footer v-if="hasPreview && !fillResult" class="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
      <button v-if="previewFillItems.length > 0 || previewWorkflowItems.length > 0" type="button" @click="emit('confirm')" :disabled="isFilling" class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition focus-visible:ring-2 focus-visible:ring-emerald-500">
        <CheckCircle class="w-3.5 h-3.5" /><span>{{ isFilling ? '正在填写...' : `已核对，确认填写 ${previewFillItems.length} 项` }}</span>
      </button>
      <button v-else type="button" @click="emit('preview-manual')" class="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"><Pipette class="w-3.5 h-3.5" />改用手动点选填写</button>
      <button type="button" @click="emit('cancel')" class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold">{{ isFilling ? '停止' : '取消' }}</button>
    </footer>

    <footer v-else class="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
      <button type="button" @click="emit('analyze')" :disabled="isFilling" class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"><Sparkles class="w-3.5 h-3.5" />{{ isFilling ? '正在识别...' : '识别并生成风险预览' }}</button>
      <button v-if="isFilling" type="button" @click="emit('cancel')" class="px-3 py-2 bg-white border border-rose-200 text-rose-700 rounded-xl font-bold">停止</button>
      <button type="button" @click="emit('manual')" class="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-1"><Pipette class="w-3.5 h-3.5" />手动</button>
      <button type="button" @click="emit('upload')" class="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-1"><Paperclip class="w-3.5 h-3.5" />附件</button>
    </footer>
  </div>
</template>
