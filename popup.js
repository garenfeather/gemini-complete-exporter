/**
 * popup.js
 * 处理扩展弹窗 UI 以隐藏/显示导出按钮。
 *
 * 功能：
 * - 复选框用于在支持的聊天页面上隐藏/显示导出按钮。
 * - 使用 chrome.storage.sync 持久化用户选择。
 */

// 获取复选框元素
const hideExportBtnCheckbox = document.getElementById('hideExportBtn');

// 从 chrome.storage 加载保存的状态并更新复选框
chrome.storage.sync.get(['hideExportBtn'], (result) => {
  hideExportBtnCheckbox.checked = !!result.hideExportBtn;
});

// 复选框切换时保存状态
hideExportBtnCheckbox.addEventListener('change', (e) => {
  chrome.storage.sync.set({ hideExportBtn: hideExportBtnCheckbox.checked });
});
