/**
 * Gemini 聊天导出器 - 助手数据服务
 * 处理助手响应、思考过程和生成内容的提取
 */

(function() {
  'use strict';

  // ============================================================================
  // 助手数据服务
  // ============================================================================
  window.AssistantDataService = {
    /**
     * 使用剪贴板 API 复制模型响应文本
     */
    async copyModelResponse(turn, copyBtn) {
      try {
        await navigator.clipboard.writeText('');
      } catch (e) {
        // 忽略剪贴板清除错误
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
     * 检查模型响应是否包含操作卡片（应跳过）
     */
    hasActionCard(modelRespElem) {
      if (!modelRespElem) return false;
      return modelRespElem.querySelector(CONFIG.SELECTORS.ACTION_CARD) !== null;
    },

    /**
     * 从思考部分提取模型思考过程
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

      // 检查思考内容是否已展开
      let thoughtsContent = modelRespElem.querySelector(CONFIG.SELECTORS.THOUGHTS_CONTENT);
      const wasExpanded = thoughtsContent !== null;
      console.log('[Thoughts] wasExpanded:', wasExpanded);

      // 如果未展开，点击按钮展开
      if (!wasExpanded) {
        console.log('[Thoughts] Clicking to expand...');
        thoughtsButton.click();
        await Utils.sleep(CONFIG.TIMING.THOUGHTS_EXPAND_DELAY);

        // 等待思考内容出现
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

      // 从 p 标签中提取思考文本内容，使用换行符分隔
      const paragraphs = thoughtsContent.querySelectorAll('p');
      const thoughtsText = Array.from(paragraphs)
        .map(p => p.textContent.trim())
        .filter(text => text.length > 0)
        .join('\n');
      console.log('[Thoughts] Extracted text length:', thoughtsText.length);
      console.log('[Thoughts] Paragraph count:', paragraphs.length);
      console.log('[Thoughts] First 100 chars:', thoughtsText.substring(0, 100));

      // 如果是我们展开的，则关闭思考部分（保持 UI 整洁）
      if (!wasExpanded) {
        console.log('[Thoughts] Closing thoughts...');
        thoughtsButton.click();
        await Utils.sleep(CONFIG.TIMING.THOUGHTS_EXPAND_DELAY);
      }

      return thoughtsText || null;
    },

    /**
     * 从混合响应（包含图片的响应）中提取文本
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
     * 从模型响应元素中提取助手消息
     * @param {Element} modelRespElem - 模型响应元素
     * @param {Element} turn - 对话轮次元素
     * @param {number} messageIndex - 消息在对话中的索引
     * @param {string} conversationId - 对话 ID
     * @returns {Object} 包含 assistantMessage 和 imagesToDownload 的对象
     */
    async extractAssistantMessage(modelRespElem, turn, messageIndex, conversationId) {
      if (!modelRespElem) {
        return { assistantMessage: null, imagesToDownload: [] };
      }

      // 触发鼠标悬停以显示复制按钮
      modelRespElem.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await Utils.sleep(CONFIG.TIMING.MOUSEOVER_DELAY);

      const imagesToDownload = [];
      const copyBtn = turn.querySelector(CONFIG.SELECTORS.COPY_BUTTON);

      if (copyBtn) {
        // 带复制按钮的普通文本响应
        const clipboardText = await this.copyModelResponse(turn, copyBtn);

        const assistantMessage = {
          role: 'assistant',
          content_type: 'text',
          content: clipboardText ? Utils.removeCitations(clipboardText) : ''
        };

        // 提取模型思考过程（如果存在）
        const modelThoughts = await this.extractModelThoughts(modelRespElem);
        if (modelThoughts) {
          assistantMessage.model_thoughts = modelThoughts;
        }

        return { assistantMessage: assistantMessage, imagesToDownload: [] };
      } else {
        // 检查生成的图片（图片生成响应）
        const generatedImages = MediaExportService.extractGeneratedImages(modelRespElem);

        if (generatedImages.length > 0) {
          // 从混合响应中提取文本内容
          const textContent = this.extractTextFromMixedResponse(modelRespElem);

          const assistantMessage = {
            role: 'assistant',
            content_type: 'mixed',
            content: textContent,
            files: []
          };

          // 收集生成的图片以便下载
          generatedImages.forEach((imageUrl, imageIndex) => {
            // 生成本地文件名
            const name = Utils.generateGeneratedImageFilename(
              conversationId,
              messageIndex,
              imageIndex
            );

            assistantMessage.files.push({
              type: 'image',
              url: imageUrl,
              name: name
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
