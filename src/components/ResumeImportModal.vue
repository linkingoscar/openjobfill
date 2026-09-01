<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { extractTextFromFile } from '@/core/parser/textExtractor';
import { importResumeText } from '@/core/importers/jsonResumeImporter';
import type { StandardResume } from '@/types/resume';
import { 
  UploadCloud, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowRight,
  User,
  GraduationCap,
  Briefcase,
  FolderGit2,
  Trophy,
  Activity,
  AlertTriangle,
  HelpCircle
} from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'import', resume: StandardResume): void;
}>();

const mode = ref<'upload' | 'paste'>('upload');
const isParsing = ref(false);
const rawText = ref('');
const fileName = ref('');
const parsedResume = ref<StandardResume | null>(null);
const errorMessage = ref('');

const healthReport = computed(() => {
  if (!parsedResume.value) return null;
  const r = parsedResume.value;
  
  let identifiedCount = 0;
  if (r.basics.name) identifiedCount++;
  if (r.basics.phone) identifiedCount++;
  if (r.basics.email) identifiedCount++;
  if (r.basics.gender) identifiedCount++;
  if (r.basics.birthDate) identifiedCount++;
  if (r.basics.politicalStatus) identifiedCount++;
  if (r.basics.expectedRole) identifiedCount++;
  if (r.basics.currentLocation?.city) identifiedCount++;
  if (r.basics.nativePlace?.city) identifiedCount++;
  if (r.basics.birthPlace?.city) identifiedCount++;
  if (r.basics.hobbies) identifiedCount++;
  if (r.basics.selfEvaluation) identifiedCount++;
  identifiedCount += (r.educations?.length || 0) * 3;
  identifiedCount += (r.experiences?.length || 0) * 3;
  identifiedCount += (r.projects?.length || 0) * 2;
  identifiedCount += (r.skills?.length || 0);
  identifiedCount += (r.languages?.length || 0) * 2;
  identifiedCount += (r.certificates?.length || 0);
  identifiedCount += (r.familyMembers?.length || 0) * 3;
  identifiedCount += (r.awards?.length || 0) * 2;
  identifiedCount += (r.academicAchievements?.length || 0) * 2;
  identifiedCount += (r.campusExperiences?.length || 0) * 2;

  const missingItems: string[] = [];
  if (!r.basics.gender) missingItems.push('性别');
  if (!r.basics.nativePlace?.city && !r.basics.nativePlace?.province) missingItems.push('籍贯 / 生源地');
  if (!r.basics.hukouLocation?.city && !r.basics.hukouLocation?.province) missingItems.push('户口所在地');
  if (!r.basics.availableTime) missingItems.push('到岗时间');
  if (!r.basics.maritalStatus) missingItems.push('婚姻状况');
  if (!r.basics.height) missingItems.push('身高');
  if (!r.basics.expectedSalaryMin) missingItems.push('期望薪资');
  if ((!r.certificates || r.certificates.length === 0) && (!r.languages || r.languages.length === 0)) missingItems.push('CET-4/6 英语成绩或证书');
  if (!r.basics.idCardNumber) missingItems.push('身份证号');

  const warnings: string[] = [];
  r.educations?.forEach((edu, i) => {
    if (!edu.endDate) warnings.push(`第 ${i + 1} 段教育缺少毕业年月`);
    if (!edu.major) warnings.push(`第 ${i + 1} 段教育缺少专业`);
  });
  r.experiences?.forEach((exp, i) => {
    if (!exp.startDate || !exp.endDate) warnings.push(`第 ${i + 1} 段经历起止时间不完整`);
  });

  return {
    identifiedCount,
    missingItems,
    warnings,
  };
});

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close');
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  await processFile(file);
};

const handleDrop = async (event: DragEvent) => {
  event.preventDefault();
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0];
    await processFile(file);
  }
};

const processFile = async (file: File) => {
  isParsing.value = true;
  errorMessage.value = '';
  fileName.value = file.name;
  parsedResume.value = null;

  try {
    const text = await extractTextFromFile(file);
    rawText.value = text;
    if (!text || text.trim().length === 0) {
      throw new Error('未能在文件中提取到有效文本，请确认该 PDF 不是纯图片扫描件');
    }
    const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
    parsedResume.value = importResumeText(text, cleanTitle);
  } catch (err: any) {
    errorMessage.value = err?.message || '文件解析失败，请检查文件格式';
  } finally {
    isParsing.value = false;
  }
};

const handleParsePastedText = () => {
  if (!rawText.value.trim()) {
    errorMessage.value = '请先粘贴简历文本内容';
    return;
  }
  isParsing.value = true;
  errorMessage.value = '';
  try {
    parsedResume.value = importResumeText(rawText.value, '粘贴文本导入简历');
  } catch (err: any) {
    errorMessage.value = err?.message || '文本解析异常';
  } finally {
    isParsing.value = false;
  }
};

const handleConfirmImport = () => {
  if (!parsedResume.value) return;
  const cleanData = JSON.parse(JSON.stringify(parsedResume.value));
  emit('import', cleanData);
};
</script>

<template>
  <div 
    role="dialog"
    aria-modal="true"
    aria-labelledby="import-modal-title"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in font-sans"
  >
    <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800">
      <!-- Modal Header -->
      <header class="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Sparkles class="w-4 h-4 fill-white" aria-hidden="true" />
          </div>
          <div>
            <h2 id="import-modal-title" class="text-base font-bold leading-tight">智能简历解析导入</h2>
            <p class="text-xs text-blue-100">支持 PDF / Word / Markdown / JSON Resume，100% 浏览器纯本地解析</p>
          </div>
        </div>
        <button 
          type="button"
          @click="emit('close')" 
          class="p-1.5 rounded-lg hover:bg-white/20 transition focus-visible:ring-2 focus-visible:ring-white"
          aria-label="关闭导入窗口"
        >
          <X class="w-5 h-5" aria-hidden="true" />
        </button>
      </header>

      <!-- Main Body -->
      <div class="p-6 flex-1 overflow-y-auto space-y-6">
        <!-- Switch Mode Tabs -->
        <div 
          role="tablist" 
          aria-label="导入方式选择" 
          class="flex items-center gap-2 border-b border-slate-100 pb-3"
        >
          <button
            id="tab-import-upload"
            role="tab"
            type="button"
            :aria-selected="mode === 'upload'"
            aria-controls="panel-import-upload"
            @click="mode = 'upload'"
            :class="[
              'px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500',
              mode === 'upload' ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            ]"
          >
            <UploadCloud class="w-4 h-4" aria-hidden="true" />
            <span>上传文件 (PDF / DOCX)</span>
          </button>
          <button
            id="tab-import-paste"
            role="tab"
            type="button"
            :aria-selected="mode === 'paste'"
            aria-controls="panel-import-paste"
            @click="mode = 'paste'"
            :class="[
              'px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500',
              mode === 'paste' ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            ]"
          >
            <FileText class="w-4 h-4" aria-hidden="true" />
            <span>直接粘贴文本</span>
          </button>
        </div>

        <!-- Mode 1: File Upload Area -->
        <div 
          id="panel-import-upload"
          role="tabpanel"
          aria-labelledby="tab-import-upload"
          v-if="mode === 'upload' && !parsedResume" 
          class="space-y-4"
        >
          <div
            @dragover.prevent
            @drop="handleDrop"
            class="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 rounded-2xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 relative focus-within:ring-2 focus-within:ring-blue-500"
          >
            <input
              id="resume-file-input"
              type="file"
              accept=".pdf,.docx,.txt,.md,.json,application/json"
              @change="handleFileUpload"
              aria-label="上传简历文件 (支持 PDF, DOCX, TXT, MD, JSON)"
              class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div class="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
              <UploadCloud class="w-7 h-7" aria-hidden="true" />
            </div>
            <div>
              <p class="text-sm font-bold text-slate-800">拖拽简历文件到此处，或 <span class="text-blue-600 underline">点击上传</span></p>
              <p class="text-xs text-slate-500 mt-1">支持格式：.pdf (文字版)、.docx、.txt、.md、JSON Resume</p>
            </div>
          </div>
        </div>

        <!-- Mode 2: Paste Raw Text Area -->
        <div 
          id="panel-import-paste"
          role="tabpanel"
          aria-labelledby="tab-import-paste"
          v-if="mode === 'paste' && !parsedResume" 
          class="space-y-3"
        >
          <label for="paste-resume-textarea" class="block text-xs font-semibold text-slate-700">
            简历纯文本内容：
          </label>
          <textarea
            id="paste-resume-textarea"
            v-model="rawText"
            rows="8"
            placeholder="请在此粘贴你的简历纯文本内容（如姓名、联系方式、教育背景、工作经历等）..."
            class="w-full p-3 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-slate-800"
          ></textarea>
          <button
            type="button"
            @click="handleParsePastedText"
            :disabled="isParsing"
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-md shadow-blue-500/20 active:scale-[0.98] disabled:opacity-75 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Sparkles class="w-3.5 h-3.5" aria-hidden="true" />
            <span>{{ isParsing ? '正在智能提取...' : '开始提取简历结构' }}</span>
          </button>
        </div>

        <!-- Loading State -->
        <div 
          v-if="isParsing" 
          role="status" 
          aria-live="polite" 
          class="text-center py-10 space-y-3"
        >
          <div class="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p class="text-xs font-bold text-slate-700">正在分析简历结构并提取模块字段...</p>
        </div>

        <!-- Error Message -->
        <div 
          v-if="errorMessage" 
          role="alert" 
          aria-live="assertive" 
          class="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs"
        >
          <AlertCircle class="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{{ errorMessage }}</span>
        </div>

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
                @click="parsedResume = null"
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
      </div>

      <!-- Modal Footer -->
      <footer class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
        <span class="text-xs text-slate-500">导入后可在管理后台随时补充或修改各字段详情</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="emit('close')"
            class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            取消
          </button>
          <button
            v-if="parsedResume"
            type="button"
            @click="handleConfirmImport"
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span>导入并补全资料</span>
            <ArrowRight class="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>
