<script setup lang="ts">
import { CheckCircle, AlertTriangle, Copy, Lightbulb, Highlighter, BookmarkPlus } from 'lucide-vue-next';
import type { JDAnalysisResult } from '@/core/matcher/jdMatcher';
import type { ApplicationTrackerDraft } from '@/core/storage/applicationDraftStorage';
defineProps<{
  jdAnalysis: JDAnalysisResult | null;
  applicationDraft: ApplicationTrackerDraft | null;
  isHighlightingJD: boolean;
}>();
const emit = defineEmits<{
  (event: 'archive' | 'dismiss-draft' | 'analyze' | 'toggle-highlight'): void;
  (event: 'copy-keyword', keyword: string): void;
}>();
</script>

<template>
        <!-- TAB 2: 岗位 JD 匹配度分析 -->
        <div 
          id="drawer-panel-jd"
          role="tabpanel"
          aria-labelledby="drawer-tab-jd"
          class="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div class="p-4 flex-1 overflow-y-auto space-y-3.5">
            <div
              v-if="applicationDraft"
              class="p-3 rounded-xl border border-emerald-200 bg-emerald-50/80 space-y-2"
              role="status"
              aria-live="polite"
            >
              <div class="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle class="w-4 h-4 text-emerald-600" aria-hidden="true" />
                检测到申请成功，已生成投递草稿
              </div>
              <p class="text-[11px] text-emerald-900 truncate" :title="`${applicationDraft.job.companyName} · ${applicationDraft.job.jobTitle}`">
                {{ applicationDraft.job.companyName }} · {{ applicationDraft.job.jobTitle }}
              </p>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="emit('archive')"
                  class="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  确认归档为已投递
                </button>
                <button
                  type="button"
                  @click="emit('dismiss-draft')"
                  class="px-2.5 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-800 text-[11px] font-bold hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  稍后
                </button>
              </div>
            </div>

            <!-- Job Title & Score Gauge -->
            <div class="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500">识别到的岗位名称:</span>
                <button 
                  type="button" 
                  @click="emit('analyze')" 
                  class="text-blue-600 font-bold hover:underline"
                >
                  重新分析
                </button>
              </div>
              <div class="font-bold text-slate-900 text-sm truncate">
                {{ jdAnalysis?.jobTitle || '正在识别页面岗位...' }}
              </div>

              <!-- Score Bar -->
              <div class="pt-1">
                <div class="flex items-center justify-between text-xs mb-1">
                  <span class="font-semibold text-slate-700">关键词覆盖率</span>
                  <span 
                    :class="[
                      'font-extrabold text-sm',
                      jdAnalysis?.matchScore == null ? 'text-slate-500' : jdAnalysis.matchScore >= 80 ? 'text-emerald-600' : jdAnalysis.matchScore >= 60 ? 'text-amber-600' : 'text-rose-600'
                    ]"
                  >
                    {{ jdAnalysis?.matchScore == null ? '无法评估' : `${jdAnalysis.matchScore}%` }}
                  </span>
                </div>
                <div v-if="jdAnalysis?.matchScore != null" class="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                  <div 
                    class="h-full transition-all duration-500 rounded-full"
                    :class="(jdAnalysis?.matchScore || 0) >= 80 ? 'bg-emerald-500' : (jdAnalysis?.matchScore || 0) >= 60 ? 'bg-amber-500' : 'bg-rose-500'"
                    :style="{ width: `${jdAnalysis?.matchScore || 0}%` }"
                  ></div>
                </div>
              </div>
              <p class="text-xs text-slate-500">仅比较页面词典关键词，不使用 AI，不代表综合匹配度、初筛通过率或录用概率。</p>
            </div>

            <!-- Matched Keywords -->
            <div class="space-y-1.5">
              <div class="text-xs font-bold text-slate-700 flex items-center gap-1">
                <CheckCircle class="w-3.5 h-3.5 text-emerald-600" />
                <span>已命中的核心技能 ({{ jdAnalysis?.matchedKeywords.length || 0 }})</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="kw in jdAnalysis?.matchedKeywords"
                  :key="kw"
                  class="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold"
                >
                  {{ kw }}
                </span>
                <span v-if="!jdAnalysis?.matchedKeywords?.length" class="text-slate-400 text-xs italic">
                  未检测到完全一致的技能标签
                </span>
              </div>
            </div>

            <!-- Missing Keywords (Click to Copy) -->
            <div class="space-y-1.5">
              <div class="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span class="flex items-center gap-1">
                  <AlertTriangle class="w-3.5 h-3.5 text-amber-500" />
                  <span>岗位提及但简历中缺失的关键词 ({{ jdAnalysis?.missingKeywords.length || 0 }})</span>
                </span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="kw in jdAnalysis?.missingKeywords"
                  :key="kw"
                  type="button"
                  @click="emit('copy-keyword', kw)"
                  class="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  :title="`点击复制【${kw}】`"
                >
                  <span>{{ kw }}</span>
                  <Copy class="w-2.5 h-2.5 opacity-60" />
                </button>
                <span v-if="jdAnalysis?.matchScore != null && !jdAnalysis.missingKeywords.length" class="text-emerald-600 text-xs font-medium">
                  简历已覆盖本次识别到的关键词，仍需人工核对岗位其他要求。
                </span>
              </div>
              <p class="text-xs text-slate-400">点击缺失标签可复制；仅补充真实经历，不要为了提高覆盖率添加不具备的技能。</p>
            </div>

            <!-- Diagnostic Tips -->
            <div class="p-3 bg-blue-50/60 border border-blue-100 rounded-xl space-y-1.5">
              <div class="text-xs font-bold text-blue-900 flex items-center gap-1">
                <Lightbulb class="w-3.5 h-3.5 text-blue-600" />
                <span>分析依据与核对提示</span>
              </div>
              <ul class="text-xs text-blue-800 space-y-1 list-disc list-inside">
                <li v-for="(tip, idx) in jdAnalysis?.diagnosticTips" :key="idx">
                  {{ tip }}
                </li>
              </ul>
            </div>
          </div>

          <!-- Tab 2 Footer -->
          <footer class="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
            <button
              type="button"
              @click="emit('toggle-highlight')"
              :class="[
                'px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition focus-visible:ring-2 focus-visible:ring-amber-500 border',
                isHighlightingJD ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              ]"
              title="在当前招聘网页原文上用荧光笔标记技能词"
            >
              <Highlighter class="w-3.5 h-3.5" :class="isHighlightingJD ? 'text-amber-600 fill-amber-500' : 'text-slate-500'" />
              <span>{{ isHighlightingJD ? '清除荧光' : '网页荧光笔' }}</span>
            </button>
            <button
              type="button"
              @click="emit('archive')"
              class="flex-1 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1 shadow-md shadow-blue-500/20 active:scale-95 transition focus-visible:ring-2 focus-visible:ring-blue-500 text-xs"
            >
              <BookmarkPlus class="w-3.5 h-3.5" />
              <span>归档本岗位</span>
            </button>
          </footer>
        </div>
</template>
