<script setup lang="ts">
import { Copy, Download, History, Trash2, Upload, Package, Play } from 'lucide-vue-next';
import type { FillHistoryRecord } from '@/types/fillHistory';

defineProps<{
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
</script>

<template>
  <section class="pt-3 mt-3 border-t border-slate-200" aria-labelledby="fill-history-title">
    <div class="flex items-center justify-between gap-2 mb-2">
      <div class="flex items-center gap-1.5 min-w-0">
        <History class="w-4 h-4 text-blue-600 flex-shrink-0" aria-hidden="true" />
        <h3 id="fill-history-title" class="text-xs font-bold text-slate-700">
          填表历史（{{ records.length }}/{{ maxRecords }}）
        </h3>
        <span class="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">已脱敏</span>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <button type="button" @click="emit('copy')" :disabled="records.length === 0" class="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500" title="复制脱敏诊断信息" aria-label="复制脱敏诊断信息">
          <Copy class="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button type="button" @click="emit('export')" :disabled="records.length === 0" class="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500" title="导出脱敏诊断 JSON" aria-label="导出脱敏诊断 JSON">
          <Download class="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button type="button" @click="emit('replay-export')" class="p-1.5 rounded-md text-slate-500 hover:text-violet-600 hover:bg-violet-50 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-violet-500" title="导出运行回放问题包" aria-label="导出运行回放问题包">
          <Package class="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button type="button" @click="emit('replay-import')" class="p-1.5 rounded-md text-slate-500 hover:text-violet-600 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500" title="导入运行回放问题包" aria-label="导入运行回放问题包">
          <Upload class="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button type="button" @click="emit('replay-run')" class="p-1.5 rounded-md text-slate-500 hover:text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500" title="离线回放最近运行（不写网页）" aria-label="离线回放最近运行（不写网页）">
          <Play class="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button type="button" @click="emit('clear')" :disabled="records.length === 0" class="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-rose-500" title="清空填表历史" aria-label="清空填表历史">
          <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>

    <p v-if="feedback" role="status" aria-live="polite" class="text-xs text-violet-700 bg-violet-50 rounded p-2 mb-2">{{ feedback }}</p>
    <p class="text-[10px] text-slate-400 mb-2 leading-relaxed">
      不保存字段实际填写值；错误文本中的联系方式、证件号和期望/实际值会自动隐藏。
    </p>

    <div v-if="loading" role="status" class="text-center py-3 text-xs text-slate-400">正在读取历史记录…</div>
    <div v-else-if="records.length === 0" class="text-center py-3 text-xs text-slate-400 bg-slate-50 rounded-lg">
      完成一次自动填写后，诊断记录会保存在这里
    </div>
    <div v-else class="space-y-1.5 max-h-64 overflow-y-auto pr-1">
      <details v-for="record in records" :key="record.id" class="group rounded-lg border border-slate-200 bg-white overflow-hidden">
        <summary class="cursor-pointer list-none p-2 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-xs font-semibold text-slate-700 truncate" :title="record.pageTitle || record.hostname">
                {{ record.pageTitle || record.hostname || '未知页面' }}
              </div>
              <div class="text-[10px] text-slate-400 truncate mt-0.5" :title="record.pageUrl">
                {{ formatTime(record.createdAt) }} · {{ record.hostname || '本地页面' }}
              </div>
            </div>
            <div class="flex gap-1 text-[10px] font-bold flex-shrink-0">
              <span class="text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">成功 {{ record.filledCount }}</span>
              <span v-if="record.failedCount" class="text-rose-700 bg-rose-50 rounded px-1.5 py-0.5">失败 {{ record.failedCount }}</span>
            </div>
          </div>
        </summary>
        <div class="border-t border-slate-100 p-2 bg-slate-50/60 space-y-1">
          <div class="text-[10px] text-slate-500 flex justify-between gap-2">
            <span class="truncate">引擎：{{ record.adapterName }} · {{ record.phase === 'analysis' ? '页面分析' : '填写执行' }}</span>
            <span class="flex-shrink-0">{{ record.durationMs }}ms</span>
          </div>
          <p v-if="record.operationError" class="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 rounded px-2 py-1 break-words">{{ record.operationError }}</p>
          <div v-for="(field, fieldIndex) in record.fields" :key="`${record.id}-${fieldIndex}`" class="text-[10px] rounded bg-white border border-slate-100 px-2 py-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-slate-700 font-medium truncate">{{ field.label }}</span>
              <span :class="['font-bold flex-shrink-0', field.status === 'success' ? 'text-emerald-600' : field.status === 'failed' ? 'text-rose-600' : 'text-amber-600']">
                {{ field.status === 'success' ? '成功' : field.status === 'failed' ? '失败' : '跳过' }}
              </span>
            </div>
            <p v-if="field.message" class="text-slate-400 mt-0.5 break-words">{{ field.message }}</p>
          </div>
        </div>
      </details>
    </div>
  </section>
</template>
