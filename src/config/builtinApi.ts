import type { ApiKeySourceMode } from "../lib/storage";

/**
 * 站点默认智谱 API Key（会随前端静态资源公开）。
 * 也可在项目根 `.env` 设置 `VITE_ZHIPU_API_KEY` 覆盖下方默认值（构建时生效）。
 */
const HARDCODED_ZHIPU_API_KEY = "935f9fc804c643d8ac2ee2d78337b8d6.6CiU2hjdzD3QKcOL";

function envBuiltinKey(): string {
  const v = import.meta.env.VITE_ZHIPU_API_KEY;
  return typeof v === "string" ? v.trim() : "";
}

/** 站点内置 Key（未配置则为空字符串） */
export function getBuiltinZhipuApiKey(): string {
  return envBuiltinKey() || HARDCODED_ZHIPU_API_KEY.trim();
}

/**
 * 按用户选择的来源解析实际调用用的 Key。
 * - builtin：始终用站点内置（含环境变量覆盖）
 * - custom：仅用用户保存的 Key，为空则不可用
 */
export function resolveZhipuApiKey(mode: ApiKeySourceMode, userSavedKey: string): string {
  if (mode === "builtin") {
    return getBuiltinZhipuApiKey();
  }
  return userSavedKey.trim();
}
