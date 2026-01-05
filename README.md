# Gemini 聊天导出工具

Chrome 扩展，一键导出 Gemini 聊天记录为 JSON 格式，支持视频链接提取。

## 功能特性

- 一键导出完整 Gemini 对话为 JSON 格式
- 自动提取用户上传的视频链接
- 自动提取模型思考过程（model thoughts）
- 智能识别内容类型（纯文本/混合内容）
- 统计对话轮数和消息总数
- 使用对话 ID 命名导出文件
- 简洁交互，无配置界面

## 安装

1. 下载或克隆本仓库
2. 打开 Chrome 浏览器，访问 `chrome://extensions`
3. 开启右上角"开发者模式"
4. 点击"加载已解压的扩展程序"，选择项目文件夹

## 使用

1. 打开 [Gemini](https://gemini.google.com/) 聊天页面
2. 点击左下角 "Export" 按钮
3. 自动下载 `{对话ID}.json` 文件

## JSON 格式

```json
{
  "title": "对话标题",
  "round_count": 1,
  "total_count": 2,
  "data": [
    {
      "role": "user",
      "content_type": "mixed",
      "content": "文本内容",
      "videos": [
        "https://..."
      ]
    },
    {
      "role": "assistant",
      "content_type": "text",
      "content": "AI 回复内容",
      "model_thoughts": "模型的思考过程（如果有）"
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 对话标题 |
| `round_count` | number | 对话轮数（1 用户 + 1 助手 = 1 轮） |
| `total_count` | number | 消息总数（用户 + 助手） |
| `data` | array | 消息列表 |
| `role` | string | `"user"` 或 `"assistant"` |
| `content_type` | string | `"text"` 或 `"mixed"` |
| `content` | string | 消息文本内容 |
| `videos` | array | 视频链接数组（仅在有视频时存在） |
| `model_thoughts` | string | 模型思考过程（仅在 assistant 消息有思考内容时存在） |

### 动态字段规则

- **无视频**：不包含 `videos` 字段
- **有视频**：`content_type` 自动设为 `"mixed"`，包含 `videos` 数组
- **纯文本**：`content_type` 为 `"text"`
- **有模型思考**：assistant 消息包含 `model_thoughts` 字段
- **无模型思考**：不包含 `model_thoughts` 字段

## 权限说明

- `clipboardRead`：读取剪贴板以获取 Gemini 回复的完整格式
- `storage`：保存扩展设置

## 许可证

[Apache License 2.0](LICENSE)
