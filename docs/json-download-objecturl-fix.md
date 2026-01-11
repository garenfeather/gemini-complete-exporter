# JSON 导出大对话失败（Extension context invalidated）修复记录

## 背景

当对话轮数较大、且包含大量图片/视频时，导出 JSON 在最后阶段可能失败，表现为下载无法触发并报错。

## 现象（修复前）

在导出较大对话（示例：`count` 290+ 且包含大量媒体）时，导出流程会在导出 JSON 阶段失败，控制台可见类似报错：

- `Error exporting JSON: Error: Extension context invalidated.`

典型堆栈（节选）：

- `ExportController.exportToFile` → `ExportController.execute` → `ExportController.handleSingleExport`

## 原因分析（推测）

后台 `DOWNLOAD_JSON` 处理逻辑使用了 `FileReader.readAsDataURL(blob)` 将 JSON Blob 转换为 Data URL 再下载。

Data URL 会把整份 JSON 进行 base64 编码并生成超长字符串。对于大对话 JSON：

- 生成 `jsonString`（一份完整字符串）
- 再构造 `blob`
- 再生成 `dataUrl`（base64 后的超长字符串）

以上中间态会造成明显的内存峰值和额外 CPU 开销，可能导致扩展后台上下文被系统回收/重启，进而让 content script 侧感知为 `Extension context invalidated`。

## 修复方案

文件：`src/background/service-worker.js`

将 JSON 下载从 Data URL 改为 Object URL：

- 使用 `URL.createObjectURL(blob)` 生成 `blob:` URL 作为下载地址，避免生成超长 base64 字符串。
- 记录 `downloadId -> objectUrl` 映射。
- 在 `chrome.downloads.onChanged` 监听到下载 `complete` 或 `interrupted` 时执行 `URL.revokeObjectURL(objectUrl)`，释放资源。
- 保留兜底：若 `createObjectURL` 或下载触发失败，则回退到 Data URL 路径。

## 效果与收益（修复后）

- 大对话（290+ 轮、含大量媒体）可顺利完成 JSON 下载。
- 显著降低导出阶段内存峰值与 CPU 压力。
- 降低因后台上下文失效导致的导出失败概率。

## 验证方法

1. 选择同一份大对话样本进行导出对比。
2. 观察 console 是否仍出现 `Extension context invalidated`。
3. 可选：用 Chrome Task Manager（`Shift+Esc`）或 service worker DevTools 的 Memory 面板对比导出期间的内存峰值。
