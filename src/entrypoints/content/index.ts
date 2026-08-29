import { createApp, type App as VueApp } from 'vue';
import FloatBall from '@/components/FloatBall.vue';
import styleText from './style.css?inline';
import { isIgnoredDomain, observeRecruitmentPage } from '@/core/whitelist';
import { initSmartQALearner } from '@/core/engine/qaLearner';
import { resumeStorage } from '@/core/storage/resumeStorage';
import { formFillerEngine, type AnalyzedPlan } from '@/core/engine/filler';
import { serializeAnalyzedPlan, serializeExecutionResult } from '@/core/frames/frameCoordinator';

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
    let stopQALearner: (() => void) | null = null;
    let stopStepTracking: (() => void) | null = null;
    const framePlans = new Map<string, AnalyzedPlan>();

    const startRecruitmentListeners = () => {
      if (!stopQALearner) {
        stopQALearner = initSmartQALearner();
      }
      if (window === window.top && !stopStepTracking) {
        stopStepTracking = startStepTracking();
      }
    };

    const stopRecruitmentListeners = () => {
      stopQALearner?.();
      stopQALearner = null;
      stopStepTracking?.();
      stopStepTracking = null;
    };

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
      () => {
        startRecruitmentListeners();
        mountFloatBall();
      },
      () => {
        stopRecruitmentListeners();
        unmountFloatBall();
      }
    );

    // 只在已识别的招聘页顶层窗口启动多步表单侦测，避免普通网页长期挂载全页 MutationObserver。
    function startStepTracking(): () => void {
      let lastUrl = window.location.href;
      const handleStepChange = () => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          console.log('[OpenJobFill] 检测到网申步骤/SPA路由变化:', lastUrl);
          if (vm?.notifyStepChange) {
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
      let signatureTimer: ReturnType<typeof setTimeout> | null = null;

      const domStepObserver = new MutationObserver(() => {
        if (signatureTimer) clearTimeout(signatureTimer);
        signatureTimer = setTimeout(() => {
          const newSig = computeFormSignature();
          if (newSig && newSig !== lastSignature) {
            lastSignature = newSig;
            console.log('[OpenJobFill] 检测到网申表单 DOM 步骤结构突变');
            if (vm?.notifyStepChange) {
              vm.notifyStepChange(window.location.href);
            }
          }
        }, 500);
      });

      if (document.body) {
        domStepObserver.observe(document.body, { childList: true, subtree: true });
      }

      return () => {
        window.removeEventListener('popstate', handleStepChange);
        window.removeEventListener('hashchange', handleStepChange);
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
        domStepObserver.disconnect();
        if (signatureTimer) {
          clearTimeout(signatureTimer);
          signatureTimer = null;
        }
      };
    }

    // 监听来自 Background / Popup 的指令
    const handleRuntimeMessage = (message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      if (message.type === 'FRAME_ANALYZE') {
        (async () => {
          const analysisId = String(message.payload?.analysisId || '');
          if (!analysisId) throw new Error('缺少跨 frame 分析标识');

          const resumes = await resumeStorage.getAllResumes();
          const resume = resumes.find((item) => item.id === message.payload?.resumeId) || await resumeStorage.getActiveResume();
          const analyzed = await formFillerEngine.analyze(resume);
          framePlans.set(analysisId, analyzed);
          sendResponse({
            success: true,
            plan: serializeAnalyzedPlan(analyzed, analysisId),
          });
        })().catch((err) => sendResponse({ success: false, error: err?.message || '子页面分析失败' }));
        return true;
      }

      if (message.type === 'FRAME_EXECUTE') {
        (async () => {
          const analysisId = String(message.payload?.analysisId || '');
          const analyzed = framePlans.get(analysisId);
          if (!analyzed) throw new Error('子页面填写计划已失效，请重新识别');

          const result = await formFillerEngine.executePlan(analyzed);
          framePlans.delete(analysisId);
          sendResponse({ success: true, result: serializeExecutionResult(result) });
        })().catch((err) => sendResponse({ success: false, error: err?.message || '子页面填写失败' }));
        return true;
      }

      if (message.type === 'FRAME_CANCEL_ANALYSIS') {
        framePlans.delete(String(message.payload?.analysisId || ''));
        sendResponse({ success: true });
        return;
      }

      if (message.type !== 'TRIGGER_AUTO_FILL') return;

      // tabs.sendMessage 默认会把消息广播给所有 frame。悬浮球只挂在顶层，
      // 子 frame 若回传“面板尚未准备好”会和顶层响应竞争，导致 popup 偶发显示失败。
      // 顶层引擎本身会扫描可访问的同源 iframe，因此子 frame 不重复处理。
      if (window !== window.top) return;

      (async () => {
        try {
          // 即使悬浮球未显示，也允许手动触发时临时挂载
          if (!mounted) {
            startRecruitmentListeners();
            mountFloatBall();
          }
          if (!vm?.handleQuickFill) {
            throw new Error('填表面板尚未准备好，请刷新页面后重试');
          }

          const result = await vm.handleQuickFill();
          sendResponse({ success: true, ...result });
        } catch (err: any) {
          sendResponse({ success: false, error: err?.message || '页面识别失败' });
        }
      })();

      return true;
    };
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);

    // 官方 WXT 上下文失效生命周期钩子：插件重载时立即释放所有监听器与恢复原型
    ctx.onInvalidated(() => {
      stopObserving();
      stopRecruitmentListeners();
      unmountFloatBall();
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      framePlans.clear();
    });
  },
});
