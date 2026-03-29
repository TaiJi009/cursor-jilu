# 超市小票识别助手（Receipt OCR Web）

基于浏览器的**超市购物小票 OCR 工具**：上传小票图片，由视觉大模型提取超市名称、购物时间、商品明细与合计，支持在页面中校对编辑，并导出为 Excel（`.xlsx`）。**无需自建后端**，数据与小票图片主要在本地处理；调用 AI 时由浏览器直连各服务商 API。

## 这是一个怎样的产品

| 维度 | 说明 |
|------|------|
| **定位** | 个人效率工具：记账、报销凭证整理、家庭开支数字化 |
| **形态** | 纯前端静态单页应用（SPA），可部署到任意静态托管（本仓库默认对接 GitHub Pages） |
| **隐私** | API Key 与用户偏好存放在浏览器 `localStorage`，不按产品侧上传到自有服务器 |
| **典型流程** | 配置 API Key → 批量上传图片 → 排队/并发识别 → 左图右表校对（移动端上图下表）→ 导出 Excel |

识别字段包括：**超市名称**、**购物日期时间**、**商品列表**（名称、单价、数量、小计）及**合计金额**；界面支持暗色模式、缩略图队列状态（等待 / 识别中 / 成功 / 失败）及失败重试思路（以实际页面交互为准）。

## 功能概览（与代码一致）

- **多模型服务商**：除智谱 GLM 视觉外，可在自定义 Key 场景下选择 DeepSeek、OpenAI、阿里云通义（DashScope）等（以 `src/lib/llmProviders.ts` 为准）。
- **批量识别**：队列调度，并采用有限并发（代码中为 3 路并行）以降低被 API 限流（如 429）的概率。
- **校对**：分栏预览原图与可编辑表格；支持合并多张小票为一张总表等展示/导出相关能力（见 `MergedReceiptTable`、`exportExcel` 的导出模式）。
- **导出**：使用 SheetJS（`xlsx`）生成 Excel；支持按小票分 Sheet 与合并导出等模式（见 `src/lib/exportExcel.ts`）。
- **入口结构**：主导航 **A** 为主功能页（`ReceiptOcrPage`），**B** 为预留扩展页（`PageB`）。

更完整的需求与演进规划见仓库内 [`PRD.md`](./PRD.md)；架构与流程说明见 [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md)（部分实现细节可能与最新代码有差异，以源码为准）。

## 技术栈

- **构建**：Vite 7、TypeScript  
- **UI**：React 18、Tailwind CSS 4（`@tailwindcss/vite`）  
- **图标**：lucide-react  
- **表格导出**：xlsx（SheetJS）

## 本地开发

```bash
npm install
npm run dev
```

```bash
npm run build   # 类型检查 + 生产构建
npm run preview # 本地预览构建结果
```

## API Key 与部署说明

- 使用视觉识别前需在页面中配置对应服务商的 **API Key**（存储在本地浏览器）。
- 生产构建默认 `base` 为 `/2026-3-23-Ticket-OCR-to-Excel/`（见 `vite.config.ts`），与 GitHub 仓库同名子路径部署一致；若更换仓库名或自定义域名，请同步修改 `base`。
- `main` 分支推送可通过 [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) 部署到 GitHub Pages（需在仓库中启用 Pages 与相应权限）。

## 仓库与本地目录命名

- **GitHub**：在仓库页面打开 **Settings → General → Repository name**，改为 `2026-3-23-Ticket-OCR-to-Excel` 并保存。请先完成网页端重命名，再执行 `git push`（本地 `origin` 已改为新仓库地址；若与你实际账号不一致，请用 `git remote set-url` 自行修正）。
- **本地文件夹**：将项目根目录重命名为 `2026-3-23-Ticket-OCR-to-Excel`（与仓库名一致）。若 Cursor 或其他进程占用目录导致无法重命名，请先关闭 IDE/终端，再在资源管理器中改名，然后用新路径重新打开工程。

## 仓库内其他文档

- [`PRD.md`](./PRD.md) — 产品需求与数据结构约定  
- [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) — 系统设计（流程、决策、部署要点）  

---

*npm 包名：`2026-3-23-ticket-ocr-to-excel`（见 `package.json`）；展示用仓库名：`2026-3-23-Ticket-OCR-to-Excel`。*
