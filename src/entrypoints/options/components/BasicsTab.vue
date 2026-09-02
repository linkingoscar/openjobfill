<script setup lang="ts">
import type { StandardResume } from '@/types/resume';
import type { FieldMeta } from '@/types/trustedResume';

const props = defineProps<{ resume: StandardResume }>();
const trusted = props.resume as StandardResume & { fieldMeta?: Record<string, FieldMeta>; variantType?: 'master' | 'job-variant'; parentResumeId?: string };
trusted.fieldMeta ||= {};
if (!props.resume.basics.currentLocation) props.resume.basics.currentLocation = { city: '' };
if (!props.resume.basics.nativePlace) props.resume.basics.nativePlace = { city: '' };

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
</script>

<template>
  <div class="space-y-4 text-xs font-sans">
    <div class="p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 flex items-center justify-between gap-3">
      <div>
        <div class="font-bold">可信求职档案 · {{ trusted.variantType === 'job-variant' ? '岗位版本' : '主档案' }}</div>
        <div class="mt-1 text-[11px] text-blue-700">修改字段后会标记为人工确认；锁定字段不会被后续导入或 AI 覆盖。可单独关闭某字段的自动填写。</div>
      </div>
      <div v-if="trusted.parentResumeId" class="text-[10px] px-2 py-1 rounded bg-white border border-blue-200">继承自 {{ trusted.parentResumeId }}</div>
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
