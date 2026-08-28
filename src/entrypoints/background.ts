export default defineBackground(() => {
  console.log('[OpenJobFill] Background service worker initialized.');

  // 监听插件图标点击或快捷键
  chrome.commands?.onCommand?.addListener(async (command) => {
    if (command === 'trigger_autofill') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AUTO_FILL' });
      }
    }
  });

  // 监听来自 Content Script 或 Popup 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_OPTIONS_PAGE') {
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
    }
  });
});
