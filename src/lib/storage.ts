const API_KEY_STORAGE = "zhipu_api_key";
const API_KEY_SOURCE_STORAGE = "zhipu_api_key_source";
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
