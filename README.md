# Gemini Chat Exporter

Gemini Chat Exporter is a Chrome Extension that allows you to export your Gemini chat conversation to a well-formatted Markdown file or copy it to your clipboard—with perfect preservation of LaTeX math, code, and formatting.

## Features

- Export your full Gemini chat conversation to Markdown, preserving formatting (code, tables, LaTeX, etc.)
- Dedicated "Export Chat" button appears automatically on every Gemini chat page
- Option to hide the export button via the extension popup
- Granular message selection: Use checkboxes next to each message to select exactly what to export
- Selection presets: Instantly select all, none, or only AI responses with a dropdown
- Export to clipboard: Copy your chat as Markdown directly to your clipboard
- Custom filename (optional): Enter a filename, or leave blank to use the chat title or a timestamp
- Removes citation markers automatically
- Dark mode support
- No build step required
- Open source under the Apache License 2.0

## Installation

1. **Download the extension**
   - Clone or download this repository
   - Unzip to a folder on your computer

2. **Load the extension in Chrome**
   - Open `chrome://extensions` in your Chrome browser
   - Enable "Developer mode" (toggle in the top right)
   - Click "Load unpacked" and select the extension folder

3. **You're done!**
   - The "Export Chat" button will now appear on every Gemini chat page

## Usage

1. Go to [Gemini](https://gemini.google.com/) and open any chat conversation.
2. Click the "Export Chat" button at the top right of the page.
3. Use the **Select messages** dropdown to quickly select "All", "Only answers" (AI responses), or "None". You can also manually check/uncheck any message using the checkboxes.
4. Choose your export mode: "Export as file" (default) or "Export to clipboard".
5. Optionally enter a filename, or leave blank to automatically use the conversation title or timestamp.
6. Wait for the export to complete.
7. The Markdown file will be downloaded or copied to your clipboard.

## Permissions

This extension requires:
- `clipboardRead`: To copy Gemini responses using the built-in copy button for perfectly formatted content
- `storage`: For extension settings

## License

This project is licensed under the [Apache License 2.0](LICENSE).
