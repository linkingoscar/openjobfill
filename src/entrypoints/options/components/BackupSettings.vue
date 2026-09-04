<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { backupManager, type BackupSummary } from '@/core/storage/backupManager';
import ConfirmModal from './ConfirmModal.vue';

const props = defineProps<{ beforeRestore?: () => Promise<void> }>();
const emit = defineEmits<{
  (e: 'data-restored'): void;
  (e: 'show-toast', type: 'success' | 'error' | 'info', text: string): void;
}>();
const busy = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const mode = ref<'merge' | 'overwrite'>('merge');
const pending = ref<{ json: string; name: string; mode: 'merge' | 'overwrite'; summary: BackupSummary; current: BackupSummary } | null>(null);
const recovery = ref<BackupSummary | null>(null);
const confirmRecovery = ref(false);
const dateLabel = (date: string | null) => date ? new Date(date).toLocaleString() : '未知（旧格式）';
const countLabel = (data: BackupSummary) => `${data.resumes} 份简历、${data.rules} 条规则、${data.domains} 个域名、${data.applications} 条投递`;
const reportError = (error: unknown) => emit('show-toast', 'error', error instanceof Error ? error.message : '操作失败，请重试');
const refreshRecovery = async () => { recovery.value = await backupManager.getRecoveryPointSummary(); };
onMounted(() => { void refreshRecovery().catch(reportError); });

const chooseFile = (nextMode: 'merge' | 'overwrite') => {
  if (busy.value) return;
  mode.value = nextMode;
  fileInput.value?.click();
};
const previewFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || busy.value) return;
  const selectedMode = mode.value;
  busy.value = true;
  pending.value = null;
  try {
    const json = await file.text();
    const summary = backupManager.previewBackup(json);
    await props.beforeRestore?.();
    const current = backupManager.previewBackup(await backupManager.exportFullBackup());
    pending.value = { json, name: file.name, mode: selectedMode, summary, current };
  } catch (error) { reportError(error); }
  finally { busy.value = false; input.value = ''; }
};

const restore = async (fromRecovery = false) => {
  if (busy.value || (!fromRecovery && !pending.value)) return;
  const selected = pending.value;
  busy.value = true;
  confirmRecovery.value = false;
  try {
    await props.beforeRestore?.();
    if (fromRecovery) await backupManager.restoreRecoveryPoint();
    else await backupManager.importFullBackup(selected!.json, selected!.mode);
    pending.value = null;
    emit('data-restored');
    emit('show-toast', 'success', fromRecovery ? '已恢复覆盖前的数据' : selected?.mode === 'overwrite' ? '备份恢复完成；覆盖前的数据已保留在本地恢复点' : '备份合并导入完成');
  } catch (error) { reportError(error); }
  finally {
    busy.value = false;
    await refreshRecovery().catch(reportError);
  }
};

const exportAll = async () => {
  if (busy.value) return;
  busy.value = true;
  try {
    await props.beforeRestore?.();
    const json = await backupManager.exportFullBackup();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `OpenJobFill_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    emit('show-toast', 'success', '已开始下载备份，请确认文件已保存');
  } catch (error) { reportError(error); }
  finally { busy.value = false; }
};
</script>

<template>
  <section aria-labelledby="backup-heading" class="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
    <h3 id="backup-heading" class="text-sm font-bold text-slate-800">本地数据备份与恢复</h3>
    <p class="text-slate-600 leading-relaxed">备份包含简历、规则、自定义域名和投递记录；不包含 AI 配置与 Key、填写历史和浏览器设置，换设备后需要重新配置。</p>
    <p class="text-amber-700">备份和本地恢复点包含个人敏感资料，请妥善保管。恢复点只保留最近一次覆盖前状态，不代替独立文件备份。</p>
    <div class="flex flex-wrap gap-2">
      <button type="button" @click="exportAll" :disabled="busy" class="px-3 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500">导出全部本地数据</button>
      <button type="button" @click="chooseFile('merge')" :disabled="busy" class="px-3 py-2 rounded-lg bg-white border disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500">合并导入备份</button>
      <button type="button" @click="chooseFile('overwrite')" :disabled="busy" class="px-3 py-2 rounded-lg bg-white border border-amber-300 text-amber-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-amber-500">完全覆盖恢复</button>
      <input ref="fileInput" type="file" accept=".json" class="hidden" aria-label="选择本地备份文件" @change="previewFile" />
    </div>
    <p v-if="busy" role="status">正在处理，请勿关闭页面…</p>
    <section v-if="pending" aria-labelledby="restore-preview-heading" class="p-4 rounded-xl border border-amber-300 bg-amber-50 space-y-2">
      <h4 id="restore-preview-heading" class="font-bold">恢复前预览：{{ pending.mode === 'overwrite' ? '覆盖' : '合并' }}</h4>
      <p class="break-all">文件：{{ pending.name }}</p>
      <p>备份时间：{{ dateLabel(pending.summary.exportedAt) }}</p>
      <p>文件包含：{{ countLabel(pending.summary) }}</p>
      <p>当前数据：{{ countLabel(pending.current) }}</p>
      <p v-if="!pending.summary.isFullBackup">这是旧版简历数组文件，只影响简历，其他模块保持不变。</p>
      <p v-if="pending.mode === 'overwrite'" class="font-semibold text-amber-900">所选模块将被替换，包括文件中未包含的当前记录。确认前不会恢复；覆盖前会先保存本地恢复点，保存失败则停止。</p>
      <p v-else>导入记录会与当前数据合并；同 ID 简历和规则可能更新。请先核对文件来源。</p>
      <div class="flex gap-2">
        <button type="button" :disabled="busy" @click="restore()" class="px-3 py-2 rounded-lg bg-amber-700 text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-amber-500">{{ pending.mode === 'overwrite' ? '确认覆盖并保留恢复点' : '确认合并导入' }}</button>
        <button type="button" :disabled="busy" @click="pending = null" class="px-3 py-2 rounded-lg bg-white border focus-visible:ring-2 focus-visible:ring-blue-500">取消恢复</button>
      </div>
    </section>
    <div v-if="recovery" class="border-t pt-3 space-y-2">
      <p>最近覆盖前恢复点：{{ dateLabel(recovery.exportedAt) }} · {{ countLabel(recovery) }}</p>
      <button type="button" :disabled="busy" @click="confirmRecovery = true" class="px-3 py-2 rounded-lg bg-white border text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">恢复覆盖前的数据</button>
    </div>
    <ConfirmModal :is-open="confirmRecovery" title="恢复覆盖前的数据" :message="recovery ? `将恢复 ${dateLabel(recovery.exportedAt)} 的 ${countLabel(recovery)}，替换当前四类数据。当前状态会成为新的恢复点。` : ''" confirm-text="确认恢复" @cancel="confirmRecovery = false" @confirm="restore(true)" />
  </section>
</template>
