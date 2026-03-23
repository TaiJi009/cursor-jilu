import { Download, LoaderCircle, Play, Trash2, X, ZoomIn } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ApiKeyInput from "./components/ApiKeyInput";
import ImageUploader from "./components/ImageUploader";
import ReceiptTable from "./components/ReceiptTable";
import ThemeToggle from "./components/ThemeToggle";
import { exportReceiptsToExcel, type ExportMode } from "./lib/exportExcel";
import { readApiKey, readTheme, type ThemeMode, writeApiKey, writeTheme } from "./lib/storage";
import { recognizeReceipt } from "./lib/zhipu";
import type { QueueFile, Receipt } from "./types/receipt";

function newQueueFile(file: File): QueueFile {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    status: "pending"
  };
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => readTheme());
  const [apiKey, setApiKey] = useState<string>(() => readApiKey());
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string>("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<ExportMode>("separate");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    writeTheme(theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      queue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [queue]);

  const selected = useMemo(
    () => queue.find((item) => item.id === selectedId) ?? queue[0] ?? null,
    [queue, selectedId]
  );

  const completedCount = queue.filter((item) => item.status === "success").length;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const addFiles = (files: File[]) => {
    setQueue((prev) => {
      const next = [...prev, ...files.map(newQueueFile)];
      if (!selectedId && next[0]) setSelectedId(next[0].id);
      return next;
    });
  };

  const removeFile = (id: string) => {
    setQueue((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((item) => item.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  };

  const updateReceipt = (id: string, receipt: Receipt) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, result: receipt } : item)));
  };

  const saveApiKey = (value: string) => {
    writeApiKey(value);
    setApiKey(value.trim());
    showToast("API Key 已保存到本地。");
  };

  const runRecognition = async () => {
    if (!apiKey.trim()) {
      showToast("请先输入并保存 API Key。");
      return;
    }
    if (queue.length === 0) {
      showToast("请先上传小票图片。");
      return;
    }

    setIsRecognizing(true);
    for (const entry of queue) {
      if (entry.status === "success") continue;
      setQueue((prev) => prev.map((item) => (item.id === entry.id ? { ...item, status: "processing", errorMessage: undefined } : item)));
      try {
        const result = await recognizeReceipt(entry.file, apiKey);
        setQueue((prev) =>
          prev.map((item) =>
            item.id === entry.id ? { ...item, status: "success", result, errorMessage: undefined } : item
          )
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "识别失败";
        setQueue((prev) =>
          prev.map((item) => (item.id === entry.id ? { ...item, status: "error", errorMessage: message } : item))
        );
      }
    }
    setIsRecognizing(false);
    showToast("批量识别已结束。");
  };

  const exportExcel = () => {
    try {
      exportReceiptsToExcel(queue, exportMode);
      showToast(`Excel 导出成功（${exportMode === "merged" ? "合并汇总" : "分 Sheet"}模式）。`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "导出失败。");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors duration-200 dark:bg-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-800/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">超市小票识别助手</h1>
            <p className="text-xs text-gray-600 dark:text-gray-400">上传图片 -&gt; AI 识别 -&gt; 校对 -&gt; 导出 Excel</p>
          </div>
          <ThemeToggle
            theme={theme}
            onToggle={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
          />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[1.1fr_1.3fr]">
        <section className="space-y-4">
          <ApiKeyInput initialValue={apiKey} onSave={saveApiKey} />
          <ImageUploader onAddFiles={addFiles} />

          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">待识别队列</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                已完成 {completedCount}/{queue.length}
              </span>
            </div>
            <div className="grid max-h-80 gap-2 overflow-auto pr-1">
              {queue.length === 0 && (
                <p className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:bg-gray-700/40 dark:text-gray-300">
                  还没有上传图片
                </p>
              )}
              {queue.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`group flex items-center gap-3 rounded-xl border p-2 text-left transition-colors ${
                    selected?.id === item.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                      : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40"
                  }`}
                >
                  <div
                    className="group/thumb relative h-14 w-14 shrink-0 cursor-zoom-in"
                    onClick={(event) => {
                      event.stopPropagation();
                      setLightboxUrl(item.previewUrl);
                    }}
                  >
                    <img src={item.previewUrl} alt={item.file.name} className="h-14 w-14 rounded-lg object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 transition-colors group-hover/thumb:bg-black/30">
                      <ZoomIn className="h-5 w-5 text-white opacity-0 drop-shadow transition-opacity group-hover/thumb:opacity-100" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{item.file.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.status === "pending" && "等待中"}
                      {item.status === "processing" && "识别中..."}
                      {item.status === "success" && "已完成"}
                      {item.status === "error" && "失败"}
                    </p>
                    {item.errorMessage && <p className="truncate text-xs text-red-500">{item.errorMessage}</p>}
                  </div>
                  <span className="rounded-full px-2 py-1 text-xs">
                    {item.status === "processing" ? (
                      <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" />
                    ) : (
                      <Trash2
                        className="h-4 w-4 text-gray-400 transition group-hover:text-red-500"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeFile(item.id);
                        }}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
            {queue.some((item) => item.status === "success") && (
              <div className="mt-3 flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700/50">
                <button
                  type="button"
                  onClick={() => setExportMode("separate")}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    exportMode === "separate"
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  分 Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setExportMode("merged")}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    exportMode === "merged"
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  合并汇总
                </button>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn-primary flex-1 justify-center"
                onClick={runRecognition}
                disabled={isRecognizing || queue.length === 0}
              >
                {isRecognizing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                开始识别
              </button>
              <button
                type="button"
                className="btn-secondary flex-1 justify-center"
                onClick={exportExcel}
                disabled={queue.every((item) => item.status !== "success")}
              >
                <Download className="h-4 w-4" />
                导出 Excel
              </button>
            </div>
          </section>
        </section>

        <section>
          {!selected?.result ? (
            <div className="card flex min-h-[420px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              上传并识别后，这里会显示可编辑的结构化结果。
            </div>
          ) : (
            <div className="space-y-4">
              <section className="card">
                <h2 className="mb-2 text-sm font-semibold">原图预览</h2>
                <img
                  src={selected.previewUrl}
                  alt={selected.file.name}
                  className="max-h-[320px] w-full rounded-xl object-contain"
                />
              </section>
              <ReceiptTable receipt={selected.result} onChange={(next) => updateReceipt(selected.id, next)} />
            </div>
          )}
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900">
          {toast}
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="图片预览"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
