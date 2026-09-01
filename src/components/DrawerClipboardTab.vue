<script setup lang="ts">
import { Check, Copy, ExternalLink, Search } from 'lucide-vue-next';
import type { ClipboardItem } from '@/types/floatingBall';

defineProps<{
  items: ClipboardItem[];
  searchQuery: string;
  copiedFieldKey: string | null;
  copyToastMessage: string;
}>();

const emit = defineEmits<{
  (event: 'update:searchQuery', value: string): void;
  (event: 'copy-field', item: ClipboardItem): void;
  (event: 'open-options'): void;
}>();

const handleSearchInput = (event: Event) => {
  emit('update:searchQuery', (event.target as HTMLInputElement).value);
};
</script>

<template>
  <div id="drawer-panel-clipboard" role="tabpanel" aria-labelledby="drawer-tab-clipboard" class="flex-1 flex flex-col min-h-0 overflow-hidden">
    <div class="p-3 border-b border-slate-100 bg-slate-50">
      <div class="relative flex items-center">
        <Search class="w-3.5 h-3.5 absolute left-2.5 text-slate-400" aria-hidden="true" />
        <input
          :value="searchQuery"
          @input="handleSearchInput"
          type="text"
          aria-label="搜索简历字段"
          placeholder="搜索字段 (如: 姓名, 电话, GPA, 问答, 自我评价)..."
          class="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>

    <div v-if="copyToastMessage" role="status" aria-live="polite" class="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold text-center animate-fade-in flex items-center justify-center gap-1">
      <Check class="w-3.5 h-3.5" aria-hidden="true" />
      <span>{{ copyToastMessage }}</span>
    </div>

    <div class="p-3 flex-1 overflow-y-auto space-y-2">
      <div v-if="items.length === 0" class="text-center py-8 text-slate-500 text-xs">没有找到匹配的简历字段</div>
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        @click="emit('copy-field', item)"
        class="w-full text-left p-2.5 bg-slate-50 hover:bg-blue-50/80 border border-slate-100 hover:border-blue-200 rounded-xl cursor-pointer transition flex items-center justify-between group focus-visible:ring-2 focus-visible:ring-blue-500"
        :title="`点击复制【${item.label}】(若输入框聚焦则自动填入)`"
        :aria-label="`复制 ${item.category} ${item.label}: ${item.value}`"
      >
        <div class="min-w-0 flex-1 pr-2">
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-slate-500 font-medium px-1.5 py-0.5 bg-white border border-slate-200 rounded">{{ item.category }}</span>
            <span class="font-bold text-slate-800 text-xs">{{ item.label }}</span>
          </div>
          <div class="text-xs text-slate-600 truncate mt-0.5">{{ item.value }}</div>
        </div>
        <div class="w-6 h-6 rounded-lg bg-white border border-slate-200 group-hover:border-blue-300 group-hover:text-blue-600 flex items-center justify-center text-slate-400 shadow-xs flex-shrink-0">
          <Check v-if="copiedFieldKey === item.id" class="w-3.5 h-3.5 text-emerald-600 animate-scale" aria-hidden="true" />
          <Copy v-else class="w-3.5 h-3.5" aria-hidden="true" />
        </div>
      </button>
    </div>

    <footer class="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
      <span>💡 点击任意字段直接复制或点填</span>
      <button type="button" @click="emit('open-options')" class="text-blue-600 font-semibold hover:underline flex items-center gap-0.5 focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
        <span>编辑简历</span>
        <ExternalLink class="w-3 h-3" aria-hidden="true" />
      </button>
    </footer>
  </div>
</template>
