/**
 * Gemini 聊天导出器 - 用户数据服务
 * 处理用户消息和附加文件的提取
 */

(function() {
  'use strict';

  // ============================================================================
  // 用户数据服务
  // ============================================================================
  window.UserDataService = {
    /**
     * 从查询元素中提取用户消息
     * @param {Element} userQueryElem - 用户查询元素
     * @param {number} messageIndex - 消息在对话中的索引
     * @param {string} conversationId - 对话 ID
     * @returns {Object} 包含 userMessage、videosToDownload 和 imagesToDownload 的对象
     */
    async extractUserMessage(userQueryElem, messageIndex, conversationId) {
      if (!userQueryElem) {
        return { userMessage: null, videosToDownload: [], imagesToDownload: [] };
      }

      const userMessage = {
        role: 'user'
      };

      const videosToDownload = [];
      const imagesToDownload = [];

      // 按顺序提取文件（视频和图片）
      const files = await MediaExportService.extractFiles(userQueryElem);

      // 收集视频和图片以便稍后下载
      if (files.length > 0) {
        const videos = files.filter(f => f.type === 'video');
        videos.forEach((video, videoIndex) => {
          videosToDownload.push({
            url: video.url,
            filename: video.filename,
            conversationId: conversationId,
            messageIndex: messageIndex,
            fileIndex: videoIndex
          });
        });

        const images = files.filter(f => f.type === 'image');
        images.forEach((image, imageIndex) => {
          imagesToDownload.push({
            url: image.url,
            conversationId: conversationId,
            messageIndex: messageIndex,
            fileIndex: imageIndex
          });
        });
      }

      // 提取文本
      const queryTextElem = userQueryElem.querySelector(CONFIG.SELECTORS.USER_QUERY_TEXT);
      const userText = queryTextElem
        ? queryTextElem.textContent.trim()
        : userQueryElem.textContent.trim();

      // 确定内容类型并设置字段
      if (files.length > 0) {
        userMessage.content_type = 'mixed';
        userMessage.files = files;
      } else {
        userMessage.content_type = 'text';
      }

      userMessage.content = userText || '';

      return {
        userMessage: userMessage,
        videosToDownload: videosToDownload,
        imagesToDownload: imagesToDownload
      };
    }
  };

})();
