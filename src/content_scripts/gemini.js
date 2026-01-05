/**
 * Gemini Chat Exporter - Gemini content script
 * Exports Gemini chat conversations to JSON format
 */

(function() {
  'use strict';

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  const CONFIG = {
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
      THOUGHTS_CONTENT: 'div[data-test-id="thoughts-content"]'
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

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  const Utils = {
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
      // Extract conversation ID from URL: gemini.google.com/app/{id}
      const urlMatch = window.location.pathname.match(/\/app\/([^\/]+)/);
      return urlMatch ? urlMatch[1] : `conversation_${Date.now()}`;
    }
  };

  // ============================================================================
  // EXPORT SERVICE
  // ============================================================================
  class ExportService {
    async scrollToLoadAll() {
      const scrollContainer = document.querySelector(CONFIG.SELECTORS.CHAT_CONTAINER);
      if (!scrollContainer) {
        throw new Error('Could not find chat history container. Are you on a Gemini chat page?');
      }

      let stableScrolls = 0;
      let scrollAttempts = 0;
      let lastScrollTop = null;

      while (stableScrolls < CONFIG.TIMING.MAX_STABLE_SCROLLS &&
             scrollAttempts < CONFIG.TIMING.MAX_SCROLL_ATTEMPTS) {
        const currentTurnCount = document.querySelectorAll(CONFIG.SELECTORS.CONVERSATION_TURN).length;
        scrollContainer.scrollTop = 0;
        await Utils.sleep(CONFIG.TIMING.SCROLL_DELAY);

        const scrollTop = scrollContainer.scrollTop;
        const newTurnCount = document.querySelectorAll(CONFIG.SELECTORS.CONVERSATION_TURN).length;

        if (newTurnCount === currentTurnCount && (lastScrollTop === scrollTop || scrollTop === 0)) {
          stableScrolls++;
        } else {
          stableScrolls = 0;
        }

        lastScrollTop = scrollTop;
        scrollAttempts++;
      }
    }

    async copyModelResponse(turn, copyBtn) {
      try {
        await navigator.clipboard.writeText('');
      } catch (e) {
        // Ignore clipboard clear errors
      }

      let attempts = 0;
      let clipboardText = '';

      while (attempts < CONFIG.TIMING.MAX_CLIPBOARD_ATTEMPTS) {
        const modelRespElem = turn.querySelector(CONFIG.SELECTORS.MODEL_RESPONSE);
        if (modelRespElem) {
          modelRespElem.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }

        await Utils.sleep(CONFIG.TIMING.CLIPBOARD_CLEAR_DELAY);
        copyBtn.click();
        await Utils.sleep(CONFIG.TIMING.CLIPBOARD_READ_DELAY);

        clipboardText = await navigator.clipboard.readText();
        if (clipboardText) break;
        attempts++;
      }

      return clipboardText;
    }

    async extractVideoUrls(userQueryElem) {
      const videoUrls = [];
      const fileContainer = userQueryElem.querySelector(CONFIG.SELECTORS.FILE_PREVIEW_CONTAINER);
      if (!fileContainer) {
        return videoUrls;
      }

      const videoButtons = userQueryElem.querySelectorAll(CONFIG.SELECTORS.VIDEO_PREVIEW_BUTTON);
      if (videoButtons.length === 0) {
        return videoUrls;
      }

      for (const btn of videoButtons) {
        try {
          btn.click();

          let videoPlayer = null;
          const startTime = Date.now();
          while (!videoPlayer && (Date.now() - startTime) < CONFIG.TIMING.VIDEO_LOAD_TIMEOUT) {
            await Utils.sleep(CONFIG.TIMING.VIDEO_LOAD_DELAY);
            videoPlayer = document.querySelector(CONFIG.SELECTORS.VIDEO_PLAYER);
          }

          if (videoPlayer) {
            const sourceElem = videoPlayer.querySelector('source');
            const videoUrl = sourceElem?.src || videoPlayer.src;
            if (videoUrl) {
              videoUrls.push(videoUrl);
            }
          }

          await Utils.sleep(CONFIG.TIMING.LIGHTBOX_CLOSE_DELAY);
          document.querySelector('button[mat-dialog-close]').click();
          await Utils.sleep(CONFIG.TIMING.LIGHTBOX_CLOSE_DELAY);

        } catch (e) {
          console.error('Error extracting video URL:', e);
        }
      }

      return videoUrls;
    }

    extractImageUrls(userQueryElem) {
      const imageUrls = [];
      const fileContainer = userQueryElem.querySelector(CONFIG.SELECTORS.FILE_PREVIEW_CONTAINER);
      if (!fileContainer) {
        return imageUrls;
      }

      const imageElements = userQueryElem.querySelectorAll(CONFIG.SELECTORS.IMAGE_PREVIEW);
      imageElements.forEach(img => {
        const imageUrl = img.src;
        if (imageUrl) {
          imageUrls.push(imageUrl);
        }
      });

      return imageUrls;
    }

    async extractFiles(userQueryElem) {
      const files = [];
      const fileContainer = userQueryElem.querySelector(CONFIG.SELECTORS.FILE_PREVIEW_CONTAINER);
      if (!fileContainer) {
        return files;
      }

      // Get all file preview elements in order
      const filePreviews = fileContainer.querySelectorAll('user-query-file-preview');

      for (const preview of filePreviews) {
        // Check if it's a video
        const videoButton = preview.querySelector(CONFIG.SELECTORS.VIDEO_PREVIEW_BUTTON);
        if (videoButton) {
          try {
            videoButton.click();

            let videoPlayer = null;
            const startTime = Date.now();
            while (!videoPlayer && (Date.now() - startTime) < CONFIG.TIMING.VIDEO_LOAD_TIMEOUT) {
              await Utils.sleep(CONFIG.TIMING.VIDEO_LOAD_DELAY);
              videoPlayer = document.querySelector(CONFIG.SELECTORS.VIDEO_PLAYER);
            }

            if (videoPlayer) {
              const sourceElem = videoPlayer.querySelector('source');
              const videoUrl = sourceElem?.src || videoPlayer.src;
              if (videoUrl) {
                // Extract filename from URL
                const urlParams = new URLSearchParams(new URL(videoUrl).search);
                const filename = urlParams.get('filename') || 'video.mp4';
                files.push({ type: 'video', url: videoUrl, filename: filename });
              }
            }

            await Utils.sleep(CONFIG.TIMING.LIGHTBOX_CLOSE_DELAY);
            document.querySelector('button[mat-dialog-close]').click();
            await Utils.sleep(CONFIG.TIMING.LIGHTBOX_CLOSE_DELAY);
          } catch (e) {
            console.error('Error extracting video URL:', e);
          }
          continue;
        }

        // Check if it's an image
        const imageElement = preview.querySelector(CONFIG.SELECTORS.IMAGE_PREVIEW);
        if (imageElement) {
          const imageUrl = imageElement.src;
          if (imageUrl) {
            files.push({ type: 'image', url: imageUrl });
          }
        }
      }

      return files;
    }

    getConversationTitle() {
      const titleCard = document.querySelector(CONFIG.SELECTORS.CONVERSATION_TITLE);
      return titleCard ? titleCard.textContent.trim() : 'Untitled Conversation';
    }

    hasActionCard(modelRespElem) {
      if (!modelRespElem) return false;
      return modelRespElem.querySelector(CONFIG.SELECTORS.ACTION_CARD) !== null;
    }

    async extractModelThoughts(modelRespElem) {
      if (!modelRespElem) {
        console.log('[Thoughts] modelRespElem is null');
        return null;
      }

      const thoughtsButton = modelRespElem.querySelector(CONFIG.SELECTORS.THOUGHTS_HEADER_BUTTON);
      if (!thoughtsButton) {
        console.log('[Thoughts] No thoughts button found');
        return null;
      }

      const thoughtsContainer = modelRespElem.querySelector(CONFIG.SELECTORS.MODEL_THOUGHTS);
      if (!thoughtsContainer) {
        console.log('[Thoughts] No thoughts container found');
        return null;
      }

      // Check if thoughts content is already expanded
      let thoughtsContent = modelRespElem.querySelector(CONFIG.SELECTORS.THOUGHTS_CONTENT);
      const wasExpanded = thoughtsContent !== null;
      console.log('[Thoughts] wasExpanded:', wasExpanded);

      // If not expanded, click button to expand
      if (!wasExpanded) {
        console.log('[Thoughts] Clicking to expand...');
        thoughtsButton.click();
        await Utils.sleep(CONFIG.TIMING.THOUGHTS_EXPAND_DELAY);

        // Wait for thoughts content to appear
        let attempts = 0;
        while (attempts < 10 && !thoughtsContent) {
          await Utils.sleep(200);
          thoughtsContent = modelRespElem.querySelector(CONFIG.SELECTORS.THOUGHTS_CONTENT);
          attempts++;
          console.log('[Thoughts] Waiting for content... attempt:', attempts);
        }

        if (!thoughtsContent) {
          console.log('[Thoughts] Content not found after expansion');
          return null;
        }
      }

      // Extract thoughts text content from p tags with line breaks
      const paragraphs = thoughtsContent.querySelectorAll('p');
      const thoughtsText = Array.from(paragraphs)
        .map(p => p.textContent.trim())
        .filter(text => text.length > 0)
        .join('\n');
      console.log('[Thoughts] Extracted text length:', thoughtsText.length);
      console.log('[Thoughts] Paragraph count:', paragraphs.length);
      console.log('[Thoughts] First 100 chars:', thoughtsText.substring(0, 100));

      // Close thoughts if we expanded them (keeps UI clean)
      if (!wasExpanded) {
        console.log('[Thoughts] Closing thoughts...');
        thoughtsButton.click();
        await Utils.sleep(CONFIG.TIMING.THOUGHTS_EXPAND_DELAY);
      }

      return thoughtsText || null;
    }

    async buildJSON(turns, conversationTitle, conversationId) {
      const data = [];
      const videosToDownload = [];

      for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];
        Utils.createNotification(`Processing message ${i + 1} of ${turns.length}...`);

        // Check if model response has action-card
        const modelRespElem = turn.querySelector(CONFIG.SELECTORS.MODEL_RESPONSE);
        if (this.hasActionCard(modelRespElem)) {
          // Skip this turn entirely (both user query and model response)
          continue;
        }

        // User message
        const userQueryElem = turn.querySelector(CONFIG.SELECTORS.USER_QUERY);
        if (userQueryElem) {
          const userMessage = {
            role: 'user'
          };

          // Extract files (videos and images in order)
          const files = await this.extractFiles(userQueryElem);

          // Collect videos for later download
          if (files.length > 0) {
            const videos = files.filter(f => f.type === 'video');
            videos.forEach((video, videoIndex) => {
              videosToDownload.push({
                url: video.url,
                filename: video.filename,
                conversationId: conversationId,
                messageIndex: i,
                fileIndex: videoIndex
              });
            });
          }

          // Extract text
          const queryTextElem = userQueryElem.querySelector(CONFIG.SELECTORS.USER_QUERY_TEXT);
          const userText = queryTextElem
            ? queryTextElem.textContent.trim()
            : userQueryElem.textContent.trim();

          // Determine content type and set fields
          if (files.length > 0) {
            userMessage.content_type = 'mixed';
            userMessage.files = files;
          } else {
            userMessage.content_type = 'text';
          }

          userMessage.content = userText || '';
          data.push(userMessage);
        }

        // Model response
        if (modelRespElem) {
          modelRespElem.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          await Utils.sleep(CONFIG.TIMING.MOUSEOVER_DELAY);

          const copyBtn = turn.querySelector(CONFIG.SELECTORS.COPY_BUTTON);
          if (copyBtn) {
            const clipboardText = await this.copyModelResponse(turn, copyBtn);

            const assistantMessage = {
              role: 'assistant',
              content_type: 'text',
              content: clipboardText ? Utils.removeCitations(clipboardText) : ''
            };

            // Extract model thoughts if present
            const modelThoughts = await this.extractModelThoughts(modelRespElem);
            if (modelThoughts) {
              assistantMessage.model_thoughts = modelThoughts;
            }

            data.push(assistantMessage);
          }
        }
      }

      // Calculate round_count and total_count
      const userCount = data.filter(m => m.role === 'user').length;
      const assistantCount = data.filter(m => m.role === 'assistant').length;
      const roundCount = Math.min(userCount, assistantCount);
      const totalCount = data.length;

      return {
        jsonData: {
          title: conversationTitle,
          round_count: roundCount,
          total_count: totalCount,
          data: data
        },
        videosToDownload: videosToDownload
      };
    }

    async exportToFile(jsonData, filename) {
      const jsonString = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = `${filename}.json`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    }

    async execute() {
      try {
        await this.scrollToLoadAll();

        const turns = Array.from(document.querySelectorAll(CONFIG.SELECTORS.CONVERSATION_TURN));
        const conversationTitle = this.getConversationTitle();
        const conversationId = Utils.getConversationIdFromURL();

        // Build JSON and collect video information
        const result = await this.buildJSON(turns, conversationTitle, conversationId);

        // Export JSON file
        await this.exportToFile(result.jsonData, conversationId);
        Utils.createNotification('JSON export completed!');

        // Download videos after JSON export
        if (result.videosToDownload.length > 0) {
          Utils.createNotification(`Starting download of ${result.videosToDownload.length} video(s)...`);
          await this.batchDownloadVideos(result.videosToDownload);
          Utils.createNotification('All downloads initiated!');
        } else {
          Utils.createNotification('Export completed!');
        }
      } catch (error) {
        console.error('Export error:', error);
        alert(`Export failed: ${error.message}`);
      }
    }

    async batchDownloadVideos(videosToDownload) {
      for (let i = 0; i < videosToDownload.length; i++) {
        const videoInfo = videosToDownload[i];
        try {
          // Send download request to background service worker
          const response = await chrome.runtime.sendMessage({
            type: 'DOWNLOAD_VIDEO',
            data: {
              url: videoInfo.url,
              filename: videoInfo.filename,
              conversationId: videoInfo.conversationId,
              messageIndex: videoInfo.messageIndex,
              fileIndex: videoInfo.fileIndex
            }
          });

          if (response.success) {
            console.log(`Video ${i + 1}/${videosToDownload.length} download initiated (ID: ${response.downloadId})`);
          } else {
            console.error(`Video ${i + 1}/${videosToDownload.length} download failed: ${response.error}`);
          }

          // Delay between downloads to avoid Chrome's multiple-download confirmation
          if (i < videosToDownload.length - 1) {
            await Utils.sleep(500);
          }
        } catch (error) {
          console.error(`Error downloading video ${i + 1}/${videosToDownload.length}:`, error);
        }
      }
    }
  }

  // ============================================================================
  // UI BUILDER
  // ============================================================================
  class UIBuilder {
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
  }

  // ============================================================================
  // EXPORT CONTROLLER
  // ============================================================================
  class ExportController {
    constructor() {
      this.exportService = new ExportService();
      this.button = null;
    }

    init() {
      this.createUI();
      this.attachEventListeners();
      this.observeStorageChanges();
    }

    createUI() {
      this.button = UIBuilder.createButton();
      document.body.appendChild(this.button);
    }

    attachEventListeners() {
      this.button.addEventListener('click', () => this.handleButtonClick());
    }

    async handleButtonClick() {
      this.button.disabled = true;
      this.button.textContent = 'Exporting...';

      try {
        await this.exportService.execute();
      } catch (error) {
        console.error('Export error:', error);
      } finally {
        this.button.disabled = false;
        this.button.textContent = 'Export';
      }
    }

    observeStorageChanges() {
      const updateVisibility = () => {
        try {
          if (chrome?.storage?.sync) {
            chrome.storage.sync.get(['hideExportBtn'], (result) => {
              this.button.style.display = result.hideExportBtn ? 'none' : '';
            });
          }
        } catch (e) {
          console.error('Storage access error:', e);
        }
      };

      updateVisibility();

      const observer = new MutationObserver(updateVisibility);
      observer.observe(document.body, { childList: true, subtree: true });

      if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'sync' && 'hideExportBtn' in changes) {
            updateVisibility();
          }
        });
      }
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  const controller = new ExportController();
  controller.init();

})();
