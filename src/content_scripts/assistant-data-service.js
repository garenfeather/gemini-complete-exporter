/**
 * Gemini Chat Exporter - Assistant Data Service
 * Handles extraction of assistant responses, thoughts, and generated content
 */

(function() {
  'use strict';

  // ============================================================================
  // ASSISTANT DATA SERVICE
  // ============================================================================
  window.AssistantDataService = {
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
    },

    /**
     * Check if model response has action card (should skip)
     */
    hasActionCard(modelRespElem) {
      if (!modelRespElem) return false;
      return modelRespElem.querySelector(CONFIG.SELECTORS.ACTION_CARD) !== null;
    },

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
    },

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
    },

    /**
     * Extract assistant message from model response element
     * @param {Element} modelRespElem - The model response element
     * @param {Element} turn - The conversation turn element
     * @param {number} messageIndex - Index of the message in conversation
     * @param {string} conversationId - Conversation ID
     * @returns {Object} Object containing assistantMessage and imagesToDownload
     */
    async extractAssistantMessage(modelRespElem, turn, messageIndex, conversationId) {
      if (!modelRespElem) {
        return { assistantMessage: null, imagesToDownload: [] };
      }

      // Trigger mouseover to show copy button
      modelRespElem.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await Utils.sleep(CONFIG.TIMING.MOUSEOVER_DELAY);

      const imagesToDownload = [];
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

        return { assistantMessage: assistantMessage, imagesToDownload: [] };
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
              messageIndex: messageIndex,
              fileIndex: imageIndex,
              isGenerated: true
            });
          });

          return { assistantMessage: assistantMessage, imagesToDownload: imagesToDownload };
        }
      }

      return { assistantMessage: null, imagesToDownload: [] };
    }
  };

})();
