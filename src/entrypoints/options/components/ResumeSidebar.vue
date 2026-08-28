<script setup lang="ts">
import type { StandardResume } from '@/types/resume';
import { Plus, Trash2, FileText } from 'lucide-vue-next';

defineProps<{
  resumes: StandardResume[];
  currentResumeId: string;
}>();

const emit = defineEmits<{
  (e: 'select', resume: StandardResume): void;
  (e: 'create'): void;
  (e: 'delete', id: string): void;
}>();
</script>

<template>
  <aside 
    class="w-64 bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col gap-3 h-[calc(100vh-120px)] sticky top-20 shadow-sm"
    aria-label="我的简历版本管理"
  >
    <div class="flex items-center justify-between pb-2 border-b border-slate-100">
      <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">我的简历库</span>
      <button
        type="button"
        @click="emit('create')"
        class="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition focus-visible:ring-2 focus-visible:ring-blue-500"
        title="新建一份简历"
        aria-label="新建一份简历"
      >
        <Plus class="w-4 h-4" aria-hidden="true" />
      </button>
    </div>

    <div 
      role="list"
      aria-label="简历版本列表"
      class="flex-1 overflow-y-auto space-y-2 pr-1"
    >
      <div
        v-for="r in resumes"
        :key="r.id"
        role="listitem"
        class="group relative"
      >
        <button
          type="button"
          @click="emit('select', r)"
          :aria-current="currentResumeId === r.id ? 'true' : 'false'"
          :class="[
            'w-full text-left p-3 rounded-xl cursor-pointer text-xs transition border flex flex-col gap-1 focus-visible:ring-2 focus-visible:ring-blue-500',
            currentResumeId === r.id
              ? 'bg-blue-50/80 border-blue-300 text-blue-950 shadow-xs'
              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
          ]"
        >
          <div class="flex items-center justify-between font-semibold pr-6">
            <span class="truncate">{{ r.title }}</span>
          </div>
          <div class="text-xs text-slate-500 truncate">
            {{ r.basics.name }} · {{ r.educations[0]?.schoolName || '未填学校' }}
          </div>
        </button>

        <button
          v-if="resumes.length > 1"
          type="button"
          @click.stop="emit('delete', r.id)"
          :class="[
            'absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-500'
          ]"
          :title="`删除简历: ${r.title}`"
          :aria-label="`删除简历: ${r.title}`"
        >
          <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  </aside>
</template>
