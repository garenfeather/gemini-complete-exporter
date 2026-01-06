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
    }
  };

})();
