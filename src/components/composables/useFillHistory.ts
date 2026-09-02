import { ref, type Ref } from 'vue';
import { fillHistoryStorage, MAX_FILL_HISTORY_RECORDS } from '@/core/storage/fillHistoryStorage';
import type { FillHistoryRecord } from '@/types/fillHistory';
import type { FillResult } from '@/types/adapter';
import { SnapshotRecorder } from '@/core/pipeline/snapshotRecorder';

/** 填表历史的读取、脱敏导出和异常记录边界。 */
export function useFillHistory(copyToastMessage: Ref<string>, currentAdapterName: Ref<string>) {
  const fillHistoryRecords = ref<FillHistoryRecord[]>([]);
  const isHistoryLoading = ref(false);

  const loadFillHistory = async () => {
    isHistoryLoading.value = true;
    try {
      fillHistoryRecords.value = await fillHistoryStorage.getRecords();
    } catch (error) {
      console.warn('[OpenJobFill] 读取填表历史失败:', error);
    } finally {
      isHistoryLoading.value = false;
    }
  };

  const persistFillHistory = async (result: FillResult) => {
    try {
      const record = fillHistoryStorage.createRecord(result, {
        pageUrl: window.location.href,
        pageTitle: document.title,
      });
      fillHistoryRecords.value = await fillHistoryStorage.append(record);
    } catch (error) {
      console.warn('[OpenJobFill] 保存填表历史失败:', error);
    }
  };

  const persistOperationError = async (phase: 'analysis' | 'execution', error: unknown) => {
    try {
      const record = fillHistoryStorage.createErrorRecord({
        pageUrl: window.location.href,
        pageTitle: document.title,
        adapterName: currentAdapterName.value,
        phase,
        error,
      });
      fillHistoryRecords.value = await fillHistoryStorage.append(record);
    } catch (storageError) {
      console.warn('[OpenJobFill] 保存异常诊断失败:', storageError);
    }
  };

  const formatHistoryTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const showHistoryToast = (message: string) => {
    copyToastMessage.value = message;
    setTimeout(() => { copyToastMessage.value = ''; }, 2500);
  };

  const handleCopyDiagnosticHistory = async () => {
    if (fillHistoryRecords.value.length === 0) {
      showHistoryToast('暂无可复制的填表历史');
      return;
    }
    try {
      await navigator.clipboard.writeText(await fillHistoryStorage.exportJSON());
      showHistoryToast(`已复制 ${fillHistoryRecords.value.length} 次脱敏诊断记录`);
    } catch (error) {
      console.error('[OpenJobFill] 复制诊断记录失败:', error);
      showHistoryToast('复制失败，请改用导出 JSON');
    }
  };

  const handleExportDiagnosticHistory = async () => {
    if (fillHistoryRecords.value.length === 0) {
      showHistoryToast('暂无可导出的填表历史');
      return;
    }
    const blob = new Blob([await fillHistoryStorage.exportJSON()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `openjobfill-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showHistoryToast(`已导出 ${fillHistoryRecords.value.length} 次脱敏诊断记录`);
  };

  const handleExportReplayPackage = async () => {
    try {
      const packageJSON = await SnapshotRecorder.exportProblemPackage();
      const parsed = JSON.parse(packageJSON) as { sessions?: unknown[] };
      if (!parsed.sessions?.length) {
        showHistoryToast('暂无可导出的运行快照');
        return;
      }
      const blob = new Blob([packageJSON], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `openjobfill-replay-package-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showHistoryToast(`已导出 ${parsed.sessions.length} 次运行的脱敏问题包`);
    } catch (error) {
      console.error('[OpenJobFill] 导出回放问题包失败:', error);
      showHistoryToast('导出回放问题包失败');
    }
  };

  const handleImportReplayPackage = () => {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = '.json,application/json';
    picker.addEventListener('change', async () => {
      const file = picker.files?.[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) { showHistoryToast('问题包超过 8 MiB 限制'); return; }
      try {
        const result = await SnapshotRecorder.importProblemPackage(await file.text());
        showHistoryToast(`已导入 ${result.imported} 次运行快照（已重新脱敏）`);
      } catch (error) {
        console.error('[OpenJobFill] 导入回放问题包失败:', error);
        showHistoryToast(error instanceof Error ? error.message : '导入回放问题包失败');
      }
    }, { once: true });
    picker.click();
  };

  const handleRunReplay = async () => {
    try {
      const { replayRunSnapshot } = await import('@/core/pipeline/deterministicReplay');
      const recent = JSON.parse(await SnapshotRecorder.exportProblemPackage()).sessions;
      if (!recent.length) { showHistoryToast('暂无可回放的运行'); return; }
      const report = await replayRunSnapshot(recent[0]);
      showHistoryToast(report.replaySuccess
        ? `确定性回放通过：${report.executionCount} 个执行阶段、${report.sectionCount} 个区块、${report.aiResponseCount} 次 AI 响应；未写入网页`
        : `回放未通过：${report.differences[0]?.reason}`);
    } catch (error) { showHistoryToast(error instanceof Error ? error.message : '回放失败'); }
  };

  const handleClearFillHistory = async () => {
    if (fillHistoryRecords.value.length === 0) return;
    if (!window.confirm(`确认清空最近 ${fillHistoryRecords.value.length} 次填表历史？此操作无法撤销。`)) return;
    await fillHistoryStorage.clear();
    fillHistoryRecords.value = [];
    showHistoryToast('填表历史已清空');
  };

  return {
    fillHistoryRecords,
    isHistoryLoading,
    MAX_FILL_HISTORY_RECORDS,
    loadFillHistory,
    persistFillHistory,
    persistOperationError,
    formatHistoryTime,
    handleCopyDiagnosticHistory,
    handleExportDiagnosticHistory,
    handleExportReplayPackage,
    handleImportReplayPackage,
    handleRunReplay,
    handleClearFillHistory,
  };
}
