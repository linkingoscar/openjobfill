<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { AlertTriangle, X } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  }>(),
  {
    title: '确认操作',
    confirmText: '确定删除',
    cancelText: '取消',
    danger: true,
  }
);

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('cancel');
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div
    v-if="isOpen"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-modal-title"
    aria-describedby="confirm-modal-desc"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in font-sans"
  >
    <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md flex flex-col overflow-hidden text-slate-800">
      <header class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div :class="['w-8 h-8 rounded-xl flex items-center justify-center', danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600']">
            <AlertTriangle class="w-4 h-4" aria-hidden="true" />
          </div>
          <h2 id="confirm-modal-title" class="text-sm font-bold text-slate-900">
            {{ title }}
          </h2>
        </div>
        <button
          type="button"
          @click="emit('cancel')"
          class="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="关闭确认窗口"
        >
          <X class="w-4 h-4" aria-hidden="true" />
        </button>
      </header>

      <div class="p-6">
        <p id="confirm-modal-desc" class="text-xs text-slate-600 leading-relaxed">
          {{ message }}
        </p>
      </div>

      <footer class="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
        <button
          type="button"
          @click="emit('cancel')"
          class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {{ cancelText }}
        </button>
        <button
          type="button"
          @click="emit('confirm')"
          :class="[
            'px-4 py-2 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-[0.98] focus-visible:ring-2',
            danger
              ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20 focus-visible:ring-red-500'
              : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 focus-visible:ring-blue-500'
          ]"
        >
          {{ confirmText }}
        </button>
      </footer>
    </div>
  </div>
</template>
