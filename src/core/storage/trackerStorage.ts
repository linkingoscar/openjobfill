import type { JobApplicationRecord, ApplicationStatus } from '../../types/tracker';

const TRACKER_STORAGE_KEY = 'openjobfill_job_applications';

const SAMPLE_APPLICATIONS: JobApplicationRecord[] = [
  {
    id: 'app-sample-1',
    companyName: '字节跳动 (ByteDance)',
    jobTitle: '前端开发工程师 - 抖音架构',
    appliedDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
    status: 'interview1',
    jobUrl: 'https://jobs.bytedance.com',
    salary: '25k-35k',
    resumeVersionTitle: '通用校招技术版',
    notes: '一面约在下周二下午 15:00，重点准备 Vue 3 源码、工程化与微前端方案。',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'app-sample-2',
    companyName: '腾讯 (Tencent)',
    jobTitle: 'Web 前端研发工程师 - PCG',
    appliedDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
    status: 'assessment',
    jobUrl: 'https://join.qq.com',
    salary: '22k-30k',
    resumeVersionTitle: '通用校招技术版',
    notes: '已收到北森在线测评链接，需在周末前完成。',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'app-sample-3',
    companyName: '阿里巴巴 (Alibaba)',
    jobTitle: '前端工程专家 - 淘天集团',
    appliedDate: new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10),
    status: 'screening',
    jobUrl: 'https://talent.taotian.com',
    salary: '28k-40k',
    resumeVersionTitle: '社招高级前端版',
    notes: '已通过官网完成网申，系统显示“初筛中”。',
    updatedAt: new Date().toISOString()
  }
];

function isExtensionEnv(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage && !!chrome.storage.local;
  } catch {
    return false;
  }
}

export const trackerStorage = {
  async getApplications(): Promise<JobApplicationRecord[]> {
    if (isExtensionEnv()) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.get([TRACKER_STORAGE_KEY], (res) => {
            if (chrome.runtime?.lastError || !res) {
              resolve(this.getFromLocalStorage());
              return;
            }
            const records = res[TRACKER_STORAGE_KEY] as JobApplicationRecord[] | undefined;
            if (!records) {
              this.saveApplications(SAMPLE_APPLICATIONS);
              resolve(SAMPLE_APPLICATIONS);
            } else {
              resolve(records);
            }
          });
        } catch {
          resolve(this.getFromLocalStorage());
        }
      });
    } else {
      return this.getFromLocalStorage();
    }
  },

  getFromLocalStorage(): JobApplicationRecord[] {
    const data = localStorage.getItem(TRACKER_STORAGE_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(SAMPLE_APPLICATIONS));
    return SAMPLE_APPLICATIONS;
  },

  async saveApplications(list: JobApplicationRecord[]): Promise<void> {
    if (isExtensionEnv()) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.set({ [TRACKER_STORAGE_KEY]: list }, () => resolve());
        } catch {
          localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(list));
          resolve();
        }
      });
    } else {
      localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(list));
    }
  },

  async saveApplication(record: JobApplicationRecord): Promise<void> {
    const list = await this.getApplications();
    const index = list.findIndex((a) => a.id === record.id);
    record.updatedAt = new Date().toISOString();

    if (index >= 0) {
      list[index] = record;
    } else {
      list.unshift(record); // 最新投递置顶
    }

    await this.saveApplications(list);
  },

  async deleteApplication(id: string): Promise<void> {
    const list = await this.getApplications();
    const filtered = list.filter((a) => a.id !== id);
    await this.saveApplications(filtered);
  },

  async updateApplicationStatus(id: string, status: ApplicationStatus): Promise<void> {
    const list = await this.getApplications();
    const target = list.find((a) => a.id === id);
    if (target) {
      target.status = status;
      target.updatedAt = new Date().toISOString();
      await this.saveApplications(list);
    }
  },

  async exportApplicationsToCSV(): Promise<string> {
    const list = await this.getApplications();
    const headers = ['公司名称', '岗位名称', '投递日期', '当前状态', '投递链接', '期望/标明薪资', '使用简历版本', '备忘笔记', '最后更新时间'];
    
    const statusMap: Record<ApplicationStatus, string> = {
      applied: '已投递',
      screening: '简历初筛',
      assessment: '笔试/测评',
      interview1: '技术一面',
      interview2: '复试/二面',
      hr: 'HR终面',
      offer: '已录用 (Offer)',
      rejected: '流程结束'
    };

    const rows = list.map((item) => [
      `"${(item.companyName || '').replace(/"/g, '""')}"`,
      `"${(item.jobTitle || '').replace(/"/g, '""')}"`,
      item.appliedDate || '',
      statusMap[item.status] || item.status,
      `"${(item.jobUrl || '').replace(/"/g, '""')}"`,
      `"${(item.salary || '').replace(/"/g, '""')}"`,
      `"${(item.resumeVersionTitle || '').replace(/"/g, '""')}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
      item.updatedAt || ''
    ]);

    return '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  },

  async exportApplicationsToJSON(): Promise<string> {
    const list = await this.getApplications();
    return JSON.stringify(list, null, 2);
  }
};
