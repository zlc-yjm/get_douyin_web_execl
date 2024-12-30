// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('douyin.com')) {
    console.log('Douyin page loaded, injecting content script...');
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).catch(err => console.error('Script injection error:', err));
  }
});

// 监听扩展安装或更新
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
}); 