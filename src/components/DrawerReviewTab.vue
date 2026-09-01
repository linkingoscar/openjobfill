<script setup lang="ts">
import { AlertTriangle, CheckCircle } from 'lucide-vue-next';
import type { FillResult } from '@/types/adapter';

interface BindingOption { label: string; value: string }
interface BindingGroup { group: string; options: BindingOption[] }

defineProps<{
  fillResult: FillResult | null;
  activeTaskMappingId: string | null;
  selectedMappingKey: string;
  availableBindingFields: BindingGroup[];
}>();

const emit = defineEmits<{
  (event: 'focus-task', task: NonNullable<FillResult['remainingTasks']>[number]): void;
  (event: 'toggle-mapping', task: NonNullable<FillResult['remainingTasks']>[number]): void;
  (event: 'save-mapping', task: NonNullable<FillResult['remainingTasks']>[number]): void;
  (event: 'update:selectedMappingKey', value: string): void;
}>();

const handleSelectionChange = (event: Event) => {
  emit('update:selectedMappingKey', (event.target as HTMLSelectElement).value);
};
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
            <button v-if="task.element" type="button" @click="emit('focus-task', task)" class="px-2 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-[11px] font-bold transition shadow-xs" title="在网页中滚动并高亮定位此输入框">定位</button>
            <button v-if="task.element" type="button" @click="emit('toggle-mapping', task)" class="px-2 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-[11px] font-bold transition shadow-xs" title="将此未识别字段永久绑定到简历属性">记住映射</button>
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
