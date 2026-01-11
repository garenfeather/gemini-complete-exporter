# MutationObserver 改造方案

## 概述

本文档详细列出项目中所有使用固定延时（`Utils.sleep()`）的位置，以及如何使用 `MutationObserver` 进行改造，以提高代码的可靠性和执行效率。

---

## 改造原则

### 为什么要改造

| 问题 | 固定延时 | MutationObserver |
|------|----------|------------------|
| 可靠性 | 低（靠猜测） | 高（基于实际 DOM 状态） |
| 执行速度 | 固定慢 | 最快响应 |
| 网络适应性 | 差（网络慢易失败） | 自动适应 |
| 资源消耗 | 阻塞等待 | 事件驱动 |

### 改造策略

1. **优先用于“短生命周期等待”**：用 MutationObserver 等待元素出现/消失/稳定，达成目标后立刻 `disconnect()`，避免常驻监听
2. **监听范围尽量小**：优先监听特定容器（如聊天容器/overlay 容器），避免对 `document.body` 使用 `subtree: true` 这种全局高频监听
3. **保留超时兜底** 防止无限等待
4. **组合策略** Observer 检测 + 短延时确认稳定

---

## 需要改造的位置清单

### 一、export-controller.js

#### 1.1 页面加载等待
- **位置**: `checkAutoExport()` 第 172 行
- **当前代码**: `await Utils.sleep(2000)`
- **问题**: 固定等待 2 秒，无法确认页面是否真正加载完成
- **改造方式**:
  - 监听 `CONFIG.SELECTORS.CHAT_CONTAINER` 元素出现
  - 监听对话轮次 `CONFIG.SELECTORS.CONVERSATION_TURN` 元素出现
  - 等待 "加载中" 指示器消失（如果存在）
- **触发条件**: 目标元素已存在于 DOM 中
- **超时设置**: 10000ms

#### 1.2 滚动加载等待（已完成）
- **位置**: `scrollToLoadAll()`
- **修复前问题**: 依赖固定 `sleep`，快网浪费时间、慢网易漏加载；并且每轮循环会全局 `document.querySelectorAll` 统计 turn 数
- **落地方式**:
  - 使用短生命周期 `MutationObserver` 监听聊天容器（`CHAT_CONTAINER`）的子树变化
  - **新 turn 出现立即返回**（fast path）
  - 否则等待 DOM 在 `stableTime` 窗口内无变化后返回（收尾路径）并带 `timeout` 兜底
  - turn 计数收窄到 `scrollContainer.querySelectorAll(...)`（避免全局扫描）
- **优化参考**:
  - `src/content_scripts/export-controller.js:248`
  - `src/content_scripts/utils.js:94`（`Utils.waitForNewTurnsOrStable`）

#### 1.3 下载开始等待
- **位置**: `exportToFile()` 第 371 行
- **当前代码**: `await Utils.sleep(1000)`
- **问题**: 无法确认下载是否真正开始
- **改造方式**:
  - 依赖 `chrome.runtime.sendMessage` 的回调确认
  - 在 background script 中监听 `chrome.downloads.onCreated` 事件
  - 通过消息通知 content script 下载已开始
- **触发条件**: 收到 background script 的下载确认消息
- **超时设置**: 5000ms

---

### 二、assistant-data-service.js

#### 2.1 剪贴板操作等待
- **位置**: `copyModelResponse()` 第 32-34 行
- **当前代码**:
  ```javascript
  await Utils.sleep(CONFIG.TIMING.CLIPBOARD_CLEAR_DELAY);  // 200ms
  copyBtn.click();
  await Utils.sleep(CONFIG.TIMING.CLIPBOARD_READ_DELAY);   // 300ms
  ```
- **问题**: 剪贴板操作时机不确定，多次重试表明可靠性差
- **改造方式**:
  - 使用 `navigator.clipboard.read()` 的 Promise 直接等待
  - 添加剪贴板内容变化检测（对比前后值）
  - 考虑备选方案：直接从 DOM 提取格式化文本
- **触发条件**: 剪贴板内容非空且与之前不同
- **超时设置**: 2000ms
- **备注**: 剪贴板 API 本身是异步的，主要优化点在于检测内容变化

#### 2.2 思考内容展开等待
- **位置**: `extractModelThoughts()` 第 82 行
- **当前代码**: `await Utils.sleep(CONFIG.TIMING.THOUGHTS_EXPAND_DELAY)` (300ms)
- **问题**: 点击展开按钮后固定等待
- **改造方式**:
  - 监听 `CONFIG.SELECTORS.THOUGHTS_CONTENT` 元素出现
  - 监听思考容器的 `childList` 变化
- **触发条件**: `thoughts-content` 元素被添加到 DOM
- **超时设置**: 3000ms

#### 2.3 思考内容轮询等待
- **位置**: `extractModelThoughts()` 第 87-88 行
- **当前代码**:
  ```javascript
  while (attempts < 10 && !thoughtsContent) {
    await Utils.sleep(200);
    thoughtsContent = modelRespElem.querySelector(CONFIG.SELECTORS.THOUGHTS_CONTENT);
  }
  ```
- **问题**: 轮询模式效率低
- **改造方式**: 与 2.2 合并，使用单一 MutationObserver
- **触发条件**: 同 2.2
- **超时设置**: 同 2.2

#### 2.4 思考内容关闭等待
- **位置**: `extractModelThoughts()` 第 113 行
- **当前代码**: `await Utils.sleep(CONFIG.TIMING.THOUGHTS_EXPAND_DELAY)` (300ms)
- **问题**: 关闭后固定等待
- **改造方式**:
  - 监听 `CONFIG.SELECTORS.THOUGHTS_CONTENT` 元素移除
  - 或监听容器的 class/attribute 变化
- **触发条件**: `thoughts-content` 元素从 DOM 中移除
- **超时设置**: 1000ms
- **备注**: 关闭操作对导出结果影响较小，可保留短延时作为简化方案

#### 2.5 菜单打开等待
- **位置**: `extractModelName()` 第 133 行
- **当前代码**: `await Utils.sleep(300)`
- **问题**: 菜单可能未完全打开
- **改造方式**:
  - 监听 `.mat-mdc-menu-panel` 元素出现
  - 监听菜单的 `visibility` 或 `opacity` 属性变化
  - 监听 `aria-expanded` 属性变化
- **触发条件**: 菜单面板元素出现且可见
- **超时设置**: 2000ms

#### 2.6 菜单关闭等待
- **位置**: `extractModelName()` 第 158 行
- **当前代码**: `await Utils.sleep(200)`
- **问题**: 菜单可能未完全关闭
- **改造方式**:
  - 监听 `.mat-mdc-menu-panel` 元素移除
  - 监听 `.cdk-overlay-backdrop` 元素移除
- **触发条件**: 菜单面板元素从 DOM 中移除
- **超时设置**: 1000ms

#### 2.7 鼠标悬停效果等待
- **位置**: `extractAssistantMessage()` 第 287 行
- **当前代码**: `await Utils.sleep(CONFIG.TIMING.MOUSEOVER_DELAY)` (500ms)
- **问题**: 悬停后等待复制按钮出现
- **改造方式**:
  - 监听 `CONFIG.SELECTORS.COPY_BUTTON` 元素出现
  - 监听按钮的 `visibility` 或 `display` 变化
- **触发条件**: 复制按钮元素出现且可交互
- **超时设置**: 2000ms

---

### 三、media-export-service.js

#### 3.1 视频播放器加载等待（已弃用方法）
- **位置**: `extractVideoUrls()` 第 34-37 行
- **当前代码**:
  ```javascript
  while (!videoPlayer && (Date.now() - startTime) < CONFIG.TIMING.VIDEO_LOAD_TIMEOUT) {
    await Utils.sleep(CONFIG.TIMING.VIDEO_LOAD_DELAY);  // 500ms
    videoPlayer = document.querySelector(CONFIG.SELECTORS.VIDEO_PLAYER);
  }
  ```
- **问题**: 轮询模式效率低
- **改造方式**:
  - 监听 `CONFIG.SELECTORS.VIDEO_PLAYER` 元素出现
  - 监听视频元素的 `loadeddata` 或 `canplay` 事件
- **触发条件**: video 元素出现且 src 已设置
- **超时设置**: 保持 5000ms
- **备注**: 此方法已标记弃用，可考虑直接删除

#### 3.2 Lightbox 关闭等待（已弃用方法）
- **位置**: `extractVideoUrls()` 第 47、49 行
- **当前代码**: `await Utils.sleep(CONFIG.TIMING.LIGHTBOX_CLOSE_DELAY)` (300ms)
- **问题**: 固定等待关闭动画
- **改造方式**:
  - 监听 `button[mat-dialog-close]` 所在对话框元素移除
  - 监听 `.cdk-overlay-container` 子元素变化
- **触发条件**: 对话框元素从 DOM 中移除
- **超时设置**: 2000ms
- **备注**: 此方法已标记弃用

#### 3.3 视频播放器加载等待（extractFiles）
- **位置**: `extractFiles()` 第 101-105 行
- **当前代码**: 与 3.1 相同的轮询模式
- **改造方式**: 同 3.1
- **触发条件**: 同 3.1
- **超时设置**: 5000ms

#### 3.4 Lightbox 关闭等待（extractFiles）
- **位置**: `extractFiles()` 第 118、120 行
- **当前代码**: `await Utils.sleep(CONFIG.TIMING.LIGHTBOX_CLOSE_DELAY)` (300ms)
- **改造方式**: 同 3.2
- **触发条件**: 同 3.2
- **超时设置**: 2000ms

#### 3.5 批量下载间隔
- **位置**: `batchDownloadVideos()` 第 185 行
- **当前代码**: `await Utils.sleep(500)`
- **问题**: 固定间隔可能不够或过长
- **改造方式**:
  - 监听 `chrome.downloads.onChanged` 事件
  - 等待前一个下载状态变为 `in_progress` 或 `complete`
  - 在 background script 实现下载队列管理
- **触发条件**: 前一个下载已开始（状态变化）
- **超时设置**: 5000ms
- **备注**: 此优化需要与 background script 配合

#### 3.6 批量图片下载间隔
- **位置**: `batchDownloadImages()` 第 239 行
- **当前代码**: `await Utils.sleep(500)`
- **改造方式**: 同 3.5
- **触发条件**: 同 3.5
- **超时设置**: 同 3.5

---

## 改造优先级

### P0 - 高优先级（影响核心功能可靠性）

| 编号 | 位置 | 问题描述 |
|------|------|----------|
| 1.2 | scrollToLoadAll | 滚动加载是核心流程，失败导致数据不完整 |
| 2.1 | copyModelResponse | 剪贴板操作是获取格式化文本的关键 |
| 2.5 | extractModelName | 菜单交互不稳定会导致模型名提取失败 |
| 2.7 | extractAssistantMessage | 复制按钮不出现导致无法提取内容 |

### P1 - 中优先级（影响用户体验）

| 编号 | 位置 | 问题描述 |
|------|------|----------|
| 1.1 | checkAutoExport | 批量导出的自动触发可靠性 |
| 2.2/2.3 | extractModelThoughts | 思考内容提取失败影响完整性 |
| 3.3/3.4 | extractFiles | 视频提取失败影响媒体完整性 |

### P2 - 低优先级（优化项）

| 编号 | 位置 | 问题描述 |
|------|------|----------|
| 1.3 | exportToFile | 可通过 callback 机制优化 |
| 2.4/2.6 | thoughts/menu close | 关闭操作影响较小 |
| 3.5/3.6 | batch download | 可在 background script 层面优化 |

---

## 通用工具函数设计

### waitForElement

等待指定元素出现在 DOM 中。

```javascript
/**
 * 等待元素出现
 * @param {string} selector - CSS 选择器
 * @param {Object} options - 配置选项
 * @param {number} options.timeout - 超时时间（毫秒），默认 5000
 * @param {Element} options.parent - 父元素，默认 document
 * @returns {Promise<Element>} 找到的元素
 */
function waitForElement(selector, options = {})
```

**实现要点**:
- 先检查元素是否已存在
- 使用 MutationObserver 监听 `childList` 和 `subtree`
- 设置超时 reject
- 返回找到的元素

### waitForElementRemoval

等待指定元素从 DOM 中移除。

```javascript
/**
 * 等待元素移除
 * @param {string} selector - CSS 选择器
 * @param {Object} options - 配置选项
 * @param {number} options.timeout - 超时时间（毫秒），默认 3000
 * @param {Element} options.parent - 父元素，默认 document
 * @returns {Promise<void>}
 */
function waitForElementRemoval(selector, options = {})
```

**实现要点**:
- 先检查元素是否已不存在
- 监听 `childList` 变化
- 检测目标元素的移除

### waitForAttribute

等待元素属性变化到指定值。

```javascript
/**
 * 等待元素属性变化
 * @param {Element} element - 目标元素
 * @param {string} attributeName - 属性名
 * @param {string|Function} expectedValue - 期望值或判断函数
 * @param {Object} options - 配置选项
 * @returns {Promise<void>}
 */
function waitForAttribute(element, attributeName, expectedValue, options = {})
```

**实现要点**:
- 监听 `attributes` 变化
- 使用 `attributeFilter` 优化性能
- 支持函数判断复杂条件

### waitForStableDOM

等待 DOM 稳定（一段时间内无变化）。

```javascript
/**
 * 等待 DOM 稳定
 * @param {Element} element - 监听的根元素
 * @param {Object} options - 配置选项
 * @param {number} options.stableTime - 稳定时间（毫秒），默认 500
 * @param {number} options.timeout - 超时时间（毫秒），默认 10000
 * @returns {Promise<void>}
 */
function waitForStableDOM(element, options = {})
```

**实现要点**:
- 使用 debounce 机制
- 每次变化重置稳定计时器
- 适用于滚动加载场景

---

## 改造示例

### 示例：改造 scrollToLoadAll（已完成）

参考实现见源文件：

- `src/content_scripts/export-controller.js:248`
- `src/content_scripts/utils.js:94`

关键点：

- 不再使用固定 `sleep`；改为短生命周期 observer 等待“新增 turn”或“DOM 稳定窗口”
- turn 计数收窄到聊天容器，避免全局 `document.querySelectorAll`

### 示例：改造 extractModelName 菜单等待

**改造前**:
```javascript
moreMenuButton.click();
await Utils.sleep(300);  // 固定等待菜单打开
const modelMenuItem = document.querySelector('div[mat-menu-item] mat-icon[fonticon="spark"]');
```

**改造后**:
```javascript
moreMenuButton.click();

// 等待菜单面板出现
await Utils.waitForElement('.mat-mdc-menu-panel', { timeout: 2000 });

const modelMenuItem = document.querySelector('div[mat-menu-item] mat-icon[fonticon="spark"]');
```

---

## 注意事项

### 1. 清理 Observer

每个 MutationObserver 使用后必须调用 `disconnect()` 释放资源：

```javascript
const observer = new MutationObserver(callback);
observer.observe(target, config);
// ... 使用完毕后
observer.disconnect();
```

### 2. 错误处理

所有等待函数应该：
- 支持超时并抛出明确的超时错误
- 在 finally 中清理 Observer
- 提供有意义的错误信息

### 3. 向后兼容

改造过程中保留原有的超时配置作为兜底：

```javascript
// 在 CONFIG.TIMING 中保留原有配置作为默认超时值
SCROLL_TIMEOUT: 5000,      // 滚动加载等待超时兜底（事件驱动等待的 timeout）
MENU_TIMEOUT: 2000,        // 菜单操作超时
ELEMENT_TIMEOUT: 3000      // 通用元素等待超时
```

### 4. 反模式提醒

避免将 MutationObserver 用作“常驻的全局信号源”来驱动业务逻辑或高开销操作，典型反例如下：

- 监听 `document.body` 且开启 `subtree: true`，并在回调中频繁执行 `chrome.storage.*.get()`、重排/重绘、网络请求等
- 用 DOM 抖动来触发“设置同步”（设置变化的正确触发源应是 `chrome.storage.onChanged`）

已知收益明确的修正示例：按钮显隐同步不再依赖 DOM 变化，见 `docs/remove-body-mutationobserver.md`。

### 5. 调试支持

添加调试日志以便排查问题：

```javascript
if (CONFIG.DEBUG) {
  console.log(`[Observer] Waiting for: ${selector}`);
  console.log(`[Observer] Found element after ${elapsed}ms`);
}
```

---

## 改造清单

- [x] 避免常驻全局 observer 驱动业务逻辑（已完成：移除按钮显隐的 body observer，见 `docs/remove-body-mutationobserver.md`）
- [ ] 创建 `utils-observer.js` 封装通用等待函数
- [x] 1.2 `scrollToLoadAll`：滚动加载等待（已完成：见 `src/content_scripts/export-controller.js:248` / `src/content_scripts/utils.js:94`）
- [ ] 改造 `export-controller.js` 中的其余延时（1.1/1.3）
- [ ] 改造 `assistant-data-service.js` 中的 7 处延时
- [ ] 改造 `media-export-service.js` 中的 6 处延时
- [ ] 删除已弃用的 `extractVideoUrls` 和 `extractImageUrls` 方法
- [ ] 更新 `CONFIG.TIMING` 配置，将固定延时改为超时阈值
- [ ] 添加单元测试验证改造效果
- [ ] 在不同网络环境下进行测试
