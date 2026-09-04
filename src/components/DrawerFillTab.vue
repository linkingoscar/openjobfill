<script setup lang="ts">
import { AlertTriangle, Sparkles, Eye, CheckCircle, EyeOff, Pipette, Paperclip } from 'lucide-vue-next';
import type { FillResult } from '@/types/adapter';
defineProps<{
  currentAdapterName: string;
  operationError: string;
  isFilling: boolean;
  hasPreview: boolean;
  fillResult: FillResult | null;
  aiFeedback?: string;
  previewFillItems: Array<{ id: string; field: { label: string }; targetValue?: unknown; reason?: string }>;
  previewNeedsUserItems: Array<{ id: string; field: { label: string } }>;
  previewWorkflowItems: Array<{ groupKey: string; summary: string }>;
}>();
const emit = defineEmits<{
  (event: 'clear-badges' | 'confirm' | 'preview-manual' | 'analyze' | 'manual' | 'upload' | 'cancel'): void;
}>();
</script>

<template>
        <!-- TAB 1: 填表日志与徽标 -->
        <div 
          id="drawer-panel-logs"
          role="tabpanel"
          aria-labelledby="drawer-tab-logs"
          class="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div class="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>当前适配引擎:</span>
            <span class="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 truncate max-w-[170px]">
              {{ currentAdapterName }}
            </span>
          </div>

          <div class="p-4 flex-1 overflow-y-auto space-y-3">
            <p v-if="aiFeedback && !isFilling" role="status" class="p-3 rounded-xl bg-violet-50 border border-violet-200 text-xs text-violet-900">{{ aiFeedback }}</p>
            <div
              v-if="operationError && !isFilling"
              role="alert"
              class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs"
            >
              <div class="font-bold flex items-center gap-1.5">
                <AlertTriangle class="w-4 h-4" aria-hidden="true" />
                本次操作没有完成
              </div>
              <p class="mt-1 leading-relaxed">{{ operationError }}</p>
            </div>

            <div v-if="!fillResult && !isFilling && !hasPreview && !operationError" class="text-center py-8 text-slate-500">
              <Sparkles class="w-8 h-8 mx-auto mb-2 text-blue-400 opacity-60" aria-hidden="true" />
              <p class="font-medium text-xs text-slate-700">点击下方按钮或按 <kbd class="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-xs text-slate-800">Alt+Shift+F</kbd></p>
              <p class="text-xs text-slate-500 mt-1">先智能识别生成预览，核对无误后一键确认填写</p>
            </div>

            <div v-if="isFilling" role="status" aria-live="polite" class="text-center py-8 text-slate-600">
              <div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p class="font-medium text-xs">正在分析页面结构并注入行内徽标...</p>
            </div>

            <!-- Preview Plan (填前预览确认：先识别展示，确认后才写入) -->
            <div v-if="hasPreview && !fillResult" class="space-y-2">
              <div
                :class="[
                  'p-2.5 rounded-xl border text-xs',
                  previewFillItems.length > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                ]"
              >
                <span class="font-bold flex items-center gap-1">
                  <Eye class="w-4 h-4 text-blue-600" aria-hidden="true" />
                  {{ previewFillItems.length > 0
                    ? `已识别 ${previewFillItems.length} 个字段，请核对后确认填写`
                    : '当前页面没有可自动填写的字段' }}
                </span>
                <span v-if="previewNeedsUserItems.length > 0" class="block mt-0.5 text-amber-700">
                  另有 {{ previewNeedsUserItems.length }} 项需要你手动补充
                </span>
                <span v-if="previewWorkflowItems.length > 0" class="block mt-1 text-indigo-700">
                  确认后还会执行 {{ previewWorkflowItems.length }} 个重复区块流程；只允许编辑、保存和新增，不会提交申请或进入下一步
                </span>
              </div>

              <div class="max-h-56 overflow-y-auto space-y-1 pr-1">
                <div
                  v-for="item in previewFillItems"
                  :key="item.id"
                  class="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100 flex items-center justify-between text-xs"
                >
                  <span class="font-medium text-slate-700 truncate">{{ item.field.label }}<small v-if="item.reason === 'AI 匹配'" class="ml-1 text-violet-700">AI 建议</small></span>
                  <span class="text-emerald-700 truncate max-w-[110px]" :title="String(item.targetValue ?? '')">
                    {{ item.targetValue }}
                  </span>
                </div>
                <div
                  v-for="action in previewWorkflowItems"
                  :key="`workflow-${action.groupKey}`"
                  class="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-800"
                >
                  <span class="font-medium">{{ action.summary }}</span>
                </div>
                <div
                  v-for="item in previewNeedsUserItems"
                  :key="item.id"
                  class="p-2 rounded-lg bg-amber-50/60 border border-amber-100 flex items-center text-xs"
                >
                  <span class="text-amber-700 truncate">需手动：{{ item.field.label }}</span>
                </div>
              </div>
            </div>

            <!-- Result Logs -->
            <div v-if="fillResult" class="space-y-2">
              <div
                :class="[
                  'flex items-center justify-between p-2.5 rounded-xl border text-xs',
                  fillResult.filledCount > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                ]"
              >
                <span class="font-bold flex items-center gap-1">
                  <CheckCircle class="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  {{ fillResult.filledCount > 0
                    ? `成功填入 ${fillResult.filledCount} 项（已高亮）`
                    : '本次没有字段填写成功' }}
                </span>
                <span class="text-slate-500">耗时 {{ fillResult.durationMs }}ms</span>
              </div>

              <div class="text-xs font-semibold text-slate-700 pt-1 flex items-center justify-between">
                <span>字段填入详情：</span>
                <button
                  type="button"
                  @click="emit('clear-badges')"
                  class="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
                >
                  <EyeOff class="w-3 h-3" />
                  <span>清除徽标</span>
                </button>
              </div>

              <div class="max-h-56 overflow-y-auto space-y-1 pr-1">
                <div
                  v-for="(log, idx) in fillResult.logs"
                  :key="idx"
                  class="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                >
                  <div class="flex items-center gap-1.5 truncate max-w-[190px]">
                    <span
                      :class="[
                        'w-1.5 h-1.5 rounded-full flex-shrink-0',
                        log.status === 'success' ? 'bg-emerald-500' : 'bg-amber-400'
                      ]"
                    ></span>
                    <span class="font-medium text-slate-700 truncate">{{ log.label }}</span>
                  </div>
                  <span class="text-slate-500 truncate max-w-[110px]" :title="log.value">
                    {{ log.value || log.message }}
                  </span>
                </div>
              </div>
            </div>

            <slot name="history" />
          </div>

          <!-- Footer Action Button：预览确认态 -->
          <footer v-if="hasPreview && !fillResult" class="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
            <button
              v-if="previewFillItems.length > 0 || previewWorkflowItems.length > 0"
              type="button"
              @click="emit('confirm')"
              :disabled="isFilling"
              class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <CheckCircle class="w-3.5 h-3.5" aria-hidden="true" />
              <span>{{ isFilling ? '正在填写...' : `确认填写 ${previewFillItems.length} 项${previewWorkflowItems.length ? '并执行区块流程' : ''}` }}</span>
            </button>
            <button
              v-else
              type="button"
              @click="emit('preview-manual')"
              class="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <Pipette class="w-3.5 h-3.5" aria-hidden="true" />
              <span>改用手动点选填写</span>
            </button>
            <button
              type="button"
              @click="emit('cancel')"
              class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {{ isFilling ? '停止' : '取消' }}
            </button>
          </footer>

          <!-- Footer Action Button：初始态 -->
          <footer v-else class="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
            <button
              type="button"
              @click="emit('analyze')"
              :disabled="isFilling"
              class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Sparkles class="w-3.5 h-3.5" aria-hidden="true" />
              <span>{{ isFilling ? '正在识别...' : '一键识别并预览填写 (Alt+Shift+F)' }}</span>
            </button>
            <button
              v-if="isFilling"
              type="button"
              @click="emit('cancel')"
              class="px-3 py-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 rounded-xl font-bold transition active:scale-95 focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              停止
            </button>
            <button
              type="button"
              @click="emit('manual')"
              title="点选手动填充：点击网页上的输入框，从简历字段中选一个填入（自动填充漏填/填错时补救）"
              class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Pipette class="w-3.5 h-3.5" aria-hidden="true" />
              <span>手动</span>
            </button>
            <button
              type="button"
              @click="emit('upload')"
              title="选择本地 PDF/Word 简历，并注入当前网页的简历附件上传区"
              class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Paperclip class="w-3.5 h-3.5" aria-hidden="true" />
              <span>附件</span>
            </button>
          </footer>
        </div>
</template>
