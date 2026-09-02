import { ref, type Ref } from 'vue';
import { analyzeJDMatch, clearJDHighlights, highlightJDOnWebpage, type JDAnalysisResult } from '@/core/matcher/jdMatcher';
import type { StandardResume } from '@/types/resume';
import type { DrawerTab } from '@/types/floatingBall';

/** JD 匹配分析与网页标注状态边界。 */
export function useJDAnalysis(
  currentResume: Ref<StandardResume | null>,
  drawerTab: Ref<DrawerTab>,
  copyToastMessage: Ref<string>,
) {
  const jdAnalysis = ref<JDAnalysisResult | null>(null);
  const isAnalyzingJD = ref(false);
  const isHighlightingJD = ref(false);

  const handleAnalyzeJD = () => {
    if (!currentResume.value) return;
    isAnalyzingJD.value = true;
    try {
      jdAnalysis.value = analyzeJDMatch(currentResume.value);
    } catch (error) {
      console.error('[OpenJobFill] JD Match error:', error);
    } finally {
      isAnalyzingJD.value = false;
    }
  };

  const handleSwitchToJDTab = () => {
    drawerTab.value = 'jdMatch';
    if (!jdAnalysis.value) handleAnalyzeJD();
  };

  const handleToggleJDHighlight = () => {
    if (!currentResume.value) return;
    if (!isHighlightingJD.value) {
      const result = highlightJDOnWebpage(currentResume.value);
      isHighlightingJD.value = true;
      copyToastMessage.value = `🖍️ 已在网页标注技能词 (命中 ${result.matchedCount} / 缺失 ${result.missingCount})`;
    } else {
      clearJDHighlights();
      isHighlightingJD.value = false;
      copyToastMessage.value = '已清除网页 JD 荧光笔标记';
    }
    setTimeout(() => { copyToastMessage.value = ''; }, 2500);
  };

  return {
    jdAnalysis,
    isAnalyzingJD,
    isHighlightingJD,
    handleAnalyzeJD,
    handleSwitchToJDTab,
    handleToggleJDHighlight,
  };
}
