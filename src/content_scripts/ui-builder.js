/**
 * Gemini 聊天导出器 - UI 构建器
 * 为扩展创建和管理 UI 元素
 */

(function() {
  'use strict';

  // ============================================================================
  // UI 构建器
  // ============================================================================
  window.UIBuilder = class UIBuilder {
    /**
     * 创建导出按钮容器（包含下拉菜单）
     */
    static createButton() {
      // 创建容器
      const container = document.createElement('div');
      container.id = CONFIG.BUTTON_ID + '-container';
      Object.assign(container.style, {
        position: 'fixed',
        bottom: '24px',
        left: '180px',
        zIndex: '9999',
        display: 'inline-block'
      });

      // 创建主按钮
      const mainBtn = document.createElement('button');
      mainBtn.id = CONFIG.BUTTON_ID;
      Object.assign(mainBtn.style, {
        padding: '8px 16px',
        background: CONFIG.STYLES.BUTTON_PRIMARY,
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '1em',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        fontWeight: 'bold',
        transition: 'background 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      });

      // 添加按钮文字和下拉箭头
      const arrow = document.createElement('span');
      arrow.textContent = '▼';
      arrow.style.fontSize = '0.7em';
      mainBtn.appendChild(document.createTextNode('Export '));
      mainBtn.appendChild(arrow);

      // 创建下拉菜单
      const dropdown = document.createElement('div');
      dropdown.id = CONFIG.BUTTON_ID + '-dropdown';
      Object.assign(dropdown.style, {
        display: 'none',
        position: 'absolute',
        bottom: '100%',
        left: '0',
        marginBottom: '4px',
        background: CONFIG.STYLES.BUTTON_PRIMARY,
        border: 'none',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        width: '100%',
        overflow: 'hidden'
      });

      // 批量导出选项
      const batchExportOption = this.createDropdownOption('批量导出', 'batch');

      dropdown.appendChild(batchExportOption);

      // 鼠标悬停显示/隐藏下拉菜单
      container.addEventListener('mouseenter', () => {
        dropdown.style.display = 'block';
      });

      container.addEventListener('mouseleave', () => {
        dropdown.style.display = 'none';
      });

      // 主按钮颜色变化
      mainBtn.addEventListener('mouseenter', () => {
        mainBtn.style.background = CONFIG.STYLES.BUTTON_HOVER;
      });
      mainBtn.addEventListener('mouseleave', () => {
        mainBtn.style.background = CONFIG.STYLES.BUTTON_PRIMARY;
      });

      container.appendChild(dropdown);
      container.appendChild(mainBtn);

      // 保存引用以便后续使用
      container._mainBtn = mainBtn;
      container._dropdown = dropdown;
      container._batchExportOption = batchExportOption;

      return container;
    }

    /**
     * 创建下拉菜单选项
     */
    static createDropdownOption(text, type) {
      const option = document.createElement('div');
      option.className = 'export-dropdown-option';
      option.dataset.type = type;
      option.textContent = text;

      Object.assign(option.style, {
        padding: '10px 16px',
        cursor: 'pointer',
        transition: 'background 0.2s',
        fontSize: '0.95em',
        color: '#fff',
        borderBottom: 'none'
      });

      option.addEventListener('mouseenter', () => {
        option.style.background = CONFIG.STYLES.BUTTON_HOVER;
      });

      option.addEventListener('mouseleave', () => {
        option.style.background = 'transparent';
      });

      return option;
    }

    /**
     * 创建文件上传对话框
     */
    static createFileUploadDialog() {
      // 创建遮罩层
      const overlay = document.createElement('div');
      overlay.id = 'batch-export-overlay';
      Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: '10000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });

      // 创建对话框
      const dialog = document.createElement('div');
      Object.assign(dialog.style, {
        background: '#fff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        maxWidth: '500px',
        width: '90%'
      });

      // 标题
      const title = document.createElement('h3');
      title.textContent = '批量导出对话';
      title.style.margin = '0 0 16px 0';
      title.style.fontSize = '1.3em';
      title.style.color = '#333';

      // 说明文本
      const description = document.createElement('p');
      description.textContent = '上传包含对话ID的txt文件，每行一个ID（最多5个）';
      description.style.margin = '0 0 16px 0';
      description.style.fontSize = '0.9em';
      description.style.color = '#666';

      // 文件输入
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.txt';
      fileInput.style.display = 'none';

      const fileButton = document.createElement('button');
      fileButton.textContent = '选择文件';
      Object.assign(fileButton.style, {
        padding: '10px 20px',
        background: CONFIG.STYLES.BUTTON_PRIMARY,
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '1em',
        marginRight: '12px'
      });

      const fileName = document.createElement('span');
      fileName.textContent = '未选择文件';
      fileName.style.color = '#999';
      fileName.style.fontSize = '0.9em';

      fileButton.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          fileName.textContent = e.target.files[0].name;
          fileName.style.color = '#333';
        }
      });

      // 按钮容器
      const buttonContainer = document.createElement('div');
      Object.assign(buttonContainer.style, {
        marginTop: '24px',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px'
      });

      const cancelButton = document.createElement('button');
      cancelButton.textContent = '取消';
      Object.assign(cancelButton.style, {
        padding: '10px 20px',
        background: '#f0f0f0',
        color: '#333',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '1em'
      });

      const uploadButton = document.createElement('button');
      uploadButton.textContent = '开始导出';
      Object.assign(uploadButton.style, {
        padding: '10px 20px',
        background: CONFIG.STYLES.BUTTON_PRIMARY,
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '1em'
      });

      cancelButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
      });

      buttonContainer.appendChild(cancelButton);
      buttonContainer.appendChild(uploadButton);

      dialog.appendChild(title);
      dialog.appendChild(description);
      dialog.appendChild(fileButton);
      dialog.appendChild(fileInput);
      dialog.appendChild(fileName);
      dialog.appendChild(buttonContainer);
      overlay.appendChild(dialog);

      // 点击遮罩层关闭
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
        }
      });

      // 保存引用
      overlay._fileInput = fileInput;
      overlay._uploadButton = uploadButton;

      return overlay;
    }
  };

})();
