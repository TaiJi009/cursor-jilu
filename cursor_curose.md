# 保存curose聊天记录
_Exported on 3/16/2026 at 21:56:42 GMT+8 from Cursor (2.6.19)_

---

**User**

你有没有办法把curose的聊天记录保存下来？

---

**Cursor**


查找 Cursor 聊天记录的保存方式，并检查项目中的 `agent-transcripts` 文件夹。



有几种方式可以保存 Cursor 的聊天记录：

---

## 1. 官方导出功能

Cursor 提供内置导出，可以：

- 在聊天界面右上角菜单中查找 **Export** / **导出** 选项
- 或参考官方文档：https://docs.cursor.com/zh/agent/chat/export

---

## 2. 本地存储位置（已有记录）

Cursor 会把 Agent 对话保存在项目目录下的 `agent-transcripts` 中：

- **路径**：`项目目录/agent-transcripts/<uuid>/<uuid>.jsonl`
- **格式**：JSONL（每行一条消息）
- 你当前项目里已有 20+ 个对话文件

这些 `.jsonl` 文件包含完整对话，但需要解析才能方便阅读。

---

## 3. 第三方导出工具

### Cursor Export Extension（推荐）

- **仓库**：https://github.com/TsekaLuk/Cursor-export-extension  
- **功能**：VS Code 扩展，一键导出对话为 Markdown
- **特点**：保留格式、元数据、时间戳，可自定义保存路径和内容

### 其他工具

- **cursor-chat-export-to-markdown**：Python 脚本，导出为 Markdown
- **cursor2md**：适用于 Cursor 0.43+，可列出或导出所有对话
- **cursor-chat-browser**：可导出为 Markdown、PDF 或 HTML

---

## 4. 手动备份

- **Agent 对话**：直接复制 `agent-transcripts` 整个文件夹
- **其他聊天**：可能保存在 `%APPDATA%\Cursor\User\workspaceStorage` 下的 `state.vscdb` 中（SQLite 数据库）

---

## 建议

1. 优先使用 Cursor 自带的 **Export** 功能（如果有）。
2. 需要批量导出或更好格式时，可安装 **Cursor Export Extension**。
3. 想长期备份，可定期复制 `agent-transcripts` 文件夹到其他位置。

如果你希望，我可以帮你写一个脚本，把 `agent-transcripts` 里的 `.jsonl` 转成可读的 Markdown 文件。

