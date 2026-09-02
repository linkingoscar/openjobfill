<script setup lang="ts">
import type { CustomQABankItem, QABankAnswerVersion } from '@/types/resume';
import { Plus, Trash2, HelpCircle, Layers3 } from 'lucide-vue-next';

const props = defineProps<{
  qaBank: CustomQABankItem[];
}>();

const nowVersion = (answer = '', maxChars?: number): QABankAnswerVersion => ({
  id: `qa-v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  answer,
  maxChars,
  createdAt: Date.now(),
  confirmedByUser: true,
  source: 'manual',
});

const addQA = () => {
  props.qaBank.push({
    id: 'qa-' + Date.now(),
    keyword: '',
    answer: '',
    question: '',
    scope: 'global',
    versions: [],
  });
};

const removeQA = (index: number) => {
  props.qaBank.splice(index, 1);
};

const syncQuestion = (qa: CustomQABankItem) => {
  qa.question = qa.keyword;
};

const syncBaseAnswer = (qa: CustomQABankItem) => {
  qa.versions ||= [];
  const base = qa.versions.find((version) => !version.maxChars);
  if (base) {
    base.answer = qa.answer;
    base.confirmedByUser = true;
    base.source = 'manual';
  } else if (qa.answer.trim()) {
    qa.versions.unshift(nowVersion(qa.answer));
  }
};

const addVersion = (qa: CustomQABankItem, maxChars?: number) => {
  qa.versions ||= [];
  qa.versions.push(nowVersion('', maxChars));
};

const removeVersion = (qa: CustomQABankItem, versionId: string) => {
  qa.versions = (qa.versions || []).filter((version) => version.id !== versionId);
};

const scopeLabel = (scope?: CustomQABankItem['scope']) => ({
  global: '全局通用',
  'job-family': '岗位类别',
  'company-domain': '公司域名',
  'job-posting': '当前岗位',
  domain: '公司域名（旧）',
}[scope || 'global']);
</script>

<template>
  <div class="space-y-4 font-sans text-xs">
    <div class="flex justify-between items-center gap-3">
      <div>
        <h3 class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <HelpCircle class="w-4 h-4 text-blue-600" aria-hidden="true" />
          <span>作用域问答库</span>
        </h3>
        <p class="mt-1 text-[11px] text-slate-500">匹配优先级：当前岗位 ＞ 公司域名 ＞ 岗位类别 ＞ 全局。只有用户确认过的答案版本才会进入填写预览。</p>
      </div>
      <button
        type="button"
        @click="addQA"
        class="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="添加一条预置问答"
      >
        <Plus class="w-3.5 h-3.5" aria-hidden="true" />
        <span>添加问答</span>
      </button>
    </div>

    <div v-if="qaBank.length === 0" class="text-center py-8 text-slate-500 border border-dashed rounded-xl bg-slate-50">
      暂未添加问答。建议先保存职业规划、个人优势等通用答案，公司专属问题请使用更窄作用域。
    </div>

    <div
      v-for="(qa, idx) in qaBank"
      :key="qa.id || idx"
      class="p-4 border border-slate-200 rounded-xl bg-slate-50 relative space-y-3"
    >
      <button
        type="button"
        @click="removeQA(idx)"
        class="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition focus-visible:ring-2 focus-visible:ring-red-500"
        :aria-label="`删除第 ${idx + 1} 条问答`"
        :title="`删除第 ${idx + 1} 条问答`"
      >
        <Trash2 class="w-4 h-4" aria-hidden="true" />
      </button>

      <div class="pr-8 grid grid-cols-[1fr_150px] gap-3">
        <div>
          <label :for="`qa-${idx}-keyword`" class="block font-medium text-slate-700 mb-1">问题 / 关键词</label>
          <input
            :id="`qa-${idx}-keyword`"
            v-model="qa.keyword"
            @input="syncQuestion(qa)"
            type="text"
            placeholder="如：为什么选择我们 / 未来职业规划"
            class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label :for="`qa-${idx}-scope`" class="block font-medium text-slate-700 mb-1">作用域</label>
          <select
            :id="`qa-${idx}-scope`"
            v-model="qa.scope"
            class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="global">全局通用</option>
            <option value="job-family">岗位类别</option>
            <option value="company-domain">公司域名</option>
            <option value="job-posting">当前岗位</option>
          </select>
        </div>
      </div>

      <div v-if="qa.scope === 'job-family'" class="max-w-md">
        <label :for="`qa-${idx}-job-family`" class="block font-medium text-slate-700 mb-1">岗位类别标识</label>
        <input :id="`qa-${idx}-job-family`" v-model="qa.jobFamily" placeholder="如：frontend / product / data" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div v-else-if="qa.scope === 'company-domain' || qa.scope === 'domain'" class="max-w-md">
        <label :for="`qa-${idx}-company-domain`" class="block font-medium text-slate-700 mb-1">公司招聘域名</label>
        <input :id="`qa-${idx}-company-domain`" v-model="qa.companyDomain" placeholder="如：jobs.example.com" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div v-else-if="qa.scope === 'job-posting'" class="max-w-md">
        <label :for="`qa-${idx}-posting`" class="block font-medium text-slate-700 mb-1">岗位快照 / Posting ID</label>
        <input :id="`qa-${idx}-posting`" v-model="qa.jobPostingId" placeholder="与当前岗位版本 jdSnapshotId 对应" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <div class="flex items-center justify-between gap-2 mb-1">
          <label :for="`qa-${idx}-answer`" class="font-medium text-slate-700">原始答案</label>
          <span class="px-2 py-0.5 rounded-full border border-slate-200 bg-white text-[10px] text-slate-500">{{ scopeLabel(qa.scope) }}</span>
        </div>
        <textarea
          :id="`qa-${idx}-answer`"
          v-model="qa.answer"
          @input="syncBaseAnswer(qa)"
          rows="3"
          placeholder="保存你亲自确认过的答案。自动填写生成的文本不会反向学习。"
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        ></textarea>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div class="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
          <div class="font-bold text-slate-700 flex items-center gap-1.5"><Layers3 class="w-3.5 h-3.5 text-indigo-600" />答案版本</div>
          <div class="flex items-center gap-1">
            <button type="button" @click="addVersion(qa, 100)" class="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50">+100 字</button>
            <button type="button" @click="addVersion(qa, 200)" class="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50">+200 字</button>
            <button type="button" @click="addVersion(qa, 500)" class="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50">+500 字</button>
          </div>
        </div>
        <div v-if="!(qa.versions?.length)" class="px-3 py-3 text-[11px] text-slate-500">暂无独立短版。原始答案仍可作为已确认版本使用。</div>
        <div v-else class="divide-y divide-slate-100">
          <div v-for="version in qa.versions" :key="version.id" class="p-3 grid grid-cols-[92px_1fr_28px] gap-2 items-start">
            <div>
              <label class="text-[10px] text-slate-500">目标字数</label>
              <input v-model.number="version.maxChars" type="number" min="1" placeholder="原始" class="mt-1 w-full px-2 py-1 border border-slate-200 rounded-md" />
              <div class="mt-1 text-[10px]" :class="version.confirmedByUser ? 'text-emerald-600' : 'text-amber-600'">{{ version.confirmedByUser ? '已确认' : '待确认' }} · {{ version.source === 'ai-confirmed' ? 'AI 采用' : '手工' }}</div>
            </div>
            <textarea v-model="version.answer" rows="2" class="w-full px-2 py-1.5 border border-slate-200 rounded-md" placeholder="对应字数版本答案"></textarea>
            <button type="button" @click="removeVersion(qa, version.id)" class="p-1 rounded text-slate-400 hover:text-red-600" aria-label="删除答案版本"><Trash2 class="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
