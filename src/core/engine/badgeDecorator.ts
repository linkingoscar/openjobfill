/**
 * OpenJobFill 表单字段行内徽标与高亮提示引擎
 * 在网页表单项注入状态徽标与 Tooltip，提供 Review-First 视觉确认
 */

export interface BadgeInfo {
  status: 'success' | 'warning' | 'missing' | 'attachment';
  label: string;
  value?: string;
  message?: string;
}

const BADGE_CLASS = 'openjobfill-field-badge';
const BADGE_STYLE_ID = 'openjobfill-badge-styles';

function ensureBadgeStyles() {
  if (document.getElementById(BADGE_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = BADGE_STYLE_ID;
  style.textContent = `
    .openjobfill-badge-wrapper {
      position: relative !important;
      display: inline-block !important;
    }
    .${BADGE_CLASS} {
      position: absolute !important;
      right: 8px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      z-index: 2147483640 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 18px !important;
      height: 18px !important;
      border-radius: 50% !important;
      font-size: 11px !important;
      font-weight: bold !important;
      color: #fff !important;
      cursor: help !important;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important;
      pointer-events: auto !important;
      transition: all 0.2s ease !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    .${BADGE_CLASS}:hover {
      transform: translateY(-50%) scale(1.15) !important;
    }
    .${BADGE_CLASS}.badge-success {
      background: #10b981 !important;
    }
    .${BADGE_CLASS}.badge-warning {
      background: #f59e0b !important;
    }
    .${BADGE_CLASS}.badge-missing {
      background: #f43f5e !important;
    }
    .${BADGE_CLASS}.badge-attachment {
      background: #8b5cf6 !important;
    }
    .${BADGE_CLASS} .openjobfill-tooltip {
      visibility: hidden !important;
      opacity: 0 !important;
      position: absolute !important;
      bottom: calc(100% + 6px) !important;
      right: 0 !important;
      background: #1e293b !important;
      color: #f8fafc !important;
      padding: 5px 9px !important;
      border-radius: 6px !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      white-space: nowrap !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
      transition: opacity 0.2s !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
      line-height: 1.4 !important;
    }
    .${BADGE_CLASS} .openjobfill-tooltip::after {
      content: '' !important;
      position: absolute !important;
      top: 100% !important;
      right: 6px !important;
      border-width: 4px !important;
      border-style: solid !important;
      border-color: #1e293b transparent transparent transparent !important;
    }
    .${BADGE_CLASS}:hover .openjobfill-tooltip {
      visibility: visible !important;
      opacity: 1 !important;
    }
    .openjobfill-highlight-success {
      outline: 2px solid rgba(16, 185, 129, 0.45) !important;
      background-color: rgba(16, 185, 129, 0.03) !important;
    }
    .openjobfill-highlight-warning {
      outline: 2px solid rgba(245, 158, 11, 0.45) !important;
      background-color: rgba(245, 158, 11, 0.03) !important;
    }
    .openjobfill-highlight-missing {
      outline: 2px dashed rgba(244, 63, 94, 0.5) !important;
    }
    .openjobfill-highlight-attachment {
      outline: 2px dashed rgba(139, 92, 246, 0.7) !important;
      background-color: rgba(139, 92, 246, 0.04) !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * 为目标表单元素添加状态徽标与高亮提示
 */
export function decorateElement(element: HTMLElement, info: BadgeInfo): void {
  if (!element || !(element instanceof HTMLElement)) return;
  ensureBadgeStyles();

  // 如果已经挂载过徽标，先移除旧徽标
  const existingBadge = element.parentElement?.querySelector(`.${BADGE_CLASS}`);
  if (existingBadge) {
    existingBadge.remove();
  }

  // 移除旧高亮
  element.classList.remove(
    'openjobfill-highlight-success',
    'openjobfill-highlight-warning',
    'openjobfill-highlight-missing',
    'openjobfill-highlight-attachment'
  );

  // 添加高亮类
  element.classList.add(`openjobfill-highlight-${info.status}`);

  // 创建徽标 DOM
  const badge = document.createElement('div');
  badge.className = `${BADGE_CLASS} badge-${info.status}`;

  const iconText = info.status === 'success' ? '✓' : info.status === 'warning' ? '!' : info.status === 'attachment' ? '📎' : '?';
  badge.textContent = iconText;

  // Tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'openjobfill-tooltip';
  const prefix = info.status === 'success' ? '已填入' : info.status === 'warning' ? '建议复核' : info.status === 'attachment' ? '简历附件区' : '待补充必填';
  const valueDisplay = info.value ? `：${info.value}` : '';
  tooltip.textContent = `[${prefix}] ${info.label}${valueDisplay}`;
  if (info.message) {
    tooltip.textContent += ` (${info.message})`;
  }

  badge.appendChild(tooltip);

  // 尝试插入到 element 父级中 (若 parent 非 relative，则添加 wrapper)
  const parent = element.parentElement;
  if (parent) {
    const parentPos = window.getComputedStyle(parent).position;
    if (parentPos === 'static') {
      parent.style.position = 'relative';
    }
    parent.appendChild(badge);
  }
}

/**
 * 扫描页面中的文件附件上传区域并注入紫色引导徽标
 */
export function scanAttachmentDropzones(): number {
  ensureBadgeStyles();
  let dropzoneCount = 0;
  const fileInputs = Array.from(document.querySelectorAll<HTMLElement>('input[type="file"], .el-upload, .ant-upload, .upload-dragger, [class*="upload-drag"], [class*="dropzone"]'));

  for (const el of fileInputs) {
    decorateElement(el, {
      status: 'attachment',
      label: '简历与作品集上传区',
      message: '点击或拖拽本地 PDF 简历至此完成上传'
    });
    dropzoneCount++;
  }

  return dropzoneCount;
}

/**
 * 扫描页面所有必填但未填写的输入框，打上红色待补提醒
 */
export function scanMissingRequiredFields(): number {
  ensureBadgeStyles();
  let missingCount = 0;
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
    )
  );

  for (const input of inputs) {
    const isRequired = 
      input.hasAttribute('required') || 
      input.getAttribute('aria-required') === 'true' ||
      input.closest('label, .form-item, .ant-form-item, .el-form-item')?.textContent?.includes('*');

    const isEmpty = !input.value || input.value.trim() === '';

    if (isRequired && isEmpty) {
      const labelText = input.getAttribute('placeholder') || 
                        input.getAttribute('aria-label') || 
                        input.closest('.form-item, .el-form-item')?.querySelector('label')?.textContent?.replace('*', '').trim() || 
                        '必填项';

      decorateElement(input, {
        status: 'missing',
        label: labelText,
        message: '简历暂无此项或未自动填入',
      });
      missingCount++;
    }
  }

  return missingCount;
}

/**
 * 清除页面上所有 OpenJobFill 注入的徽标与高亮
 */
export function clearAllBadges(): void {
  const badges = document.querySelectorAll(`.${BADGE_CLASS}`);
  badges.forEach((b) => b.remove());

  const highlighted = document.querySelectorAll(
    '.openjobfill-highlight-success, .openjobfill-highlight-warning, .openjobfill-highlight-missing'
  );
  highlighted.forEach((el) => {
    el.classList.remove(
      'openjobfill-highlight-success',
      'openjobfill-highlight-warning',
      'openjobfill-highlight-missing'
    );
  });
}
