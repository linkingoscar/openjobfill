import { isIgnoredDomain, observeRecruitmentPage } from '@/core/whitelist';
import { BUILTIN_RECRUITMENT_MATCHES } from '@/core/recruitmentPermissions';
import { isExtensionMessage } from '@/types/message';

export default defineContentScript({
  // Unknown sites no longer receive an install-time all-sites content script.
  // They can still be filled after a user gesture through activeTab, while explicitly
  // whitelisted custom domains receive their own optional origin permission.
  matches: BUILTIN_RECRUITMENT_MATCHES,
  runAt: 'document_idle',

  main() {
    // 普通页面只运行这一层探测器；Vue、解析器和填表引擎由 background 按需注入。
    if (isIgnoredDomain()) return;
    // 重型运行时会由 background 以 allFrames 注入；静态探测只需要在顶层
    // frame 工作，避免每个广告/组件 iframe 都持续读取 body 和 computed style。
    if (window !== window.top) return;

    const requestRuntime = () => {
      void chrome.runtime.sendMessage({ type: 'RECRUITMENT_PAGE_DETECTED' }).catch(() => undefined);
    };

    const stopObserving = observeRecruitmentPage(requestRuntime, () => undefined);
    const handleRuntimeMessage = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => {
      if (!isExtensionMessage(message) || message.type !== 'TRIGGER_AUTO_FILL' || window !== window.top) return;

      // 原始 popup/快捷键消息到达时，先确保重型运行时已注入，再由 background
      // 转发一个仅供 runtime 处理的内部消息，避免同一消息在探测器和运行时之间递归。
      chrome.runtime.sendMessage({
        type: 'ENSURE_RUNTIME_AND_FORWARD',
        payload: message.payload,
      }, (response) => {
        const error = chrome.runtime?.lastError;
        sendResponse(error ? { success: false, error: error.message } : response);
      });
      return true;
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);

    // 内容脚本没有 WXT context；扩展重载时 runtime 会失效，清理当前页面监听即可。
    const cleanup = () => {
      stopObserving();
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      window.removeEventListener('pagehide', cleanup);
    };
    window.addEventListener('pagehide', cleanup, { once: true });
  },
});
