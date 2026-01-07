/**
 * 后台服务工作者
 * 使用 chrome.downloads API 处理视频下载
 * 协调批量导出任务
 */

// ============================================================================
// 批量导出状态管理
// ============================================================================
let batchExportState = {
  isRunning: false,
  queue: [],
  currentIndex: 0,
  currentTabId: null,
  results: {
    completed: [],
    failed: []
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 批量导出相关消息
  if (message.type === 'START_BATCH_EXPORT') {
    handleStartBatchExport(message.conversationIds)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Batch export failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'EXPORT_COMPLETED') {
    handleExportCompleted(message.conversationId);
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'EXPORT_FAILED') {
    handleExportFailed(message.conversationId, message.error);
    sendResponse({ success: true });
    return false;
  }

  // 下载相关消息
  if (message.type === 'DOWNLOAD_VIDEO') {
    handleVideoDownload(message.data)
      .then(downloadId => {
        sendResponse({ success: true, downloadId });
      })
      .catch(error => {
        console.error('Download failed:', error);
        sendResponse({ success: false, error: error.message });
      });

    // 返回 true 表示异步响应
    return true;
  }

  if (message.type === 'DOWNLOAD_IMAGE') {
    handleImageDownload(message.data)
      .then(downloadId => {
        sendResponse({ success: true, downloadId });
      })
      .catch(error => {
        console.error('Download failed:', error);
        sendResponse({ success: false, error: error.message });
      });

    // 返回 true 表示异步响应
    return true;
  }

  if (message.type === 'DOWNLOAD_GENERATED_IMAGE') {
    handleGeneratedImageDownload(message.data)
      .then(downloadId => {
        sendResponse({ success: true, downloadId });
      })
      .catch(error => {
        console.error('Download failed:', error);
        sendResponse({ success: false, error: error.message });
      });

    // 返回 true 表示异步响应
    return true;
  }
});

async function handleVideoDownload({ url, filename, conversationId, messageIndex, fileIndex }) {
  try {
    // 如果未提供，从 URL 中提取文件名
    let finalFilename = filename;
    if (!finalFilename) {
      const urlParams = new URLSearchParams(new URL(url).search);
      const urlFilename = urlParams.get('filename');
      if (urlFilename) {
        finalFilename = urlFilename;
      } else {
        // 基于元数据生成文件名
        const ext = 'mp4'; // 默认扩展名
        finalFilename = `${conversationId}_msg${messageIndex}_video${fileIndex}.${ext}`;
      }
    }

    // 使用 chrome.downloads API
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: finalFilename,
      saveAs: false,
      conflictAction: 'uniquify'
    });

    console.log(`Download started: ${finalFilename} (ID: ${downloadId})`);
    return downloadId;

  } catch (error) {
    console.error('Error initiating download:', error);
    throw error;
  }
}

async function handleImageDownload({ url, filename, conversationId, messageIndex, fileIndex }) {
  try {
    // 如果未提供，从 URL 中提取文件名
    let finalFilename = filename;
    if (!finalFilename) {
      const urlParams = new URLSearchParams(new URL(url).search);
      const urlFilename = urlParams.get('filename');
      if (urlFilename) {
        finalFilename = urlFilename;
      } else {
        // 基于元数据生成文件名
        // 尝试从 URL 中提取扩展名
        let ext = 'jpg'; // 默认扩展名
        const urlPath = new URL(url).pathname;
        const pathExt = urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        if (pathExt) {
          ext = pathExt[1].toLowerCase();
        }
        finalFilename = `${conversationId}_msg${messageIndex}_image${fileIndex}.${ext}`;
      }
    }

    // 使用 chrome.downloads API
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: finalFilename,
      saveAs: false,
      conflictAction: 'uniquify'
    });

    console.log(`Download started: ${finalFilename} (ID: ${downloadId})`);
    return downloadId;

  } catch (error) {
    console.error('Error initiating download:', error);
    throw error;
  }
}

async function handleGeneratedImageDownload({ url, conversationId, messageIndex, fileIndex }) {
  try {
    // 生成的图片通常是 PNG 格式
    const ext = 'png';
    const finalFilename = `${conversationId}_msg${messageIndex}_generated${fileIndex}.${ext}`;

    // 使用 chrome.downloads API
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: finalFilename,
      saveAs: false,
      conflictAction: 'uniquify'
    });

    console.log(`Generated image download started: ${finalFilename} (ID: ${downloadId})`);
    return downloadId;

  } catch (error) {
    console.error('Error initiating download:', error);
    throw error;
  }
}

// 监控下载进度
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state) {
    if (downloadDelta.state.current === 'complete') {
      console.log(`Download completed: ${downloadDelta.id}`);
    } else if (downloadDelta.state.current === 'interrupted') {
      console.error(`Download interrupted: ${downloadDelta.id}`);
    }
  }
});

// ============================================================================
// 批量导出协调器
// ============================================================================

/**
 * 开始批量导出
 */
async function handleStartBatchExport(conversationIds) {
  if (batchExportState.isRunning) {
    throw new Error('批量导出任务已在运行中');
  }

  console.log('[Batch Export] Starting batch export for', conversationIds.length, 'conversations');

  // 初始化状态
  batchExportState.isRunning = true;
  batchExportState.queue = [...conversationIds];
  batchExportState.currentIndex = 0;
  batchExportState.results = {
    completed: [],
    failed: []
  };

  // 开始处理第一个
  await processNextExport();
}

/**
 * 处理下一个导出任务
 */
async function processNextExport() {
  if (!batchExportState.isRunning) {
    console.log('[Batch Export] Export cancelled');
    return;
  }

  if (batchExportState.currentIndex >= batchExportState.queue.length) {
    // 所有任务完成
    finishBatchExport();
    return;
  }

  const conversationId = batchExportState.queue[batchExportState.currentIndex];
  console.log(`[Batch Export] Processing ${batchExportState.currentIndex + 1}/${batchExportState.queue.length}: ${conversationId}`);

  try {
    // 生成URL（带自动导出标记）
    const url = generateConversationUrl(conversationId);

    // 创建新标签页
    const tab = await chrome.tabs.create({
      url: url,
      active: false  // 在后台打开
    });

    batchExportState.currentTabId = tab.id;
    console.log(`[Batch Export] Created tab ${tab.id} for conversation ${conversationId}`);

    // 标签页加载完成后会自动触发导出，然后发送 EXPORT_COMPLETED 或 EXPORT_FAILED 消息

  } catch (error) {
    console.error(`[Batch Export] Failed to create tab for ${conversationId}:`, error);
    batchExportState.results.failed.push({
      conversationId: conversationId,
      error: error.message
    });

    // 继续下一个
    batchExportState.currentIndex++;
    await processNextExport();
  }
}

/**
 * 处理导出完成
 */
async function handleExportCompleted(conversationId) {
  console.log(`[Batch Export] Export completed for ${conversationId}`);

  batchExportState.results.completed.push(conversationId);

  // 关闭当前标签页
  if (batchExportState.currentTabId) {
    try {
      await chrome.tabs.remove(batchExportState.currentTabId);
      console.log(`[Batch Export] Closed tab ${batchExportState.currentTabId}`);
    } catch (error) {
      console.error(`[Batch Export] Failed to close tab:`, error);
    }
    batchExportState.currentTabId = null;
  }

  // 等待一段时间后继续下一个（避免请求过快）
  await sleep(2000);

  // 处理下一个
  batchExportState.currentIndex++;
  await processNextExport();
}

/**
 * 处理导出失败
 */
async function handleExportFailed(conversationId, error) {
  console.error(`[Batch Export] Export failed for ${conversationId}:`, error);

  batchExportState.results.failed.push({
    conversationId: conversationId,
    error: error
  });

  // 关闭当前标签页
  if (batchExportState.currentTabId) {
    try {
      await chrome.tabs.remove(batchExportState.currentTabId);
    } catch (e) {
      console.error(`[Batch Export] Failed to close tab:`, e);
    }
    batchExportState.currentTabId = null;
  }

  // 等待一段时间后继续下一个
  await sleep(2000);

  // 处理下一个
  batchExportState.currentIndex++;
  await processNextExport();
}

/**
 * 完成批量导出
 */
function finishBatchExport() {
  console.log('[Batch Export] Batch export finished');
  console.log(`Completed: ${batchExportState.results.completed.length}`);
  console.log(`Failed: ${batchExportState.results.failed.length}`);

  if (batchExportState.results.failed.length > 0) {
    console.log('Failed IDs:', batchExportState.results.failed);
  }

  // 重置状态
  batchExportState.isRunning = false;
  batchExportState.queue = [];
  batchExportState.currentIndex = 0;
  batchExportState.currentTabId = null;

  // 可以在这里发送通知给用户
}

/**
 * 生成对话URL（带自动导出标记）
 */
function generateConversationUrl(conversationId) {
  return `https://gemini.google.com/app/${conversationId}?pageId=none&auto_export=true`;
}

/**
 * 睡眠函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
