<script setup lang="ts">
import type { CustomQABankItem } from '@/types/resume';
import { Plus, Trash2, HelpCircle } from 'lucide-vue-next';

const props = defineProps<{
  qaBank: CustomQABankItem[];
}>();

const addQA = () => {
  props.qaBank.push({
    id: 'qa-' + Date.now(),
    keyword: '',
    answer: '',
  });
};

const removeQA = (index: number) => {
  props.qaBank.splice(index, 1);
};
</script>

<template>
  <div class="space-y-4 font-sans text-xs">
    <div class="flex justify-between items-center">
      <h3 class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
        <HelpCircle class="w-4 h-4 text-blue-600" aria-hidden="true" />
        <span>自定义问答库 (智能匹配开放性大题 / 自我评价)</span>
      </h3>
      <button
        type="button"
        @click="addQA"
        class="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="添加一条预置问答"
      >
        <Plus class="w-3.5 h-3.5" aria-hidden="true" />
        <span>添加预置问答</span>
      </button>
    </div>

    <div v-if="qaBank.length === 0" class="text-center py-8 text-slate-500 border border-dashed rounded-xl bg-slate-50">
      暂未添加问答库，你可以预置如「职业规划」「优缺点」「为何加入本公司」等常见开放性问答
    </div>

    <div
      v-for="(qa, idx) in qaBank"
      :key="qa.id || idx"
      class="p-4 border border-slate-200 rounded-xl bg-slate-50 relative space-y-2"
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

      <div>
        <label :for="`qa-${idx}-keyword`" class="block font-medium text-slate-700 mb-1">
          问题关键词 (如: 自我评价、职业规划、个人优缺点、抗压能力)
        </label>
        <input
          :id="`qa-${idx}-keyword`"
          v-model="qa.keyword"
          type="text"
          placeholder="如：未来的职业发展规划"
          class="w-full max-w-md px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label :for="`qa-${idx}-answer`" class="block font-medium text-slate-700 mb-1">回答内容</label>
        <textarea
          :id="`qa-${idx}-answer`"
          v-model="qa.answer"
          rows="3"
          placeholder="预先写好你的高质量回答，当页面出现匹配关键词时插件将自动填入..."
          class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        ></textarea>
      </div>
    </div>
  </div>
</template>
