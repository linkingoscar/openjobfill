<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Plus, Trash2, Edit3, Download, Upload, Sliders, Activity, AlertTriangle, ShieldCheck, ChevronDown } from 'lucide-vue-next';
import { ruleStorage, validateCustomSiteRule } from '@/core/storage/ruleStorage';
import type { CustomSiteRule, CustomFieldMapping, CustomRuleStatus } from '@/types/rule';

const emit = defineEmits<{
  (e: 'show-toast', message: string, type?: 'success' | 'error'): void;
}>();

const rules = ref<CustomSiteRule[]>([]);
const isEditing = ref(false);
const expandedRuleId = ref<string | null>(null);
const currentRule = ref<CustomSiteRule>({ id: '', name: '', domainPattern: '', enabled: true, fields: [] });

const RESUME_KEY_OPTIONS = [
  { group: '个人基本信息', options: [
    { label: '姓名', value: 'basics.name' }, { label: '手机号码', value: 'basics.phone' }, { label: '电子邮箱', value: 'basics.email' },
    { label: '身份证号', value: 'basics.idCardNumber' }, { label: '出生日期', value: 'basics.birthDate' }, { label: '性别', value: 'basics.gender' },
    { label: '政治面貌', value: 'basics.politicalStatus' }, { label: '民族', value: 'basics.ethnicity' }, { label: '婚姻状况', value: 'basics.maritalStatus' },
    { label: '现居城市', value: 'basics.currentLocation.city' }, { label: '籍贯', value: 'basics.nativePlace.city' }, { label: '出生地', value: 'basics.birthPlace.city' },
    { label: '兴趣爱好 / 特长', value: 'basics.hobbies' }, { label: '期望职位', value: 'basics.expectedRole' }, { label: '期望城市', value: 'basics.expectedCity' },
    { label: '期望薪资', value: 'basics.expectedSalaryMin' }, { label: 'GitHub', value: 'basics.githubUrl' }, { label: 'LinkedIn', value: 'basics.linkedinUrl' },
    { label: '个人网站/博客', value: 'basics.blogUrl' }, { label: '自我评价', value: 'basics.selfEvaluation' },
  ]},
  { group: '最高教育经历 (第1段)', options: [
    { label: '学校名称', value: 'educations.0.schoolName' }, { label: '学历层次', value: 'educations.0.degree' }, { label: '所学专业', value: 'educations.0.major' },
    { label: 'GPA', value: 'educations.0.gpa' }, { label: '就读起日', value: 'educations.0.startDate' }, { label: '就读止日', value: 'educations.0.endDate' },
  ]},
  { group: '工作/实习经历 (第1段)', options: [
    { label: '公司名称', value: 'experiences.0.company' }, { label: '职位岗位', value: 'experiences.0.title' }, { label: '任职起日', value: 'experiences.0.startDate' },
    { label: '任职止日', value: 'experiences.0.endDate' }, { label: '工作描述', value: 'experiences.0.description' },
  ]},
  { group: '项目经历 (第1段)', options: [
    { label: '项目名称', value: 'projects.0.projectName' }, { label: '担任角色', value: 'projects.0.role' }, { label: '技术栈', value: 'projects.0.techStack' },
    { label: '项目描述', value: 'projects.0.description' },
  ]},
  { group: '成果荣誉与校园经历 (第1段)', options: [
    { label: '获奖名称', value: 'awards.0.name' }, { label: '获奖级别', value: 'awards.0.level' }, { label: '论文 / 成果标题', value: 'academicAchievements.0.title' },
    { label: '会议 / 期刊', value: 'academicAchievements.0.venue' }, { label: '校园组织', value: 'campusExperiences.0.organization' }, { label: '校园职务', value: 'campusExperiences.0.title' },
    { label: '家庭成员姓名', value: 'familyMembers.0.name' }, { label: '家庭成员关系', value: 'familyMembers.0.relation' },
    { label: '家庭成员工作单位', value: 'familyMembers.0.company' }, { label: '家庭成员户籍', value: 'familyMembers.0.hukouLocation' },
  ]},
];

async function loadRules() { rules.value = await ruleStorage.getCustomRules(); }
onMounted(loadRules);

function emptyField(): CustomFieldMapping {
  return { id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, selector: '', resumeKey: 'basics.name', description: '', status: 'ACTIVE' };
}
function handleCreateRule() {
  currentRule.value = { id: `rule-${Date.now()}`, name: '', domainPattern: '', enabled: true, fields: [emptyField()] };
  isEditing.value = true;
}
function handleEditRule(rule: CustomSiteRule) {
  currentRule.value = JSON.parse(JSON.stringify(rule));
  isEditing.value = true;
}
function handleAddField() { currentRule.value.fields.push(emptyField()); }
function handleRemoveField(index: number) { currentRule.value.fields.splice(index, 1); }

async function handleSaveRule() {
  const validationError = validateCustomSiteRule(currentRule.value, document);
  if (validationError) { emit('show-toast', validationError, 'error'); return; }
  try {
    await ruleStorage.saveCustomRule(currentRule.value);
    await loadRules();
    isEditing.value = false;
    emit('show-toast', `已保存规则：${currentRule.value.name}`);
  } catch (error) {
    emit('show-toast', error instanceof Error ? error.message : '规则保存失败', 'error');
  }
}
async function handleDeleteRule(id: string, name: string) {
  if (!window.confirm(`确定删除规则【${name}】吗？`)) return;
  await ruleStorage.deleteCustomRule(id);
  await loadRules();
  emit('show-toast', `已删除规则：${name}`);
}
async function handleToggleRule(rule: CustomSiteRule) {
  rule.enabled = !rule.enabled;
  await ruleStorage.saveCustomRule(rule);
  await loadRules();
  emit('show-toast', `已${rule.enabled ? '启用' : '禁用'}规则：${rule.name}`);
}
async function setMappingStatus(rule: CustomSiteRule, field: CustomFieldMapping, status: CustomRuleStatus) {
  try {
    await ruleStorage.setFieldMappingStatus(rule.id, field.id, status);
    await loadRules();
    emit('show-toast', status === 'DISABLED' ? `已禁用映射：${field.description || field.resumeKey}` : `已启用映射：${field.description || field.resumeKey}`);
  } catch (error) {
    emit('show-toast', error instanceof Error ? error.message : '映射状态更新失败', 'error');
  }
}
function statusLabel(status?: CustomRuleStatus) {
  return status === 'STALE' ? 'STALE · 已失效' : status === 'DISABLED' ? 'DISABLED · 已禁用' : 'ACTIVE · 健康';
}
function health(rule: CustomSiteRule) {
  const active = rule.fields.filter((field) => (field.status || 'ACTIVE') === 'ACTIVE').length;
  const stale = rule.fields.filter((field) => field.status === 'STALE').length;
  const disabled = rule.fields.filter((field) => field.status === 'DISABLED').length;
  const success = rule.fields.reduce((sum, field) => sum + (field.successCount || 0), 0);
  const failure = rule.fields.reduce((sum, field) => sum + (field.failureCount || 0), 0);
  const lastVerifiedAt = Math.max(0, ...rule.fields.map((field) => field.lastVerifiedAt || 0));
  return { active, stale, disabled, success, failure, lastVerifiedAt };
}
function formatTime(value?: number) {
  if (!value) return '尚未严格验证';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

async function handleExport() {
  const jsonStr = await ruleStorage.exportRulesToJson();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `openjobfill-custom-rules-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  emit('show-toast', '规则配置文件已成功导出！');
}
function handleImport() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const count = await ruleStorage.importRulesFromJson(await file.text());
      await loadRules();
      emit('show-toast', `成功导入 ${count} 条自定义规则！`);
    } catch (error) {
      emit('show-toast', error instanceof Error ? error.message : '规则导入失败', 'error');
    }
  };
  input.click();
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between pb-4 border-b border-slate-200">
      <div>
        <h3 class="text-base font-bold text-slate-800 flex items-center gap-2"><Sliders class="w-5 h-5 text-blue-600" /><span>个人站点规则与健康度</span></h3>
        <p class="text-xs text-slate-500 mt-1">用户确认过的映射优先复用；严格读回持续更新成功/失败健康度。冲突会降级为 STALE，用户可禁用单条映射而不删除历史证据。</p>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" @click="handleImport" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"><Upload class="w-3.5 h-3.5" />导入规则</button>
        <button type="button" @click="handleExport" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"><Download class="w-3.5 h-3.5" />导出规则</button>
        <button type="button" @click="handleCreateRule" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"><Plus class="w-4 h-4" />新增网站规则</button>
      </div>
    </div>

    <div class="p-3 rounded-xl border border-blue-200 bg-blue-50 text-[11px] text-blue-900 flex items-start gap-2">
      <ShieldCheck class="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div><b>健康状态：</b>ACTIVE 可参与匹配；STALE 表示 selector/fingerprint 冲突或连续读回失败，必须编辑/重新绑定后再启用；DISABLED 是用户主动暂停，运行时完全忽略。这里不保存任何简历实际值。</div>
    </div>

    <div v-if="isEditing" class="p-5 bg-white border-2 border-blue-200 rounded-2xl shadow-md space-y-4 animate-fade-in">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <h4 class="font-bold text-sm text-slate-800 flex items-center gap-2"><Edit3 class="w-4 h-4 text-blue-600" />编辑网站规则</h4>
        <div class="flex items-center gap-2"><button type="button" @click="isEditing = false" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold">取消</button><button type="button" @click="handleSaveRule" class="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold">保存此规则</button></div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-xs font-semibold text-slate-700 mb-1">规则名称 *</label><input v-model="currentRule.name" type="text" placeholder="如：某某外企中国区网申门户" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
        <div><label class="block text-xs font-semibold text-slate-700 mb-1">域名匹配模式 *</label><input v-model="currentRule.domainPattern" type="text" placeholder="如：apply.company.com 或 /career/" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
      </div>

      <div class="space-y-2 pt-2">
        <div class="flex items-center justify-between"><div><label class="text-xs font-bold text-slate-700">字段映射（{{ currentRule.fields.length }}）</label><p class="text-[10px] text-slate-400">STALE 映射修改 selector/字段后，可在状态列显式改回 ACTIVE。</p></div><button type="button" @click="handleAddField" class="text-xs font-semibold text-blue-600 flex items-center gap-1"><Plus class="w-3.5 h-3.5" />添加字段映射</button></div>
        <div class="space-y-2">
          <div v-for="(field, idx) in currentRule.fields" :key="field.id" class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
            <div class="grid grid-cols-[24px_1fr_210px_130px_32px] gap-2 items-center">
              <span class="text-slate-400 font-mono font-bold text-center">{{ idx + 1 }}</span>
              <input v-model="field.selector" type="text" placeholder="CSS 选择器" class="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select v-model="field.resumeKey" class="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"><optgroup v-for="group in RESUME_KEY_OPTIONS" :key="group.group" :label="group.group"><option v-for="opt in group.options" :key="opt.value" :value="opt.value">{{ opt.label }} ({{ opt.value }})</option></optgroup></select>
              <select v-model="field.status" class="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-semibold"><option value="ACTIVE">ACTIVE</option><option value="STALE">STALE</option><option value="DISABLED">DISABLED</option></select>
              <button type="button" @click="handleRemoveField(idx)" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50" title="删除此映射"><Trash2 class="w-4 h-4" /></button>
            </div>
            <div class="grid grid-cols-[1fr_1fr] gap-2 pl-8">
              <input v-model="field.description" type="text" placeholder="说明备注（可选）" class="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs" />
              <div class="text-[10px] text-slate-500 flex items-center gap-3 px-2"><span>验证成功 {{ field.successCount || 0 }}</span><span>失败 {{ field.failureCount || 0 }}</span><span>{{ formatTime(field.lastVerifiedAt) }}</span><span v-if="field.lastFailureReason" class="text-rose-600 truncate" :title="field.lastFailureReason">{{ field.lastFailureReason }}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="space-y-3">
      <div v-if="rules.length === 0" class="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200"><Sliders class="w-10 h-10 text-slate-300 mx-auto mb-2" /><p class="text-sm font-semibold text-slate-600">暂无个人站点规则</p><p class="text-xs text-slate-400 mt-1">可在填写预览或人工点选时保存映射，也可在这里手动创建。</p></div>

      <div v-for="rule in rules" :key="rule.id" class="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div class="p-4 flex items-center justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2"><span :class="['w-2 h-2 rounded-full', rule.enabled ? 'bg-emerald-500' : 'bg-slate-300']"></span><h4 class="font-bold text-sm text-slate-800 truncate">{{ rule.name }}</h4><span class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-mono">{{ rule.domainPattern }}</span></div>
            <div class="flex items-center flex-wrap gap-2 text-[10px] mt-2">
              <span class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">ACTIVE {{ health(rule).active }}</span>
              <span v-if="health(rule).stale" class="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100">STALE {{ health(rule).stale }}</span>
              <span v-if="health(rule).disabled" class="px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">DISABLED {{ health(rule).disabled }}</span>
              <span class="text-slate-500">验证成功 {{ health(rule).success }} · 失败 {{ health(rule).failure }}</span>
              <span class="text-slate-400">最近严格验证：{{ formatTime(health(rule).lastVerifiedAt) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" @click="expandedRuleId = expandedRuleId === rule.id ? null : rule.id" class="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1"><Activity class="w-3.5 h-3.5" />健康详情<ChevronDown class="w-3 h-3" /></button>
            <button type="button" @click="handleToggleRule(rule)" :class="['px-2.5 py-1 rounded-lg text-xs font-semibold transition', rule.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500']">{{ rule.enabled ? '规则已启用' : '规则已禁用' }}</button>
            <button type="button" @click="handleEditRule(rule)" class="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50" title="编辑/重新绑定规则"><Edit3 class="w-4 h-4" /></button>
            <button type="button" @click="handleDeleteRule(rule.id, rule.name)" class="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50" title="删除规则"><Trash2 class="w-4 h-4" /></button>
          </div>
        </div>

        <div v-if="expandedRuleId === rule.id" class="border-t border-slate-100 bg-slate-50/60 p-3 space-y-2">
          <div v-for="field in rule.fields" :key="field.id" class="rounded-xl border border-slate-200 bg-white p-2.5 text-[10px]">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0"><div class="font-semibold text-slate-700 truncate">{{ field.description || field.resumeKey }} → <span class="font-mono text-blue-700">{{ field.resumeKey }}</span></div><div class="mt-0.5 font-mono text-slate-400 truncate" :title="field.selector">{{ field.selector }}</div></div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <span :class="['px-1.5 py-0.5 rounded border font-bold', field.status === 'STALE' ? 'bg-rose-50 border-rose-200 text-rose-700' : field.status === 'DISABLED' ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-emerald-50 border-emerald-200 text-emerald-700']">{{ statusLabel(field.status) }}</span>
                <button v-if="field.status === 'ACTIVE'" type="button" @click="setMappingStatus(rule, field, 'DISABLED')" class="px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100">禁用</button>
                <button v-else-if="field.status === 'DISABLED'" type="button" @click="setMappingStatus(rule, field, 'ACTIVE')" class="px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50">重新启用</button>
                <button v-else type="button" @click="handleEditRule(rule)" class="px-2 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50">编辑重绑</button>
              </div>
            </div>
            <div class="mt-1.5 flex items-center flex-wrap gap-3 text-slate-500"><span>成功 {{ field.successCount || 0 }}</span><span>失败 {{ field.failureCount || 0 }}</span><span>最近验证 {{ formatTime(field.lastVerifiedAt) }}</span><span v-if="field.lastFailureReason" class="text-rose-600 flex items-center gap-1"><AlertTriangle class="w-3 h-3" />{{ field.lastFailureReason }}</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
