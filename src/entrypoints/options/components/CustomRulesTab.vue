<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  Upload, 
  Globe, 
  Code, 
  Check, 
  Sliders, 
  AlertCircle,
  HelpCircle
} from 'lucide-vue-next';
import { ruleStorage } from '@/core/storage/ruleStorage';
import type { CustomSiteRule, CustomFieldMapping } from '@/types/rule';

const emit = defineEmits<{
  (e: 'show-toast', message: string, type?: 'success' | 'error'): void;
}>();

const rules = ref<CustomSiteRule[]>([]);
const isEditing = ref(false);
const currentRule = ref<CustomSiteRule>({
  id: '',
  name: '',
  domainPattern: '',
  enabled: true,
  fields: []
});

const RESUME_KEY_OPTIONS = [
  { group: '个人基本信息', options: [
    { label: '姓名', value: 'basics.name' },
    { label: '手机号码', value: 'basics.phone' },
    { label: '电子邮箱', value: 'basics.email' },
    { label: '身份证号', value: 'basics.idCardNumber' },
    { label: '出生日期', value: 'basics.birthDate' },
    { label: '性别', value: 'basics.gender' },
    { label: '政治面貌', value: 'basics.politicalStatus' },
    { label: '民族', value: 'basics.ethnicity' },
    { label: '婚姻状况', value: 'basics.maritalStatus' },
    { label: '现居城市', value: 'basics.currentLocation.city' },
    { label: '籍贯', value: 'basics.nativePlace.city' },
    { label: '期望职位', value: 'basics.expectedRole' },
    { label: '期望城市', value: 'basics.expectedCity' },
    { label: '期望薪资', value: 'basics.expectedSalaryMin' },
    { label: 'GitHub', value: 'basics.githubUrl' },
    { label: 'LinkedIn', value: 'basics.linkedinUrl' },
    { label: '个人网站/博客', value: 'basics.blogUrl' },
    { label: '自我评价', value: 'basics.selfEvaluation' }
  ]},
  { group: '最高教育经历 (第1段)', options: [
    { label: '学校名称', value: 'educations.0.schoolName' },
    { label: '学历层次', value: 'educations.0.degree' },
    { label: '所学专业', value: 'educations.0.major' },
    { label: 'GPA', value: 'educations.0.gpa' },
    { label: '就读起日', value: 'educations.0.startDate' },
    { label: '就读止日', value: 'educations.0.endDate' }
  ]},
  { group: '工作/实习经历 (第1段)', options: [
    { label: '公司名称', value: 'experiences.0.company' },
    { label: '职位岗位', value: 'experiences.0.title' },
    { label: '任职起日', value: 'experiences.0.startDate' },
    { label: '任职止日', value: 'experiences.0.endDate' },
    { label: '工作描述', value: 'experiences.0.description' }
  ]},
  { group: '项目经历 (第1段)', options: [
    { label: '项目名称', value: 'projects.0.projectName' },
    { label: '担任角色', value: 'projects.0.role' },
    { label: '技术栈', value: 'projects.0.techStack' },
    { label: '项目描述', value: 'projects.0.description' }
  ]}
];

const loadRules = async () => {
  rules.value = await ruleStorage.getCustomRules();
};

onMounted(() => {
  loadRules();
});

const handleCreateRule = () => {
  currentRule.value = {
    id: `rule-${Date.now()}`,
    name: '',
    domainPattern: '',
    enabled: true,
    fields: [
      { id: `f-${Date.now()}-1`, selector: '', resumeKey: 'basics.name', description: '姓名' }
    ]
  };
  isEditing.value = true;
};

const handleEditRule = (rule: CustomSiteRule) => {
  currentRule.value = JSON.parse(JSON.stringify(rule));
  isEditing.value = true;
};

const handleAddField = () => {
  currentRule.value.fields.push({
    id: `f-${Date.now()}-${currentRule.value.fields.length + 1}`,
    selector: '',
    resumeKey: 'basics.name',
    description: ''
  });
};

const handleRemoveField = (index: number) => {
  currentRule.value.fields.splice(index, 1);
};

const handleSaveRule = async () => {
  if (!currentRule.value.name.trim() || !currentRule.value.domainPattern.trim()) {
    emit('show-toast', '请填写规则名称和域名匹配模式', 'error');
    return;
  }

  await ruleStorage.saveCustomRule(currentRule.value);
  await loadRules();
  isEditing.value = false;
  emit('show-toast', `已保存规则：${currentRule.value.name}`);
};

const handleDeleteRule = async (id: string, name: string) => {
  if (confirm(`确定删除规则【${name}】吗？`)) {
    await ruleStorage.deleteCustomRule(id);
    await loadRules();
    emit('show-toast', `已删除规则：${name}`);
  }
};

const handleToggleRule = async (rule: CustomSiteRule) => {
  rule.enabled = !rule.enabled;
  await ruleStorage.saveCustomRule(rule);
  emit('show-toast', `已${rule.enabled ? '启用' : '禁用'}规则：${rule.name}`);
};

const handleExport = async () => {
  const jsonStr = await ruleStorage.exportRulesToJson();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `openjobfill-custom-rules-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  emit('show-toast', '规则配置文件已成功导出！');
};

const handleImport = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const count = await ruleStorage.importRulesFromJson(text);
      await loadRules();
      emit('show-toast', `成功导入 ${count} 条自定义规则！`);
    } catch (err: any) {
      emit('show-toast', err.message, 'error');
    }
  };
  input.click();
};
</script>

<template>
  <div class="space-y-6">
    <!-- Top Action Bar -->
    <div class="flex items-center justify-between pb-4 border-b border-slate-200">
      <div>
        <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
          <Sliders class="w-5 h-5 text-blue-600" />
          <span>自定义网站规则引擎 (Custom Site Rules)</span>
        </h3>
        <p class="text-xs text-slate-500 mt-1">
          针对特定小众企业网申门户或非常规表单，定义专属 DOM 选择器与简历字段映射，优先于通用启发式引擎执行。
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="handleImport"
          class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <Upload class="w-3.5 h-3.5" />
          <span>导入规则</span>
        </button>
        <button
          type="button"
          @click="handleExport"
          class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <Download class="w-3.5 h-3.5" />
          <span>导出规则</span>
        </button>
        <button
          type="button"
          @click="handleCreateRule"
          class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus class="w-4 h-4" />
          <span>新增网站规则</span>
        </button>
      </div>
    </div>

    <!-- Rule Edit Modal / View -->
    <div v-if="isEditing" class="p-5 bg-white border-2 border-blue-200 rounded-2xl shadow-md space-y-4 animate-fade-in">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <h4 class="font-bold text-sm text-slate-800 flex items-center gap-2">
          <Edit3 class="w-4 h-4 text-blue-600" />
          <span>{{ currentRule.id.startsWith('rule-') ? '新建网站规则' : '编辑网站规则' }}</span>
        </h4>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="isEditing = false"
            class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
          >
            取消
          </button>
          <button
            type="button"
            @click="handleSaveRule"
            class="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs"
          >
            保存此规则
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">规则名称 *</label>
          <input
            v-model="currentRule.name"
            type="text"
            placeholder="如：某某外企中国区网申门户"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">域名匹配模式 (URL Pattern) *</label>
          <input
            v-model="currentRule.domainPattern"
            type="text"
            placeholder="如：apply.company.com 或 /career/"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <!-- Field Mappings Table -->
      <div class="space-y-2 pt-2">
        <div class="flex items-center justify-between">
          <div>
            <label class="text-xs font-bold text-slate-700">字段选择器映射清单 ({{ currentRule.fields.length }})</label>
            <p class="text-2xs text-slate-400">💡 提示：在招聘网页悬浮工具条点击【吸管图标】即可在页面直观拾取输入框并自动生成选择器。</p>
          </div>
          <button
            type="button"
            @click="handleAddField"
            class="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>添加字段映射</span>
          </button>
        </div>

        <div class="space-y-2">
          <div 
            v-for="(field, idx) in currentRule.fields" 
            :key="field.id" 
            class="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
          >
            <span class="w-5 text-slate-400 font-mono font-bold text-center">{{ idx + 1 }}</span>
            <input
              v-model="field.selector"
              type="text"
              placeholder="CSS 选择器 (如: input#user_name, .email-input)"
              class="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span class="text-slate-400">➔</span>
            <select
              v-model="field.resumeKey"
              class="w-48 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <optgroup v-for="g in RESUME_KEY_OPTIONS" :key="g.group" :label="g.group">
                <option v-for="opt in g.options" :key="opt.value" :value="opt.value">
                  {{ opt.label }} ({{ opt.value }})
                </option>
              </optgroup>
            </select>
            <input
              v-model="field.description"
              type="text"
              placeholder="说明备注 (可选)"
              class="w-32 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              @click="handleRemoveField(idx)"
              class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
              title="删除此映射"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Rules List Cards -->
    <div v-if="!isEditing" class="space-y-3">
      <div v-if="rules.length === 0" class="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        <Sliders class="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p class="text-sm font-semibold text-slate-600">暂无自定义网站规则</p>
        <p class="text-xs text-slate-400 mt-1">点击右上角“新增网站规则”自定义小众招聘系统字段</p>
      </div>

      <div
        v-for="rule in rules"
        :key="rule.id"
        class="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md transition flex items-center justify-between gap-4"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span
              :class="[
                'w-2 h-2 rounded-full',
                rule.enabled ? 'bg-emerald-500' : 'bg-slate-300'
              ]"
            ></span>
            <h4 class="font-bold text-sm text-slate-800 truncate">{{ rule.name }}</h4>
            <span class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-mono">
              {{ rule.domainPattern }}
            </span>
          </div>

          <div class="flex items-center gap-4 text-xs text-slate-500 mt-1.5">
            <span>已配置 {{ rule.fields.length }} 个字段映射</span>
            <span v-if="rule.updatedAt">更新于 {{ rule.updatedAt.slice(0, 10) }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="handleToggleRule(rule)"
            :class="[
              'px-2.5 py-1 rounded-lg text-xs font-semibold transition',
              rule.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            ]"
          >
            {{ rule.enabled ? '已启用' : '已禁用' }}
          </button>
          <button
            type="button"
            @click="handleEditRule(rule)"
            class="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition"
            title="编辑规则"
          >
            <Edit3 class="w-4 h-4" />
          </button>
          <button
            type="button"
            @click="handleDeleteRule(rule.id, rule.name)"
            class="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
            title="删除规则"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
