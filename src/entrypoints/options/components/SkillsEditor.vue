<script setup lang="ts">
import type { SkillItem } from '@/types/resume';
const props = defineProps<{ skills: SkillItem[] }>();
const addSkill = () => props.skills.push({ id: crypto.randomUUID(), name: '' });
</script>

<template>
  <section aria-labelledby="skills-heading" class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
    <div class="flex justify-between items-center gap-3">
      <h3 id="skills-heading" class="font-bold text-sm text-slate-800">专业技能</h3>
      <button type="button" @click="addSkill" class="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold focus-visible:ring-2 focus-visible:ring-blue-500">添加技能</button>
    </div>
    <p class="text-slate-500">导入的技能可在这里核对、修改或删除；保存后同步用于填表、剪贴板和关键词覆盖分析。</p>
    <p v-if="!skills.length" class="text-slate-500">尚未添加技能。只填写你真实具备的技能，熟练度可留空。</p>
    <div v-for="(skill, index) in skills" :key="skill.id" class="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
      <div>
        <label :for="`skill-name-${skill.id}`" class="block mb-1 font-medium">技能名称 {{ index + 1 }}</label>
        <input :id="`skill-name-${skill.id}`" v-model="skill.name" placeholder="如：TypeScript、Excel" class="w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label :for="`skill-level-${skill.id}`" class="block mb-1 font-medium">熟练度 {{ index + 1 }}</label>
        <select :id="`skill-level-${skill.id}`" v-model="skill.level" class="w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500">
          <option :value="undefined">未填写</option>
          <option v-for="level in ['了解', '熟悉', '熟练', '精通']" :key="level" :value="level">{{ level }}</option>
        </select>
      </div>
      <button type="button" :aria-label="`删除技能 ${index + 1}：${skill.name || '未命名'}`" @click="skills.splice(index, 1)" class="px-2 py-2 text-red-600 rounded-lg focus-visible:ring-2 focus-visible:ring-red-500">删除</button>
    </div>
  </section>
</template>
