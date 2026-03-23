/**
 * 站点内置智谱 API Key（会随前端静态资源公开，请使用额度可控、可随时在控制台吊销的 Key）。
 *
 * 配置方式（二选一，用户自定义 Key 始终优先）：
 * 1. 在下方常量中填写（构建后写入 JS，所有人可见）
 * 2. 在项目根目录 `.env` 中设置 `VITE_ZHIPU_API_KEY=你的key`（推荐，避免把密钥提交到 Git）
 */
const HARDCODED_ZHIPU_API_KEY = "";

function envBuiltinKey(): string {
  const v = import.meta.env.VITE_ZHIPU_API_KEY;
  return typeof v === "string" ? v.trim() : "";
}

/** 站点内置 Key（未配置则为空字符串） */
export function getBuiltinZhipuApiKey(): string {
  return envBuiltinKey() || HARDCODED_ZHIPU_API_KEY.trim();
}

/**
 * 实际调用智谱接口时使用的 Key：用户保存在 localStorage 中的 Key 优先，否则使用内置 Key。
 */
export function resolveZhipuApiKey(userSavedKey: string): string {
  const user = userSavedKey.trim();
  if (user) return user;
  return getBuiltinZhipuApiKey();
}
