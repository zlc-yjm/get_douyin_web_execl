let videoData = [];

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
  
  // 立即检查当前标签页
  checkCurrentTab();
  
  document.getElementById('startButton').addEventListener('click', async () => {
    console.log('Start button clicked');
    const statusElement = document.getElementById('status');
    const likeThresholdInput = document.getElementById('likeThreshold');
    const videoLimitInput = document.getElementById('videoLimit');
    const threshold = parseInt(likeThresholdInput.value);
    const videoLimit = parseInt(videoLimitInput.value);
    
    // 验证点赞数输入
    if (!likeThresholdInput.value || isNaN(threshold)) {
      statusElement.innerHTML = '请输入有效的点赞数量！<br><small>例如：1000</small>';
      likeThresholdInput.focus();
      return;
    }
    
    if (threshold < 0) {
      statusElement.innerHTML = '点赞数量不能为负数！';
      likeThresholdInput.focus();
      return;
    }

    // 验证视频行数输入
    if (!videoLimitInput.value || isNaN(videoLimit)) {
      statusElement.innerHTML = '请输入有效的视频行数！<br><small>范围：1-50</small>';
      videoLimitInput.focus();
      return;
    }
    
    if (videoLimit < 1 || videoLimit > 50) {
      statusElement.innerHTML = '视频行数必须在1-50之间！';
      videoLimitInput.focus();
      return;
    }
    
    statusElement.innerHTML = '正在准备...<br>点赞阈值: ' + threshold + '<br>获取行数: ' + videoLimit;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab);
      
      if (!tab) {
        throw new Error('无法获取当前标签页');
      }
      
      if (!tab.url || !tab.url.includes('douyin.com')) {
        statusElement.innerHTML = '请在抖音网站上使用此插件！<br>当前URL: ' + (tab.url || '未知');
        return;
      }
      
      statusElement.innerHTML = '正在获取视频数据...<br>请等待页面滚动完成';
      
      // 注入内容脚本
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('Content script injected');
      } catch (err) {
        console.log('Content script injection error (可能已经注入):', err);
      }
      
      // 等待一小段时间确保脚本加载
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 发送消息到内容脚本，增加videoLimit参数
      console.log('Sending message to content script...');
      try {
        const response = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tab.id, {
            action: "scrapeVideos",
            threshold: threshold,
            videoLimit: videoLimit
          }, response => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
          
          // 设置超时
          setTimeout(() => {
            reject(new Error('获取数据超时'));
          }, 30000); // 增加超时时间到30秒
        });
        
        console.log('Response received:', response);
        
        if (response && response.videos) {
          videoData = response.videos;
          if (videoData.length === 0) {
            statusElement.innerHTML = `未找到符合条件的视频<br>
              请检查：<br>
              1. 是否在个人主页<br>
              2. 点赞阈值(${threshold})是否过高<br>
              3. 页面是否完全加载`;
          } else {
            updateStatus();
          }
        } else {
          statusElement.innerHTML = '未能获取视频数据<br>Response: ' + JSON.stringify(response);
        }
      } catch (err) {
        console.error('Message sending error:', err);
        statusElement.innerHTML = `错误: ${err.message}<br>
          可能原因：<br>
          1. 页面未完全加载<br>
          2. 网络连接问题<br>
          3. 页面结构可能已更新`;
        // 尝试重新注入内容脚本
        location.reload();
      }
    } catch (err) {
      console.error('Error:', err);
      statusElement.innerHTML = `错误: ${err.message}<br>
        详细信息：${err.stack || '无'}`;
    }
  });
  
  document.getElementById('exportButton').addEventListener('click', () => {
    console.log('Export button clicked');
    if (videoData.length === 0) {
      alert('没有可导出的数据！');
      return;
    }

    // 创建CSV内容
    const csvContent = [
      // CSV头部
      ['视频标题', '点赞数', '视频链接'].join(','),
      // 数据行
      ...videoData.map(video => [
        // 处理标题中的逗号，用引号包裹
        `"${video.title.replace(/"/g, '""')}"`,
        video.likes,
        video.url
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: url,
      filename: `抖音视频数据_${new Date().toISOString().split('T')[0]}.csv`
    });
  });
  
  document.getElementById('analyzeButton').addEventListener('click', async () => {
    const statusElement = document.getElementById('status');
    statusElement.innerHTML = '正在分析页面结构...';
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('无法获取当前标签页');
      }
      
      // 先尝试注入内容脚本
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('Content script injected');
      } catch (err) {
        console.log('Content script injection error (可能已经注入):', err);
      }
      
      // 等待脚本加载
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 发送分析消息
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, {
          action: "analyzeStructure"
        }, response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
        
        // 设置超时
        setTimeout(() => {
          reject(new Error('分析超时，请刷新页面重试'));
        }, 5000);
      });
      
      statusElement.innerHTML = '分析完成，请查看控制台输出<br><small>按F12打开开发者工具</small>';
      console.log('分析结果:', response);
    } catch (err) {
      statusElement.innerHTML = `分析失败: ${err.message}<br>
        <small>请刷新页面后重试</small>`;
      console.error('Analysis error:', err);
    }
  });
});

async function checkCurrentTab() {
  const statusElement = document.getElementById('status');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url || !tab.url.includes('douyin.com')) {
      statusElement.innerHTML = `请在抖音网站上使用此插件！<br>当前URL: ${tab.url || '未知'}`;
      document.getElementById('startButton').disabled = true;
    }
  } catch (err) {
    console.error('Tab check error:', err);
    statusElement.innerHTML = `无法检查当前页面<br>错误: ${err.message}`;
  }
}

function updateStatus() {
  const statusElement = document.getElementById('status');
  statusElement.innerHTML = `已获取视频数：${videoData.length}<br>
    <small>点击导出按钮保存数据</small>`;
} 