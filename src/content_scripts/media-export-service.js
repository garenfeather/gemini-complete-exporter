/**
 * Gemini 聊天导出器 - 媒体导出服务
 * 处理图片和视频的提取和下载
 */

(function() {
  'use strict';

  // ============================================================================
  // 媒体导出服务
  // ============================================================================
  window.MediaExportService = {
    /**
     * 从用户查询元素中提取视频 URL（已弃用 - 请使用 extractFiles）
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
     * 从用户查询元素中提取图片 URL（已弃用 - 请使用 extractFiles）
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
     * 按顺序从用户查询中提取所有文件（视频和图片）
     */
    async extractFiles(userQueryElem) {
      const files = [];
      const fileContainer = userQueryElem.querySelector(CONFIG.SELECTORS.FILE_PREVIEW_CONTAINER);
      if (!fileContainer) {
        return files;
      }

      // 按顺序获取所有文件预览元素
      const filePreviews = fileContainer.querySelectorAll('user-query-file-preview');

      for (const preview of filePreviews) {
        // 检查是否为视频
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
                // 从 URL 中提取文件名
                const urlParams = new URLSearchParams(new URL(videoUrl).search);
                const name = urlParams.get('filename') || 'video.mp4';
                files.push({ type: 'video', url: videoUrl, name: name });
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

        // 检查是否为图片
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
     * 从模型响应中提取生成的图片
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
     * 通过后台服务工作者批量下载视频
     */
    async batchDownloadVideos(videosToDownload) {
      for (let i = 0; i < videosToDownload.length; i++) {
        const videoInfo = videosToDownload[i];
        try {
          // 向后台服务工作者发送下载请求
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

          if (response.createdConfirmed === false) {
            console.warn(`[Download] Created confirmation timeout, continuing: ${response.downloadId}`);
          }
        } catch (error) {
          console.error(`Error downloading video ${i + 1}/${videosToDownload.length}:`, error);
        }
      }
    },

    /**
     * 通过后台服务工作者批量下载图片
     */
    async batchDownloadImages(imagesToDownload) {
      for (let i = 0; i < imagesToDownload.length; i++) {
        const imageInfo = imagesToDownload[i];
        try {
          let response;

          if (imageInfo.isGenerated) {
            // 生成的图片（来自 AI 响应）
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
            // 上传的图片（来自用户查询）
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

          if (response.createdConfirmed === false) {
            console.warn(`[Download] Created confirmation timeout, continuing: ${response.downloadId}`);
          }
        } catch (error) {
          console.error(`Error downloading image ${i + 1}/${imagesToDownload.length}:`, error);
        }
      }
    }
  };

})();
