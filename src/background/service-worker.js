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
  userNumber: '0',
  results: {
    completed: [],
    failed: []
  }
};

// 记录 JSON 下载使用的 object URL，下载结束后释放
const objectUrlsByDownloadId = new Map();

function revokeObjectUrlForDownload(downloadId) {
  const objectUrl = objectUrlsByDownloadId.get(downloadId);
  if (!objectUrl) return;
  try {
    URL.revokeObjectURL(objectUrl);
  } finally {
    objectUrlsByDownloadId.delete(downloadId);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Service Worker] Received message:', message.type, message);

  // 批量导出相关消息
  if (message.type === 'START_BATCH_EXPORT') {
    handleStartBatchExport(message.conversationIds, message.userNumber)
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
    console.log('[Service Worker] Handling EXPORT_COMPLETED for:', message.conversationId);
    handleExportCompleted(message.conversationId)
      .then(() => {
        console.log('[Service Worker] EXPORT_COMPLETED handled successfully');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Handle export completed failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'EXPORT_FAILED') {
    handleExportFailed(message.conversationId, message.error)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Handle export failed failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
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

  if (message.type === 'DOWNLOAD_JSON') {
    handleJsonDownload(message.data)
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

async function handleJsonDownload({ jsonData, conversationId }) {
  const filename = `${conversationId}.json`;

  try {
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    let objectUrl;

    try {
      objectUrl = URL.createObjectURL(blob);

      const downloadId = await chrome.downloads.download({
        url: objectUrl,
        filename: filename,
        saveAs: false,
        conflictAction: 'uniquify'
      });

      objectUrlsByDownloadId.set(downloadId, objectUrl);
      console.log(`JSON download started: ${filename} (ID: ${downloadId})`);
      return downloadId;
    } catch (error) {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (_) {
          // 忽略 revoke 失败
        }
      }

      // 兼容兜底：若 object URL 在此环境不可用，则退回 Data URL
      console.warn('[JSON Download] Falling back to Data URL:', error);

      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: false,
        conflictAction: 'uniquify'
      });

      console.log(`JSON download started: ${filename} (ID: ${downloadId})`);
      return downloadId;
    }
  } catch (error) {
    console.error('Error initiating JSON download:', error);
    throw error;
  }
}

// 监控下载进度
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (!downloadDelta.state) return;

  if (downloadDelta.state.current === 'complete') {
    console.log(`Download completed: ${downloadDelta.id}`);
    revokeObjectUrlForDownload(downloadDelta.id);
  } else if (downloadDelta.state.current === 'interrupted') {
    console.error(`Download interrupted: ${downloadDelta.id}`);
    revokeObjectUrlForDownload(downloadDelta.id);
  }
});

// ============================================================================
// 批量导出协调器
// ============================================================================

/**
 * 开始批量导出
 */
async function handleStartBatchExport(conversationIds, userNumber) {
  if (batchExportState.isRunning) {
    throw new Error('Batch export is already running');
  }

  console.log('[Batch Export] Starting batch export for', conversationIds.length, 'conversations');
  console.log('[Batch Export] User number:', userNumber);

  // 初始化状态
  batchExportState.isRunning = true;
  batchExportState.queue = [...conversationIds];
  batchExportState.currentIndex = 0;
  batchExportState.userNumber = userNumber || '0';
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
    // 注意：必须 active: true，否则后台标签页的剪贴板 API 和视频加载会失败
    const tab = await chrome.tabs.create({
      url: url,
      active: true  // 激活标签页，确保剪贴板和视频能正常工作
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

  // 不关闭标签页，让下载有充足时间完成
  // if (batchExportState.currentTabId) {
  //   try {
  //     await chrome.tabs.remove(batchExportState.currentTabId);
  //     console.log(`[Batch Export] Closed tab ${batchExportState.currentTabId}`);
  //   } catch (error) {
  //     console.error(`[Batch Export] Failed to close tab:`, error);
  //   }
  //   batchExportState.currentTabId = null;
  // }

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

  // 不关闭标签页，方便用户查看错误
  // if (batchExportState.currentTabId) {
  //   try {
  //     await chrome.tabs.remove(batchExportState.currentTabId);
  //   } catch (e) {
  //     console.error(`[Batch Export] Failed to close tab:`, e);
  //   }
  //   batchExportState.currentTabId = null;
  // }

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
  const userNumber = batchExportState.userNumber || '0';
  return `https://gemini.google.com/u/${userNumber}/app/${conversationId}?pageId=none&auto_export=true`;
}

/**
 * 睡眠函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
