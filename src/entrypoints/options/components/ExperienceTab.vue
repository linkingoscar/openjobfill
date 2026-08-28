<script setup lang="ts">
import type { WorkExperience } from '@/types/resume';
import { Plus, Trash2, Briefcase } from 'lucide-vue-next';

const props = defineProps<{
  experiences: WorkExperience[];
}>();

const addExperience = () => {
  props.experiences.push({
    id: 'exp-' + Date.now(),
    company: '',
    title: '',
    startDate: '',
    endDate: '',
    techStack: '',
    description: '',
  });
};

const removeExperience = (index: number) => {
  props.experiences.splice(index, 1);
};
</script>

<template>
  <div class="space-y-4 font-sans text-xs">
    <div class="flex justify-between items-center">
      <h3 class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
        <Briefcase class="w-4 h-4 text-blue-600" aria-hidden="true" />
        <span>工作与实习经历</span>
      </h3>
      <button
        type="button"
        @click="addExperience"
        class="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="添加一条工作经历"
      >
        <Plus class="w-3.5 h-3.5" aria-hidden="true" />
        <span>添加工作经历</span>
      </button>
    </div>

    <div v-if="experiences.length === 0" class="text-center py-8 text-slate-500 border border-dashed rounded-xl bg-slate-50">
      暂未添加工作或实习经历，点击上方按钮新增
    </div>

    <div
      v-for="(exp, idx) in experiences"
      :key="exp.id || idx"
      class="p-4 border border-slate-200 rounded-xl bg-slate-50 relative grid grid-cols-2 gap-3"
    >
      <button
        type="button"
        @click="removeExperience(idx)"
        class="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition focus-visible:ring-2 focus-visible:ring-red-500"
        :aria-label="`删除第 ${idx + 1} 条工作经历`"
        :title="`删除第 ${idx + 1} 条工作经历`"
      >
        <Trash2 class="w-4 h-4" aria-hidden="true" />
      </button>

      <div>
        <label :for="`exp-${idx}-company`" class="block font-medium text-slate-700 mb-1">公司名称</label>
        <input
          :id="`exp-${idx}-company`"
          v-model="exp.company"
          type="text"
          placeholder="如：腾讯科技"
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label :for="`exp-${idx}-title`" class="block font-medium text-slate-700 mb-1">职位名称</label>
        <input
          :id="`exp-${idx}-title`"
          v-model="exp.title"
          type="text"
          placeholder="如：前端开发实习生"
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label :for="`exp-${idx}-start`" class="block font-medium text-slate-700 mb-1">起止时间</label>
        <div class="flex gap-2">
          <input
            :id="`exp-${idx}-start`"
            v-model="exp.startDate"
            placeholder="开始 2024-06"
            aria-label="工作开始时间"
            class="w-1/2 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            :id="`exp-${idx}-end`"
            v-model="exp.endDate"
            placeholder="结束 2025-02 或 至今"
            aria-label="工作结束时间"
            class="w-1/2 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label :for="`exp-${idx}-tech`" class="block font-medium text-slate-700 mb-1">主要技术栈</label>
        <input
          :id="`exp-${idx}-tech`"
          v-model="exp.techStack"
          placeholder="Vue 3, TypeScript, TailwindCSS 等"
          type="text"
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div class="col-span-2">
        <label :for="`exp-${idx}-desc`" class="block font-medium text-slate-700 mb-1">工作内容与成果 (支持 STAR 法则描述)</label>
        <textarea
          :id="`exp-${idx}-desc`"
          v-model="exp.description"
          rows="3"
          placeholder="描述你的核心工作产出、性能优化指标或业务赋能亮点..."
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        ></textarea>
      </div>
    </div>
  </div>
</template>
