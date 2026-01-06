/**
 * Gemini 聊天导出器 - UI 构建器
 * 为扩展创建和管理 UI 元素
 */

(function() {
  'use strict';

  // ============================================================================
  // UI 构建器
  // ============================================================================
  window.UIBuilder = class UIBuilder {
    /**
     * 创建导出按钮元素
     */
    static createButton() {
      const btn = document.createElement('button');
      btn.id = CONFIG.BUTTON_ID;
      btn.textContent = 'Export';

      Object.assign(btn.style, {
        position: 'fixed',
        bottom: '24px',
        left: '180px',
        zIndex: '9999',
        padding: '8px 16px',
        background: CONFIG.STYLES.BUTTON_PRIMARY,
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '1em',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        fontWeight: 'bold',
        transition: 'background 0.2s'
      });

      btn.addEventListener('mouseenter', () => btn.style.background = CONFIG.STYLES.BUTTON_HOVER);
      btn.addEventListener('mouseleave', () => btn.style.background = CONFIG.STYLES.BUTTON_PRIMARY);

      return btn;
    }
  };

})();
