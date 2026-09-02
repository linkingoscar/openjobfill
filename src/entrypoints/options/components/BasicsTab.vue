<script setup lang="ts">
import { ref } from 'vue';
import type { StandardResume } from '@/types/resume';
import type { FieldMeta, ResumeV5 } from '@/types/trustedResume';
import { resumeStorage } from '@/core/storage/resumeStorage';
import { getResumeValue, migrateToResumeV5 } from '@/core/schema/trustedResume';

const props = defineProps<{ resume: StandardResume }>();
const trusted = props.resume as StandardResume & {
  fieldMeta?: Record<string, FieldMeta>;
  variantType?: 'master' | 'job-variant';
  parentResumeId?: string;
  variantContext?: { company?: string; role?: string; jobFamily?: string; jdSnapshotId?: string };
};
trusted.fieldMeta ||= {};
if (!props.resume.basics.currentLocation) props.resume.basics.currentLocation = { city: '' };
if (!props.resume.basics.nativePlace) props.resume.basics.nativePlace = { city: '' };
const creatingVariant = ref(false);
const variantError = ref('');
const variantBusy = ref(false);
const variantDiffs = ref<Array<{ label: string; master?: string; variant?: string }>>([]);
const showVariantDiffs = ref(false);

function meta(path: string): FieldMeta | undefined { return trusted.fieldMeta?.[path]; }
function confirm(path: string) {
  const now = Date.now();
  const current = meta(path);
  trusted.fieldMeta![path] = {
    source: 'manual',
    confidence: 1,
    evidence: current?.evidence || [{ type: 'manual' }],
    confirmed: true,
    locked: current?.locked || false,
    confirmedAt: current?.confirmedAt || now,
    updatedAt: now,
    autoFillEnabled: current?.autoFillEnabled !== false,
  };
}
function toggleLock(path: string) {
  confirm(path);
  trusted.fieldMeta![path].locked = !trusted.fieldMeta![path].locked;
  trusted.fieldMeta![path].updatedAt = Date.now();
}
function toggleAutoFill(path: string) {
  confirm(path);
  trusted.fieldMeta![path].autoFillEnabled = trusted.fieldMeta![path].autoFillEnabled === false;
  trusted.fieldMeta![path].updatedAt = Date.now();
}
function sourceLabel(path: string): string {
  const source = meta(path)?.source;
  return ({ manual: '人工', 'local-parser': '本地解析', 'ai-parser': 'AI 候选', 'json-import': 'JSON', derived: '推导', 'site-learned': '站点学习' } as Record<string, string>)[source || ''] || '未确认';
}
function formatDiffValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '未设置';
  if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 120)}…` : value;
  return JSON.stringify(value);
}
async function getRawVariant(): Promise<{ variant: ResumeV5; master: ResumeV5 } | null> {
  if (trusted.variantType !== 'job-variant' || !trusted.parentResumeId) return null;
  const all = await resumeStorage.getAllResumes();
  const rawVariant = all.find((item) => item.id === props.resume.id);
  const rawMaster = all.find((item) => item.id === trusted.parentResumeId);
  if (!rawVariant || !rawMaster) return null;
  return { variant: migrateToResumeV5(rawVariant), master: migrateToResumeV5(rawMaster) };
}
async function toggleVariantComparison() {
  if (showVariantDiffs.value) {
    showVariantDiffs.value = false;
    return;
  }
  variantBusy.value = true;
  variantError.value = '';
  try {
    const pair = await getRawVariant();
    if (!pair) throw new Error('找不到该岗位版本对应的主档案');
    const rows: Array<{ label: string; master?: string; variant?: string }> = [];
    for (const path of pair.variant.variantOverrides || []) {
      rows.push({
        label: path,
        master: formatDiffValue(getResumeValue(pair.master, path)),
        variant: formatDiffValue(getResumeValue(pair.variant, path)),
      });
    }
    if (pair.variant.variantOrdering?.projects?.length) rows.push({ label: '项目顺序', master: '主档案顺序', variant: pair.variant.variantOrdering.projects.join(' → ') });
    if (pair.variant.variantOrdering?.experiences?.length) rows.push({ label: '经历顺序', master: '主档案顺序', variant: pair.variant.variantOrdering.experiences.join(' → ') });
    if (pair.variant.variantPresentation?.highlightSkills?.length) rows.push({ label: '技能高亮', master: '无岗位专属高亮', variant: pair.variant.variantPresentation.highlightSkills.join('、') });
    if (pair.variant.variantPresentation?.selectedLinkKeys?.length) rows.push({ label: '岗位链接选择', master: '全部已保存链接', variant: pair.variant.variantPresentation.selectedLinkKeys.join('、') });
    for (const override of pair.variant.variantTextOverrides || []) {
      const collection = override.collection === 'projects' ? pair.master.projects : pair.master.experiences;
      const record = collection.find((item) => item.id === override.recordId) as Record<string, unknown> | undefined;
      rows.push({
        label: `${override.collection}.${override.recordId}.${override.field}`,
        master: formatDiffValue(record?.[override.field]),
        variant: formatDiffValue(override.value),
      });
    }
    for (const [path, value] of Object.entries(pair.variant.fieldMeta || {})) {
      rows.push({
        label: `可信状态 · ${path}`,
        master: formatDiffValue(pair.master.fieldMeta?.[path] ? { confirmed: pair.master.fieldMeta[path].confirmed, locked: pair.master.fieldMeta[path].locked } : undefined),
        variant: formatDiffValue({ confirmed: value.confirmed, locked: value.locked, autoFillEnabled: value.autoFillEnabled !== false }),
      });
    }
    variantDiffs.value = rows;
    showVariantDiffs.value = true;
  } catch (error) {
    variantError.value = error instanceof Error ? error.message : '版本对比失败';
  } finally {
    variantBusy.value = false;
  }
}
async function resetVariantToMaster() {
  if (variantBusy.value) return;
  if (!window.confirm('将清除当前岗位版本的字段覆盖、排序、短文案、高亮/链接选择和版本级可信状态，使其重新完整继承主档案。岗位名称和公司上下文会保留。继续吗？')) return;
  variantBusy.value = true;
  variantError.value = '';
  try {
    const pair = await getRawVariant();
    if (!pair) throw new Error('找不到该岗位版本对应的主档案');
    pair.variant.variantOverrides = [];
    pair.variant.variantOrdering = {};
    pair.variant.variantPresentation = {};
    pair.variant.variantTextOverrides = [];
    pair.variant.fieldMeta = {};
    await resumeStorage.saveResume(pair.variant);
    await resumeStorage.setActiveResumeId(pair.variant.id);
    window.location.reload();
  } catch (error) {
    variantError.value = error instanceof Error ? error.message : '还原岗位版本失败';
    variantBusy.value = false;
  }
}
async function createVariantFromCurrent() {
  if (creatingVariant.value) return;
  creatingVariant.value = true;
  variantError.value = '';
  try {
    const variant = await resumeStorage.createJobVariant(props.resume.id, {
      role: props.resume.basics.expectedRole || undefined,
      jobFamily: trusted.variantContext?.jobFamily,
    });
    await resumeStorage.setActiveResumeId(variant.id);
    window.location.reload();
  } catch (error) {
    variantError.value = error instanceof Error ? error.message : '创建岗位版本失败';
    creatingVariant.value = false;
  }
}
</script>

<template>
  <div class="space-y-4 text-xs font-sans">
    <div class="p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 space-y-3">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="font-bold">可信求职档案 · {{ trusted.variantType === 'job-variant' ? '岗位版本' : '主档案' }}</div>
          <div class="mt-1 text-[11px] text-blue-700">修改字段后会标记为人工确认；锁定字段不会被后续导入或 AI 覆盖。可单独关闭某字段的自动填写。</div>
          <div v-if="trusted.variantType === 'job-variant'" class="mt-1 text-[10px] text-blue-700">
            岗位上下文：{{ trusted.variantContext?.company || '未指定公司' }} · {{ trusted.variantContext?.role || resume.basics.expectedRole || '未指定岗位' }}
          </div>
          <p v-if="variantError" class="mt-1 text-[10px] text-rose-700">{{ variantError }}</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap justify-end">
          <div v-if="trusted.parentResumeId" class="text-[10px] px-2 py-1 rounded bg-white border border-blue-200">继承自 {{ trusted.parentResumeId }}</div>
          <button v-if="trusted.variantType === 'job-variant'" type="button" @click="toggleVariantComparison" :disabled="variantBusy" class="px-2.5 py-1.5 rounded-lg border border-violet-300 bg-white text-violet-700 font-semibold hover:bg-violet-50 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-violet-500">
            {{ showVariantDiffs ? '收起差异' : '对比主档案' }}
          </button>
          <button v-if="trusted.variantType === 'job-variant'" type="button" @click="resetVariantToMaster" :disabled="variantBusy" class="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-800 font-semibold hover:bg-amber-50 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-amber-500">还原继承</button>
          <button type="button" @click="createVariantFromCurrent" :disabled="creatingVariant" class="px-2.5 py-1.5 rounded-lg border border-blue-300 bg-white text-blue-700 font-semibold hover:bg-blue-100 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500">
            {{ creatingVariant ? '创建中…' : trusted.variantType === 'job-variant' ? '从主档案再建岗位版本' : '创建岗位版本' }}
          </button>
        </div>
      </div>

      <div v-if="showVariantDiffs && trusted.variantType === 'job-variant'" class="rounded-xl border border-violet-200 bg-white overflow-hidden">
        <div class="px-3 py-2 border-b border-violet-100 flex items-center justify-between"><span class="font-bold text-violet-800">主档案 ↔ 当前岗位版本差异</span><span class="text-[10px] text-slate-400">仅显示显式覆盖/排序/展示与版本级可信状态</span></div>
        <div v-if="variantDiffs.length" class="max-h-48 overflow-y-auto divide-y divide-slate-100">
          <div v-for="row in variantDiffs" :key="row.label" class="grid grid-cols-[150px_1fr_1fr] gap-2 px-3 py-2 text-[10px]">
            <div class="font-semibold text-slate-700 break-all">{{ row.label }}</div>
            <div><div class="text-slate-400 mb-0.5">主档案</div><div class="text-slate-600 break-words">{{ row.master }}</div></div>
            <div><div class="text-violet-500 mb-0.5">岗位版本</div><div class="text-violet-800 break-words">{{ row.variant }}</div></div>
          </div>
        </div>
        <div v-else class="px-3 py-3 text-[11px] text-emerald-700">当前岗位版本没有显式差异，已完整继承主档案。</div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div>
        <div class="flex items-center justify-between gap-2 mb-1"><label for="basics-name" class="font-semibold text-slate-700">姓名</label><span class="text-[10px] text-slate-400">{{ sourceLabel('basics.name') }}</span></div>
        <input id="basics-name" v-model="resume.basics.name" @change="confirm('basics.name')" type="text" autocomplete="name" placeholder="如：张三" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <div class="mt-1 flex gap-1"><button type="button" @click="toggleLock('basics.name')" :class="['px-2 py-0.5 rounded border text-[10px]', meta('basics.name')?.locked ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-500']">{{ meta('basics.name')?.locked ? '已锁定' : '锁定' }}</button><button type="button" @click="toggleAutoFill('basics.name')" class="px-2 py-0.5 rounded border border-slate-200 bg-white text-[10px] text-slate-500">{{ meta('basics.name')?.autoFillEnabled === false ? '不自动填' : '允许自动填' }}</button></div>
      </div>

      <div>
        <label for="basics-gender" class="block font-semibold text-slate-700 mb-1">性别</label>
        <select id="basics-gender" v-model="resume.basics.gender" @change="confirm('basics.gender')" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="男">男</option><option value="女">女</option><option value="其他">其他</option></select>
      </div>

      <div>
        <div class="flex items-center justify-between gap-2 mb-1"><label for="basics-phone" class="font-semibold text-slate-700">手机号码</label><span class="text-[10px] text-slate-400">{{ sourceLabel('basics.phone') }}</span></div>
        <input id="basics-phone" v-model="resume.basics.phone" @change="confirm('basics.phone')" type="tel" autocomplete="tel" placeholder="11位手机号码" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="button" @click="toggleLock('basics.phone')" :class="['mt-1 px-2 py-0.5 rounded border text-[10px]', meta('basics.phone')?.locked ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-500']">{{ meta('basics.phone')?.locked ? '已锁定' : '锁定' }}</button>
      </div>

      <div>
        <div class="flex items-center justify-between gap-2 mb-1"><label for="basics-email" class="font-semibold text-slate-700">电子邮箱</label><span class="text-[10px] text-slate-400">{{ sourceLabel('basics.email') }}</span></div>
        <input id="basics-email" v-model="resume.basics.email" @change="confirm('basics.email')" type="email" autocomplete="email" placeholder="your-email@example.com" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="button" @click="toggleLock('basics.email')" :class="['mt-1 px-2 py-0.5 rounded border text-[10px]', meta('basics.email')?.locked ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-500']">{{ meta('basics.email')?.locked ? '已锁定' : '锁定' }}</button>
      </div>

      <div>
        <label for="basics-birthDate" class="block font-semibold text-slate-700 mb-1">出生日期 (YYYY-MM-DD)</label>
        <input id="basics-birthDate" v-model="resume.basics.birthDate" @change="confirm('basics.birthDate')" type="date" autocomplete="bday" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <div class="flex items-center justify-between gap-2 mb-1"><label for="basics-idCardNumber" class="font-semibold text-slate-700">身份证号</label><span class="text-[10px] text-rose-500">Critical</span></div>
        <input id="basics-idCardNumber" v-model="resume.basics.idCardNumber" @change="confirm('basics.idCardNumber')" type="text" placeholder="18位身份证号" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="button" @click="toggleLock('basics.idCardNumber')" :class="['mt-1 px-2 py-0.5 rounded border text-[10px]', meta('basics.idCardNumber')?.locked ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-500']">{{ meta('basics.idCardNumber')?.locked ? '已锁定' : '锁定' }}</button>
      </div>

      <div>
        <label for="basics-politicalStatus" class="block font-semibold text-slate-700 mb-1">政治面貌</label>
        <select id="basics-politicalStatus" v-model="resume.basics.politicalStatus" @change="confirm('basics.politicalStatus')" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="群众">群众</option><option value="共青团员">共青团员</option><option value="中共预备党员">中共预备党员</option><option value="中共党员">中共党员</option><option value="其他">其他</option></select>
      </div>

      <div><label for="basics-ethnicity" class="block font-semibold text-slate-700 mb-1">民族</label><input id="basics-ethnicity" v-model="resume.basics.ethnicity" @change="confirm('basics.ethnicity')" type="text" placeholder="如：汉族" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
      <div><label for="basics-maritalStatus" class="block font-semibold text-slate-700 mb-1">婚姻状况</label><select id="basics-maritalStatus" v-model="resume.basics.maritalStatus" @change="confirm('basics.maritalStatus')" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="未婚">未婚</option><option value="已婚">已婚</option><option value="保密">保密</option></select></div>
      <div><label for="basics-city" class="block font-semibold text-slate-700 mb-1">现居省份 / 城市</label><input id="basics-city" v-model="resume.basics.currentLocation!.city" @change="confirm('basics.currentLocation.city')" placeholder="如：北京市海淀区" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
      <div><label for="basics-nativePlace" class="block font-semibold text-slate-700 mb-1">籍贯 (省-市)</label><input id="basics-nativePlace" v-model="resume.basics.nativePlace!.city" @change="confirm('basics.nativePlace.city')" placeholder="如：山东省济南市" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
      <div><label for="basics-expectedRole" class="block font-semibold text-slate-700 mb-1">期望职位</label><input id="basics-expectedRole" v-model="resume.basics.expectedRole" @change="confirm('basics.expectedRole')" placeholder="如：前端开发工程师" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
      <div class="col-span-3"><label for="basics-selfEvaluation" class="block font-semibold text-slate-700 mb-1">自我评价</label><textarea id="basics-selfEvaluation" v-model="resume.basics.selfEvaluation" @change="confirm('basics.selfEvaluation')" rows="3" placeholder="简要概括你的专业技能优势、个人工作风格与团队协作能力..." class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea></div>
    </div>
  </div>
</template>
