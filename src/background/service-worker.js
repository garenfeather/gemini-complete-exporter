/**
 * 后台服务工作者
 * 使用 chrome.downloads API 处理视频下载
 */

/**
 * 清理文件名，移除路径遍历字符和其他不安全字符
 * @param {string} filename - 原始文件名
 * @returns {string} - 清理后的安全文件名
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  return filename
    .replace(/[\/\\]/g, '_')           // 替换路径分隔符
    .replace(/\.\./g, '_')             // 替换 ..
    .replace(/^\.+/, '_')              // 替换开头的 .
    .replace(/[<>:"|?*\x00-\x1f]/g, '_')  // 替换 Windows 不允许的字符
    .trim()
    .substring(0, 255);                 // 限制文件名长度
}

/**
 * 清理对话ID和其他标识符参数
 * @param {string} id - 原始标识符
 * @returns {string} - 清理后的安全标识符
 */
function sanitizeIdentifier(id) {
  if (!id || typeof id !== 'string') {
    return '';
  }

  return id.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    // 清理标识符参数
    const safeConversationId = sanitizeIdentifier(conversationId);
    const safeMessageIndex = parseInt(messageIndex) || 0;
    const safeFileIndex = parseInt(fileIndex) || 0;

    // 如果未提供，从 URL 中提取文件名
    let finalFilename = filename;
    if (!finalFilename) {
      const urlParams = new URLSearchParams(new URL(url).search);
      const urlFilename = urlParams.get('filename');
      if (urlFilename) {
        // 清理从 URL 提取的文件名
        finalFilename = sanitizeFilename(urlFilename);
      }
    } else {
      // 清理提供的文件名
      finalFilename = sanitizeFilename(finalFilename);
    }

    // 如果清理后文件名为空，生成默认文件名
    if (!finalFilename) {
      const ext = 'mp4'; // 默认扩展名
      finalFilename = `${safeConversationId}_msg${safeMessageIndex}_video${safeFileIndex}.${ext}`;
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
    // 清理标识符参数
    const safeConversationId = sanitizeIdentifier(conversationId);
    const safeMessageIndex = parseInt(messageIndex) || 0;
    const safeFileIndex = parseInt(fileIndex) || 0;

    // 如果未提供，从 URL 中提取文件名
    let finalFilename = filename;
    if (!finalFilename) {
      const urlParams = new URLSearchParams(new URL(url).search);
      const urlFilename = urlParams.get('filename');
      if (urlFilename) {
        // 清理从 URL 提取的文件名
        finalFilename = sanitizeFilename(urlFilename);
      }
    } else {
      // 清理提供的文件名
      finalFilename = sanitizeFilename(finalFilename);
    }

    // 如果清理后文件名为空，生成默认文件名
    if (!finalFilename) {
      // 基于元数据生成文件名
      // 尝试从 URL 中提取扩展名
      let ext = 'jpg'; // 默认扩展名
      const urlPath = new URL(url).pathname;
      const pathExt = urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      if (pathExt) {
        ext = pathExt[1].toLowerCase();
      }
      finalFilename = `${safeConversationId}_msg${safeMessageIndex}_image${safeFileIndex}.${ext}`;
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
    // 清理标识符参数
    const safeConversationId = sanitizeIdentifier(conversationId);
    const safeMessageIndex = parseInt(messageIndex) || 0;
    const safeFileIndex = parseInt(fileIndex) || 0;

    // 生成的图片通常是 PNG 格式
    const ext = 'png';
    const finalFilename = `${safeConversationId}_msg${safeMessageIndex}_generated${safeFileIndex}.${ext}`;

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
