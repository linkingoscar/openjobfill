<script setup lang="ts">
import type { EducationExperience } from '@/types/resume';
import { Plus, Trash2, GraduationCap } from 'lucide-vue-next';

const props = defineProps<{
  educations: EducationExperience[];
}>();

const addEducation = () => {
  props.educations.push({
    id: 'edu-' + Date.now(),
    schoolName: '',
    degree: '本科',
    major: '',
    startDate: '',
    endDate: '',
    isFullTime: true,
  });
};

const removeEducation = (index: number) => {
  props.educations.splice(index, 1);
};
</script>

<template>
  <div class="space-y-4 font-sans text-xs">
    <div class="flex justify-between items-center">
      <h3 class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
        <GraduationCap class="w-4 h-4 text-blue-600" aria-hidden="true" />
        <span>教育经历列表 (按时间降序)</span>
      </h3>
      <button
        type="button"
        @click="addEducation"
        class="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="添加一条教育经历"
      >
        <Plus class="w-3.5 h-3.5" aria-hidden="true" />
        <span>添加教育经历</span>
      </button>
    </div>

    <div v-if="educations.length === 0" class="text-center py-8 text-slate-500 border border-dashed rounded-xl bg-slate-50">
      暂未添加教育经历，点击上方按钮新增
    </div>

    <div
      v-for="(edu, idx) in educations"
      :key="edu.id || idx"
      class="p-4 border border-slate-200 rounded-xl bg-slate-50 relative grid grid-cols-3 gap-3"
    >
      <button
        type="button"
        @click="removeEducation(idx)"
        class="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition focus-visible:ring-2 focus-visible:ring-red-500"
        :aria-label="`删除第 ${idx + 1} 条教育经历`"
        :title="`删除第 ${idx + 1} 条教育经历`"
      >
        <Trash2 class="w-4 h-4" aria-hidden="true" />
      </button>

      <div>
        <label :for="`edu-${idx}-school`" class="block font-medium text-slate-700 mb-1">学校名称</label>
        <input
          :id="`edu-${idx}-school`"
          v-model="edu.schoolName"
          type="text"
          placeholder="如：清华大学"
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label :for="`edu-${idx}-degree`" class="block font-medium text-slate-700 mb-1">学历层次</label>
        <select
          :id="`edu-${idx}-degree`"
          v-model="edu.degree"
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="专科">专科</option>
          <option value="本科">本科</option>
          <option value="硕士">硕士</option>
          <option value="博士">博士</option>
          <option value="其他">其他</option>
        </select>
      </div>

      <div>
        <label :for="`edu-${idx}-major`" class="block font-medium text-slate-700 mb-1">专业名称</label>
        <input
          :id="`edu-${idx}-major`"
          v-model="edu.major"
          type="text"
          placeholder="如：计算机科学与技术"
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label :for="`edu-${idx}-start`" class="block font-medium text-slate-700 mb-1">开始时间 (YYYY-MM)</label>
        <input
          :id="`edu-${idx}-start`"
          v-model="edu.startDate"
          placeholder="2020-09"
          type="text"
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label :for="`edu-${idx}-end`" class="block font-medium text-slate-700 mb-1">毕业时间 (YYYY-MM)</label>
        <input
          :id="`edu-${idx}-end`"
          v-model="edu.endDate"
          placeholder="2024-06"
          type="text"
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label :for="`edu-${idx}-gpa`" class="block font-medium text-slate-700 mb-1">GPA / 成绩排名</label>
        <input
          :id="`edu-${idx}-gpa`"
          v-model="edu.gpa"
          placeholder="如：3.8/4.0 或 前 5%"
          type="text"
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  </div>
</template>
