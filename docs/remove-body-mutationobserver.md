# 移除 `observeStorageChanges()` 中的全局 MutationObserver

## 背景

在 `ExportController.observeStorageChanges()` 中，为了同步“隐藏/显示导出按钮”的设置，代码使用了一个 `MutationObserver` 监听整个 `document.body` 的 DOM 变化。

该项目运行在 `gemini.google.com` 的 SPA 页面内，页面 DOM 变化频繁；全局监听会被高频触发。

## 变更前（Before）

文件：`src/content_scripts/export-controller.js`

行为：

- `observeStorageChanges()` 会创建 `MutationObserver(updateVisibility)`。
- 监听目标：`document.body`，配置为 `{ childList: true, subtree: true }`。
- 每次 DOM 变化触发回调时，`updateVisibility()` 会调用 `chrome.storage.sync.get(['hideExportBtn'], ...)` 并更新 `buttonContainer.style.display`。

影响：

- **性能损耗**：Gemini 页面任意 DOM 抖动（消息渲染、动画、滚动等）都会触发一次 `chrome.storage.sync.get`。
- **无必要的工作**：按钮显隐的“正确触发源”是存储变化事件，而不是 DOM 变化。

## 变更后（After）

文件：`src/content_scripts/export-controller.js`

调整：

- 保留初始化时的 `updateVisibility()`（启动时读取一次设置并设置显隐）。
- 保留 `chrome.storage.onChanged` 监听（当用户在 popup 中切换设置时更新显隐）。
- **移除** `document.body` 的 `MutationObserver`（不再用 DOM 变化驱动 storage 读取）。

## 效果与收益

- **肉眼可见的交互更流畅**：避免高频 DOM 变化触发 storage 读取与样式写入。
- **降低 background/extension 开销**：减少 `chrome.storage.sync.get` 调用频率。
- **逻辑更清晰**：UI 显隐只由“设置状态”和“设置变更事件”驱动。

## 验证方法

1. 打开 Gemini 页面，确认左下角导出按钮正常显示。
2. 打开扩展弹窗（`popup.html`），切换 “Hide export button”。
3. 观察页面按钮显隐应立即变化，且不依赖页面 DOM 波动。
4. 在 Gemini 页面进行滚动/切换对话/等待消息渲染，按钮显隐不应出现抖动或延迟。

## 关联说明

- 此变更只针对“按钮显隐同步”逻辑。
- 并不反对在“等待元素出现/DOM 稳定”等短生命周期场景使用 `MutationObserver`；该类场景应当有超时兜底，并在完成后 `disconnect()` 释放资源（见 `docs/mutation-observer-refactoring.md`）。
