import { KeyRound, Save } from "lucide-react";
import { useState } from "react";

interface ApiKeyInputProps {
  initialValue: string;
  /** 是否已配置站点内置 Key（未填写时访客仍可使用） */
  builtinAvailable: boolean;
  onSave: (value: string) => void;
}

export default function ApiKeyInput({ initialValue, builtinAvailable, onSave }: ApiKeyInputProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-gray-800 dark:text-gray-200">
        <KeyRound className="h-4 w-4" />
        <h2 className="text-sm font-semibold">智谱 API Key</h2>
        {builtinAvailable && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            已启用站点默认
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
        访客可直接使用站点内置 Key 调用识别；若填写并保存自己的 Key，将<strong className="text-gray-800 dark:text-gray-200">优先使用你的 Key</strong>
        （仅保存在本机 localStorage，不会经过本站服务器）。留空保存可恢复使用站点默认。
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="输入你的 API Key"
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-blue-300 transition focus:ring-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={() => onSave(value)}
          className="btn-primary justify-center whitespace-nowrap"
        >
          <Save className="h-4 w-4" />
          保存 Key
        </button>
      </div>
    </section>
  );
}
