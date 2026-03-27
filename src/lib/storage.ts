import type { LlmProviderId } from "./llmProviders";
import { DEFAULT_LLM_PROVIDER, isLlmProviderId } from "./llmProviders";

const API_KEY_STORAGE = "zhipu_api_key";
const API_KEY_SOURCE_STORAGE = "zhipu_api_key_source";
const CUSTOM_LLM_PROVIDER_STORAGE = "custom_llm_provider";
const THEME_STORAGE = "ui_theme";

export type ThemeMode = "light" | "dark";

/** builtin：站点内置 Key；custom：仅使用用户保存的 Key */
export type ApiKeySourceMode = "builtin" | "custom";

export function readApiKeySourceMode(): ApiKeySourceMode {
  const v = localStorage.getItem(API_KEY_SOURCE_STORAGE);
  if (v === "custom") return "custom";
  return "builtin";
}

export function writeApiKeySourceMode(mode: ApiKeySourceMode): void {
  localStorage.setItem(API_KEY_SOURCE_STORAGE, mode);
}

export function readApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) ?? "";
}

export function writeApiKey(value: string): void {
  localStorage.setItem(API_KEY_STORAGE, value.trim());
}

/** 自定义 Key 模式下选择的服务商（站点默认不读此项，逻辑上等价智谱） */
export function readCustomLlmProvider(): LlmProviderId {
  const v = localStorage.getItem(CUSTOM_LLM_PROVIDER_STORAGE);
  if (v && isLlmProviderId(v)) return v;
  return DEFAULT_LLM_PROVIDER;
}

export function writeCustomLlmProvider(id: LlmProviderId): void {
  localStorage.setItem(CUSTOM_LLM_PROVIDER_STORAGE, id);
}

export function readTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_STORAGE);
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function writeTheme(value: ThemeMode): void {
  localStorage.setItem(THEME_STORAGE, value);
}
