<script setup lang="ts">
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-vue-next';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

defineProps<{
  toasts: ToastMessage[];
}>();

const emit = defineEmits<{
  (e: 'dismiss', id: string): void;
}>();
</script>

<template>
  <aside
    class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full"
    aria-label="系统状态通知"
  >
    <transition-group
      enter-active-class="transition duration-200 ease-out transform"
      enter-from-class="translate-y-2 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in transform"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="translate-y-2 opacity-0 scale-95"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        role="status"
        aria-live="polite"
        :class="[
          'pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl shadow-lg border backdrop-blur-md text-xs font-medium',
          toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900 shadow-emerald-500/10' : '',
          toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-900 shadow-red-500/10' : '',
          toast.type === 'info' ? 'bg-blue-50/95 border-blue-200 text-blue-900 shadow-blue-500/10' : '',
        ]"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <CheckCircle2 v-if="toast.type === 'success'" class="w-4 h-4 text-emerald-600 flex-shrink-0" aria-hidden="true" />
          <AlertCircle v-else-if="toast.type === 'error'" class="w-4 h-4 text-red-600 flex-shrink-0" aria-hidden="true" />
          <Info v-else class="w-4 h-4 text-blue-600 flex-shrink-0" aria-hidden="true" />
          <span class="truncate">{{ toast.text }}</span>
        </div>
        <button
          type="button"
          @click="emit('dismiss', toast.id)"
          class="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800 transition focus-visible:ring-2 focus-visible:ring-blue-500 flex-shrink-0"
          aria-label="关闭通知"
        >
          <X class="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </transition-group>
  </aside>
</template>
