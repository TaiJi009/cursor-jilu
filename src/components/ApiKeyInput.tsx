import { KeyRound, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { isLlmProviderId, LLM_PROVIDER_OPTIONS, type LlmProviderId } from "../lib/llmProviders";
import type { ApiKeySourceMode } from "../lib/storage";

export type ApiConnectionStatus = "idle" | "testing" | "success" | "error";

function ApiConnectionIndicator({ status }: { status: ApiConnectionStatus }) {
  const title =
    status === "success"
      ? "API 接入成功"
      : status === "testing"
        ? "API 接入中..."
        : status === "error"
          ? "API 未接入或无效"
          : "API 状态";

  return (
    <div
      className="flex shrink-0 items-center gap-1.5 text-xs sm:text-sm"
      title={title}
      aria-label={title}
    >
      <span className="text-slate-600 dark:text-slate-400">
        <span className="sm:hidden">API</span>
        <span className="hidden sm:inline">API 状态</span>
        <span className="hidden sm:inline">:</span>
      </span>
      <div className="relative flex h-3 w-3 items-center justify-center">
        {status === "testing" && (
          <>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500"></span>
          </>
        )}
        {status === "success" && (
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
        )}
        {status === "error" && (
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
        )}
        {status === "idle" && (
          <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
        )}
      </div>
    </div>
  );
}

interface ApiKeyInputProps {
  mode: ApiKeySourceMode;
  onModeChange: (mode: ApiKeySourceMode) => void;
  customProvider: LlmProviderId;
  onCustomProviderChange: (id: LlmProviderId) => void;
  customKeyValue: string;
  onSaveCustomKey: (value: string) => void;
  /** 智谱 / 大模型 API 连通性检测状态，展示在标题行右侧 */
  apiConnectionStatus: ApiConnectionStatus;
  /** 外层卡片额外 class（如栅格内等高 flex） */
  className?: string;
}

export default function ApiKeyInput({
  mode,
  onModeChange,
  customProvider,
  onCustomProviderChange,
  customKeyValue,
  onSaveCustomKey,
  apiConnectionStatus,
  className
}: ApiKeyInputProps) {
  const [value, setValue] = useState(customKeyValue);

  useEffect(() => {
    setValue(customKeyValue);
  }, [customKeyValue]);

  const currentHint = LLM_PROVIDER_OPTIONS.find((o) => o.id === customProvider)?.hint ?? "";

  return (
    <section className={`card flex min-h-0 flex-col ${className ?? ""}`}>
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-slate-800 dark:text-slate-100">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <KeyRound className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />
          <h2 className="text-sm font-semibold tracking-tight">智谱 API Key</h2>
          {mode === "builtin" && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              站点默认
            </span>
          )}
          {mode === "custom" && (
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
              自有 Key
            </span>
          )}
        </div>
        <ApiConnectionIndicator status={apiConnectionStatus} />
      </div>

      <div className="mb-3 flex rounded-lg bg-gray-100 p-1 dark:bg-slate-700/70">
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
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          将使用站点内置的智谱大模型 Key，无需填写。若你有自己的 Key 或希望单独计费，可切换到「使用我自己的 Key」并选择服务商。
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            选择下方服务商，在输入框内粘贴对应平台的 API Key（保存在本机 localStorage，不经由本站服务器）。切换回「站点默认」后不会删除已保存内容。
          </p>

          <label className="mb-2 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">服务商</span>
            <select
              value={customProvider}
              onChange={(e) => {
                const v = e.target.value;
                if (isLlmProviderId(v)) onCustomProviderChange(v);
              }}
              className="min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-blue-300 transition focus:ring-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {LLM_PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </label>
          {currentHint && (
            <p className="mb-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{currentHint}</p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="password"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="粘贴 API Key"
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
