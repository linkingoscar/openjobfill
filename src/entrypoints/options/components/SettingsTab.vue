<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Plus, Trash2, CheckCircle2, ShieldCheck, Download, UploadCloud, Database, RefreshCw, Bot, PlugZap } from 'lucide-vue-next';
import { backupManager } from '@/core/storage/backupManager';
import { getAISettings, saveAISettings } from '@/core/storage/aiSettingsStorage';
import type { AIProviderType } from '@/types/ai';
import { AI_PROVIDER_PRESETS, type AIProviderPresetId } from '@/core/ai/providerPresets';
import { customDomainPermissionPattern, normalizeCustomDomain, permissionPatternForBaseUrl } from '@/core/recruitmentPermissions';

defineProps<{
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
const isExporting = ref(false);
const isImporting = ref(false);
const pendingImportMode = ref<'merge' | 'overwrite'>('merge');
const fileInputRef = ref<HTMLInputElement | null>(null);

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

async function requestOriginPermission(pattern: string, label: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id || !chrome.permissions?.request) return;
  // Called directly from a button/Enter user gesture. Already-granted origins resolve true
  // without prompting; new origins show the browser's native permission dialog.
  const granted = await chrome.permissions.request({ origins: [pattern] });
  if (!granted) throw new Error(`未授权访问 ${label}；相关功能保持关闭`);
}

async function ensureAIOriginPermission() {
  if (!aiEnabled.value) return;
  const pattern = permissionPatternForBaseUrl(aiBaseUrl.value.trim());
  if (!pattern) throw new Error('AI Base URL 必须是有效的 http/https 地址');
  await requestOriginPermission(pattern, '该 AI 接口');
}

const saveAI = async () => {
  aiSaving.value = true;
  try {
    await ensureAIOriginPermission();
    await saveAISettings(buildSettings());
    emit('show-toast', 'success', aiEnabled.value ? 'AI 兜底已启用并保存；接口权限仅授予当前 origin' : 'AI 兜底已关闭');
  } catch (err: any) {
    emit('show-toast', 'error', `保存失败: ${err.message}`);
  } finally {
    aiSaving.value = false;
  }
};

const testAI = async () => {
  aiTesting.value = true;
  try {
    await ensureAIOriginPermission();
    const resp = await chrome.runtime.sendMessage({
      type: 'AI_MAP_FIELDS',
      payload: {
        settings: buildSettings(),
        fields: [{ index: 0, label: '姓名', placeholder: '', name: '', ariaLabel: '', inputType: 'text' }],
        options: [{ resumeKey: 'basics.name', label: '姓名' }],
      },
    });
    if (resp?.success) {
      emit('show-toast', 'success', '连接成功，AI 兜底可用');
    } else {
      emit('show-toast', 'error', `连接失败: ${resp?.error || '未知错误'}`);
    }
  } catch (err: any) {
    emit('show-toast', 'error', `测试失败: ${err.message}`);
  } finally {
    aiTesting.value = false;
  }
};

const handleAdd = async () => {
  const domain = normalizeCustomDomain(newDomainInput.value);
  if (!domain) return;
  const pattern = customDomainPermissionPattern(domain);
  if (!pattern) {
    emit('show-toast', 'error', '域名格式无效，请输入类似 hr.example.com 的域名');
    return;
  }
  try {
    await requestOriginPermission(pattern, domain);
    emit('add-domain', domain);
    newDomainInput.value = '';
    emit('show-toast', 'success', `已授权 ${domain}；该站点后续可自动挂载招聘运行时`);
  } catch (error) {
    emit('show-toast', 'error', error instanceof Error ? error.message : '站点权限授权失败');
  }
};

const handleRemove = async (domain: string, index: number) => {
  const pattern = customDomainPermissionPattern(domain);
  if (pattern && typeof chrome !== 'undefined' && chrome.permissions?.remove) {
    try { await chrome.permissions.remove({ origins: [pattern] }); } catch {}
  }
  emit('remove-domain', index);
};

const handleExportAll = async () => {
  isExporting.value = true;
  try {
    const jsonStr = await backupManager.exportFullBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    a.href = url;
    a.download = `OpenJobFill_FullBackup_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    emit('show-toast', 'success', '全量本地备份导出成功！');
  } catch (err: any) {
    emit('show-toast', 'error', `导出失败: ${err.message}`);
  } finally {
    isExporting.value = false;
  }
};

const triggerFileInput = (mode: 'merge' | 'overwrite') => {
  pendingImportMode.value = mode;
  fileInputRef.value?.click();
};

const handleImportFile = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const mode = pendingImportMode.value;
  isImporting.value = true;

  try {
    const text = await file.text();
    const result = await backupManager.importFullBackup(text, mode);
    emit('data-restored');
    const modeLabel = mode === 'overwrite' ? '完全覆盖恢复' : '合并导入';
    emit(
      'show-toast',
      'success',
      `备份${modeLabel}成功！已还原 ${result.resumes} 份简历、${result.rules} 条规则、${result.domains} 个域名、${result.applications} 条投递记录`
    );
  } catch (err: any) {
    emit('show-toast', 'error', `导入失败: ${err.message}`);
  } finally {
    isImporting.value = false;
    input.value = '';
  }
};
</script>

<template>
  <div class="space-y-6 font-sans text-xs">
    <section aria-labelledby="backup-heading" class="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
      <div class="flex items-center gap-2">
        <Database class="w-4 h-4 text-blue-600" />
        <h3 id="backup-heading" class="text-sm font-bold text-slate-800">
          全量本地数据备份与跨设备迁移 (纯本地安全离线)
        </h3>
      </div>
      <p class="text-slate-600 leading-relaxed">
        所有数据仅存储在本地浏览器，不上传云端。你可以一键将全部数据打包导出为 JSON 备份文件，或在其他设备上恢复。<br>
        <span class="text-amber-700 font-medium">⚠️ 导出的备份文件包含个人档案与求职敏感信息，请妥善保管。</span>
      </p>

      <div class="flex items-center gap-3 pt-1">
        <button type="button" @click="handleExportAll" :disabled="isExporting" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-sm shadow-blue-500/20 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500">
          <Download class="w-4 h-4" />
          <span>{{ isExporting ? '正在打包导出...' : '导出全部本地数据' }}</span>
        </button>
        <button type="button" @click="triggerFileInput('merge')" :disabled="isImporting" class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-700 font-bold rounded-xl transition flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-500">
          <UploadCloud class="w-4 h-4 text-blue-600" />
          <span>{{ isImporting ? '正在处理...' : '合并导入备份' }}</span>
        </button>
        <button type="button" @click="triggerFileInput('overwrite')" :disabled="isImporting" class="px-4 py-2 bg-white border border-amber-200 hover:bg-amber-50 disabled:opacity-50 text-amber-800 font-bold rounded-xl transition flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-amber-500">
          <RefreshCw class="w-4 h-4 text-amber-600" />
          <span>{{ isImporting ? '正在处理...' : '完全覆盖恢复' }}</span>
        </button>
        <input ref="fileInputRef" type="file" accept=".json" class="hidden" @change="handleImportFile" />
      </div>
    </section>

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
        默认关闭。字段映射只发送页面结构和档案字段“是否有值”，不发送实际档案值；完整简历、开放题和岗位版本建议仍需逐次确认。
        云端或自定义接口不会在安装时获得访问权，只有点击“保存配置/测试连接”时才向浏览器申请该 Base URL 的 origin 权限。
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
          <label class="block text-xs font-medium text-slate-600 mb-1">API Key（仅存本地浏览器，不上传）</label>
          <input v-model="aiApiKey" type="password" placeholder="sk-..." autocomplete="off" class="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        <div class="flex items-center gap-3 pt-1">
          <button type="button" @click="testAI" :disabled="aiTesting" class="px-4 py-2 bg-white border border-violet-300 hover:bg-violet-50 disabled:opacity-50 text-violet-700 font-bold rounded-xl transition flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-violet-500">
            <PlugZap class="w-4 h-4" />
            <span>{{ aiTesting ? '测试中...' : '测试连接并授权接口' }}</span>
          </button>
          <button type="button" @click="saveAI" :disabled="aiSaving" class="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-sm shadow-violet-500/20 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-violet-500">
            <span>{{ aiSaving ? '保存中...' : '保存配置' }}</span>
          </button>
        </div>

        <p class="text-xs text-slate-500 leading-relaxed border-t border-violet-200/60 pt-2">
          本地 Ollama 可直接使用 localhost；云端/局域网自定义地址由浏览器显示原生 origin 授权提示。撤销 AI origin 权限后，规则引擎仍可独立工作。
        </p>
      </div>
    </section>

    <section aria-labelledby="custom-domain-heading">
      <h3 id="custom-domain-heading" class="text-sm font-bold text-slate-800 mb-1">自定义招聘站点权限</h3>
      <p class="text-slate-600 mb-3 leading-relaxed">
        内置招聘/ATS 域名可自动运行轻量探测器；其它网站默认不运行 detector。添加企业专属招聘域名时，浏览器只会请求该域名的访问权限。
        不想长期授权时，无需添加域名——直接在该页面点击扩展图标即可用 activeTab 单次识别。
      </p>

      <div class="flex gap-2 mb-4">
        <label for="custom-domain-input" class="sr-only">添加自定义招聘网站域名</label>
        <input id="custom-domain-input" v-model="newDomainInput" type="text" placeholder="输入域名 (如: hr.example.com 或 https://example.com/careers)" @keyup.enter="handleAdd" class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="button" @click="handleAdd" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center gap-1 shadow-sm shadow-blue-500/20 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="授权并添加招聘站点域名">
          <Plus class="w-4 h-4" aria-hidden="true" /><span>授权并添加</span>
        </button>
      </div>

      <div v-if="domainSaveSuccess" role="status" aria-live="polite" class="text-emerald-700 text-xs font-semibold mb-3 flex items-center gap-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg animate-fade-in">
        <CheckCircle2 class="w-4 h-4 text-emerald-600" aria-hidden="true" />
        <span>站点白名单与 origin 权限已更新。</span>
      </div>

      <div v-if="customDomains.length === 0" class="text-slate-500 italic py-6 text-center border border-dashed rounded-xl bg-slate-50">
        暂无长期授权的自定义招聘域名；陌生站点仍可从扩展图标单次触发。
      </div>

      <div v-else role="list" aria-label="已配置的自定义域名列表" class="space-y-2">
        <div v-for="(domain, idx) in customDomains" :key="domain" role="listitem" class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span class="font-mono text-slate-800 text-xs">{{ domain }}</span>
          <button type="button" @click="handleRemove(domain, idx)" class="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition focus-visible:ring-2 focus-visible:ring-red-500" :aria-label="`移除域名并撤销站点权限: ${domain}`" :title="`移除域名并撤销站点权限: ${domain}`">
            <Trash2 class="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>

    <section class="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-2.5 text-blue-900" aria-labelledby="mechanism-heading">
      <h4 id="mechanism-heading" class="font-bold text-sm text-blue-900 flex items-center gap-1.5">
        <ShieldCheck class="w-4 h-4 text-blue-600" aria-hidden="true" />
        <span>最小权限招聘页面识别机制</span>
      </h4>
      <ol class="list-decimal list-inside space-y-1.5 text-blue-800 pl-1">
        <li><strong>内置招聘/ATS origin</strong> — 只在明确的 Moka、北森、飞书、Workday 等招聘域名运行轻量 detector。</li>
        <li><strong>自定义招聘域名</strong> — 用户点击“授权并添加”后，只授予该域名并在后续导航自动挂载运行时。</li>
        <li><strong>其它陌生站点</strong> — 默认完全不扫描；用户点扩展图标或快捷键后使用 activeTab 临时注入。</li>
      </ol>
      <p class="text-blue-700 text-xs pt-1 border-t border-blue-200/60">
        重型 Vue/解析/填表引擎仍然只在招聘运行时需要时注入；权限变化不会放宽密码、验证码、支付、提交/下一步等安全边界。
      </p>
    </section>
  </div>
</template>
