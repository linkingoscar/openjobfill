<script setup lang="ts">
import type { StandardResume, FamilyMember, CertificateItem, LanguageProficiency } from '@/types/resume';
import { Plus, Trash2, MapPin, DollarSign, Award, Users, Trophy, BookOpen, Landmark } from 'lucide-vue-next';

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
if (!props.resume.basics.birthPlace) {
  props.resume.basics.birthPlace = { province: '', city: '', district: '', detail: '' };
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
if (!props.resume.awards) props.resume.awards = [];
if (!props.resume.academicAchievements) props.resume.academicAchievements = [];
if (!props.resume.campusExperiences) props.resume.campusExperiences = [];

const addFamilyMember = () => {
  props.resume.familyMembers.push({
    id: 'fam-' + Date.now(),
    relation: '',
    name: '',
    company: '',
    jobTitle: '',
    phone: '',
    politicalStatus: '',
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
    language: '',
    proficiency: '',
    score: '',
    certificateName: '',
  });
};

const removeLanguage = (index: number) => {
  props.resume.languages.splice(index, 1);
};

const addAward = () => props.resume.awards!.push({ id: 'award-' + Date.now(), name: '' });
const removeAward = (index: number) => props.resume.awards!.splice(index, 1);
const addAcademicAchievement = () => props.resume.academicAchievements!.push({ id: 'academic-' + Date.now(), title: '' });
const removeAcademicAchievement = (index: number) => props.resume.academicAchievements!.splice(index, 1);
const addCampusExperience = () => props.resume.campusExperiences!.push({
  id: 'campus-' + Date.now(), organization: '', title: '', startDate: '', endDate: '', description: '', responsibility: '',
});
const removeCampusExperience = (index: number) => props.resume.campusExperiences!.splice(index, 1);
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
          <label class="block font-semibold text-slate-700 mb-1">出生地</label>
          <input
            v-model="resume.basics.birthPlace!.detail"
            type="text"
            placeholder="如：辽宁省辽阳市"
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

        <div class="col-span-3">
          <label class="block font-semibold text-slate-700 mb-1">兴趣爱好 / 个人特长</label>
          <textarea
            v-model="resume.basics.hobbies"
            rows="2"
            placeholder="如：羽毛球、摄影、长跑；也可填写个人特长"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-y"
          ></textarea>
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
          <div class="grid grid-cols-6 gap-3">
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
            <div>
              <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">户籍所在地</label>
              <input
                v-model="fam.hukouLocation"
                type="text"
                placeholder="如：辽宁省辽阳市"
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

    <!-- 5. 获奖与荣誉 -->
    <div class="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
      <div class="flex items-center justify-between border-b border-slate-200 pb-2">
        <div class="flex items-center gap-2 font-bold text-slate-800 text-sm">
          <Trophy class="w-4 h-4 text-orange-600" />
          <span>获奖、奖学金与荣誉称号</span>
        </div>
        <button type="button" @click="addAward" class="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg font-bold flex items-center gap-1">
          <Plus class="w-3.5 h-3.5" /> 增加奖项
        </button>
      </div>
      <div v-for="(awardItem, i) in resume.awards" :key="awardItem.id" class="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
        <div class="flex items-center gap-2">
          <input v-model="awardItem.name" type="text" placeholder="奖项 / 奖学金 / 荣誉名称" class="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg" />
          <input v-model="awardItem.issueDate" type="text" placeholder="获奖时间" class="w-32 px-2.5 py-1.5 border border-slate-200 rounded-lg" />
          <button type="button" @click="removeAward(i)" class="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 class="w-4 h-4" /></button>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <input v-model="awardItem.level" type="text" placeholder="授奖级别：国家级 / 省级 / 校级" class="px-2.5 py-1.5 border border-slate-200 rounded-lg" />
          <input v-model="awardItem.grade" type="text" placeholder="获奖等级：一等奖 / 铜奖" class="px-2.5 py-1.5 border border-slate-200 rounded-lg" />
          <input v-model="awardItem.role" type="text" placeholder="项目角色（可选）" class="px-2.5 py-1.5 border border-slate-200 rounded-lg" />
        </div>
        <textarea v-model="awardItem.description" rows="2" placeholder="获奖说明（可选）" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg resize-y"></textarea>
      </div>
      <div v-if="!resume.awards?.length" class="text-center py-3 text-slate-400">暂无奖项记录</div>
    </div>

    <!-- 6. 学术成果 -->
    <div class="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
      <div class="flex items-center justify-between border-b border-slate-200 pb-2">
        <div class="flex items-center gap-2 font-bold text-slate-800 text-sm">
          <BookOpen class="w-4 h-4 text-violet-600" />
          <span>论文、会议与学术成果</span>
        </div>
        <button type="button" @click="addAcademicAchievement" class="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg font-bold flex items-center gap-1">
          <Plus class="w-3.5 h-3.5" /> 增加成果
        </button>
      </div>
      <div v-for="(academic, i) in resume.academicAchievements" :key="academic.id" class="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
        <div class="flex items-center gap-2">
          <input v-model="academic.title" type="text" placeholder="论文 / 成果名称" class="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg" />
          <button type="button" @click="removeAcademicAchievement(i)" class="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 class="w-4 h-4" /></button>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <input v-model="academic.venue" type="text" placeholder="会议 / 期刊名称" class="px-2.5 py-1.5 border border-slate-200 rounded-lg" />
          <input v-model="academic.authorOrder" type="text" placeholder="作者排序" class="px-2.5 py-1.5 border border-slate-200 rounded-lg" />
          <input v-model="academic.date" type="text" placeholder="发表 / 参会时间" class="px-2.5 py-1.5 border border-slate-200 rounded-lg" />
        </div>
        <input v-model="academic.url" type="url" placeholder="论文 / 成果链接" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg" />
        <textarea v-model="academic.abstract" rows="2" placeholder="摘要（可选）" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg resize-y"></textarea>
      </div>
      <div v-if="!resume.academicAchievements?.length" class="text-center py-3 text-slate-400">暂无学术成果记录</div>
    </div>

    <!-- 7. 学生干部经历 -->
    <div class="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
      <div class="flex items-center justify-between border-b border-slate-200 pb-2">
        <div class="flex items-center gap-2 font-bold text-slate-800 text-sm">
          <Landmark class="w-4 h-4 text-cyan-700" />
          <span>学生干部与校内任职经历</span>
        </div>
        <button type="button" @click="addCampusExperience" class="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg font-bold flex items-center gap-1">
          <Plus class="w-3.5 h-3.5" /> 增加经历
        </button>
      </div>
      <div v-for="(campus, i) in resume.campusExperiences" :key="campus.id" class="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
        <div class="flex items-center gap-2">
          <input v-model="campus.organization" type="text" placeholder="学校 / 班级 / 学生组织" class="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg" />
          <input v-model="campus.title" type="text" placeholder="担任职务" class="w-52 px-2.5 py-1.5 border border-slate-200 rounded-lg" />
          <button type="button" @click="removeCampusExperience(i)" class="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 class="w-4 h-4" /></button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <input v-model="campus.startDate" type="text" placeholder="开始时间，如 2024-09" class="px-2.5 py-1.5 border border-slate-200 rounded-lg" />
          <input v-model="campus.endDate" type="text" placeholder="结束时间或至今" class="px-2.5 py-1.5 border border-slate-200 rounded-lg" />
        </div>
        <textarea v-model="campus.description" rows="2" placeholder="经历描述" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg resize-y"></textarea>
        <textarea v-model="campus.responsibility" rows="2" placeholder="主要职责" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg resize-y"></textarea>
      </div>
      <div v-if="!resume.campusExperiences?.length" class="text-center py-3 text-slate-400">暂无学生干部经历</div>
    </div>
  </div>
</template>
