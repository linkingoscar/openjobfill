<script setup lang="ts">
import type { StandardResume } from '@/types/resume';

const props = defineProps<{
  resume: StandardResume;
}>();

// Ensure nested location objects exist
if (!props.resume.basics.currentLocation) {
  props.resume.basics.currentLocation = { city: '' };
}
if (!props.resume.basics.nativePlace) {
  props.resume.basics.nativePlace = { city: '' };
}
const updateWorkingYears = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const value = input.valueAsNumber;
  props.resume.basics.workingYears = Number.isFinite(value) && value >= 0 ? value : undefined;
};
</script>

<template>
  <div class="grid grid-cols-3 gap-4 text-xs font-sans">
    <div class="col-span-3 text-slate-500 rounded-lg bg-blue-50 p-3">未确认的信息可以留空，不会自动当作“否”或“0”。请核对旧档案中的国家、工龄，并在教育背景中确认学习形式。</div>
    <div>
      <label for="basics-country" class="block font-semibold text-slate-700 mb-1">国家 / 地区</label>
      <input id="basics-country" v-model="resume.basics.country" placeholder="未填写；如：中国 / United States" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
    </div>
    <div>
      <label for="basics-working-years" class="block font-semibold text-slate-700 mb-1">工作年限</label>
      <input id="basics-working-years" :value="resume.basics.workingYears" @input="updateWorkingYears" type="number" min="0" step="0.5" placeholder="未确认请留空；0 表示零年经验" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
    </div>
    <div>
      <label for="basics-name" class="block font-semibold text-slate-700 mb-1">姓名</label>
      <input
        id="basics-name"
        v-model="resume.basics.name"
        type="text"
        autocomplete="name"
        placeholder="如：张三"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label for="basics-gender" class="block font-semibold text-slate-700 mb-1">性别</label>
      <select
        id="basics-gender"
        v-model="resume.basics.gender"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="男">男</option>
        <option value="女">女</option>
        <option value="其他">其他</option>
      </select>
    </div>

    <div>
      <label for="basics-phone" class="block font-semibold text-slate-700 mb-1">手机号码</label>
      <input
        id="basics-phone"
        v-model="resume.basics.phone"
        type="tel"
        autocomplete="tel"
        placeholder="11位手机号码"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label for="basics-email" class="block font-semibold text-slate-700 mb-1">电子邮箱</label>
      <input
        id="basics-email"
        v-model="resume.basics.email"
        type="email"
        autocomplete="email"
        placeholder="your-email@example.com"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label for="basics-birthDate" class="block font-semibold text-slate-700 mb-1">出生日期 (YYYY-MM-DD)</label>
      <input
        id="basics-birthDate"
        v-model="resume.basics.birthDate"
        type="date"
        autocomplete="bday"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label for="basics-idCardNumber" class="block font-semibold text-slate-700 mb-1">身份证号</label>
      <input
        id="basics-idCardNumber"
        v-model="resume.basics.idCardNumber"
        type="text"
        placeholder="18位身份证号"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label for="basics-politicalStatus" class="block font-semibold text-slate-700 mb-1">政治面貌</label>
      <select
        id="basics-politicalStatus"
        v-model="resume.basics.politicalStatus"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="群众">群众</option>
        <option value="共青团员">共青团员</option>
        <option value="中共预备党员">中共预备党员</option>
        <option value="中共党员">中共党员</option>
        <option value="其他">其他</option>
      </select>
    </div>

    <div>
      <label for="basics-ethnicity" class="block font-semibold text-slate-700 mb-1">民族</label>
      <input
        id="basics-ethnicity"
        v-model="resume.basics.ethnicity"
        type="text"
        placeholder="如：汉族"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label for="basics-maritalStatus" class="block font-semibold text-slate-700 mb-1">婚姻状况</label>
      <select
        id="basics-maritalStatus"
        v-model="resume.basics.maritalStatus"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="未婚">未婚</option>
        <option value="已婚">已婚</option>
        <option value="保密">保密</option>
      </select>
    </div>

    <div>
      <label for="basics-city" class="block font-semibold text-slate-700 mb-1">现居省份 / 城市</label>
      <input
        id="basics-city"
        v-model="resume.basics.currentLocation!.city"
        placeholder="如：北京市海淀区"
        type="text"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label for="basics-nativePlace" class="block font-semibold text-slate-700 mb-1">籍贯 (省-市)</label>
      <input
        id="basics-nativePlace"
        v-model="resume.basics.nativePlace!.city"
        placeholder="如：山东省济南市"
        type="text"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label for="basics-expectedRole" class="block font-semibold text-slate-700 mb-1">期望职位</label>
      <input
        id="basics-expectedRole"
        v-model="resume.basics.expectedRole"
        placeholder="如：前端开发工程师"
        type="text"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div class="col-span-3">
      <label for="basics-selfEvaluation" class="block font-semibold text-slate-700 mb-1">自我评价</label>
      <textarea
        id="basics-selfEvaluation"
        v-model="resume.basics.selfEvaluation"
        rows="3"
        placeholder="简要概括你的专业技能优势、个人工作风格与团队协作能力..."
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      ></textarea>
    </div>
  </div>
</template>
