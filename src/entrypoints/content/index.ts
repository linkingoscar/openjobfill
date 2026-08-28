import { createApp, type App as VueApp } from 'vue';
import FloatBall from '@/components/FloatBall.vue';
import styleText from './style.css?inline';
import { isIgnoredDomain, isRecruitmentPage, observeRecruitmentPage } from '@/core/whitelist';
import { initSmartQALearner } from '@/core/engine/qaLearner';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  cssInjectionMode: 'manual',

  main(ctx) {
    // 0. 快速短路：如果是 ChatGPT/搜索引擎/通用社交网站，立即终止，0 资源占用，不挂载任何逻辑
    if (isIgnoredDomain()) {
      return;
    }

    let mounted = false;
    let app: VueApp | null = null;
    let hostEl: HTMLDivElement | null = null;
    let vm: any = null;

    // 启动智能问答主动学习监听器 (自我进化问答库)
    const stopQALearner = initSmartQALearner();

    function mountFloatBall() {
      // 只有在顶级窗口 (Top Window) 挂载悬浮球，避免在每个嵌套 iframe 中出现多个悬浮球
      if (mounted || window !== window.top) return;

      console.log('[OpenJobFill] 检测到招聘页面，注入悬浮球:', window.location.href);

      // 1. 创建挂载容器与 Shadow DOM
      hostEl = document.createElement('div');
      hostEl.id = 'openjobfill-extension-host';
      document.documentElement.appendChild(hostEl);

      const shadowRoot = hostEl.attachShadow({ mode: 'open' });

      // 2. 注入 TailwindCSS 样式
      const styleEl = document.createElement('style');
      styleEl.textContent = styleText;
      shadowRoot.appendChild(styleEl);

      // 3. 挂载 Vue 悬浮组件
      const mountPoint = document.createElement('div');
      shadowRoot.appendChild(mountPoint);

      app = createApp(FloatBall);
      vm = app.mount(mountPoint) as any;
      mounted = true;
    }

    function unmountFloatBall() {
      if (!mounted) return;
      try {
        app?.unmount();
        hostEl?.remove();
      } catch (e) {}
      app = null;
      hostEl = null;
      vm = null;
      mounted = false;
    }

    // 白名单门控：只在招聘相关页面挂载悬浮球，离开时自动卸载
    const stopObserving = observeRecruitmentPage(
      () => mountFloatBall(),
      () => unmountFloatBall()
    );

    // 智能多步向导 (Multi-Step Wizard) SPA 路由与 DOM 步骤切换侦测
    let lastUrl = window.location.href;
    const handleStepChange = () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('[OpenJobFill] 检测到网申步骤/SPA路由变化:', lastUrl);
        if (vm && vm.notifyStepChange) {
          vm.notifyStepChange(lastUrl);
        }
      }
    };
    window.addEventListener('popstate', handleStepChange);
    window.addEventListener('hashchange', handleStepChange);

    // 拦截 pushState / replaceState 以精准捕获无刷新单页步骤切换
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleStepChange();
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      handleStepChange();
    };

    // DOM 表单签名突变监听 (捕获无 URL 变化的同页多步切换)
    const computeFormSignature = () => {
      const stepTitles = Array.from(
        document.querySelectorAll(
          '.ant-steps-item-active, .el-step.is-process, .semi-step-item-process, [class*="step"][class*="active"], [class*="step-current"]'
        )
      )
        .map((el) => (el.textContent || '').trim())
        .join('|');
      const inputNames = Array.from(document.querySelectorAll('input, select, textarea'))
        .slice(0, 25)
        .map((el) => el.getAttribute('name') || el.getAttribute('data-automation-id') || el.id || el.className)
        .filter(Boolean)
        .join(',');
      return `${stepTitles}::${inputNames}`;
    };

    let lastSignature = computeFormSignature();
    let signatureTimer: any = null;

    const domStepObserver = new MutationObserver(() => {
      if (signatureTimer) clearTimeout(signatureTimer);
      signatureTimer = setTimeout(() => {
        const newSig = computeFormSignature();
        if (newSig && newSig !== lastSignature) {
          lastSignature = newSig;
          console.log('[OpenJobFill] 检测到网申表单 DOM 步骤结构突变');
          if (vm && vm.notifyStepChange) {
            vm.notifyStepChange(window.location.href);
          }
        }
      }, 500);
    });

    try {
      domStepObserver.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}

    // 官方 WXT 上下文失效生命周期钩子：插件重载时立即释放所有监听器与恢复原型
    ctx.onInvalidated(() => {
      stopObserving();
      stopQALearner();
      unmountFloatBall();
      window.removeEventListener('popstate', handleStepChange);
      window.removeEventListener('hashchange', handleStepChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      domStepObserver.disconnect();
      if (signatureTimer) clearTimeout(signatureTimer);
    });

    // 监听来自 Background / Popup 的指令
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TRIGGER_AUTO_FILL') {
        // 即使悬浮球未显示，也允许手动触发时临时挂载
        if (!mounted) {
          mountFloatBall();
        }
        if (vm && vm.handleQuickFill) {
          vm.handleQuickFill();
          sendResponse({ success: true });
        }
      }
    });
  },
});
