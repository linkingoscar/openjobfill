<script setup lang="ts">
import { computed } from 'vue';
import { Activity, AlertCircle, AlertTriangle, User, GraduationCap, Briefcase, FolderGit2, Trophy } from 'lucide-vue-next';
import type { StandardResume } from '@/types/resume';
import { assessResumeImport } from '@/core/importers/resumeImportQuality';

const props = defineProps<{ parsedResume: StandardResume }>();
const emit = defineEmits<{ (event: 'reset'): void }>();
const healthReport = computed(() => assessResumeImport(props.parsedResume));
</script>

<template>
        <!-- Parsed Result Preview & Health Check -->
        <div v-if="parsedResume && healthReport" class="space-y-4 animate-fade-in">
          <!-- Health Check Diagnostic Banner -->
          <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Activity class="w-4 h-4 text-blue-600" />
                <span class="font-bold text-slate-900 text-xs">简历解析体检报告</span>
                <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px]">
                  已识别 {{ healthReport.identifiedCount }} 项字段
                </span>
              </div>
              <button
                type="button"
                @click="emit('reset')"
                class="text-xs text-slate-500 hover:text-slate-900 underline font-medium focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              >
                重新上传
              </button>
            </div>

            <!-- Missing High-frequency Items -->
            <div v-if="healthReport.missingItems.length > 0" class="space-y-1.5">
              <div class="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <AlertCircle class="w-3.5 h-3.5 text-amber-500" />
                <span>建议在网申前补全的高频缺失项 ({{ healthReport.missingItems.length }} 项):</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="item in healthReport.missingItems"
                  :key="item"
                  class="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-lg text-[11px] font-medium"
                >
                  ○ {{ item }}
                </span>
              </div>
            </div>

            <!-- Warnings -->
            <div v-if="healthReport.warnings.length > 0" class="space-y-1">
              <div class="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <AlertTriangle class="w-3.5 h-3.5 text-amber-600" />
                <span>建议核对项:</span>
              </div>
              <ul class="text-[11px] text-slate-500 list-disc list-inside space-y-0.5">
                <li v-for="(warn, i) in healthReport.warnings" :key="i">{{ warn }}</li>
              </ul>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 text-xs">
            <!-- Basic Info Card -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h3 class="font-bold text-slate-800 flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                <User class="w-4 h-4 text-blue-600" aria-hidden="true" /> 基本信息
              </h3>
              <div class="grid grid-cols-2 gap-2 text-slate-700">
                <div><span class="text-slate-500">姓名:</span> {{ parsedResume.basics.name || '未提取到' }}</div>
                <div><span class="text-slate-500">性别:</span> {{ parsedResume.basics.gender }}</div>
                <div><span class="text-slate-500">电话:</span> {{ parsedResume.basics.phone || '未提取到' }}</div>
                <div><span class="text-slate-500">邮箱:</span> {{ parsedResume.basics.email || '未提取到' }}</div>
                <div><span class="text-slate-500">生日:</span> {{ parsedResume.basics.birthDate || '未提取到' }}</div>
                <div><span class="text-slate-500">政治面貌:</span> {{ parsedResume.basics.politicalStatus }}</div>
                <div><span class="text-slate-500">出生地:</span> {{ parsedResume.basics.birthPlace?.detail || parsedResume.basics.birthPlace?.city || '未提取到' }}</div>
                <div class="col-span-2"><span class="text-slate-500">求职意向:</span> {{ parsedResume.basics.expectedRole || '未提取到' }}</div>
              </div>
            </div>

            <!-- Education Summary Card -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h3 class="font-bold text-slate-800 flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                <GraduationCap class="w-4 h-4 text-indigo-600" aria-hidden="true" /> 教育背景 ({{ parsedResume.educations.length }} 条)
              </h3>
              <div v-if="parsedResume.educations.length === 0" class="text-slate-500 italic">未识别到教育经历</div>
              <div v-for="(edu, idx) in parsedResume.educations" :key="idx" class="text-slate-700">
                <span class="font-semibold text-slate-900">{{ edu.schoolName }}</span> · {{ edu.degree }} · {{ edu.major }}
                <div class="text-xs text-slate-500">{{ edu.startDate }} ~ {{ edu.endDate }}</div>
              </div>
            </div>

            <!-- Work Experience Summary Card -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h3 class="font-bold text-slate-800 flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                <Briefcase class="w-4 h-4 text-blue-600" aria-hidden="true" /> 工作与实习 ({{ parsedResume.experiences.length }} 条)
              </h3>
              <div v-if="parsedResume.experiences.length === 0" class="text-slate-500 italic">未识别到工作经历</div>
              <div v-for="(exp, idx) in parsedResume.experiences" :key="idx" class="text-slate-700 truncate">
                <span class="font-semibold text-slate-900">{{ exp.company }}</span> - {{ exp.title }}
                <div class="text-xs text-slate-500">{{ exp.startDate }} ~ {{ exp.endDate }}</div>
              </div>
            </div>

            <!-- Project Experience Summary Card -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h3 class="font-bold text-slate-800 flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                <FolderGit2 class="w-4 h-4 text-amber-600" aria-hidden="true" /> 项目经历 ({{ parsedResume.projects.length }} 条)
              </h3>
              <div v-if="parsedResume.projects.length === 0" class="text-slate-500 italic">未识别到项目经历</div>
              <div v-for="(proj, idx) in parsedResume.projects" :key="idx" class="text-slate-700 truncate">
                <span class="font-semibold text-slate-900">{{ proj.projectName }}</span> ({{ proj.role }})
              </div>
            </div>

            <div class="col-span-2 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h3 class="font-bold text-slate-800 flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                <Trophy class="w-4 h-4 text-orange-600" aria-hidden="true" /> 校招扩展信息
              </h3>
              <div class="grid grid-cols-4 gap-2 text-slate-700">
                <div>家庭成员：<b>{{ parsedResume.familyMembers?.length || 0 }}</b> 条</div>
                <div>语言成绩：<b>{{ parsedResume.languages?.length || 0 }}</b> 条</div>
                <div>证书：<b>{{ parsedResume.certificates?.length || 0 }}</b> 条</div>
                <div>获奖荣誉：<b>{{ parsedResume.awards?.length || 0 }}</b> 条</div>
                <div>学术成果：<b>{{ parsedResume.academicAchievements?.length || 0 }}</b> 条</div>
                <div>学生干部：<b>{{ parsedResume.campusExperiences?.length || 0 }}</b> 条</div>
                <div class="col-span-2 truncate">兴趣爱好：{{ parsedResume.basics.hobbies || '未提取到' }}</div>
              </div>
            </div>
          </div>
        </div>
</template>
