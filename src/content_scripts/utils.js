/**
 * Gemini 聊天导出器 - 工具函数
 * 扩展中使用的通用工具函数
 */

(function() {
  'use strict';

  // ============================================================================
  // 工具函数
  // ============================================================================
  window.Utils = {
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    removeCitations(text) {
      return text
        .replace(/\[cite_start\]/g, '')
        .replace(/\[cite:[\d,\s]+\]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    },

    createNotification(message) {
      const popup = document.createElement('div');
      Object.assign(popup.style, {
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: '99999',
        background: '#333',
        color: '#fff',
        padding: '10px 18px',
        borderRadius: '8px',
        fontSize: '1em',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        opacity: '0.95',
        pointerEvents: 'none'
      });
      popup.textContent = message;
      document.body.appendChild(popup);
      setTimeout(() => popup.remove(), CONFIG.TIMING.POPUP_DURATION);
      return popup;
    },

    getConversationIdFromURL() {
      // 从 URL 中提取对话 ID: gemini.google.com/app/{id}
      const urlMatch = window.location.pathname.match(/\/app\/([^\/]+)/);
      return urlMatch ? urlMatch[1] : `conversation_${Date.now()}`;
    },

    generateVideoFilename(url, filename, conversationId, messageIndex, fileIndex) {
      // 如果已有文件名则使用，否则生成文件名
      if (filename) {
        return filename;
      }

      // 尝试从 URL 参数中获取文件名
      try {
        const urlParams = new URLSearchParams(new URL(url).search);
        const urlFilename = urlParams.get('filename');
        if (urlFilename) {
          return urlFilename;
        }
      } catch (e) {
        // 忽略 URL 解析错误
      }

      // 生成默认文件名
      const ext = 'mp4';
      return `${conversationId}_msg${messageIndex}_video${fileIndex}.${ext}`;
    },

    generateImageFilename(url, filename, conversationId, messageIndex, fileIndex) {
      // 如果已有文件名则使用，否则生成文件名
      if (filename) {
        return filename;
      }

      // 尝试从 URL 参数中获取文件名
      try {
        const urlParams = new URLSearchParams(new URL(url).search);
        const urlFilename = urlParams.get('filename');
        if (urlFilename) {
          return urlFilename;
        }
      } catch (e) {
        // 忽略 URL 解析错误
      }

      // 尝试从 URL 路径中提取扩展名
      let ext = 'jpg'; // 默认扩展名
      try {
        const urlPath = new URL(url).pathname;
        const pathExt = urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        if (pathExt) {
          ext = pathExt[1].toLowerCase();
        }
      } catch (e) {
        // 忽略 URL 解析错误
      }

      // 生成默认文件名
      return `${conversationId}_msg${messageIndex}_image${fileIndex}.${ext}`;
    },

    generateGeneratedImageFilename(conversationId, messageIndex, fileIndex) {
      // 生成的图片通常是 PNG 格式
      const ext = 'png';
      return `${conversationId}_msg${messageIndex}_generated${fileIndex}.${ext}`;
    }
  };

})();
