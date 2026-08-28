import { describe, it, expect, beforeEach } from 'vitest';
import { PageAnalyzer } from '@/core/pipeline/pageAnalyzer';

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

    // 4. 验证主文档与 iframe 内的 input 都被成功捕获
    expect(descriptors.length).toBe(3);

    const labels = descriptors.map((d) => d.label);
    expect(labels).toContain('主页面邮箱');
    expect(labels).toContain('子页面手机号');
    expect(labels).toContain('子页面姓名');
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
});
