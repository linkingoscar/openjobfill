import { describe, it, expect, beforeEach } from 'vitest';
import { PageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { selectCustomOption } from '@/core/engine/selector';
import { decorateElement, scanMissingRequiredFields, clearAllBadges } from '@/core/engine/badgeDecorator';

describe('PageAnalyzer Iframe Deep Scanning Suite (跨同源 iframe 深度扫描测试)', () => {
  let analyzer: PageAnalyzer;

  beforeEach(() => {
    document.body.innerHTML = '';
    analyzer = new PageAnalyzer();
  });

  it('应该能够穿透并提取同源 iframe 内部的表单控件', () => {
    // 1. 在主页面放置一个输入框
    const mainContainer = document.createElement('div');
    mainContainer.innerHTML = `
      <div>
        <label for="main-email">主页面邮箱</label>
        <input id="main-email" type="email" placeholder="main@example.com" />
      </div>
    `;
    document.body.appendChild(mainContainer);

    // 2. 模拟一个包含表单的同源 iframe
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);

    // jsdom 下 iframe 拥有 contentDocument
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    expect(iframeDoc).toBeDefined();

    if (iframeDoc) {
      iframeDoc.body.innerHTML = `
        <form>
          <div>
            <label for="iframe-phone">子页面手机号</label>
            <input id="iframe-phone" type="tel" placeholder="13800000000" />
          </div>
          <div>
            <label for="iframe-name">子页面姓名</label>
            <input id="iframe-name" type="text" placeholder="张三" />
          </div>
        </form>
      `;
    }

    // 3. 执行全页面扫描
    const descriptors = analyzer.analyzePage(document);

    // 4. 验证主文档与 iframe 内的 input 都被成功捕获，且类型正确解析为 text/textarea/select 等，未因 realm 差异变成 unknown
    expect(descriptors.length).toBe(3);

    const labels = descriptors.map((d) => d.label);
    expect(labels).toContain('主页面邮箱');
    expect(labels).toContain('子页面手机号');
    expect(labels).toContain('子页面姓名');

    const phoneDesc = descriptors.find((d) => d.label === '子页面手机号');
    expect(phoneDesc?.type).toBe('text');
  });

  it('同源 iframe 内部的 textarea, select 和 radio group 应被准确识别且 options 正常提取', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.body.innerHTML = `
        <form>
          <div class="form-item">
            <label for="if-select">最高学历</label>
            <select id="if-select">
              <option value="bachelor">本科</option>
              <option value="master">硕士</option>
            </select>
          </div>
          <div class="radio-group">
            <label>性别</label>
            <input type="radio" name="if-gender" value="male" /> 男
            <input type="radio" name="if-gender" value="female" /> 女
          </div>
          <div class="form-item">
            <label for="if-summary">个人总结</label>
            <textarea id="if-summary" placeholder="请简述优势"></textarea>
          </div>
        </form>
      `;
    }

    const descriptors = analyzer.analyzePage(document);
    const selectDesc = descriptors.find((d) => d.label === '最高学历');
    const radioDesc = descriptors.find((d) => d.label === '性别' || d.type === 'radio');
    const textareaDesc = descriptors.find((d) => d.label === '个人总结');

    expect(selectDesc).toBeDefined();
    expect(selectDesc?.type).toBe('select');
    expect(selectDesc?.options).toContain('本科');
    expect(selectDesc?.options).toContain('硕士');

    expect(textareaDesc).toBeDefined();
    expect(textareaDesc?.type).toBe('textarea');

    expect(radioDesc).toBeDefined();
    expect(radioDesc?.type).toBe('radio');
  });

  it('应该继续穿透第二层同源 iframe，而不是只扫描门户 iframe 第一层', () => {
    const outer = document.createElement('iframe');
    document.body.appendChild(outer);

    const outerDoc = outer.contentDocument || outer.contentWindow?.document;
    expect(outerDoc).toBeDefined();
    if (!outerDoc) return;

    const inner = outerDoc.createElement('iframe');
    outerDoc.body.appendChild(inner);
    const innerDoc = inner.contentDocument || inner.contentWindow?.document;
    expect(innerDoc).toBeDefined();
    if (!innerDoc) return;

    innerDoc.body.innerHTML = `
      <div class="form-item">
        <label for="nested-phone">第二层手机号</label>
        <input id="nested-phone" name="phone" type="tel" />
      </div>
    `;

    const descriptors = analyzer.analyzePage(document);
    expect(descriptors.some((d) => d.label === '第二层手机号')).toBe(true);
  });

  it('面对跨域 iframe 访问受限抛出异常时，应具备容错弹性而不崩溃', () => {
    const mainInput = document.createElement('input');
    mainInput.id = 'safe-input';
    mainInput.setAttribute('aria-label', '安全输入框');
    document.body.appendChild(mainInput);

    // 模拟一个受限 iframe (跨域 SecurityError)
    const restrictedIframe = document.createElement('iframe');
    Object.defineProperty(restrictedIframe, 'contentDocument', {
      get() {
        throw new DOMException('Blocked a frame with origin from accessing a cross-origin frame.', 'SecurityError');
      },
    });
    document.body.appendChild(restrictedIframe);

    expect(() => {
      const descriptors = analyzer.analyzePage(document);
      expect(descriptors.length).toBe(1);
      expect(descriptors[0].ariaLabel).toBe('安全输入框');
    }).not.toThrow();
  });

  it('iframe 内原生 select 应使用所属 Window 的事件与类型判断', async () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    expect(iframeDoc).toBeDefined();
    if (!iframeDoc) return;

    iframeDoc.body.innerHTML = `
      <label for="nested-degree">学历</label>
      <select id="nested-degree">
        <option value="">请选择</option>
        <option value="bachelor">本科</option>
        <option value="master">硕士</option>
      </select>
    `;
    const select = iframeDoc.getElementById('nested-degree') as HTMLSelectElement;
    expect(await selectCustomOption(select, '硕士')).toBe(true);
    expect(select.value).toBe('master');
  });

  it('iframe 内字段也应显示成功/待补徽标，并能被清理', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    expect(iframeDoc).toBeDefined();
    if (!iframeDoc) return;

    iframeDoc.body.innerHTML = `
      <div class="form-item"><label>手机号 *</label><input required name="phone" /></div>
    `;
    const input = iframeDoc.querySelector('input') as HTMLInputElement;

    decorateElement(input, { status: 'success', label: '手机号', value: '13800000000' });
    expect(iframeDoc.querySelector('.openjobfill-field-badge')).not.toBeNull();
    expect(iframeDoc.querySelector('#openjobfill-badge-styles')).not.toBeNull();

    const sibling = iframeDoc.createElement('input');
    sibling.name = 'email';
    input.parentElement?.appendChild(sibling);
    decorateElement(sibling, { status: 'warning', label: '邮箱' });
    expect(iframeDoc.querySelectorAll('.openjobfill-field-badge')).toHaveLength(2);

    expect(scanMissingRequiredFields()).toBe(1);
    expect(iframeDoc.querySelector('.openjobfill-field-badge.badge-missing')).not.toBeNull();

    clearAllBadges();
    expect(iframeDoc.querySelector('.openjobfill-field-badge')).toBeNull();
  });

  it('同一表单行的必填星号不应泄漏到并排的非必填字段', () => {
    const row = document.createElement('div');
    row.className = 'form-item';
    row.innerHTML = '<label>手机号 *</label><input name="phone"><label>邮箱</label><input name="email">';
    document.body.appendChild(row);

    const descriptors = analyzer.analyzePage(document);
    const phone = descriptors.find((item) => item.name === 'phone');
    const email = descriptors.find((item) => item.name === 'email');
    expect(phone?.required).toBe(true);
    expect(email?.required).toBe(false);
  });
});
