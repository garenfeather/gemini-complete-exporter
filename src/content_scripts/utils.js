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
    },

    /**
     * 验证对话 ID 格式
     * Gemini 对话 ID 格式：16位十六进制字符串
     */
    validateConversationId(id) {
      if (!id || typeof id !== 'string') {
        return false;
      }

      // 去除首尾空格
      id = id.trim();

      // 检查长度和格式（16位十六进制）
      const hexPattern = /^[a-f0-9]{16}$/i;
      return hexPattern.test(id);
    },

    /**
     * 解析批量导出文件内容
     * @param {string} content - 文件内容
     * @returns {Object} { valid: string[], invalid: string[], error: string|null }
     */
    parseBatchExportFile(content) {
      const result = {
        valid: [],
        invalid: [],
        error: null
      };

      if (!content || typeof content !== 'string') {
        result.error = '文件内容为空';
        return result;
      }

      // 按行分割
      const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0); // 过滤空行

      if (lines.length === 0) {
        result.error = '文件中没有有效内容';
        return result;
      }

      if (lines.length > 5) {
        result.error = `文件包含 ${lines.length} 个ID，超过最大限制（5个）`;
        return result;
      }

      // 验证每个 ID
      for (const line of lines) {
        if (this.validateConversationId(line)) {
          result.valid.push(line.trim());
        } else {
          result.invalid.push(line);
        }
      }

      return result;
    },

    /**
     * 生成 Gemini 对话完整 URL
     */
    generateConversationUrl(conversationId) {
      // 从当前 URL 提取用户编号（如 u/3）
      const userMatch = window.location.pathname.match(/\/u\/(\d+)\//);
      const userNumber = userMatch ? userMatch[1] : '0';

      return `https://gemini.google.com/u/${userNumber}/app/${conversationId}?pageId=none`;
    }
  };

})();
