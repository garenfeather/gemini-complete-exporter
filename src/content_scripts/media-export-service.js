/**
 * Gemini Chat Exporter - Media Export Service
 * Handles extraction and downloading of images and videos
 */

(function() {
  'use strict';

  // ============================================================================
  // MEDIA EXPORT SERVICE
  // ============================================================================
  window.MediaExportService = {
    /**
     * Extract video URLs from user query element (deprecated - use extractFiles instead)
     */
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
    },

    /**
     * Extract image URLs from user query element (deprecated - use extractFiles instead)
     */
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
    },

    /**
     * Extract all files (videos and images) from user query in order
     */
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
    },

    /**
     * Extract generated images from model response
     */
    extractGeneratedImages(modelRespElem) {
      const generatedImages = [];
      if (!modelRespElem) return generatedImages;

      const imageElements = modelRespElem.querySelectorAll(CONFIG.SELECTORS.GENERATED_IMAGE_IMG);
      imageElements.forEach(img => {
        const imageUrl = img.src;
        if (imageUrl) {
          generatedImages.push(imageUrl);
        }
      });

      return generatedImages;
    },

    /**
     * Batch download videos via background service worker
     */
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
    },

    /**
     * Batch download images via background service worker
     */
    async batchDownloadImages(imagesToDownload) {
      for (let i = 0; i < imagesToDownload.length; i++) {
        const imageInfo = imagesToDownload[i];
        try {
          let response;

          if (imageInfo.isGenerated) {
            // Generated image (from AI response)
            response = await chrome.runtime.sendMessage({
              type: 'DOWNLOAD_GENERATED_IMAGE',
              data: {
                url: imageInfo.url,
                conversationId: imageInfo.conversationId,
                messageIndex: imageInfo.messageIndex,
                fileIndex: imageInfo.fileIndex
              }
            });
          } else {
            // Uploaded image (from user query)
            const urlParams = new URLSearchParams(new URL(imageInfo.url).search);
            const filename = urlParams.get('filename') || null;

            response = await chrome.runtime.sendMessage({
              type: 'DOWNLOAD_IMAGE',
              data: {
                url: imageInfo.url,
                filename: filename,
                conversationId: imageInfo.conversationId,
                messageIndex: imageInfo.messageIndex,
                fileIndex: imageInfo.fileIndex
              }
            });
          }

          if (response.success) {
            const imageType = imageInfo.isGenerated ? 'generated image' : 'image';
            console.log(`Image ${i + 1}/${imagesToDownload.length} (${imageType}) download initiated (ID: ${response.downloadId})`);
          } else {
            console.error(`Image ${i + 1}/${imagesToDownload.length} download failed: ${response.error}`);
          }

          // Delay between downloads to avoid Chrome's multiple-download confirmation
          if (i < imagesToDownload.length - 1) {
            await Utils.sleep(500);
          }
        } catch (error) {
          console.error(`Error downloading image ${i + 1}/${imagesToDownload.length}:`, error);
        }
      }
    }
  };

})();
