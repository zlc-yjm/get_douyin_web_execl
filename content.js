console.log('Content script loaded');

// 通知扩展已加载
chrome.runtime.sendMessage({ action: 'contentScriptLoaded' });

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  if (request.action === "analyzeStructure") {
    // 执行页面分析
    const result = analyzePageStructure();
    sendResponse({ result });
    return true;
  }
  
  if (request.action === "scrapeVideos") {
    console.log('Starting to scrape videos');
    
    // 使用 Promise 来处理异步操作
    (async () => {
      try {
        // 等待页面加载
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 执行自动滚动
        await autoScroll();
        
        // 再次等待以确保内容加载完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 获取视频数据，传入视频行数限制
        const videos = scrapeCurrentPageVideos(request.threshold, request.videoLimit);
        console.log('Scraped videos:', videos);
        
        // 发送响���
        sendResponse({ videos: videos });
      } catch (err) {
        console.error('Error during scraping:', err);
        sendResponse({ error: err.message });
      }
    })();
    
    return true; // 保持消息通道开放
  }
});

function scrapeCurrentPageVideos(threshold, videoLimit = 50) {
  const videos = [];
  console.log('开始抓取视频数据，点赞阈值:', threshold, '视频行数限制:', videoLimit);
  
  // 查找所有视频卡片 - 支持多种场景
  const selectors = [
    '.wqW3g_Kl',                    // 用户主页
    '.ECMy_Zdt',                    // 首页推荐
    '[data-e2e="scroll-item"]',     // 视频流
    '.video-card-big',              // 搜索结果
    '.player-info',                 // 播放页
    '.UwvcKsMK'                     // 其他可能的视频卡片类名
  ];
  
  const videoCards = document.querySelectorAll(selectors.join(','));
  console.log(`找到 ${videoCards.length} 个视频卡片`);
  
  // 计算需要处理的视频数量（每行6个视频）
  const videosPerRow = 6;
  const totalVideosToProcess = Math.min(videoLimit * videosPerRow, videoCards.length);
  console.log(`将处理前 ${totalVideosToProcess} 个视频（${videoLimit}行 x ${videosPerRow}个/行）`);
  
  // 只处理指定行数的视频
  const cardsToProcess = Array.from(videoCards).slice(0, totalVideosToProcess);
  
  cardsToProcess.forEach((card, index) => {
    try {
      // 获取视频链接 - 支持多种链接格式
      let videoUrl = null;
      const linkElement = card.querySelector('a[href*="/video/"], a[href*="/share/"], a[href*="/follow/"]');
      if (linkElement) {
        const href = linkElement.getAttribute('href');
        // 处理不同格式的链接
        if (href.includes('/follow/')) {
          // 从 follow 链接中提取视频ID
          const videoId = href.match(/\/follow\/.*?\/(\d+)/)?.[1];
          if (videoId) {
            videoUrl = `https://www.douyin.com/video/${videoId}`;
          }
        } else {
          videoUrl = href.startsWith('http') ? href : `https://www.douyin.com${href}`;
        }
      }
      
      // 获取标题 - 支持多种标题元素
      const titleSelectors = [
        '.eJFBAbdI',
        '.EtttsrEw',
        '.title',
        '[data-e2e="video-title"]',
        '.video-title',
        '.desc'
      ];
      const titleElement = card.querySelector(titleSelectors.join(','));
      const videoTitle = titleElement ? titleElement.textContent.trim() : '';
      
      // 获取点赞数 - 支持多种点赞元素
      let likeCount = 0;
      const likeSelectors = [
        '.BgCg_ebQ',
        '.like-count',
        '[data-e2e="like-count"]',
        '.stats-like',
        '.video-data .like'
      ];
      const likeElement = card.querySelector(likeSelectors.join(','));
      if (likeElement) {
        const text = likeElement.textContent.trim();
        // 处理带单位的数字
        if (text.includes('万')) {
          // 处理 x.x万 格式
          const num = parseFloat(text.replace('万', ''));
          likeCount = Math.floor(num * 10000);
        } else if (text.includes('w')) {
          // 处理 x.xw 格式
          const num = parseFloat(text.replace('w', ''));
          likeCount = Math.floor(num * 10000);
        } else if (text.includes('k')) {
          // 处理 x.xk 格式
          const num = parseFloat(text.replace('k', ''));
          likeCount = Math.floor(num * 1000);
        } else {
          likeCount = parseInt(text.replace(/[^\d]/g, '')) || 0;
        }
      }
      
      console.log(`处理第 ${index + 1} 个视频:`, {
        url: videoUrl,
        likes: likeCount,
        title: videoTitle,
        rawLikes: likeElement ? likeElement.textContent.trim() : '未找到'  // 添加原始点赞数据用于调试
      });
      
      if (videoUrl && likeCount >= threshold) {
        videos.push({
          url: videoUrl,
          likes: likeCount,
          title: videoTitle
        });
      }
    } catch (err) {
      console.error(`处理第 ${index + 1} 个视频时出错:`, err);
    }
  });
  
  console.log(`共找到 ${videos.length} 个符合条件的视频`);
  return videos;
}

// 自动滚动到底部
async function autoScroll() {
  console.log('开始自动滚动...');
  return new Promise((resolve) => {
    let lastHeight = document.documentElement.scrollHeight;
    let scrollCount = 0;
    let noChangeCount = 0;
    const maxScrolls = 30;
    
    // 等待页面初始加载
    setTimeout(() => {
      const timer = setInterval(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        scrollCount++;
        console.log(`滚动次数: ${scrollCount}`);
        
        // 等待内容加载
        setTimeout(() => {
          const newHeight = document.documentElement.scrollHeight;
          console.log(`页面高度: ${newHeight}, 上次高度: ${lastHeight}`);
          
          // 检查是否有新内容加载 - 支持多种场景
          const videoCards = document.querySelectorAll([
            '.wqW3g_Kl',
            '.ECMy_Zdt',
            '[data-e2e="scroll-item"]',
            '.video-card-big',
            '.player-info',
            '.UwvcKsMK'
          ].join(','));
          console.log(`当前找到 ${videoCards.length} 个视频卡片`);
          
          if (newHeight === lastHeight && videoCards.length > 0) {
            noChangeCount++;
            if (noChangeCount >= 3) {
              clearInterval(timer);
              console.log('滚动完成：内容已加载完毕');
              resolve();
            }
          } else {
            noChangeCount = 0;
          }
          
          if (scrollCount >= maxScrolls) {
            clearInterval(timer);
            console.log('滚动完成：达到最大次数');
            resolve();
          }
          
          lastHeight = newHeight;
        }, 1500); // 增加等待时间
      }, 2000); // 增加滚动间隔
    }, 2000); // 等待页面初始加载
  });
}

function analyzePageStructure() {
  console.log('开始分析页面结构...');
  
  // 分析第一个视频卡片
  const firstCard = document.querySelector('.wqW3g_Kl');
  if (firstCard) {
    console.log('\n第一个视频卡片结构:');
    console.log('HTML:', firstCard.outerHTML);
    
    // 查找所有可能包含数字的元素
    const allElements = firstCard.getElementsByTagName('*');
    console.log('\n包含数字的元素:');
    Array.from(allElements).forEach(el => {
      const text = el.textContent.trim();
      if (/\d+/.test(text)) {
        console.log('元素:', el);
        console.log('类名:', el.className);
        console.log('文本:', text);
        console.log('HTML:', el.outerHTML);
        console.log('---');
      }
    });
    
    // 查找所有带有特定关键字的类名
    console.log('\n特定类名的元素:');
    ['like', 'count', 'num', 'digit', 'stat'].forEach(keyword => {
      const elements = firstCard.querySelectorAll(`[class*="${keyword}"]`);
      if (elements.length > 0) {
        console.log(`\n包含 "${keyword}" 的类名元素:`);
        elements.forEach(el => {
          console.log('类名:', el.className);
          console.log('文本:', el.textContent.trim());
          console.log('HTML:', el.outerHTML);
          console.log('---');
        });
      }
    });
  }
  
  // 查找所有视频卡片
  const videoCards = document.querySelectorAll('.wqW3g_Kl');
  console.log(`\n找到 ${videoCards.length} 个视频卡片`);
  
  // 分析前三个视频卡片的数据
  videoCards.forEach((card, index) => {
    if (index < 3) {
      console.log(`\n视频 ${index + 1}:`);
      
      // 获取视频链接
      const linkElement = card.querySelector('a[href*="/video/"]');
      console.log('链接:', linkElement ? linkElement.getAttribute('href') : '未找到');
      
      // 获取标题
      const titleElement = card.querySelector('.eJFBAbdI, .EtttsrEw');
      console.log('标题:', titleElement ? titleElement.textContent.trim() : '未找到');
      
      // 查找所有数字元素
      const numberElements = Array.from(card.getElementsByTagName('*'))
        .filter(el => /^\d+$/.test(el.textContent.trim()));
      
      console.log('数字元素:');
      numberElements.forEach(el => {
        console.log('- 类名:', el.className);
        console.log('  文本:', el.textContent.trim());
        console.log('  HTML:', el.outerHTML);
      });
    }
  });
  
  return '页面结构分析完成，请在控制台查看详细信息';
}

function getLikeCount(videoCard) {
  // 方法1: 直接通过类名获取点赞数
  const likeElement = videoCard.querySelector('.BgCg_ebQ');
  if (likeElement) {
    return likeElement.textContent;
  }
  
  // 方法2: 通过包含like的父元素获取
  const likeContainer = videoCard.querySelector('.uWre3Wbh.author-card-user-video-like');
  if (likeContainer) {
    const numberElement = likeContainer.querySelector('.BgCg_ebQ');
    return numberElement ? numberElement.textContent : null;
  }
  
  return null;
}

console.log('Content script fully initialized'); 