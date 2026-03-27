import { KeyRound, Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { ApiKeySourceMode } from "../lib/storage";

interface ApiKeyInputProps {
  mode: ApiKeySourceMode;
  onModeChange: (mode: ApiKeySourceMode) => void;
  customKeyValue: string;
  onSaveCustomKey: (value: string) => void;
  /** 外层卡片额外 class（如栅格内等高 flex） */
  className?: string;
}

export default function ApiKeyInput({ mode, onModeChange, customKeyValue, onSaveCustomKey, className }: ApiKeyInputProps) {
  const [value, setValue] = useState(customKeyValue);

  useEffect(() => {
    setValue(customKeyValue);
  }, [customKeyValue]);

  return (
    <section className={`card flex min-h-0 flex-col ${className ?? ""}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-gray-800 dark:text-gray-200">
        <KeyRound className="h-4 w-4" />
        <h2 className="text-sm font-semibold">智谱 API Key</h2>
        {mode === "builtin" && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            站点默认 API
          </span>
        )}
        {mode === "custom" && (
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
            自定义 API
          </span>
        )}
      </div>

      <div className="mb-3 flex rounded-lg bg-gray-100 p-1 dark:bg-gray-700/50">
        <button
          type="button"
          onClick={() => onModeChange("builtin")}
          className={`min-h-11 flex-1 touch-manipulation rounded-md px-2 py-2.5 text-xs font-medium transition-colors sm:min-h-0 sm:py-2 ${
            mode === "builtin"
              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          使用站点默认 API
        </button>
        <button
          type="button"
          onClick={() => onModeChange("custom")}
          className={`min-h-11 flex-1 touch-manipulation rounded-md px-2 py-2.5 text-xs font-medium transition-colors sm:min-h-0 sm:py-2 ${
            mode === "custom"
              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          使用我自己的 Key
        </button>
      </div>

      {mode === "builtin" ? (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          将使用站点内置的智谱大模型 API Key，无需填写。若你有自己的 Key 或希望单独计费，可切换到「使用我自己的 Key」。
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
            仅使用你下方填写并保存的 Key（保存在本机 localStorage，不经由本站服务器）。切换回「站点默认」后不会删除已保存内容。
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="password"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="粘贴你的智谱 API Key"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-blue-300 transition focus:ring-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => onSaveCustomKey(value)}
              className="btn-primary justify-center whitespace-nowrap"
            >
              <Save className="h-4 w-4" />
              保存 Key
            </button>
          </div>
        </>
      )}
    </section>
  );
}
