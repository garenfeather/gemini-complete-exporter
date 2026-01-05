/**
 * Gemini Chat Exporter - Export Controller
 * Coordinates UI, export orchestration, and data services
 */

(function() {
  'use strict';

  // ============================================================================
  // EXPORT CONTROLLER
  // ============================================================================
  window.ExportController = class ExportController {
    constructor() {
      this.button = null;
    }

    /**
     * Initialize controller - create UI and attach listeners
     */
    init() {
      this.createUI();
      this.attachEventListeners();
      this.observeStorageChanges();
    }

    /**
     * Create UI elements
     */
    createUI() {
      this.button = UIBuilder.createButton();
      document.body.appendChild(this.button);
    }

    /**
     * Attach event listeners to UI
     */
    attachEventListeners() {
      this.button.addEventListener('click', () => this.handleButtonClick());
    }

    /**
     * Handle export button click
     */
    async handleButtonClick() {
      this.button.disabled = true;
      this.button.textContent = 'Exporting...';

      try {
        await this.execute();
      } catch (error) {
        console.error('Export error:', error);
      } finally {
        this.button.disabled = false;
        this.button.textContent = 'Export';
      }
    }

    /**
     * Observe storage changes to show/hide button
     */
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

    // ============================================================================
    // EXPORT ORCHESTRATION METHODS
    // ============================================================================

    /**
     * Scroll to top of chat to load all messages
     */
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

    /**
     * Get conversation title from page
     */
    getConversationTitle() {
      const titleCard = document.querySelector(CONFIG.SELECTORS.CONVERSATION_TITLE);
      return titleCard ? titleCard.textContent.trim() : 'Untitled Conversation';
    }

    /**
     * Build JSON structure from conversation turns
     * Orchestrates extraction of both user and assistant messages
     */
    async buildJSON(turns, conversationTitle, conversationId) {
      const data = [];
      const videosToDownload = [];
      const imagesToDownload = [];

      for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];
        Utils.createNotification(`Processing message ${i + 1} of ${turns.length}...`);

        // Check if model response has action-card (skip if present)
        const modelRespElem = turn.querySelector(CONFIG.SELECTORS.MODEL_RESPONSE);
        if (AssistantDataService.hasActionCard(modelRespElem)) {
          // Skip this turn entirely (both user query and model response)
          continue;
        }

        // Extract user message
        const userQueryElem = turn.querySelector(CONFIG.SELECTORS.USER_QUERY);
        if (userQueryElem) {
          const userResult = await UserDataService.extractUserMessage(
            userQueryElem,
            i,
            conversationId
          );

          if (userResult.userMessage) {
            data.push(userResult.userMessage);
            videosToDownload.push(...userResult.videosToDownload);
            imagesToDownload.push(...userResult.imagesToDownload);
          }
        }

        // Extract assistant message
        if (modelRespElem) {
          const assistantResult = await AssistantDataService.extractAssistantMessage(
            modelRespElem,
            turn,
            i,
            conversationId
          );

          if (assistantResult.assistantMessage) {
            data.push(assistantResult.assistantMessage);
            imagesToDownload.push(...assistantResult.imagesToDownload);
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
        videosToDownload: videosToDownload,
        imagesToDownload: imagesToDownload
      };
    }

    /**
     * Export JSON data to file
     */
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

    /**
     * Main export execution
     * Orchestrates the entire export process
     */
    async execute() {
      try {
        await this.scrollToLoadAll();

        const turns = Array.from(document.querySelectorAll(CONFIG.SELECTORS.CONVERSATION_TURN));
        const conversationTitle = this.getConversationTitle();
        const conversationId = Utils.getConversationIdFromURL();

        // Build JSON and collect media information
        const result = await this.buildJSON(turns, conversationTitle, conversationId);

        // Export JSON file
        await this.exportToFile(result.jsonData, conversationId);
        Utils.createNotification('JSON export completed!');

        // Download videos after JSON export
        if (result.videosToDownload.length > 0) {
          Utils.createNotification(`Starting download of ${result.videosToDownload.length} video(s)...`);
          await MediaExportService.batchDownloadVideos(result.videosToDownload);
          Utils.createNotification('Video downloads initiated!');
        }

        // Download images after video downloads
        if (result.imagesToDownload.length > 0) {
          Utils.createNotification(`Starting download of ${result.imagesToDownload.length} image(s)...`);
          await MediaExportService.batchDownloadImages(result.imagesToDownload);
          Utils.createNotification('Image downloads initiated!');
        }

        // Final completion message
        if (result.videosToDownload.length > 0 || result.imagesToDownload.length > 0) {
          Utils.createNotification('All downloads initiated!');
        } else {
          Utils.createNotification('Export completed!');
        }
      } catch (error) {
        console.error('Export error:', error);
        alert(`Export failed: ${error.message}`);
      }
    }
  };

})();
