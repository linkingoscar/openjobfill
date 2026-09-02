<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { 
  Plus, 
  Search, 
  Download, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  Calendar, 
  Briefcase, 
  Building2, 
  DollarSign, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  ArrowRight,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-vue-next';
import { trackerStorage } from '@/core/storage/trackerStorage';
import type { JobApplicationRecord, ApplicationStatus, TrackerEditableField } from '@/types/tracker';
import { createApplicationId, TRACKER_EDITABLE_FIELDS } from '@/core/tracker/trackerSchema';

const emit = defineEmits<{
  (e: 'show-toast', msg: string): void;
}>();

const applications = ref<JobApplicationRecord[]>([]);
const searchQuery = ref('');
const filterStatus = ref<string>('all');
const isModalOpen = ref(false);
const editingRecord = ref<JobApplicationRecord | null>(null);

// 表单临时编辑对象
const formData = ref<JobApplicationRecord>({
  id: '',
  companyName: '',
  jobTitle: '',
  appliedDate: new Date().toISOString().slice(0, 10),
  status: 'applied',
  jobUrl: '',
  salary: '',
  resumeVersionTitle: '',
  notes: '',
  source: 'manual',
  updatedAt: ''
});

const COLUMNS: { key: ApplicationStatus; label: string; color: string; bg: string }[] = [
  { key: 'applied', label: '已投递', color: 'text-blue-700', bg: 'bg-blue-50/80 border-blue-200' },
  { key: 'screening', label: '简历初筛', color: 'text-sky-700', bg: 'bg-sky-50/80 border-sky-200' },
  { key: 'assessment', label: '笔试/测评', color: 'text-amber-700', bg: 'bg-amber-50/80 border-amber-200' },
  { key: 'interview1', label: '技术一面', color: 'text-indigo-700', bg: 'bg-indigo-50/80 border-indigo-200' },
  { key: 'interview2', label: '业务/二面', color: 'text-purple-700', bg: 'bg-purple-50/80 border-purple-200' },
  { key: 'hr', label: 'HR 终面', color: 'text-pink-700', bg: 'bg-pink-50/80 border-pink-200' },
  { key: 'offer', label: '已收 Offer 🎉', color: 'text-emerald-700', bg: 'bg-emerald-50/80 border-emerald-200' },
  { key: 'rejected', label: '流程结束', color: 'text-slate-500', bg: 'bg-slate-100 border-slate-200' }
];

const loadApplications = async () => {
  applications.value = await trackerStorage.getApplications();
};

onMounted(() => {
  loadApplications();
});

// 统计指标
const stats = computed(() => {
  const total = applications.value.length;
  const interviewing = applications.value.filter(a => ['interview1', 'interview2', 'hr'].includes(a.status)).length;
  const offers = applications.value.filter(a => a.status === 'offer').length;
  const active = applications.value.filter(a => a.status !== 'rejected' && a.status !== 'offer').length;
  return { total, interviewing, offers, active };
});

const filteredApplications = computed(() => {
  let list = applications.value;
  if (filterStatus.value !== 'all') {
    list = list.filter(a => a.status === filterStatus.value);
  }
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter(a => 
      a.companyName.toLowerCase().includes(q) || 
      a.jobTitle.toLowerCase().includes(q) || 
      (a.notes && a.notes.toLowerCase().includes(q))
    );
  }
  return list;
});

const getColumnItems = (statusKey: ApplicationStatus) => {
  return filteredApplications.value.filter(a => a.status === statusKey);
};

const handleOpenCreateModal = () => {
  editingRecord.value = null;
  formData.value = {
    schemaVersion: 2,
    id: createApplicationId(),
    clientRequestId: createApplicationId('application'),
    companyName: '',
    jobTitle: '',
    appliedDate: new Date().toISOString().slice(0, 10),
    status: 'applied',
    jobUrl: '',
    salary: '',
    resumeVersionTitle: '',
    notes: '',
    source: 'manual',
    syncState: 'local',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  isModalOpen.value = true;
};

const handleEditRecord = (record: JobApplicationRecord) => {
  editingRecord.value = record;
  formData.value = JSON.parse(JSON.stringify(record));
  isModalOpen.value = true;
};

const handleSaveRecord = async () => {
  if (!formData.value.companyName.trim() || !formData.value.jobTitle.trim()) {
    emit('show-toast', '请填写公司名称和职位名称');
    return;
  }
  const userFields = TRACKER_EDITABLE_FIELDS.filter((field) => editingRecord.value
    ? formData.value[field] !== editingRecord.value[field]
    : formData.value[field] !== undefined && formData.value[field] !== '');
  const userSources = Object.fromEntries(userFields.map((field) => [field, 'user'])) as Partial<Record<TrackerEditableField, 'user'>>;
  await trackerStorage.saveApplication({
    ...formData.value,
    source: editingRecord.value ? 'user_confirmed' : 'manual',
    fieldSources: { ...(formData.value.fieldSources || {}), ...userSources },
    lockedFields: [...new Set([...(formData.value.lockedFields || []), ...userFields])],
  });
  await loadApplications();
  isModalOpen.value = false;
  emit('show-toast', '投递记录保存成功！');
};

const handleDeleteRecord = async (id: string, name: string) => {
  if (!confirm(`确定要删除【${name}】的投递记录吗？`)) return;
  await trackerStorage.deleteApplication(id);
  await loadApplications();
  emit('show-toast', '已删除该投递记录');
};

const handleQuickChangeStatus = async (record: JobApplicationRecord, nextStatus: ApplicationStatus) => {
  await trackerStorage.updateApplicationStatus(record.id, nextStatus);
  await loadApplications();
  emit('show-toast', `已将状态更新为【${COLUMNS.find(c => c.key === nextStatus)?.label}】`);
};

const handleExportCSV = async () => {
  const csvContent = await trackerStorage.exportApplicationsToCSV();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `openjobfill-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  emit('show-toast', '已导出投递进度 CSV 表格！');
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header & Stats Bar -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
      <div>
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp class="w-5 h-5 text-blue-600" />
          <span>求职投递进度追踪看板 (Job Tracker)</span>
        </h2>
        <p class="text-xs text-slate-500 mt-0.5">
          实时管理各岗位面试流转状态与面试备忘，本地安全存储，告别投递遗忘。
        </p>
      </div>

      <!-- Stats Pill Grid -->
      <div class="flex items-center gap-3 flex-wrap">
        <div class="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center min-w-[70px]">
          <div class="text-xs text-slate-500 font-semibold">总投递</div>
          <div class="text-base font-extrabold text-slate-800">{{ stats.total }}</div>
        </div>
        <div class="px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-xl text-center min-w-[70px]">
          <div class="text-xs text-blue-600 font-semibold">进行中</div>
          <div class="text-base font-extrabold text-blue-700">{{ stats.active }}</div>
        </div>
        <div class="px-3.5 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-center min-w-[70px]">
          <div class="text-xs text-indigo-600 font-semibold">面试中</div>
          <div class="text-base font-extrabold text-indigo-700">{{ stats.interviewing }}</div>
        </div>
        <div class="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-center min-w-[70px]">
          <div class="text-xs text-emerald-600 font-semibold">Offer 🎉</div>
          <div class="text-base font-extrabold text-emerald-700">{{ stats.offers }}</div>
        </div>
      </div>
    </div>

    <!-- Actions & Filter Toolbar -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="flex items-center gap-2.5 w-full sm:w-auto">
        <div class="relative flex-1 sm:w-72">
          <Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索公司、岗位或面试笔记..."
            class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <select
          v-model="filterStatus"
          class="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">全部状态</option>
          <option v-for="col in COLUMNS" :key="col.key" :value="col.key">{{ col.label }}</option>
        </select>
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
        <button
          type="button"
          @click="handleExportCSV"
          class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
        >
          <FileSpreadsheet class="w-3.5 h-3.5" />
          <span>导出 CSV</span>
        </button>
        <button
          type="button"
          @click="handleOpenCreateModal"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20 flex items-center gap-1.5"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>手动添加投递</span>
        </button>
      </div>
    </div>

    <!-- Kanban Board Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      <div
        v-for="col in COLUMNS"
        :key="col.key"
        class="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3 flex flex-col min-h-[300px]"
      >
        <!-- Column Header -->
        <div class="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200">
          <div class="flex items-center gap-1.5">
            <span :class="['font-bold text-xs', col.color]">{{ col.label }}</span>
            <span class="px-1.5 py-0.2 bg-white border border-slate-200 rounded-full text-2xs font-extrabold text-slate-600">
              {{ getColumnItems(col.key).length }}
            </span>
          </div>
        </div>

        <!-- Card List -->
        <div class="space-y-2.5 flex-1 overflow-y-auto max-h-[600px] pr-0.5">
          <div
            v-for="item in getColumnItems(col.key)"
            :key="item.id"
            class="p-3 bg-white hover:border-blue-300 border border-slate-200/80 rounded-xl shadow-2xs hover:shadow-sm transition group"
          >
            <div class="flex items-start justify-between gap-1.5">
              <h4 class="font-bold text-xs text-slate-900 leading-snug line-clamp-1">
                {{ item.companyName }}
              </h4>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  type="button"
                  @click="handleEditRecord(item)"
                  class="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600"
                  title="编辑"
                >
                  <Edit3 class="w-3 h-3" />
                </button>
                <button
                  type="button"
                  @click="handleDeleteRecord(item.id, item.companyName)"
                  class="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-600"
                  title="删除"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              </div>
            </div>

            <div class="text-xs font-semibold text-blue-600 mt-1 line-clamp-1">
              {{ item.jobTitle }}
            </div>

            <!-- Details Tags -->
            <div class="flex flex-wrap items-center gap-2 mt-2 text-2xs text-slate-500">
              <span class="flex items-center gap-0.5">
                <Calendar class="w-3 h-3 text-slate-400" />
                {{ item.appliedDate }}
              </span>
              <span v-if="item.salary" class="flex items-center gap-0.5 text-amber-600 font-medium">
                <DollarSign class="w-3 h-3" />
                {{ item.salary }}
              </span>
            </div>

            <!-- Notes Snippet -->
            <div v-if="item.notes" class="mt-2 p-1.5 bg-slate-50 rounded-lg text-2xs text-slate-600 line-clamp-2 border border-slate-100">
              💬 {{ item.notes }}
            </div>

            <!-- Card Footer: Status Quick Mover -->
            <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
              <select
                :value="item.status"
                @change="(e: any) => handleQuickChangeStatus(item, e.target.value)"
                class="text-2xs bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-semibold text-slate-700 focus:outline-none"
              >
                <option v-for="c in COLUMNS" :key="c.key" :value="c.key">{{ c.label }}</option>
              </select>

              <a
                v-if="item.jobUrl"
                :href="item.jobUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-slate-400 hover:text-blue-600 p-0.5"
                title="打开投递原网页"
              >
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>
          </div>

          <div v-if="getColumnItems(col.key).length === 0" class="text-center py-8 text-2xs text-slate-400 italic">
            暂无记录
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <div
      v-if="isModalOpen"
      class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div class="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-scale">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 class="font-bold text-sm text-slate-900">
            {{ editingRecord ? '编辑投递记录' : '新增岗位投递记录' }}
          </h3>
          <button @click="isModalOpen = false" class="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">公司/企业名称 *</label>
            <input
              v-model="formData.companyName"
              type="text"
              placeholder="例如：字节跳动 (ByteDance)"
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">投递岗位名称 *</label>
            <input
              v-model="formData.jobTitle"
              type="text"
              placeholder="例如：前端开发工程师 - 抖音架构"
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">投递日期</label>
              <input
                v-model="formData.appliedDate"
                type="date"
                class="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">当前状态</label>
              <select
                v-model="formData.status"
                class="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option v-for="c in COLUMNS" :key="c.key" :value="c.key">{{ c.label }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">标明薪资 (选填)</label>
              <input
                v-model="formData.salary"
                type="text"
                placeholder="例如：25k-35k · 15薪"
                class="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">使用简历版本 (选填)</label>
              <input
                v-model="formData.resumeVersionTitle"
                type="text"
                placeholder="例如：通用技术版"
                class="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">岗位原网页 URL (选填)</label>
            <input
              v-model="formData.jobUrl"
              type="text"
              placeholder="https://..."
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">面试与投递备忘笔记</label>
            <textarea
              v-model="formData.notes"
              rows="3"
              placeholder="记录面试官提问、考点、HR 沟通内容或准备事项..."
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            ></textarea>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            @click="isModalOpen = false"
            class="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-700"
          >
            取消
          </button>
          <button
            type="button"
            @click="handleSaveRecord"
            class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold text-white shadow-xs"
          >
            保存记录
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
