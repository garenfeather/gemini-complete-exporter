/**
 * Gemini Chat Exporter - Configuration
 * Central configuration constants for the extension
 */

(function() {
  'use strict';

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  window.CONFIG = {
    BUTTON_ID: 'gemini-export-btn',

    SELECTORS: {
      CHAT_CONTAINER: '[data-test-id="chat-history-container"]',
      CONVERSATION_TURN: 'div.conversation-container',
      USER_QUERY: 'user-query',
      MODEL_RESPONSE: 'model-response',
      COPY_BUTTON: 'button[data-test-id="copy-button"]',
      CONVERSATION_TITLE: '.conversation-title',
      FILE_PREVIEW_CONTAINER: '.file-preview-container',
      VIDEO_PREVIEW_BUTTON: 'button[data-test-id="video-preview-button"]',
      VIDEO_PLAYER: 'video[data-test-id="video-player"]',
      USER_QUERY_TEXT: '.query-text',
      IMAGE_PREVIEW: 'img[data-test-id="uploaded-img"]',
      ACTION_CARD: 'action-card',
      THOUGHTS_HEADER_BUTTON: 'button[data-test-id="thoughts-header-button"]',
      MODEL_THOUGHTS: 'model-thoughts',
      THOUGHTS_CONTENT: 'div[data-test-id="thoughts-content"]',
      GENERATED_IMAGE: 'generated-image',
      GENERATED_IMAGE_IMG: 'generated-image img.image',
      DOWNLOAD_GENERATED_IMAGE_BUTTON: 'button[data-test-id="download-generated-image-button"]',
      MODEL_RESPONSE_TEXT: '.markdown p[data-path-to-node]'
    },

    TIMING: {
      SCROLL_DELAY: 2000,
      CLIPBOARD_CLEAR_DELAY: 200,
      CLIPBOARD_READ_DELAY: 300,
      MOUSEOVER_DELAY: 500,
      POPUP_DURATION: 900,
      MAX_SCROLL_ATTEMPTS: 60,
      MAX_STABLE_SCROLLS: 4,
      MAX_CLIPBOARD_ATTEMPTS: 10,
      VIDEO_LOAD_DELAY: 500,
      VIDEO_LOAD_TIMEOUT: 5000,
      LIGHTBOX_CLOSE_DELAY: 300,
      THOUGHTS_EXPAND_DELAY: 300
    },

    STYLES: {
      BUTTON_PRIMARY: '#1a73e8',
      BUTTON_HOVER: '#1765c1'
    }
  };

})();
