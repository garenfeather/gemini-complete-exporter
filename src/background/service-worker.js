/**
 * 后台服务工作者
 * 使用 chrome.downloads API 处理视频下载
 */

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
