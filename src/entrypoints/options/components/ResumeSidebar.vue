<script setup lang="ts">
import type { StandardResume } from '@/types/resume';
import { Plus, Trash2 } from 'lucide-vue-next';
import { resumeStorage } from '@/core/storage/resumeStorage';

const props = defineProps<{
  resumes: StandardResume[];
  currentResumeId: string;
}>();

const emit = defineEmits<{
  (e: 'select', resume: StandardResume): void;
  (e: 'create'): void;
  (e: 'delete', id: string): void;
}>();

async function handleSelect(resume: StandardResume) {
  try {
    // The sidebar list intentionally keeps raw persistence records for management,
    // but the editor must always receive the resolved view so job variants inherit
    // the latest non-overridden facts and trust metadata from their master.
    emit('select', await resumeStorage.getResumeForFill(resume.id));
  } catch {
    emit('select', resume);
  }
}

function variantType(resume: StandardResume): 'master' | 'job-variant' {
  return (resume as StandardResume & { variantType?: 'master' | 'job-variant' }).variantType === 'job-variant'
    ? 'job-variant'
    : 'master';
}
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
        title="新建一份主档案"
        aria-label="新建一份主档案"
      >
        <Plus class="w-4 h-4" aria-hidden="true" />
      </button>
    </div>

    <div role="list" aria-label="简历版本列表" class="flex-1 overflow-y-auto space-y-2 pr-1">
      <div v-for="r in props.resumes" :key="r.id" role="listitem" class="group relative">
        <button
          type="button"
          @click="handleSelect(r)"
          :aria-current="currentResumeId === r.id ? 'true' : 'false'"
          :class="[
            'w-full text-left p-3 rounded-xl cursor-pointer text-xs transition border flex flex-col gap-1 focus-visible:ring-2 focus-visible:ring-blue-500',
            currentResumeId === r.id
              ? 'bg-blue-50/80 border-blue-300 text-blue-950 shadow-xs'
              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
          ]"
        >
          <div class="flex items-center justify-between gap-1 font-semibold pr-6">
            <span class="truncate">{{ r.title }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span
              :class="[
                'px-1.5 py-0.5 rounded border text-[9px] font-bold',
                variantType(r) === 'job-variant'
                  ? 'bg-violet-50 border-violet-200 text-violet-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              ]"
            >
              {{ variantType(r) === 'job-variant' ? '岗位版本' : '主档案' }}
            </span>
            <span class="text-[10px] text-slate-500 truncate">
              {{ r.basics.name || '姓名未填' }} · {{ r.educations[0]?.schoolName || '未填学校' }}
            </span>
          </div>
        </button>

        <button
          v-if="resumes.length > 1"
          type="button"
          @click.stop="emit('delete', r.id)"
          class="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-500"
          :title="`删除简历: ${r.title}`"
          :aria-label="`删除简历: ${r.title}`"
        >
          <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  </aside>
</template>
