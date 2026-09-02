<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { validateResumeImageFile } from '@/core/importers/resumeImagePreparation';
import { getAISettings } from '@/core/storage/aiSettingsStorage';
import { resumeStorage } from '@/core/storage/resumeStorage';
import type { AISettings } from '@/types/ai';
import type { StandardResume } from '@/types/resume';
import { UploadCloud, FileText, Sparkles, AlertCircle, X, ArrowRight, ScanLine } from 'lucide-vue-next';
import { useResumeImport } from './composables/useResumeImport';
import ResumeImportPreview from './ResumeImportPreview.vue';

const props = defineProps<{ baseResume?: StandardResume | null }>();
const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'import', resume: StandardResume): void;
}>();
const mode = ref<'upload' | 'paste' | 'vision'>('upload');
const rawText = ref('');
const visionConsent = ref(false);
const visionFile = ref<File | null>(null);
const visionPreviewUrl = ref('');
const aiSettings = ref<AISettings | null>(null);
const activeBaseResume = ref<StandardResume | null>(null);
const effectiveBaseResume = computed(() => props.baseResume || activeBaseResume.value);
const useAIEnhancement = ref(false);
const documentConsent = ref(false);
const importer = useResumeImport();
const {
  isParsing, parsedResume, errorMessage, enhancementNotice,
  localCandidates, aiCandidates, importConflicts, acceptedPaths, canConfirmImport,
} = importer;
const aiConfigLabel = computed(() => {
  const settings = aiSettings.value;
  return settings?.enabled ? `${settings.provider === 'ollama' ? 'Ollama' : '云端 API'} · ${settings.model || '未配置模型'}` : 'AI 尚未启用';
});

const resetImport = () => {
  importer.reset();
  documentConsent.value = false;
  visionConsent.value = false;
};
watch(mode, resetImport);
const handleKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape') emit('close'); };
onMounted(async () => {
  window.addEventListener('keydown', handleKeydown);
  const [settings, active] = await Promise.all([
    getAISettings(),
    props.baseResume ? Promise.resolve(props.baseResume) : resumeStorage.getActiveResume().catch(() => null),
  ]);
  aiSettings.value = settings;
  activeBaseResume.value = active;
});
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (visionPreviewUrl.value) URL.revokeObjectURL(visionPreviewUrl.value);
});

const processFile = async (file: File) => {
  const result = await importer.importDocument(file, {
    enhance: useAIEnhancement.value,
    consent: documentConsent.value,
    baseResume: effectiveBaseResume.value,
  });
  documentConsent.value = false;
  if (result) rawText.value = result.text;
};
const handleFileUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) await processFile(file);
};
const handleDrop = async (event: DragEvent) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) await processFile(file);
};
const handleParsePastedText = () => importer.importText(rawText.value, effectiveBaseResume.value);

const selectVisionFile = (file: File) => {
  try {
    validateResumeImageFile(file);
    resetImport();
    if (visionPreviewUrl.value) URL.revokeObjectURL(visionPreviewUrl.value);
    visionFile.value = file;
    visionPreviewUrl.value = URL.createObjectURL(file);
  } catch (error) {
    importer.reportError(error instanceof Error ? error.message : '图片格式无效');
  }
};
const handleVisionFile = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) selectVisionFile(file);
};
const handleVisionDrop = (event: DragEvent) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) selectVisionFile(file);
};
const handleVisionParse = async () => {
  if (!visionFile.value) {
    importer.reportError('请先选择简历图片');
    return;
  }
  const request = importer.importImage(visionFile.value, visionConsent.value, effectiveBaseResume.value);
  visionConsent.value = false;
  await request;
};
const handleConfirmImport = () => {
  if (parsedResume.value && canConfirmImport.value) emit('import', JSON.parse(JSON.stringify(parsedResume.value)));
};
</script>

<template>
  <div role="dialog" aria-modal="true" aria-labelledby="import-modal-title" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in font-sans">
    <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800">
      <header class="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center"><Sparkles class="w-4 h-4 fill-white" aria-hidden="true" /></div>
          <div>
            <h2 id="import-modal-title" class="text-base font-bold leading-tight">可信简历解析导入</h2>
            <p class="text-xs text-blue-100">本地解析优先；AI 只生成候选，冲突必须显式处理</p>
          </div>
        </div>
        <button type="button" @click="emit('close')" class="p-1.5 rounded-lg hover:bg-white/20 transition focus-visible:ring-2 focus-visible:ring-white" aria-label="关闭导入窗口"><X class="w-5 h-5" aria-hidden="true" /></button>
      </header>

      <div class="p-6 flex-1 overflow-y-auto space-y-6">
        <div role="tablist" aria-label="导入方式选择" class="flex items-center gap-2 border-b border-slate-100 pb-3">
          <button id="tab-import-upload" role="tab" type="button" :aria-selected="mode === 'upload'" aria-controls="panel-import-upload" @click="mode = 'upload'" :class="['px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500', mode === 'upload' ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs' : 'text-slate-500 hover:text-slate-800']"><UploadCloud class="w-4 h-4" /><span>上传文件 (PDF / DOCX)</span></button>
          <button id="tab-import-paste" role="tab" type="button" :aria-selected="mode === 'paste'" aria-controls="panel-import-paste" @click="mode = 'paste'" :class="['px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500', mode === 'paste' ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs' : 'text-slate-500 hover:text-slate-800']"><FileText class="w-4 h-4" /><span>直接粘贴文本</span></button>
          <button id="tab-import-vision" role="tab" type="button" :aria-selected="mode === 'vision'" aria-controls="panel-import-vision" @click="mode = 'vision'" :class="['px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-violet-500', mode === 'vision' ? 'bg-violet-50 text-violet-700 border border-violet-200 shadow-xs' : 'text-slate-500 hover:text-slate-800']"><ScanLine class="w-4 h-4" /><span>AI 图片识别</span></button>
        </div>

        <div id="panel-import-upload" role="tabpanel" aria-labelledby="tab-import-upload" v-if="mode === 'upload' && !parsedResume" class="space-y-4">
          <div class="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
            <label class="flex items-center gap-2 font-bold text-slate-800 cursor-pointer"><input v-model="useAIEnhancement" type="checkbox" class="w-4 h-4 accent-violet-600" /><span>使用已配置模型补强 PDF / Word 解析</span></label>
            <p class="text-slate-500">PDF：本地文本 + 最多前 4 页页面图；Word：本地提取文本。AI 失败时保留本地候选，不会把失败伪装成成功导入。</p>
            <label v-if="useAIEnhancement" class="flex items-start gap-2 p-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 cursor-pointer"><input v-model="documentConsent" type="checkbox" class="mt-0.5 w-4 h-4 accent-violet-600" /><span>我确认本次会把该 PDF/Word 的完整提取文本，以及 PDF 页面图发送到 {{ aiConfigLabel }}。</span></label>
          </div>
          <div @dragover.prevent @drop="handleDrop" class="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 rounded-2xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 relative focus-within:ring-2 focus-within:ring-blue-500">
            <input id="resume-file-input" type="file" accept=".pdf,.docx,.txt,.md,.json,application/json" @change="handleFileUpload" :disabled="useAIEnhancement && !documentConsent" aria-label="上传简历文件" class="absolute inset-0 z-10 opacity-0 cursor-pointer w-full h-full" />
            <div class="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner"><UploadCloud class="w-7 h-7" /></div>
            <div><p class="text-sm font-bold text-slate-800">拖拽简历文件到此处，或 <span class="text-blue-600 underline">点击上传</span></p><p class="text-xs text-slate-500 mt-1">支持 .pdf、.docx、.txt、.md、JSON Resume</p></div>
          </div>
        </div>

        <div id="panel-import-vision" role="tabpanel" aria-labelledby="tab-import-vision" v-if="mode === 'vision' && !parsedResume" class="space-y-4">
          <div class="p-3 rounded-xl border border-violet-200 bg-violet-50 text-xs text-violet-900 space-y-1">
            <div class="font-bold flex items-center gap-1.5"><ScanLine class="w-4 h-4" />视觉模型配置：{{ aiConfigLabel }}</div>
            <p>图片会压缩到最长边 2200px，然后发送到你在设置中配置的接口。模型结果只作为字段候选进入审核。</p>
          </div>
          <div @dragover.prevent @drop="handleVisionDrop" class="border-2 border-dashed border-violet-300 hover:border-violet-500 bg-violet-50/30 rounded-2xl p-6 text-center transition relative focus-within:ring-2 focus-within:ring-violet-500">
            <input id="resume-vision-file-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" @change="handleVisionFile" aria-label="选择用于 AI 识别的简历图片" class="absolute inset-0 z-10 opacity-0 cursor-pointer w-full h-full" />
            <img v-if="visionPreviewUrl" :src="visionPreviewUrl" alt="待识别简历图片预览" class="relative pointer-events-none mx-auto max-h-56 max-w-full rounded-lg shadow-sm border border-slate-200" />
            <div v-else class="py-5 space-y-2"><ScanLine class="w-9 h-9 mx-auto text-violet-600" /><p class="font-bold text-slate-800">拖入或选择 JPG / PNG / WebP 简历图片</p><p class="text-slate-500">最大 12 MB</p></div>
          </div>
          <label class="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 cursor-pointer"><input v-model="visionConsent" type="checkbox" class="mt-0.5 w-4 h-4 accent-violet-600" /><span>我确认本次将完整简历图片发送到上述模型接口，并在导入前处理所有冲突。</span></label>
          <button type="button" @click="handleVisionParse" :disabled="isParsing || !visionFile || !visionConsent" class="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-md shadow-violet-500/20 focus-visible:ring-2 focus-visible:ring-violet-500"><Sparkles class="w-3.5 h-3.5" /><span>{{ isParsing ? '视觉模型识别中...' : '开始 AI 视觉识别' }}</span></button>
        </div>

        <div id="panel-import-paste" role="tabpanel" aria-labelledby="tab-import-paste" v-if="mode === 'paste' && !parsedResume" class="space-y-3">
          <label for="paste-resume-textarea" class="block text-xs font-semibold text-slate-700">简历纯文本内容：</label>
          <textarea id="paste-resume-textarea" v-model="rawText" rows="8" placeholder="请在此粘贴你的简历纯文本内容..." class="w-full p-3 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-slate-800"></textarea>
          <button type="button" @click="handleParsePastedText" :disabled="isParsing" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-md shadow-blue-500/20 active:scale-[0.98] disabled:opacity-75 focus-visible:ring-2 focus-visible:ring-blue-500"><Sparkles class="w-3.5 h-3.5" /><span>{{ isParsing ? '正在智能提取...' : '开始提取简历结构' }}</span></button>
        </div>

        <div v-if="enhancementNotice" role="status" aria-live="polite" class="p-3 rounded-xl border text-xs" :class="enhancementNotice.startsWith('AI 补强未完成') ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'">{{ enhancementNotice }}</div>
        <div v-if="isParsing" role="status" aria-live="polite" class="text-center py-10 space-y-3"><div class="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div><p class="text-xs font-bold text-slate-700">正在分析简历并生成字段级候选...</p></div>
        <div v-if="errorMessage" role="alert" aria-live="assertive" class="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs"><AlertCircle class="w-4 h-4 flex-shrink-0" /><span>{{ errorMessage }}</span></div>

        <ResumeImportPreview
          v-if="parsedResume"
          :parsed-resume="parsedResume"
          :local-candidates="localCandidates"
          :ai-candidates="aiCandidates"
          :conflicts="importConflicts"
          :accepted-paths="acceptedPaths"
          @reset="resetImport"
          @resolve-conflict="importer.resolveConflict"
        />
      </div>

      <footer class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
        <span class="text-xs" :class="importConflicts.length ? 'text-amber-700 font-semibold' : 'text-slate-500'">{{ importConflicts.length ? `还有 ${importConflicts.length} 个冲突未处理，暂不能写入档案` : '所有冲突已处理；保存后字段来源与确认状态会随档案持久化' }}</span>
        <div class="flex items-center gap-2">
          <button type="button" @click="emit('close')" class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition focus-visible:ring-2 focus-visible:ring-blue-500">取消</button>
          <button v-if="parsedResume" type="button" @click="handleConfirmImport" :disabled="!canConfirmImport" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500"><span>{{ effectiveBaseResume ? '合并到当前可信档案' : '导入可信档案' }}</span><ArrowRight class="w-3.5 h-3.5" /></button>
        </div>
      </footer>
    </div>
  </div>
</template>
