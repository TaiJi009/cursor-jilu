import { Download, LoaderCircle, Play, Trash2, X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ApiKeyInput from "./components/ApiKeyInput";
import { getBuiltinZhipuApiKey, resolveZhipuApiKey } from "./config/builtinApi";
import ImageUploader from "./components/ImageUploader";
import ReceiptTable from "./components/ReceiptTable";
import ThemeToggle from "./components/ThemeToggle";
import { exportReceiptsToExcel, type ExportMode } from "./lib/exportExcel";
import { readApiKey, readTheme, type ThemeMode, writeApiKey, writeTheme } from "./lib/storage";
import { recognizeReceipt, testApiKey } from "./lib/zhipu";
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
  const [apiStatus, setApiStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string>("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [lightboxDragging, setLightboxDragging] = useState(false);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const lightboxDragOriginRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0 });
  const lightboxWasDraggingRef = useRef(false);
  const [exportMode, setExportMode] = useState<ExportMode>("separate");
  const queueRef = useRef(queue);

  const effectiveApiKey = useMemo(() => resolveZhipuApiKey(apiKey), [apiKey]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const closeLightbox = useCallback(() => {
    setLightboxUrl(null);
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
    setLightboxDragging(false);
  }, []);

  useLayoutEffect(() => {
    if (!lightboxDragging) return;
    const onMove = (e: PointerEvent) => {
      const o = lightboxDragOriginRef.current;
      setLightboxPan({
        x: o.panX + (e.clientX - o.startX),
        y: o.panY + (e.clientY - o.startY)
      });
    };
    const onUp = () => {
      setLightboxDragging(false);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [lightboxDragging]);

  /** 仅在一次拖动结束（true→false）时归零，避免误触其它时机 */
  useEffect(() => {
    if (!lightboxUrl) {
      lightboxWasDraggingRef.current = false;
      return;
    }
    if (lightboxWasDraggingRef.current && !lightboxDragging) {
      setLightboxPan({ x: 0, y: 0 });
    }
    lightboxWasDraggingRef.current = lightboxDragging;
  }, [lightboxUrl, lightboxDragging]);

  useEffect(() => {
    if (!lightboxUrl) return;
    const el = lightboxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setLightboxZoom((prev) => {
        const delta = e.deltaY > 0 ? -0.12 : 0.12;
        return Math.min(5, Math.max(0.2, prev + delta));
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [lightboxUrl]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    writeTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!effectiveApiKey.trim()) {
      setApiStatus("error");
      return;
    }
    setApiStatus("testing");
    testApiKey(effectiveApiKey).then((isValid) => {
      setApiStatus(isValid ? "success" : "error");
    });
  }, [effectiveApiKey]);

  useEffect(() => {
    return () => {
      queueRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

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
    const builtin = getBuiltinZhipuApiKey();
    if (value.trim()) {
      showToast("API Key 已保存到本地，将优先使用你的 Key。");
    } else if (builtin) {
      showToast("已清除自定义 Key，将使用站点默认 Key。");
    } else {
      showToast("已清除。当前未配置自定义 Key 与内置 Key。");
    }
  };

  const runRecognition = async () => {
    if (!effectiveApiKey.trim()) {
      showToast("未配置可用 API Key：请填写并保存你自己的 Key，或由站长配置内置 Key。");
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
        const result = await recognizeReceipt(entry.file, effectiveApiKey);
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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm" title={
              apiStatus === "success" ? "API 接入成功" :
              apiStatus === "testing" ? "API 接入中..." : "API 未接入或无效"
            }>
              <span className="text-gray-600 dark:text-gray-300">API 状态:</span>
              <div className="relative flex h-3 w-3 items-center justify-center">
                {apiStatus === "testing" && (
                  <>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500"></span>
                  </>
                )}
                {apiStatus === "success" && (
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
                )}
                {apiStatus === "error" && (
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                )}
              </div>
            </div>
            <ThemeToggle
              theme={theme}
              onToggle={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[1.1fr_1.3fr]">
        <section className="space-y-4">
          <ApiKeyInput initialValue={apiKey} builtinAvailable={!!getBuiltinZhipuApiKey()} onSave={saveApiKey} />
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
                      setLightboxZoom(1);
                      setLightboxPan({ x: 0, y: 0 });
                      setLightboxDragging(false);
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
                <div
                  className="group/preview relative cursor-zoom-in"
                  onClick={() => {
                    setLightboxZoom(1);
                    setLightboxPan({ x: 0, y: 0 });
                    setLightboxDragging(false);
                    setLightboxUrl(selected.previewUrl);
                  }}
                >
                  <img
                    src={selected.previewUrl}
                    alt={selected.file.name}
                    className="max-h-[320px] w-full rounded-xl object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 transition-colors group-hover/preview:bg-black/25">
                    <ZoomIn className="h-8 w-8 text-white opacity-0 drop-shadow transition-opacity group-hover/preview:opacity-100" />
                  </div>
                </div>
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
          ref={lightboxRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={closeLightbox}
          >
            <X className="h-5 w-5" />
          </button>

          {lightboxZoom !== 1 && (
            <div className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1 text-xs text-white backdrop-blur-sm">
              {Math.round(lightboxZoom * 100)}%
            </div>
          )}

          <div
            className={`flex max-h-[90vh] max-w-[90vw] select-none items-center justify-center ${lightboxDragging ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ touchAction: "none" }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              event.preventDefault();
              lightboxDragOriginRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                panX: lightboxPan.x,
                panY: lightboxPan.y
              };
              setLightboxDragging(true);
            }}
          >
            <div
              style={{
                transform: `translate(${lightboxPan.x}px, ${lightboxPan.y}px) scale(${lightboxZoom})`,
                transformOrigin: "center center",
                transition: lightboxDragging ? "none" : "transform 0.2s ease"
              }}
            >
              <img
                src={lightboxUrl}
                alt="图片预览"
                draggable={false}
                className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setLightboxZoom(1);
                  setLightboxPan({ x: 0, y: 0 });
                }}
              />
            </div>
          </div>

          <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/50">
            滚轮缩放 · 按住左键拖动 · 松手归中 · 双击重置缩放
          </p>
        </div>
      )}
    </div>
  );
}
