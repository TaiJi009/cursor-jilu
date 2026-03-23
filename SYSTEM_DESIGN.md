# 超市小票 OCR 识别与 Excel 导出工具 - 系统设计文档

## 1. 整体架构

### 1.1 架构概览

本系统为**纯前端静态单页应用（SPA）**，无后端服务，所有计算与状态管理均在浏览器内完成。

```
┌─────────────────────────────────────────────────────────┐
│                      浏览器（Client）                    │
│                                                         │
│  ┌─────────────┐   ┌───────────────┐  ┌─────────────┐  │
│  │   UI 层      │   │   业务逻辑层   │  │   数据层     │  │
│  │  (React)    │◄─►│  (Hooks/Svc)  │◄►│ (Zustand)   │  │
│  └─────────────┘   └──────┬────────┘  └─────────────┘  │
│                           │                             │
│                    ┌──────▼────────┐                    │
│                    │  外部依赖适配层  │                    │
│                    │  ┌──────────┐ │                    │
│                    │  │ ZhipuAI  │ │  ← API 调用         │
│                    │  │  Client  │ │                    │
│                    │  └──────────┘ │                    │
│                    │  ┌──────────┐ │                    │
│                    │  │  SheetJS │ │  ← Excel 生成        │
│                    │  └──────────┘ │                    │
│                    └───────────────┘                    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │              浏览器存储                           │    │
│  │   localStorage (API Key)  │  Object URL (预览)   │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
            │
            ▼ HTTPS
┌─────────────────────────┐
│   智谱 AI GLM-4V-Flash   │
│   (外部视觉大模型 API)    │
└─────────────────────────┘
```

### 1.2 技术栈选型

| 层级 | 技术选型 | 选型理由 |
|------|---------|---------|
| 构建工具 | Vite | 极速 HMR，零配置静态部署 |
| UI 框架 | React 18 + TypeScript | 生态成熟，类型安全 |
| 状态管理 | Zustand | 轻量，适合中小型应用，无样板代码 |
| UI 组件库 | Tailwind CSS + shadcn/ui | 原子化 CSS，高度可定制，无运行时开销 |
| Excel 导出 | xlsx (SheetJS) | 业界标准，纯前端生成 `.xlsx` |
| AI 接口 | 智谱 AI GLM-4V-Flash | 支持图文多模态，有免费额度 |
| 部署 | GitHub Pages + GitHub Actions | 免费静态托管，CI/CD 自动化 |

---

## 2. 目录结构设计

```
src/
├── main.tsx                    # 应用入口
├── App.tsx                     # 根组件，路由/主题容器
│
├── components/                 # UI 组件
│   ├── layout/
│   │   ├── Header.tsx          # 顶部导航（主题切换、API Key 状态）
│   │   └── Layout.tsx          # 整体布局容器
│   ├── upload/
│   │   ├── DropZone.tsx        # 拖拽上传区域
│   │   └── ThumbnailList.tsx   # 图片缩略图队列
│   ├── review/
│   │   ├── ReviewPanel.tsx     # 左图右表分栏容器
│   │   ├── ImageViewer.tsx     # 左侧原图预览
│   │   └── ReceiptTable.tsx    # 右侧可编辑数据表格
│   ├── dialogs/
│   │   └── ApiKeyDialog.tsx    # API Key 设置弹窗
│   └── ui/                     # shadcn/ui 基础组件
│       ├── button.tsx
│       ├── toast.tsx
│       └── ...
│
├── hooks/                      # 自定义 Hooks
│   ├── useOcrQueue.ts          # OCR 串行队列调度
│   ├── useApiKey.ts            # API Key 读写
│   └── useTheme.ts             # 主题切换
│
├── services/                   # 业务服务层
│   ├── zhipuai.ts              # 智谱 AI API 封装
│   └── exporter.ts             # Excel 导出服务
│
├── store/                      # Zustand 状态仓库
│   └── receiptStore.ts         # 核心状态（小票列表、选中项）
│
├── types/                      # TypeScript 类型定义
│   └── receipt.ts              # ReceiptData, ReceiptItem 等接口
│
└── utils/                      # 工具函数
    ├── imageUtils.ts           # 图片压缩、转 Base64
    └── promptBuilder.ts        # 构建发送给 AI 的 Prompt
```

---

## 3. 核心模块设计

### 3.1 状态管理（Zustand Store）

```typescript
// store/receiptStore.ts
interface ReceiptStore {
  receipts: ReceiptData[];           // 所有小票列表
  activeReceiptId: string | null;    // 当前预览/编辑的小票 ID

  // Actions
  addReceipts: (files: File[]) => void;
  removeReceipt: (id: string) => void;
  updateReceiptStatus: (id: string, status: ReceiptStatus) => void;
  updateReceiptData: (id: string, data: Partial<ReceiptData>) => void;
  updateReceiptItem: (receiptId: string, itemIndex: number, item: Partial<ReceiptItem>) => void;
  setActiveReceipt: (id: string | null) => void;
}
```

### 3.2 OCR 串行队列（useOcrQueue）

为避免 API 并发超限，采用串行队列处理机制：

```
┌──────────────────────────────────────────────────────────┐
│                    OCR 队列调度器                         │
│                                                          │
│   receipts: [img1(pending), img2(pending), img3(done)]   │
│                     │                                    │
│              取第一个 pending                             │
│                     │                                    │
│              ┌──────▼──────┐                             │
│              │ 状态→processing│                           │
│              └──────┬──────┘                             │
│                     │                                    │
│         ┌───────────▼───────────┐                        │
│         │  图片转 Base64         │                        │
│         │  构建 Prompt          │                        │
│         │  调用 ZhipuAI API     │                        │
│         └───────────┬───────────┘                        │
│                     │                                    │
│         ┌───────────┴───────────┐                        │
│     成功 ▼                  失败 ▼                        │
│  状态→success           状态→error                        │
│  解析 JSON 写入 Store    写入错误信息                      │
│         └───────────┬───────────┘                        │
│                     │                                    │
│              继续处理下一个 pending                        │
└──────────────────────────────────────────────────────────┘
```

### 3.3 智谱 AI API 封装（services/zhipuai.ts）

**请求格式（GLM-4V-Flash 多模态）：**

```typescript
interface ZhipuRequest {
  model: "glm-4v-flash";
  messages: [{
    role: "user";
    content: [
      { type: "image_url"; image_url: { url: string } },  // Base64 图片
      { type: "text";      text: string }                 // 提取指令 Prompt
    ]
  }];
}
```

**Prompt 设计原则（promptBuilder.ts）：**

```
你是一个专业的购物小票信息提取助手。
请识别图片中的购物小票，严格按照以下 JSON 格式返回，不要输出任何其他内容：

{
  "storeName": "超市名称",
  "date": "YYYY-MM-DD HH:mm",
  "items": [
    { "name": "商品名", "price": 单价数字, "quantity": 数量数字, "subtotal": 小计数字 }
  ],
  "total": 合计数字
}

注意：
- 所有金额为数字类型，不含货币符号
- 无法识别的字段填 null
- items 为空时返回空数组 []
```

**响应解析策略：**
- 用正则 `/\{[\s\S]*\}/` 从返回文本中提取 JSON（防止 AI 输出多余文字）
- 解析失败时将该小票标记为 `error` 状态，保留原始 AI 响应供调试

### 3.4 Excel 导出（services/exporter.ts）

```
所有 success 状态小票
        │
        ▼
  遍历每张小票
        │
  ┌─────▼─────┐
  │ 构建 Sheet │  → Sheet 名: "超市名-MM月DD日"（截断至31字符）
  │           │
  │ 行1: 标题行 │  → ["商品名称", "单价", "数量", "小计"]
  │ 行2~N: 商品 │  → 每条 ReceiptItem 对应一行
  │ 行N+1: 合计 │  → ["合计", "", "", total]
  └─────┬─────┘
        │
  追加到 Workbook
        │
  xlsx.writeFile() → 触发浏览器下载
  文件名: "小票记录_YYYY-MM-DD.xlsx"
```

---

## 4. 数据流设计

### 4.1 核心流程数据流

```
用户拖拽/选择图片
       │
       ▼
  DropZone 组件
  验证（大小≤5MB，格式合法）
       │
       ▼
  store.addReceipts()
  生成 ReceiptData（status: 'pending'）
  创建 Object URL 用于预览
       │
       ▼
  useOcrQueue Hook 监听 store
  检测到 pending 项目，开始队列处理
       │
       ├──► 调用 zhipuai.recognize(file, apiKey)
       │         │
       │    成功  ▼  失败
       │    store.updateReceiptData()
       │    写入 storeName/date/items/total
       │    status → 'success' / 'error'
       │
       ▼
  ReviewPanel 渲染
  左侧: ImageViewer 显示 previewUrl
  右侧: ReceiptTable 渲染可编辑表格
       │
  用户编辑单元格
       │
       ▼
  store.updateReceiptItem() / updateReceiptData()
  实时更新 Store
       │
  用户点击"导出 Excel"
       │
       ▼
  exporter.exportToExcel(receipts.filter(success))
  触发 .xlsx 文件下载
```

### 4.2 API Key 数据流

```
首次使用               后续使用
    │                     │
    ▼                     ▼
ApiKeyDialog          useApiKey.getKey()
用户输入 Key          读取 localStorage
    │                     │
    ▼                     ▼
localStorage.setItem  传入 zhipuai.recognize()
('apiKey', key)
```

---

## 5. 组件交互设计

### 5.1 页面布局结构

```
┌─────────────────────────────────────────────────────┐
│  Header: [Logo] [主题切换🌙] [API Key: ✅已设置]      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │            DropZone 上传区域                   │   │
│  │     拖拽文件到此处，或 点击选择文件              │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  缩略图队列: [img1✅] [img2⏳] [img3❌] [img4⏸]       │
│                                   [开始识别] [导出]   │
│                                                     │
│  ─────────────── 校对区域 ────────────────────────   │
│  ┌───────────────────┐  ┌──────────────────────┐   │
│  │                   │  │ 超市名: ___________   │   │
│  │   原始图片预览      │  │ 日  期: ___________   │   │
│  │                   │  │ ┌──┬──────┬──┬──┬──┐ │   │
│  │                   │  │ │#│名称  │价│量│计│ │   │
│  │                   │  │ ├──┼──────┼──┼──┼──┤ │   │
│  │                   │  │ │1│苹果  │3│2│6 │ │   │
│  └───────────────────┘  │ └──┴──────┴──┴──┴──┘ │   │
│                         │ 合计: 6.00            │   │
│                         └──────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 5.2 缩略图状态视觉规范

| 状态 | 图标 | 角标颜色 | 说明 |
|------|------|---------|------|
| `pending` | ⏸ | 灰色 | 等待识别 |
| `processing` | ⏳ | 蓝色旋转 | 识别中 |
| `success` | ✅ | 绿色 | 识别完成 |
| `error` | ❌ | 红色 | 识别失败（可点击重试） |

---

## 6. 关键技术决策

### 6.1 图片转 Base64 vs 直接上传 URL

**选择：Base64**
- 原因：纯前端应用无文件服务器，无法提供公网 URL
- 优化：上传前压缩至长边 ≤ 1920px，JPEG 质量 0.85，减少 Token 消耗

### 6.2 串行 vs 并行 API 调用

**选择：串行（队列）**
- 原因：智谱 AI 免费版 QPS 限制（通常 2-5 QPS），并行易触发 429 错误
- 实现：`useOcrQueue` Hook 监听 store，始终保证只有一个进行中的请求

### 6.3 全局状态 vs 局部状态

**选择：Zustand 全局状态管理小票数据**
- 原因：小票数据需在缩略图列表、校对面板、导出功能间共享
- 局部状态仅用于 UI 临时状态（如弹窗开关、输入框焦点）

### 6.4 Excel 生成时机

**选择：点击"导出"时按需生成**
- 原因：用户可能多次编辑后再导出，实时生成会增加不必要的计算
- 导出时过滤 `status === 'success'` 的小票，跳过失败项

---

## 7. 错误处理策略

| 错误场景 | 处理方式 | 用户提示 |
|---------|---------|---------|
| API Key 未设置 | 阻止识别，打开设置弹窗 | Toast: "请先设置 API Key" |
| 图片超出 5MB | 上传时拦截 | Toast: "图片过大，请压缩后重试" |
| API 返回 401 | 标记 error + 提示 | Toast: "API Key 无效，请重新设置" |
| API 返回 429 | 等待 2s 后自动重试（最多3次） | 缩略图显示"重试中..." |
| JSON 解析失败 | 标记 error，保留原始响应 | Toast: "识别结果解析失败，可手动输入" |
| 无 success 小票时导出 | 禁用导出按钮 | 按钮置灰 + Tooltip 提示 |

---

## 8. 部署架构（GitHub Actions）

```yaml
# .github/workflows/deploy.yml
触发条件: push to main
流程:
  1. Checkout 代码
  2. Setup Node.js 20
  3. npm ci
  4. npm run build  → dist/
  5. Deploy dist/ → gh-pages 分支
  6. GitHub Pages 自动从 gh-pages 分支发布
```

**Vite 配置注意：**
```typescript
// vite.config.ts
export default defineConfig({
  base: '/仓库名/',  // GitHub Pages 子路径部署必须配置
})
```

---

## 9. 后续迭代扩展点

| Phase | 功能 | 技术方案 |
|-------|------|---------|
| Phase 2 | 历史记录持久化 | IndexedDB（Dexie.js），存储 ReceiptData（去除 File 对象，保留 Base64） |
| Phase 3 | 消费统计图表 | Recharts，基于历史数据聚合月度/超市维度 |
| Phase 4 | 多模型支持 | 抽象 `OcrProvider` 接口，适配 OpenAI Vision / 百度 OCR 等 |
