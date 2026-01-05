/**
 * Gemini Chat Exporter - Text Export Service
 * Handles extraction and export of text content, conversation structure, and JSON building
 */

(function() {
  'use strict';

  // ============================================================================
  // TEXT EXPORT SERVICE (Main Export Service)
  // ============================================================================
  window.ExportService = class ExportService {
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
     * Copy model response text using clipboard API
     */
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

    /**
     * Get conversation title from page
     */
    getConversationTitle() {
      const titleCard = document.querySelector(CONFIG.SELECTORS.CONVERSATION_TITLE);
      return titleCard ? titleCard.textContent.trim() : 'Untitled Conversation';
    }

    /**
     * Check if model response has action card (should skip)
     */
    hasActionCard(modelRespElem) {
      if (!modelRespElem) return false;
      return modelRespElem.querySelector(CONFIG.SELECTORS.ACTION_CARD) !== null;
    }

    /**
     * Extract model thoughts from thinking section
     */
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

    /**
     * Extract text from mixed response (response with images)
     */
    extractTextFromMixedResponse(modelRespElem) {
      if (!modelRespElem) return '';

      const textElements = modelRespElem.querySelectorAll(CONFIG.SELECTORS.MODEL_RESPONSE_TEXT);
      const textParts = [];

      textElements.forEach(elem => {
        const text = elem.textContent.trim();
        if (text) {
          textParts.push(text);
        }
      });

      return textParts.join('\n');
    }

    /**
     * Build JSON structure from conversation turns
     */
    async buildJSON(turns, conversationTitle, conversationId) {
      const data = [];
      const videosToDownload = [];
      const imagesToDownload = [];

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
          const files = await MediaExportService.extractFiles(userQueryElem);

          // Collect videos and images for later download
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

            const images = files.filter(f => f.type === 'image');
            images.forEach((image, imageIndex) => {
              imagesToDownload.push({
                url: image.url,
                conversationId: conversationId,
                messageIndex: i,
                fileIndex: imageIndex
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
            // Normal text response with copy button
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
          } else {
            // Check for generated images (image generation response)
            const generatedImages = MediaExportService.extractGeneratedImages(modelRespElem);

            if (generatedImages.length > 0) {
              // Extract text content from mixed response
              const textContent = this.extractTextFromMixedResponse(modelRespElem);

              const assistantMessage = {
                role: 'assistant',
                content_type: 'mixed',
                content: textContent,
                files: []
              };

              // Collect generated images for download
              generatedImages.forEach((imageUrl, imageIndex) => {
                assistantMessage.files.push({
                  type: 'image',
                  url: imageUrl
                });

                imagesToDownload.push({
                  url: imageUrl,
                  conversationId: conversationId,
                  messageIndex: i,
                  fileIndex: imageIndex,
                  isGenerated: true
                });
              });

              data.push(assistantMessage);
            }
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
     */
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
