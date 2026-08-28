<script setup lang="ts">
import type { StandardResume, FamilyMember, CertificateItem, LanguageProficiency } from '@/types/resume';
import { Plus, Trash2, ShieldCheck, Heart, MapPin, DollarSign, Award, Users } from 'lucide-vue-next';

const props = defineProps<{
  resume: StandardResume;
}>();

// Ensure nested objects and arrays exist
if (!props.resume.basics.hukouLocation) {
  props.resume.basics.hukouLocation = { province: '', city: '', district: '', detail: '' };
}
if (!props.resume.basics.nativePlace) {
  props.resume.basics.nativePlace = { province: '', city: '', district: '', detail: '' };
}
if (!props.resume.familyMembers) {
  props.resume.familyMembers = [];
}
if (!props.resume.certificates) {
  props.resume.certificates = [];
}
if (!props.resume.languages) {
  props.resume.languages = [];
}

const addFamilyMember = () => {
  props.resume.familyMembers.push({
    id: 'fam-' + Date.now(),
    relation: '父亲',
    name: '',
    company: '',
    jobTitle: '',
    phone: '',
    politicalStatus: '群众',
  });
};

const removeFamilyMember = (index: number) => {
  props.resume.familyMembers.splice(index, 1);
};

const addCertificate = () => {
  props.resume.certificates.push({
    id: 'cert-' + Date.now(),
    name: '',
    issueDate: '',
  });
};

const removeCertificate = (index: number) => {
  props.resume.certificates.splice(index, 1);
};

const addLanguage = () => {
  props.resume.languages.push({
    id: 'lang-' + Date.now(),
    language: '英语',
    proficiency: '熟练',
    score: '',
    certificateName: '大学英语六级 (CET-6)',
  });
};

const removeLanguage = (index: number) => {
  props.resume.languages.splice(index, 1);
};
</script>

<template>
  <div class="space-y-6 text-xs font-sans text-slate-700">
    <!-- 1. 户籍与身体健康 (国企/银行/事业单位高频) -->
    <div class="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
      <div class="flex items-center gap-2 font-bold text-slate-800 text-sm border-b border-slate-200 pb-2">
        <MapPin class="w-4 h-4 text-blue-600" />
        <span>户籍地、生源地与身体健康</span>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">户口所在地 / 户籍</label>
          <input
            v-model="resume.basics.hukouLocation!.detail"
            type="text"
            placeholder="如：山东省济南市历下区"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">生源所在地 / 籍贯</label>
          <input
            v-model="resume.basics.nativePlace!.detail"
            type="text"
            placeholder="如：山东省济南市"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">健康状况</label>
          <select
            v-model="resume.basics.healthStatus"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="">未填写</option>
            <option value="健康">健康</option>
            <option value="良好">良好</option>
            <option value="一般">一般</option>
          </select>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">身高 (cm)</label>
          <input
            v-model="resume.basics.height"
            type="text"
            placeholder="如：178"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">体重 (kg)</label>
          <input
            v-model="resume.basics.weight"
            type="text"
            placeholder="如：68"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">婚姻状况</label>
          <select
            v-model="resume.basics.maritalStatus"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="">未填写</option>
            <option value="未婚">未婚</option>
            <option value="已婚">已婚</option>
            <option value="保密">保密</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 2. 求职意向与到岗时间 -->
    <div class="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
      <div class="flex items-center gap-2 font-bold text-slate-800 text-sm border-b border-slate-200 pb-2">
        <DollarSign class="w-4 h-4 text-emerald-600" />
        <span>求职状态、期望薪酬与到岗时间</span>
      </div>

      <div class="grid grid-cols-4 gap-4">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">当前求职状态</label>
          <select
            v-model="resume.basics.jobStatus"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="">未填写</option>
            <option value="应届毕业生">应届毕业生</option>
            <option value="在校生找实习">在校生找实习</option>
            <option value="离职-随时到岗">离职-随时到岗</option>
            <option value="在职-考虑机会">在职-考虑机会</option>
          </select>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">到岗时间</label>
          <select
            v-model="resume.basics.availableTime"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="">未填写</option>
            <option value="随时">随时</option>
            <option value="1周内">1周内</option>
            <option value="1个月内">1个月内</option>
          </select>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">期望工作城市</label>
          <input
            v-model="resume.basics.expectedCity"
            type="text"
            placeholder="如：北京 / 上海 / 杭州"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">期望月薪 (k)</label>
          <input
            v-model.number="resume.basics.expectedSalaryMin"
            type="number"
            placeholder="如：25"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
      </div>
    </div>

    <!-- 3. 外语能力与专业证书 (CET-4/6, 计算机等级等) -->
    <div class="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
      <div class="flex items-center justify-between border-b border-slate-200 pb-2">
        <div class="flex items-center gap-2 font-bold text-slate-800 text-sm">
          <Award class="w-4 h-4 text-indigo-600" />
          <span>外语能力与证书 (CET-4/6, 软考, 职业资格)</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="addLanguage"
            class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs flex items-center gap-1 transition"
          >
            <Plus class="w-3.5 h-3.5" /> 增加语言
          </button>
          <button
            type="button"
            @click="addCertificate"
            class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs flex items-center gap-1 transition"
          >
            <Plus class="w-3.5 h-3.5" /> 增加证书
          </button>
        </div>
      </div>

      <!-- Languages -->
      <div v-if="resume.languages && resume.languages.length > 0" class="space-y-2">
        <div 
          v-for="(lang, i) in resume.languages" 
          :key="lang.id || i" 
          class="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center gap-3"
        >
          <input
            v-model="lang.language"
            type="text"
            placeholder="语种 (如: 英语)"
            class="w-28 px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
          <input
            v-model="lang.certificateName"
            type="text"
            placeholder="证书等级 (如: 大学英语六级 CET-6 / 雅思 7.5)"
            class="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
          <input
            v-model="lang.score"
            type="text"
            placeholder="成绩/分数 (如: 580)"
            class="w-28 px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
          <button
            type="button"
            @click="removeLanguage(i)"
            class="p-1.5 text-slate-400 hover:text-rose-600 transition"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Certificates -->
      <div v-if="resume.certificates && resume.certificates.length > 0" class="space-y-2">
        <div 
          v-for="(cert, i) in resume.certificates" 
          :key="cert.id || i" 
          class="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center gap-3"
        >
          <input
            v-model="cert.name"
            type="text"
            placeholder="证书全称 (如: 计算机技术与软件专业技术资格 / 教师资格证)"
            class="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
          <input
            v-model="cert.issueDate"
            type="month"
            placeholder="获得年月"
            class="w-36 px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
          <button
            type="button"
            @click="removeCertificate(i)"
            class="p-1.5 text-slate-400 hover:text-rose-600 transition"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div v-if="(!resume.languages || resume.languages.length === 0) && (!resume.certificates || resume.certificates.length === 0)" class="text-center py-4 text-slate-400">
        点击上方按钮可添加英语 CET 成绩、雅思/托福或专业职业资格证书
      </div>
    </div>

    <!-- 4. 家庭成员 (国企/银行校招多卡片必填) -->
    <div class="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
      <div class="flex items-center justify-between border-b border-slate-200 pb-2">
        <div class="flex items-center gap-2 font-bold text-slate-800 text-sm">
          <Users class="w-4 h-4 text-amber-600" />
          <span>家庭成员与主要社会关系 (银行/国企/校招常用)</span>
        </div>
        <button
          type="button"
          @click="addFamilyMember"
          class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-bold text-xs flex items-center gap-1 transition"
        >
          <Plus class="w-3.5 h-3.5" /> 增加家庭成员
        </button>
      </div>

      <div v-if="resume.familyMembers && resume.familyMembers.length > 0" class="space-y-3">
        <div 
          v-for="(fam, i) in resume.familyMembers" 
          :key="fam.id || i" 
          class="p-3 bg-white border border-slate-200 rounded-xl space-y-2 relative group"
        >
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-800 text-xs">家庭成员 {{ i + 1 }}</span>
            <button
              type="button"
              @click="removeFamilyMember(i)"
              class="text-slate-400 hover:text-rose-600 transition"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
          <div class="grid grid-cols-5 gap-3">
            <div>
              <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">关系</label>
              <input
                v-model="fam.relation"
                type="text"
                placeholder="如：父亲 / 母亲 / 配偶"
                class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">姓名</label>
              <input
                v-model="fam.name"
                type="text"
                placeholder="姓名"
                class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">工作单位</label>
              <input
                v-model="fam.company"
                type="text"
                placeholder="工作单位名称"
                class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">职务</label>
              <input
                v-model="fam.jobTitle"
                type="text"
                placeholder="职务"
                class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">联系电话</label>
              <input
                v-model="fam.phone"
                type="tel"
                placeholder="手机号码"
                class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-4 text-slate-400">
        暂无家庭成员记录，如遇银行或央国企网申，可提前添加父母或配偶信息以便自动填表
      </div>
    </div>
  </div>
</template>
