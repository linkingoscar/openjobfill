/**
 * 点选手动填充
 *
 * 全自动填充漏填/填错时的手动补救（human-in-the-loop 安全网）：
 *   点击页面上的输入框 → 在旁边弹出简历字段选择浮层 → 选中即填入 → 继续点选下一个。
 *
 * 复用 elementPicker 的悬浮高亮与点击捕获机制。
 * 全程本地，不经过任何网络。
 */
import type { StandardResume } from '../../types/resume';
import { startElementPicking } from './elementPicker';
import { setNativeValue, setNativeRadioChecked } from './dispatcher';
import { selectCustomOption } from './selector';
import { fillDatePicker } from './datepicker';

export interface ManualFillField {
  resumeKey: string;
  label: string;
  value: string;
}

const MENU_ID = 'openjobfill-manualfill-menu';

/**
 * 从简历提取"有值"的可填充字段清单
 */
export function buildFillableFields(resume: StandardResume): ManualFillField[] {
  const fields: ManualFillField[] = [];

  const push = (resumeKey: string, label: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    fields.push({ resumeKey, label, value: str });
  };

  const b = resume.basics;
  push('basics.name', '姓名', b.name);
  push('basics.phone', '手机号', b.phone);
  push('basics.email', '邮箱', b.email);
  push('basics.idCardNumber', '身份证号', b.idCardNumber);
  push('basics.gender', '性别', b.gender);
  push('basics.birthDate', '出生日期', b.birthDate);
  push('basics.politicalStatus', '政治面貌', b.politicalStatus);
  push('basics.ethnicity', '民族', b.ethnicity);
  push('basics.maritalStatus', '婚姻状况', b.maritalStatus);
  push('basics.nativePlace.city', '籍贯', b.nativePlace?.city);
  push('basics.currentLocation.city', '现居城市', b.currentLocation?.city);
  push('basics.expectedRole', '期望职位', b.expectedRole);
  push('basics.expectedSalaryMin', '期望薪资', b.expectedSalaryMin);
  push('basics.selfEvaluation', '自我评价', b.selfEvaluation);
  push('basics.githubUrl', 'GitHub', b.githubUrl);
  push('basics.linkedinUrl', 'LinkedIn', b.linkedinUrl);
  push('basics.postalCode', '邮政编码', b.postalCode);

  resume.educations?.forEach((edu, i) => {
    const n = i + 1;
    push(`educations.${i}.schoolName`, `毕业院校(${n})`, edu.schoolName);
    push(`educations.${i}.major`, `专业(${n})`, edu.major);
    push(`educations.${i}.degree`, `学历(${n})`, edu.degree);
    push(`educations.${i}.gpa`, `GPA(${n})`, edu.gpa);
  });

  resume.experiences?.forEach((exp, i) => {
    const n = i + 1;
    push(`experiences.${i}.company`, `公司(${n})`, exp.company);
    push(`experiences.${i}.title`, `职位(${n})`, exp.title);
    push(`experiences.${i}.description`, `工作内容(${n})`, exp.description);
  });

  resume.projects?.forEach((proj, i) => {
    const n = i + 1;
    push(`projects.${i}.projectName`, `项目名称(${n})`, proj.projectName);
    push(`projects.${i}.role`, `项目角色(${n})`, proj.role);
  });

  resume.qaBank?.forEach((qa) => {
    push(`qaBank.${qa.id}`, `问答: ${qa.keyword}`, qa.answer);
  });

  return fields;
}

/**
 * 把值填入目标元素，并给一次成功高亮反馈
 */
async function applyValueToElement(el: HTMLElement, value: string): Promise<void> {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'radio') {
      setNativeRadioChecked(el, true);
    } else if (el.type === 'date' || /date|birth/i.test(el.name || '')) {
      await fillDatePicker(el, value);
    } else {
      setNativeValue(el, value);
    }
  } else if (el instanceof HTMLTextAreaElement) {
    setNativeValue(el, value);
  } else if (el instanceof HTMLSelectElement) {
    await selectCustomOption(el, value);
  } else {
    const ok = await selectCustomOption(el, value);
    if (!ok) setNativeValue(el as unknown as HTMLInputElement, value);
  }

  flashSuccess(el);
}

/** 填入成功后的短暂绿色高亮，给用户明确反馈 */
function flashSuccess(el: HTMLElement): void {
  const prev = el.style.outline;
  el.style.outline = '2px solid #16a34a';
  el.style.outlineOffset = '2px';
  setTimeout(() => {
    el.style.outline = prev;
    el.style.outlineOffset = '';
  }, 1200);
}

/**
 * 在锚点元素旁弹出字段选择浮层
 */
function showFieldMenu(
  anchorEl: HTMLElement,
  fields: ManualFillField[],
  onSelect: (field: ManualFillField) => void,
  onDismiss: () => void
): void {
  removeMenu();

  const rect = anchorEl.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = MENU_ID;
  menu.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    width: 300px;
    max-height: 320px;
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 20px 40px -8px rgba(15, 23, 42, 0.35);
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  `;

  // 定位：默认放锚点下方，空间不足则放上方；水平方向防溢出
  const menuHeight = 320;
  const below = rect.bottom + 8;
  const top = below + menuHeight > window.innerHeight ? Math.max(8, rect.top - menuHeight - 8) : below;
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - 316);
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;

  const search = document.createElement('input');
  search.placeholder = '搜索简历字段…（点击填入，Esc 关闭）';
  search.style.cssText = `
    padding: 10px 12px;
    border: none;
    border-bottom: 1px solid #e2e8f0;
    outline: none;
    font-size: 13px;
    color: #0f172a;
    background: #f8fafc;
  `;

  const list = document.createElement('div');
  list.style.cssText = 'overflow-y: auto; flex: 1;';

  const renderList = (keyword: string) => {
    list.innerHTML = '';
    const kw = keyword.trim().toLowerCase();
    const filtered = kw
      ? fields.filter((f) => f.label.toLowerCase().includes(kw) || f.value.toLowerCase().includes(kw))
      : fields;

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = '没有匹配的字段';
      empty.style.cssText = 'padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;';
      list.appendChild(empty);
      return;
    }

    for (const field of filtered) {
      const item = document.createElement('button');
      item.type = 'button';
      item.style.cssText = `
        display: block;
        width: 100%;
        text-align: left;
        padding: 9px 12px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-bottom: 1px solid #f1f5f9;
      `;
      item.onmouseenter = () => (item.style.background = '#eff6ff');
      item.onmouseleave = () => (item.style.background = 'transparent');

      const labelEl = document.createElement('div');
      labelEl.textContent = field.label;
      labelEl.style.cssText = 'font-size: 12px; font-weight: 600; color: #0f172a;';

      const valueEl = document.createElement('div');
      const preview = field.value.length > 40 ? field.value.slice(0, 40) + '…' : field.value;
      valueEl.textContent = preview;
      valueEl.style.cssText = 'font-size: 12px; color: #64748b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

      item.appendChild(labelEl);
      item.appendChild(valueEl);
      item.onclick = () => {
        removeMenu();
        onSelect(field);
      };
      list.appendChild(item);
    }
  };

  search.addEventListener('input', () => renderList(search.value));
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      removeMenu();
      onDismiss();
    }
  });

  menu.appendChild(search);
  menu.appendChild(list);
  renderList('');
  document.body.appendChild(menu);
  search.focus();

  // 点击浮层外部关闭
  const onOutsideClick = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      removeMenu();
      onDismiss();
      document.removeEventListener('mousedown', onOutsideClick, true);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);
}

function removeMenu(): void {
  document.getElementById(MENU_ID)?.remove();
}

/**
 * 启动点选手动填充
 *
 * 流程：点选输入框 → 弹字段浮层 → 选中填入 → 自动进入下一次点选。
 * 按 ESC 或点击浮层外部可随时退出。
 */
export function startManualFill(resume: StandardResume, onFilled?: (label: string, value: string) => void): void {
  const fields = buildFillableFields(resume);

  if (fields.length === 0) {
    console.warn('[OpenJobFill] 简历暂无可填充字段');
    return;
  }

  startElementPicking(
    (info) => {
      const el = document.querySelector<HTMLElement>(info.selector);
      if (!el) {
        startManualFill(resume, onFilled);
        return;
      }

      showFieldMenu(
        el,
        fields,
        async (field) => {
          await applyValueToElement(el, field.value);
          onFilled?.(field.label, field.value);
          // 填入后继续点选下一个，形成连续补救
          startManualFill(resume, onFilled);
        },
        () => {
          // 用户关闭浮层 → 回到点选状态
          startManualFill(resume, onFilled);
        }
      );
    },
    () => {
      removeMenu();
    }
  );
}
