/**
 * 站点适配器填充工具箱
 *
 * 10 个 adapter 各自手写「查询 → 填充 → 计数」三段式，导致三类缺陷反复出现：
 *   1. 统计语义混淆：页面找不到元素被记成 skipped（合理跳过），真实故障被淹没
 *   2. 容器解析降级：`cards[i] || document` 会在增行失败时退化为全文档查询，
 *      第 N 段经历静默覆盖第 1 段 —— 用户看到「填充成功」，简历数据其实是错的
 *   3. 宽泛选择器张冠李戴：`input[name*="name"]` 会命中 username / emergencyContactName
 *
 * 本模块把这三件事收敛到一处，各 adapter 只声明「填什么、用什么选择器」。
 *
 * 统计口径（三者之和恒等于声明的字段总数）：
 *   - skipped：简历里该字段本就没有值 —— 用户没填，不是故障
 *   - failed ：简历有值但页面上找不到元素，或写入执行失败 —— 必须暴露给用户
 *   - success：已成功写入
 */

import type { FillResult, FillLogItem } from '../../types/adapter';
import { setNativeValue, setNativeRadioChecked } from '../engine/dispatcher';
import { selectCustomOption, selectCascaderOptions } from '../engine/selector';
import { fillDatePicker } from '../engine/datepicker';

/**
 * 元素身份特征中会引发身份错配的排斥词（中英双语）
 * 命中这些词的控件属于他人（紧急联系人 / 推荐人 / 家属）或账号体系（用户名 / 昵称），
 * 填入本人信息属于严重事故，宁可不填也不能错填。
 */
const IDENTITY_EXCLUSION_TERMS = [
  // 他人身份：紧急联系人、推荐人、证明人、家属、监护人
  'emergency', 'contact', 'family', 'father', 'mother', 'parent', 'guardian',
  'reference', 'referee', 'recommend', 'relative', 'spouse',
  '紧急', '联系人', '推荐人', '证明人', '父亲', '母亲', '家属', '监护', '配偶',
  // 账号体系：用户名、昵称、登录名、账号
  'username', 'user_name', 'nickname', 'nick_name', 'loginname', 'login_name',
  'loginid', 'account', '用户名', '昵称', '登录名', '账号',
];

export interface FieldQueryOptions {
  /** 额外追加的排除词 */
  exclude?: string[];
  /**
   * 允许命中身份排斥词（默认 false）。
   *
   * 仅在明确要定位「他人身份」控件时置为 true —— 例如回填紧急联系人、
   * 家属姓名这类本就属于第三方的字段，此时排斥过滤会误伤正确目标。
   */
  allowIdentityTerms?: boolean;
}

/**
 * 拼接元素的可识别身份串，用于排斥词检测
 */
function getElementIdentity(el: Element): string {
  const elAny = el as HTMLElement;
  const parts = [
    el.getAttribute('name'),
    el.getAttribute('id'),
    el.getAttribute('placeholder'),
    el.getAttribute('aria-label'),
    typeof elAny.className === 'string' ? elAny.className : '',
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * 判断元素是否命中身份排斥词，供自定义查找逻辑（如跨 iframe 遍历）复用
 */
export function isIdentityExcluded(el: Element, options: FieldQueryOptions = {}): boolean {
  if (options.allowIdentityTerms) {
    return (options.exclude ?? []).some((term) =>
      getElementIdentity(el).includes(term.toLowerCase())
    );
  }
  const terms = [...IDENTITY_EXCLUSION_TERMS, ...(options.exclude ?? [])].map((t) => t.toLowerCase());
  const identity = getElementIdentity(el);
  return terms.some((term) => identity.includes(term));
}

/**
 * 在作用域内查找首个匹配且未命中排斥词的元素
 *
 * selector 支持数组，按置信度从高到低依次尝试（站点专属 → 中文语义 → 字段名 → 宽泛兜底）。
 * 这与直接把多个选择器用逗号拼接有本质区别：逗号拼接时浏览器按 DOM 顺序返回，
 * 宽泛选择器可能抢在专属选择器之前命中，把优先级打乱。
 *
 * 注意：若全部候选都被排斥词过滤，返回 null（宁可不填，不可错填）。
 */
export function queryFirst<T extends Element>(
  root: ParentNode,
  selector: string | string[],
  options: FieldQueryOptions = {}
): T | null {
  const groups = Array.isArray(selector) ? selector : [selector];

  for (const sel of groups) {
    const found = findFirstUsable<T>(root, sel, options);
    if (found) return found;

    // 该选择器找不到「可用」元素时，退一步按大小写不敏感再试（应对驼峰命名）。
    // 判据必须是「无可用元素」而非「无匹配元素」——
    // 精确匹配很可能只命中了一堆应当被排斥的控件（如 username / nickname）。
    const ciSelector = withCaseInsensitiveFlag(sel);
    if (ciSelector !== sel) {
      const foundCi = findFirstUsable<T>(root, ciSelector, options);
      if (foundCi) return foundCi;
    }
  }
  return null;
}

/** 在单个选择器的匹配结果中取首个未被身份排斥的元素 */
function findFirstUsable<T extends Element>(
  root: ParentNode,
  selector: string,
  options: FieldQueryOptions
): T | null {
  for (const el of tryQueryAll<T>(root, selector)) {
    if (isIdentityExcluded(el, options)) continue;
    return el;
  }
  return null;
}

/** 把选择器数组规整为可读字符串，用于失败信息 */
function describeSelector(selector: string | string[]): string {
  const groups = Array.isArray(selector) ? selector : [selector];
  return groups[groups.length - 1];
}

/**
 * 需要补大小写不敏感标志的属性
 *
 * 网申表单大量使用驼峰命名（candidateName / idCardNumber / schoolName /
 * data-automation-id="legalNameSection_firstName"），而 CSS 属性值匹配默认大小写敏感，
 * `[name*="name"]` 命中不了 `name="candidateName"` —— 会表现为字段静默漏填。
 */
const CASE_INSENSITIVE_ATTRS = 'name|id|class|placeholder|aria-label|data-automation-id|data-testid';

/**
 * 为属性选择器补 `i` 标志（已带 i 的不重复添加）
 */
function withCaseInsensitiveFlag(selector: string): string {
  const pattern = new RegExp(
    `\\[\\s*(?:${CASE_INSENSITIVE_ATTRS})\\s*[*^$~|]?=\\s*"[^"]*"\\s*\\](?!\\s*i\\b)`,
    'gi'
  );
  return selector.replace(pattern, (m) => {
    const trimmed = m.trimEnd();
    return `${trimmed.slice(0, -1)} i]`;
  });
}

/** 安全查询，选择器非法时返回空数组而非抛错 */
function tryQueryAll<T extends Element>(root: ParentNode, selector: string): T[] {
  try {
    return Array.from(root.querySelectorAll<T>(selector));
  } catch {
    return [];
  }
}

/**
 * 判定值是否「不可用」。注意 0 与 false 是有效业务值，不能按 falsy 处理。
 */
function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

function stringify(value: unknown): string {
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

export class FillSession {
  private logs: FillLogItem[] = [];
  private filledCount = 0;
  private skippedCount = 0;
  private failedCount = 0;
  private readonly startTime = Date.now();

  constructor(private readonly adapterName: string) {}

  /** 成功写入 */
  ok(label: string, field: string, value: unknown): void {
    this.filledCount++;
    this.logs.push({ status: 'success', label, field, value: stringify(value) });
  }

  /** 简历无值 —— 合理跳过，不是故障 */
  skip(label: string, field: string, reason = '简历中该字段为空'): void {
    this.skippedCount++;
    this.logs.push({ status: 'skipped', label, field, value: '', message: reason });
  }

  /** 页面找不到元素或写入失败 —— 真实故障，必须暴露 */
  fail(label: string, field: string, reason: string): void {
    this.failedCount++;
    this.logs.push({ status: 'failed', label, field, value: '', message: reason });
  }

  /**
   * 解析多段经历的第 index 个区块容器
   *
   * 关键：绝不降级到 document。找不到容器就返回 null 并计入失败，
   * 由调用方 break —— 否则第 N 段会覆写到第 1 段的输入框上。
   */
  section<T extends Element>(cards: T[], index: number, label: string): T | null {
    const card = cards[index];
    if (!card) {
      this.fail(
        `${label}(${index + 1})`,
        `${label}[${index}]`,
        `页面仅识别到 ${cards.length} 个区块，无法回填第 ${index + 1} 段（已中止，避免覆盖已有内容）`
      );
      return null;
    }
    return card;
  }

  /** 普通文本 / 数字输入框 */
  async text(
    root: ParentNode,
    selector: string | string[],
    label: string,
    field: string,
    value: unknown,
    options: FieldQueryOptions = {}
  ): Promise<void> {
    if (isBlank(value)) return this.skip(label, field);

    const el = queryFirst<HTMLInputElement>(root, selector, options);
    if (!el) return this.fail(label, field, `页面未找到匹配控件 (${describeSelector(selector)})`);

    try {
      setNativeValue(el, stringify(value));
      this.ok(label, field, value);
    } catch (err: any) {
      this.fail(label, field, `写入失败: ${err?.message || '未知异常'}`);
    }
  }

  /** 多行文本域 */
  async textarea(
    root: ParentNode,
    selector: string | string[],
    label: string,
    field: string,
    value: unknown,
    options: FieldQueryOptions = {}
  ): Promise<void> {
    if (isBlank(value)) return this.skip(label, field);

    const el = queryFirst<HTMLTextAreaElement>(root, selector, options);
    if (!el) return this.fail(label, field, `页面未找到多行文本框 (${describeSelector(selector)})`);

    try {
      setNativeValue(el, stringify(value));
      this.ok(label, field, value);
    } catch (err: any) {
      this.fail(label, field, `写入失败: ${err?.message || '未知异常'}`);
    }
  }

  /** 自定义下拉框（Ant / Element / Moka 等组件库的 select） */
  async select(
    root: ParentNode,
    selector: string | string[],
    label: string,
    field: string,
    value: unknown,
    options: FieldQueryOptions = {}
  ): Promise<void> {
    if (isBlank(value)) return this.skip(label, field);

    const el = queryFirst<HTMLElement>(root, selector, options);
    if (!el) return this.fail(label, field, `页面未找到下拉控件 (${describeSelector(selector)})`);

    try {
      const ok = await selectCustomOption(el, stringify(value));
      if (ok) this.ok(label, field, value);
      else this.fail(label, field, `下拉选项中未匹配到「${stringify(value)}」`);
    } catch (err: any) {
      this.fail(label, field, `下拉选择失败: ${err?.message || '未知异常'}`);
    }
  }

  /** 日期选择器 */
  async date(
    root: ParentNode,
    selector: string | string[],
    label: string,
    field: string,
    value: unknown,
    options: FieldQueryOptions = {}
  ): Promise<void> {
    if (isBlank(value)) return this.skip(label, field);

    const el = queryFirst<HTMLInputElement>(root, selector, options);
    if (!el) return this.fail(label, field, `页面未找到日期控件 (${describeSelector(selector)})`);

    try {
      await fillDatePicker(el, stringify(value));
      this.ok(label, field, value);
    } catch (err: any) {
      this.fail(label, field, `日期写入失败: ${err?.message || '未知异常'}`);
    }
  }

  /** 省市区级联选择 */
  async area(
    root: ParentNode,
    selector: string | string[],
    label: string,
    field: string,
    value: unknown,
    options: FieldQueryOptions = {}
  ): Promise<void> {
    if (isBlank(value)) return this.skip(label, field);

    const el = queryFirst<HTMLElement>(root, selector, options);
    if (!el) return this.fail(label, field, `页面未找到级联控件 (${describeSelector(selector)})`);

    try {
      const ok = await selectCascaderOptions(el, stringify(value));
      if (ok) this.ok(label, field, value);
      else this.fail(label, field, `级联选项中未匹配到「${stringify(value)}」`);
    } catch (err: any) {
      this.fail(label, field, `级联选择失败: ${err?.message || '未知异常'}`);
    }
  }

  /**
   * 按可见文本匹配单选按钮（性别、是否等）
   * 找不到匹配项时记 failed —— 不猜、不选默认值。
   */
  async radioByText(
    root: ParentNode,
    itemSelector: string | string[],
    label: string,
    field: string,
    value: unknown,
    options: FieldQueryOptions = {}
  ): Promise<void> {
    if (isBlank(value)) return this.skip(label, field);

    const target = stringify(value);
    const groups = Array.isArray(itemSelector) ? itemSelector : [itemSelector];

    let candidates: HTMLElement[] = [];
    for (const sel of groups) {
      const variants = [sel];
      const ciSelector = withCaseInsensitiveFlag(sel);
      if (ciSelector !== sel) variants.push(ciSelector);

      for (const variant of variants) {
        const found = tryQueryAll<HTMLElement>(root, variant).filter(
          (node) => !isIdentityExcluded(node, options)
        );
        if (found.length > 0) {
          candidates = found;
          break;
        }
      }

      if (candidates.length > 0) break;
    }

    if (candidates.length === 0) {
      return this.fail(label, field, `页面未找到单选项 (${describeSelector(itemSelector)})`);
    }

    const matched = candidates.find((node) => {
      const text = (node.textContent || '').trim();
      const control = node.querySelector<HTMLInputElement>('input[type="radio"]');
      const controlValue = control?.value || '';
      return text === target || text.includes(target) || controlValue === target;
    });

    if (!matched) {
      return this.fail(label, field, `单选项中未匹配到「${target}」`);
    }

    try {
      const radio = matched.querySelector<HTMLInputElement>('input[type="radio"]');
      if (radio) setNativeRadioChecked(radio, true);
      else matched.click();
      this.ok(label, field, target);
    } catch (err: any) {
      this.fail(label, field, `单选写入失败: ${err?.message || '未知异常'}`);
    }
  }

  /**
   * 对已定位到的元素执行自定义写入
   *
   * 用于无法用 CSS 选择器表达的场景（例如跨同源 iframe 遍历出的元素集合）。
   * 复用同一套 skipped / failed 判定，保证统计口径不漂移。
   */
  async apply(
    el: Element | null,
    label: string,
    field: string,
    value: unknown,
    applier: (el: Element, value: string) => Promise<boolean> | boolean
  ): Promise<void> {
    if (isBlank(value)) return this.skip(label, field);
    if (!el) return this.fail(label, field, '页面未找到匹配控件');

    try {
      const done = await applier(el, stringify(value));
      if (done) this.ok(label, field, value);
      else this.fail(label, field, '写入结果未确认为成功');
    } catch (err: any) {
      this.fail(label, field, `写入失败: ${err?.message || '未知异常'}`);
    }
  }

  finish(): FillResult {
    return {
      success: this.filledCount > 0,
      adapterName: this.adapterName,
      filledCount: this.filledCount,
      skippedCount: this.skippedCount,
      failedCount: this.failedCount,
      logs: this.logs,
      durationMs: Date.now() - this.startTime,
    };
  }
}

/**
 * 创建一次填充会话
 */
export function createFillSession(adapterName: string): FillSession {
  return new FillSession(adapterName);
}
