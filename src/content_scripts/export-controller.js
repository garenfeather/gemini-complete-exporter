/**
 * Gemini 聊天导出器 - 导出控制器
 * 协调 UI、导出编排和数据服务
 */

(function() {
  'use strict';

  // ============================================================================
  // 导出控制器
  // ============================================================================
  window.ExportController = class ExportController {
    constructor() {
      this.buttonContainer = null;
      this.mainBtn = null;
      this.singleExportOption = null;
      this.batchExportOption = null;
    }

    /**
     * 初始化控制器 - 创建 UI 并附加监听器
     */
    init() {
      this.createUI();
      this.attachEventListeners();
      this.observeStorageChanges();
      this.checkAutoExport();
    }

    /**
     * 创建 UI 元素
     */
    createUI() {
      this.buttonContainer = UIBuilder.createButton();
      this.mainBtn = this.buttonContainer._mainBtn;
      this.batchExportOption = this.buttonContainer._batchExportOption;
      document.body.appendChild(this.buttonContainer);
    }

    /**
     * 附加事件监听器到 UI
     */
    attachEventListeners() {
      // 主按钮点击 - 单个导出
      this.mainBtn.addEventListener('click', () => this.handleSingleExport());

      // 批量导出选项
      this.batchExportOption.addEventListener('click', () => this.handleBatchExport());
    }

    /**
     * 处理单个导出
     */
    async handleSingleExport() {
      this.mainBtn.disabled = true;
      const originalText = this.mainBtn.textContent;
      this.mainBtn.textContent = 'Exporting...';

      try {
        await this.execute();
      } catch (error) {
        console.error('Export error:', error);
        alert(`导出失败: ${error.message}`);
      } finally {
        this.mainBtn.disabled = false;
        this.mainBtn.textContent = originalText;
      }
    }

    /**
     * 处理批量导出
     */
    async handleBatchExport() {
      // 创建文件上传对话框
      const dialog = UIBuilder.createFileUploadDialog();
      document.body.appendChild(dialog);

      const fileInput = dialog._fileInput;
      const uploadButton = dialog._uploadButton;

      // 处理上传按钮点击
      uploadButton.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) {
          alert('请先选择文件');
          return;
        }

        try {
          // 读取文件内容
          const content = await this.readFileContent(file);

          // 解析并验证ID
          const result = Utils.parseBatchExportFile(content);

          if (result.error) {
            alert(`文件格式错误：${result.error}`);
            return;
          }

          if (result.invalid.length > 0) {
            const message = `发现 ${result.invalid.length} 个无效ID：\n${result.invalid.join('\n')}\n\n是否继续导出 ${result.valid.length} 个有效ID？`;
            if (!confirm(message)) {
              return;
            }
          }

          if (result.valid.length === 0) {
            alert('没有找到有效的对话ID');
            return;
          }

          // 关闭对话框
          document.body.removeChild(dialog);

          // 发送批量导出请求到 background script
          console.log('[Batch Export] Starting batch export for IDs:', result.valid);
          chrome.runtime.sendMessage({
            type: 'START_BATCH_EXPORT',
            conversationIds: result.valid
          }, (response) => {
            if (response && response.success) {
              Utils.createNotification(`已开始批量导出 ${result.valid.length} 个对话`);
            } else {
              alert(`启动批量导出失败: ${response?.error || '未知错误'}`);
            }
          });

        } catch (error) {
          console.error('Batch export error:', error);
          alert(`批量导出失败: ${error.message}`);
        }
      });
    }

    /**
     * 读取文件内容
     */
    readFileContent(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('文件读取失败'));
        reader.readAsText(file);
      });
    }

    /**
     * 检查是否需要自动导出
     */
    async checkAutoExport() {
      const urlParams = new URLSearchParams(window.location.search);
      const autoExport = urlParams.get('auto_export');

      if (autoExport === 'true') {
        console.log('[Auto Export] Detected auto export flag, starting export...');

        // 等待页面完全加载
        await Utils.sleep(2000);

        try {
          // 执行导出
          await this.execute();

          // 通知 background script 导出完成
          chrome.runtime.sendMessage({
            type: 'EXPORT_COMPLETED',
            conversationId: Utils.getConversationIdFromURL()
          });

        } catch (error) {
          console.error('[Auto Export] Export failed:', error);

          // 通知 background script 导出失败
          chrome.runtime.sendMessage({
            type: 'EXPORT_FAILED',
            conversationId: Utils.getConversationIdFromURL(),
            error: error.message
          });
        }
      }
    }

    /**
     * 观察存储变化以显示/隐藏按钮
     */
    observeStorageChanges() {
      const updateVisibility = () => {
        try {
          if (chrome?.storage?.sync) {
            chrome.storage.sync.get(['hideExportBtn'], (result) => {
              this.buttonContainer.style.display = result.hideExportBtn ? 'none' : '';
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
    // 导出编排方法
    // ============================================================================

    /**
     * 滚动到聊天顶部以加载所有消息
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
     * 从页面获取对话标题
     */
    getConversationTitle() {
      const titleCard = document.querySelector(CONFIG.SELECTORS.CONVERSATION_TITLE);
      return titleCard ? titleCard.textContent.trim() : 'Untitled Conversation';
    }

    /**
     * 从对话轮次构建 JSON 结构
     * 编排用户和助手消息的提取
     */
    async buildJSON(turns, conversationTitle, conversationId) {
      const data = [];
      const videosToDownload = [];
      const imagesToDownload = [];

      for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];
        Utils.createNotification(`Processing message ${i + 1} of ${turns.length}...`);

        // 检查模型响应是否包含操作卡片（如果存在则跳过）
        const modelRespElem = turn.querySelector(CONFIG.SELECTORS.MODEL_RESPONSE);
        if (AssistantDataService.hasActionCard(modelRespElem)) {
          // 完全跳过此轮次（用户查询和模型响应都跳过）
          continue;
        }

        // 提取用户消息
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

        // 提取助手消息
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

      // 计算轮次数和总数
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
     * 导出 JSON 数据到文件
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
     * 主导出执行
     * 编排整个导出过程
     */
    async execute() {
      try {
        await this.scrollToLoadAll();

        const turns = Array.from(document.querySelectorAll(CONFIG.SELECTORS.CONVERSATION_TURN));
        const conversationTitle = this.getConversationTitle();
        const conversationId = Utils.getConversationIdFromURL();

        // 构建 JSON 并收集媒体信息
        const result = await this.buildJSON(turns, conversationTitle, conversationId);

        // 导出 JSON 文件
        await this.exportToFile(result.jsonData, conversationId);
        Utils.createNotification('JSON export completed!');

        // JSON 导出后下载视频
        if (result.videosToDownload.length > 0) {
          Utils.createNotification(`Starting download of ${result.videosToDownload.length} video(s)...`);
          await MediaExportService.batchDownloadVideos(result.videosToDownload);
          Utils.createNotification('Video downloads initiated!');
        }

        // 视频下载后下载图片
        if (result.imagesToDownload.length > 0) {
          Utils.createNotification(`Starting download of ${result.imagesToDownload.length} image(s)...`);
          await MediaExportService.batchDownloadImages(result.imagesToDownload);
          Utils.createNotification('Image downloads initiated!');
        }

        // 最终完成消息
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
