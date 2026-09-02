import { createApp, type App as VueApp } from 'vue';
import FloatBall from '@/components/FloatBall.vue';
import styleText from './content/style.css?inline';
import { initSmartQALearner } from '@/core/engine/qaLearner';
import { resumeStorage } from '@/core/storage/resumeStorage';
import { formFillerEngine, type AnalyzedPlan } from '@/core/engine/filler';
import { serializeAnalyzedPlan, serializeExecutionResult } from '@/core/frames/frameCoordinator';
import { isExtensionMessage } from '@/types/message';
import { isApplicationSuccessPage } from '@/core/tracker/pageJobExtractor';

export default defineUnlistedScript(() => {
  // executeScript 可能在同一 frame 重复执行（例如 SPA 导航或 service worker 重启）。
  // 以每个 frame 的 DOM 标记作为幂等标记，避免重复挂载和重复监听。
  // 顶层额外使用宿主节点 ID，便于调试和与旧版本页面兼容。
  const runtimeMarker = 'data-openjobfill-runtime-mounted';
  if (document.documentElement?.hasAttribute(runtimeMarker)) return;
  document.documentElement?.setAttribute(runtimeMarker, 'true');
  if (window.top === window && document.getElementById('openjobfill-extension-host')) return;

  let mounted = false;
  let app: VueApp | null = null;
  let hostEl: HTMLDivElement | null = null;
  let vm: {
    handleQuickFill?: () => Promise<{ fillCount?: number; needsUserCount?: number }>;
    notifyStepChange?: (url: string, changedNodes?: HTMLElement[]) => void;
    isFilling?: () => boolean;
  } | null = null;
  let stopQALearner: (() => void) | null = null;
  let stopStepTracking: (() => void) | null = null;
  const framePlans = new Map<string, AnalyzedPlan>();

  const startRecruitmentListeners = () => {
    // QA 学习器需要读取顶层页面的候选字段；跨域子 frame 只承担分析/执行消息，
    // 不再为每个 frame 各自安装一套全页监听器。
    if (window === window.top && !stopQALearner) stopQALearner = initSmartQALearner();
    if (window === window.top && !stopStepTracking) stopStepTracking = startStepTracking();
  };

  const stopRecruitmentListeners = () => {
    stopQALearner?.();
    stopQALearner = null;
    stopStepTracking?.();
    stopStepTracking = null;
  };

  function mountFloatBall() {
    if (mounted || window !== window.top) return;

    hostEl = document.createElement('div');
    hostEl.id = 'openjobfill-extension-host';
    document.documentElement.appendChild(hostEl);
    const shadowRoot = hostEl.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = styleText;
    shadowRoot.appendChild(styleEl);

    const mountPoint = document.createElement('div');
    shadowRoot.appendChild(mountPoint);
    app = createApp(FloatBall);
    vm = app.mount(mountPoint) as typeof vm;
    mounted = true;
  }

  function unmountFloatBall() {
    if (!mounted) return;
    try {
      app?.unmount();
      hostEl?.remove();
    } catch {
      // 页面卸载时 DOM 可能已经不可用。
    }
    app = null;
    hostEl = null;
    vm = null;
    mounted = false;
  }

  function startStepTracking(): () => void {
    let lastUrl = window.location.href;
    let lastSuccessSignal = isApplicationSuccessPage();
    const handleStepChange = () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        lastSuccessSignal = false;
        vm?.notifyStepChange?.(lastUrl);
      }
    };
    window.addEventListener('popstate', handleStepChange);
    window.addEventListener('hashchange', handleStepChange);

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

    const computeFormSignature = () => {
      const stepTitles = Array.from(document.querySelectorAll(
        '.ant-steps-item-active, .el-step.is-process, .semi-step-item-process, [class*="step"][class*="active"], [class*="step-current"]',
      )).map((el) => (el.textContent || '').trim()).join('|');
      const inputNames = Array.from(document.querySelectorAll('input, select, textarea'))
        .slice(0, 25)
        .map((el) => el.getAttribute('name') || el.getAttribute('data-automation-id') || el.id || el.className)
        .filter(Boolean)
        .join(',');
      return `${stepTitles}::${inputNames}`;
    };

    let lastSignature = computeFormSignature();
    let signatureTimer: ReturnType<typeof setTimeout> | null = null;
    const domStepObserver = new MutationObserver((mutations) => {
      if (signatureTimer) clearTimeout(signatureTimer);
      signatureTimer = setTimeout(() => {
        const newSig = computeFormSignature();
        const signatureChanged = !!newSig && newSig !== lastSignature;
        const successDetected = isApplicationSuccessPage();
        const successChanged = successDetected && !lastSuccessSignal;
        lastSuccessSignal = successDetected;
        // 自己的动态增行/组件渲染也会触发 mutation；运行中只更新基线，
        // 不把这些预期变化误当成外部步骤切换或增量任务。申请成功信号除外，
        // 它需要尽快中止未完成的填写并生成待确认草稿。
        if (!signatureChanged && !successChanged) return;
        const busy = !!vm?.isFilling?.();
        if (signatureChanged) lastSignature = newSig;
        if (busy && !successChanged) return;
        const changedNodes = signatureChanged
          ? mutations
            .flatMap((mutation) => Array.from(mutation.addedNodes))
            .map((node) => node.nodeType === 1 ? node as HTMLElement : node.parentElement)
            .filter((node): node is HTMLElement => !!node)
            .slice(0, 40)
          : [];
        vm?.notifyStepChange?.(window.location.href, changedNodes);
      }, 500);
    });
    if (document.body) domStepObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('popstate', handleStepChange);
      window.removeEventListener('hashchange', handleStepChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      domStepObserver.disconnect();
      if (signatureTimer) clearTimeout(signatureTimer);
    };
  }

  const handleRuntimeMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    if (!isExtensionMessage(message)) return;

    if (message.type === 'FRAME_ANALYZE') {
      (async () => {
        const analysisId = message.payload.analysisId;
        const resumes = await resumeStorage.getAllResumes();
        const resume = resumes.find((item) => item.id === message.payload.resumeId) || await resumeStorage.getActiveResume();
        const analyzed = await formFillerEngine.analyze(resume, { runId: message.payload.runId });
        framePlans.set(analysisId, analyzed);
        sendResponse({ success: true, plan: serializeAnalyzedPlan(analyzed, analysisId) });
      })().catch((error) => sendResponse({ success: false, error: error instanceof Error ? error.message : '子页面分析失败' }));
      return true;
    }

    if (message.type === 'FRAME_EXECUTE') {
      (async () => {
        const analyzed = framePlans.get(message.payload.analysisId);
        if (!analyzed) throw new Error('子页面填写计划已失效，请重新识别');
        const result = await formFillerEngine.executePlan(analyzed);
        framePlans.delete(message.payload.analysisId);
        sendResponse({ success: true, result: serializeExecutionResult(result) });
      })().catch((error) => sendResponse({ success: false, error: error instanceof Error ? error.message : '子页面填写失败' }));
      return true;
    }

    if (message.type === 'FRAME_CANCEL_ANALYSIS') {
      const analyzed = framePlans.get(message.payload.analysisId);
      if (analyzed) formFillerEngine.cancelRun(analyzed.runId, '跨域填写已取消');
      framePlans.delete(message.payload.analysisId);
      sendResponse({ success: true });
      return;
    }

    if (message.type !== 'RUNTIME_TRIGGER_AUTO_FILL' && message.type !== 'TRIGGER_AUTO_FILL') return;
    if (window !== window.top) return;

    (async () => {
      try {
        if (!mounted) {
          startRecruitmentListeners();
          mountFloatBall();
        }
        if (!vm?.handleQuickFill) throw new Error('填表面板尚未准备好，请刷新页面后重试');
        const result = await vm.handleQuickFill();
        sendResponse({ success: true, ...result });
      } catch (error) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : '页面识别失败' });
      }
    })();
    return true;
  };

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  startRecruitmentListeners();
  mountFloatBall();

  const cleanup = () => {
    stopRecruitmentListeners();
    unmountFloatBall();
    chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    framePlans.clear();
    window.removeEventListener('pagehide', cleanup);
  };
  window.addEventListener('pagehide', cleanup, { once: true });
});
