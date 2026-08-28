<script setup lang="ts">
import { ref } from 'vue';
import { Plus, Trash2, CheckCircle2, ShieldCheck, HelpCircle } from 'lucide-vue-next';

defineProps<{
  customDomains: string[];
  domainSaveSuccess: boolean;
}>();

const emit = defineEmits<{
  (e: 'add-domain', domain: string): void;
  (e: 'remove-domain', index: number): void;
}>();

const newDomainInput = ref('');

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
    <!-- 自定义域名白名单 -->
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

    <!-- 识别机制说明 -->
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
