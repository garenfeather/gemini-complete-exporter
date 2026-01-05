/**
 * Gemini Chat Exporter - User Data Service
 * Handles extraction of user messages and attached files
 */

(function() {
  'use strict';

  // ============================================================================
  // USER DATA SERVICE
  // ============================================================================
  window.UserDataService = {
    /**
     * Extract user message from query element
     * @param {Element} userQueryElem - The user query element
     * @param {number} messageIndex - Index of the message in conversation
     * @param {string} conversationId - Conversation ID
     * @returns {Object} Object containing userMessage, videosToDownload, and imagesToDownload
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

      return {
        userMessage: userMessage,
        videosToDownload: videosToDownload,
        imagesToDownload: imagesToDownload
      };
    }
  };

})();
