<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Plus, Trash2, CheckCircle2, ShieldCheck, Bot, PlugZap } from 'lucide-vue-next';
import BackupSettings from './BackupSettings.vue';
import { getAISettings, saveAISettings } from '@/core/storage/aiSettingsStorage';
import type { AIProviderType } from '@/types/ai';
import { AI_PROVIDER_PRESETS, type AIProviderPresetId } from '@/core/ai/providerPresets';

defineProps<{
  beforeRestore?: () => Promise<void>;
  customDomains: string[];
  domainSaveSuccess: boolean;
}>();

const emit = defineEmits<{
  (e: 'add-domain', domain: string): void;
  (e: 'remove-domain', index: number): void;
  (e: 'data-restored'): void;
  (e: 'show-toast', type: 'success' | 'error' | 'info', text: string): void;
}>();

const newDomainInput = ref('');
// ── AI 兜底配置（本地优先：默认关闭，纯本地规则即可用；配置后启用 AI 增强）──
const aiEnabled = ref(false);
const aiProvider = ref<AIProviderType>('ollama');
const aiPreset = ref<AIProviderPresetId>('ollama');
const aiBaseUrl = ref('http://localhost:11434');
const aiModel = ref('qwen2.5:7b');
const aiApiKey = ref('');
const aiSaving = ref(false);
const aiTesting = ref(false);

onMounted(async () => {
  const s = await getAISettings();
  aiEnabled.value = s.enabled;
  aiProvider.value = s.provider;
  aiBaseUrl.value = s.baseUrl;
  aiModel.value = s.model;
  aiApiKey.value = s.apiKey || '';
  const matchedPreset = (Object.entries(AI_PROVIDER_PRESETS) as [AIProviderPresetId, (typeof AI_PROVIDER_PRESETS)[AIProviderPresetId]][])
    .find(([, preset]) => preset.baseUrl === s.baseUrl);
  aiPreset.value = matchedPreset?.[0] || (s.provider === 'ollama' ? 'ollama' : 'custom');
});

const onPresetChange = () => {
  const preset = AI_PROVIDER_PRESETS[aiPreset.value];
  aiProvider.value = preset.provider;
  aiBaseUrl.value = preset.baseUrl;
  aiModel.value = preset.defaultModel;
};

const buildSettings = () => ({
  enabled: aiEnabled.value,
  provider: aiProvider.value,
  baseUrl: aiBaseUrl.value.trim(),
  model: aiModel.value.trim(),
  apiKey: aiApiKey.value.trim() || undefined,
});

const saveAI = async () => {
  aiSaving.value = true;
  try {
    await saveAISettings(buildSettings());
    emit('show-toast', 'success', aiEnabled.value ? 'AI 兜底已启用并保存' : 'AI 兜底已关闭');
  } catch (err: any) {
    emit('show-toast', 'error', `保存失败: ${err.message}`);
  } finally {
    aiSaving.value = false;
  }
};

const testAI = async () => {
  aiTesting.value = true;
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'AI_MAP_FIELDS',
      payload: {
        settings: buildSettings(),
        fields: [{ index: 0, label: '姓名', placeholder: '', name: '', ariaLabel: '', inputType: 'text' }],
        options: [{ resumeKey: 'basics.name', label: '姓名' }],
      },
    });
    if (resp?.success && resp.mapping?.['0'] === 'basics.name') {
      emit('show-toast', 'success', '连接成功，示例字段映射有效；图片/PDF 的视觉能力需要单独确认');
    } else if (resp?.success) {
      emit('show-toast', 'info', '接口已响应，但没有返回有效的示例映射。请检查模型名称和输出格式');
    } else {
      emit('show-toast', 'error', `连接失败: ${resp?.error || '未知错误'}`);
    }
  } catch (err: any) {
    emit('show-toast', 'error', `测试失败: ${err.message}`);
  } finally {
    aiTesting.value = false;
  }
};

const handleAdd = () => {
  const domain = newDomainInput.value.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  if (!domain) return;
  emit('add-domain', domain);
  newDomainInput.value = '';
};

</script>

<template>
  <div class="space-y-6 font-sans text-xs">
    <BackupSettings :before-restore="beforeRestore" @data-restored="emit('data-restored')" @show-toast="(type, text) => emit('show-toast', type, text)" />

    <!-- AI 智能兜底（可选 · 本地优先） -->
    <section aria-labelledby="ai-heading" class="p-5 bg-violet-50 border border-violet-200/80 rounded-2xl space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Bot class="w-4 h-4 text-violet-600" />
          <h3 id="ai-heading" class="text-sm font-bold text-slate-800">AI 智能兜底（可选 · 本地优先）</h3>
        </div>
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <span class="text-xs font-medium" :class="aiEnabled ? 'text-violet-700' : 'text-slate-500'">{{ aiEnabled ? '已启用' : '已关闭' }}</span>
          <input type="checkbox" v-model="aiEnabled" class="w-4 h-4 accent-violet-600" />
        </label>
      </div>

      <p class="text-slate-600 leading-relaxed">
        默认关闭，本地规则仍可正常填表。字段兜底发送页面字段描述和允许的简历字段名称，不发送简历字段值。文档/图片增强需逐次确认，才会向所选接口发送提取文本（最多 60,000 字符）、PDF 前 4 页图片或所选简历图片。
        推荐本地 Ollama（零成本、数据不出机）；也可使用自带 Key 的云端接口。
      </p>

      <div v-if="aiEnabled" class="space-y-3 pt-1">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">提供方快速配置</label>
            <select v-model="aiPreset" @change="onPresetChange" class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option v-for="(preset, id) in AI_PROVIDER_PRESETS" :key="id" :value="id">{{ preset.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">模型</label>
            <input v-model="aiModel" type="text" placeholder="qwen2.5:7b / deepseek-chat" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">接口地址 Base URL</label>
          <input v-model="aiBaseUrl" type="text" placeholder="http://localhost:11434 或 https://api.deepseek.com" class="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        <div v-if="aiProvider === 'openai-compatible'">
          <label class="block text-xs font-medium text-slate-600 mb-1">API Key（本地保存，调用所选接口时用于鉴权）</label>
          <input v-model="aiApiKey" type="password" placeholder="sk-..." autocomplete="off" class="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        <div class="flex items-center gap-3 pt-1">
          <button type="button" @click="testAI" :disabled="aiTesting" class="px-4 py-2 bg-white border border-violet-300 hover:bg-violet-50 disabled:opacity-50 text-violet-700 font-bold rounded-xl transition flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-violet-500">
            <PlugZap class="w-4 h-4" />
            <span>{{ aiTesting ? '测试中...' : '测试连接' }}</span>
          </button>
          <button type="button" @click="saveAI" :disabled="aiSaving" class="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-sm shadow-violet-500/20 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-violet-500">
            <span>{{ aiSaving ? '保存中...' : '保存配置' }}</span>
          </button>
        </div>

        <p class="text-xs text-slate-500 leading-relaxed border-t border-violet-200/60 pt-2">
          💡 本地 Ollama：先运行 <code class="bg-white px-1 py-0.5 rounded font-mono">ollama run {{ aiModel || 'qwen2.5:7b' }}</code>。图片识别和 PDF 页面图补强需要视觉模型；文本模型可用于字段映射、Word/文本结构化。AI 结果仍需人工核对，不会自动投递。文档增强失败会保留可用的本地结果，之后可修改资料、改用文本或更换模型重试。
        </p>
      </div>
    </section>

    <!-- 2. 自定义域名白名单 -->
    <section aria-labelledby="custom-domain-heading">
      <h3 id="custom-domain-heading" class="text-sm font-bold text-slate-800 mb-1">
        自定义域名白名单
      </h3>
      <p class="text-slate-600 mb-3 leading-relaxed">
        插件默认已内置 100+ 主流招聘与 ATS 平台域名，并支持通过页面内容智能分析网申表单。
        如果某个企业专属网申页面未被自动挂载悬浮球，你可以在此手动添加其域名。
      </p>

      <div class="flex gap-2 mb-4">
        <label for="custom-domain-input" class="sr-only">添加自定义招聘网站域名</label>
        <input
          id="custom-domain-input"
          v-model="newDomainInput"
          type="text"
          placeholder="输入域名 (如: hr.example.com 或 https://example.com/careers)"
          @keyup.enter="handleAdd"
          class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          @click="handleAdd"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center gap-1 shadow-sm shadow-blue-500/20 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="添加域名到白名单"
        >
          <Plus class="w-4 h-4" aria-hidden="true" />
          <span>添加</span>
        </button>
      </div>

      <div 
        v-if="domainSaveSuccess" 
        role="status" 
        aria-live="polite" 
        class="text-emerald-700 text-xs font-semibold mb-3 flex items-center gap-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg animate-fade-in"
      >
        <CheckCircle2 class="w-4 h-4 text-emerald-600" aria-hidden="true" />
        <span>白名单已更新并自动生效！</span>
      </div>

      <div v-if="customDomains.length === 0" class="text-slate-500 italic py-6 text-center border border-dashed rounded-xl bg-slate-50">
        暂无自定义域名。在上方输入框键入域名即可快速添加。
      </div>

      <div v-else role="list" aria-label="已配置的自定义域名列表" class="space-y-2">
        <div
          v-for="(domain, idx) in customDomains"
          :key="domain"
          role="listitem"
          class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl"
        >
          <span class="font-mono text-slate-800 text-xs">{{ domain }}</span>
          <button
            type="button"
            @click="emit('remove-domain', idx)"
            class="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition focus-visible:ring-2 focus-visible:ring-red-500"
            :aria-label="`从白名单移除域名: ${domain}`"
            :title="`从白名单移除域名: ${domain}`"
          >
            <Trash2 class="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>

    <!-- 3. 识别机制说明 -->
    <section class="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-2.5 text-blue-900" aria-labelledby="mechanism-heading">
      <h4 id="mechanism-heading" class="font-bold text-sm text-blue-900 flex items-center gap-1.5">
        <ShieldCheck class="w-4 h-4 text-blue-600" aria-hidden="true" />
        <span>智能多层招聘页面识别机制</span>
      </h4>
      <p class="text-blue-800 leading-relaxed">
        OpenJobFill 采用<strong>三层保底自适应策略</strong>自动判断当前网页是否为求职网申页面：
      </p>
      <ol class="list-decimal list-inside space-y-1.5 text-blue-800 pl-1">
        <li><strong>官方平台与域名库</strong> — 内置 Moka、北森、飞书招聘、用友大易等 100+ ATS 平台及你的自定义白名单</li>
        <li><strong>URL 语义路径特征</strong> — 智能扫描包含 /career、/jobs、/apply、/campus 等招聘路由路径</li>
        <li><strong>DOM 表单密度与求职词汇共现分析</strong> — 深度扫描页面输入项与「简历」「学历」「工作经历」等关键词，自适应未知私有 ATS</li>
      </ol>
      <p class="text-blue-700 text-xs pt-1 border-t border-blue-200/60">
        💡 提示：即使页面未被自动挂载悬浮球，你依然可以随时点击浏览器右上角的扩展图标一键触发填表。
      </p>
    </section>
  </div>
</template>
