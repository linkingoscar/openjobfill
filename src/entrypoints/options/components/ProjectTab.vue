<script setup lang="ts">
import type { ProjectExperience } from '@/types/resume';
import { Plus, Trash2, FolderGit2 } from 'lucide-vue-next';

const props = defineProps<{
  projects: ProjectExperience[];
}>();

const addProject = () => {
  props.projects.push({
    id: 'proj-' + Date.now(),
    projectName: '',
    role: '',
    startDate: '',
    endDate: '',
    description: '',
    responsibility: '',
    techStack: '',
  });
};

const removeProject = (index: number) => {
  props.projects.splice(index, 1);
};
</script>

<template>
  <div class="space-y-4 font-sans text-xs">
    <div class="flex justify-between items-center">
      <h3 class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
        <FolderGit2 class="w-4 h-4 text-blue-600" aria-hidden="true" />
        <span>项目经历</span>
      </h3>
      <button
        type="button"
        @click="addProject"
        class="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="添加一条项目经历"
      >
        <Plus class="w-3.5 h-3.5" aria-hidden="true" />
        <span>添加项目经历</span>
      </button>
    </div>

    <div v-if="projects.length === 0" class="text-center py-8 text-slate-500 border border-dashed rounded-xl bg-slate-50">
      暂未添加项目经历，点击上方按钮新增
    </div>

    <div
      v-for="(proj, idx) in projects"
      :key="proj.id || idx"
      class="p-4 border border-slate-200 rounded-xl bg-slate-50 relative grid grid-cols-2 gap-3"
    >
      <button
        type="button"
        @click="removeProject(idx)"
        class="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition focus-visible:ring-2 focus-visible:ring-red-500"
        :aria-label="`删除第 ${idx + 1} 条项目经历`"
        :title="`删除第 ${idx + 1} 条项目经历`"
      >
        <Trash2 class="w-4 h-4" aria-hidden="true" />
      </button>

      <div>
        <label :for="`proj-${idx}-name`" class="block font-medium text-slate-700 mb-1">项目名称</label>
        <input
          :id="`proj-${idx}-name`"
          v-model="proj.projectName"
          type="text"
          placeholder="如：开源求职填表插件"
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label :for="`proj-${idx}-role`" class="block font-medium text-slate-700 mb-1">担任角色</label>
        <input
          :id="`proj-${idx}-role`"
          v-model="proj.role"
          type="text"
          placeholder="如：核心开发者 / 架构师"
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div class="col-span-2">
        <label :for="`proj-${idx}-desc`" class="block font-medium text-slate-700 mb-1">项目描述与个人职责</label>
        <textarea
          :id="`proj-${idx}-desc`"
          v-model="proj.description"
          rows="3"
          placeholder="简述项目背景、核心解决的技术难题、个人具体贡献以及量化收益..."
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        ></textarea>
      </div>
    </div>
  </div>
</template>
