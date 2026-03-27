import { Download, LoaderCircle, Play, RefreshCw, Trash2, X, ZoomIn } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";
import { flushSync } from "react-dom";
import ApiKeyInput from "../components/ApiKeyInput";
import ImageUploader from "../components/ImageUploader";
import MergedReceiptTable from "../components/MergedReceiptTable";
import ReceiptTable from "../components/ReceiptTable";
import { resolveZhipuApiKey } from "../config/builtinApi";
import { exportReceiptsToExcel, type ExportMode } from "../lib/exportExcel";
import { receiptHasSubtotalTotalMismatch } from "../lib/receiptTotalCheck";
import type { LlmProviderId } from "../lib/llmProviders";
import { recognizeReceipt, testApiKey } from "../lib/receiptVisionLlm";
import {
  readApiKey,
  readApiKeySourceMode,
  readCustomLlmProvider,
  type ApiKeySourceMode,
  writeApiKey,
  writeApiKeySourceMode,
  writeCustomLlmProvider
} from "../lib/storage";
import type { QueueFile, Receipt } from "../types/receipt";

type ApiPageStatus = "idle" | "testing" | "success" | "error";

function newQueueFile(file: File): QueueFile {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    status: "pending"
  };
}

/** 同时进行的识别数上限，避免与智谱等平台并发/QPS 限制冲突导致大量 429 */
const RECOGNITION_CONCURRENCY = 3;

/** 队列中多张图片限并发识别，完成后各自更新 success / error */
async function recognizeEntriesInParallel(
  entries: QueueFile[],
  provider: LlmProviderId,
  apiKey: string,
  setQueue: Dispatch<SetStateAction<QueueFile[]>>
): Promise<void> {
  if (entries.length === 0) return;
  const idSet = new Set(entries.map((e) => e.id));
  setQueue((prev) =>
    prev.map((item) => (idSet.has(item.id) ? { ...item, status: "processing", errorMessage: undefined } : item))
  );

  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= entries.length) return;
      const entry = entries[i]!;
      try {
        const result = await recognizeReceipt(entry.file, provider, apiKey);
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
  };

  const pool = Math.min(RECOGNITION_CONCURRENCY, entries.length);
  await Promise.all(Array.from({ length: pool }, () => worker()));
}

export default function ReceiptOcrPage() {
  const [apiKey, setApiKey] = useState<string>(() => readApiKey());
  const [apiKeySourceMode, setApiKeySourceMode] = useState<ApiKeySourceMode>(() => readApiKeySourceMode());
  const [customLlmProvider, setCustomLlmProviderState] = useState<LlmProviderId>(() => readCustomLlmProvider());
  const [apiStatus, setApiStatus] = useState<ApiPageStatus>("idle");
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
  /** 队列已有图片时，本次待确认的新增文件 */
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[] | null>(null);
  const queueRef = useRef(queue);
  /** 大屏下与「原图预览」卡片等高：测量预览区高度后赋给子集 Z（API+上传 | 队列） */
  const previewCardRef = useRef<HTMLElement | null>(null);
  const [lgSubsetZHeightPx, setLgSubsetZHeightPx] = useState<number | null>(null);

  const effectiveApiKey = useMemo(
    () => resolveZhipuApiKey(apiKeySourceMode, apiKey),
    [apiKeySourceMode, apiKey]
  );

  /** 站点默认固定走智谱；自有 Key 时由用户选择服务商 */
  const effectiveLlmProvider = useMemo<LlmProviderId>(
    () => (apiKeySourceMode === "builtin" ? "zhipu" : customLlmProvider),
    [apiKeySourceMode, customLlmProvider]
  );

  const setCustomLlmProvider = useCallback((id: LlmProviderId) => {
    writeCustomLlmProvider(id);
    setCustomLlmProviderState(id);
  }, []);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useLayoutEffect(() => {
    const el = previewCardRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const mq = window.matchMedia("(min-width: 1024px)");

    const apply = () => {
      if (!mq.matches) {
        setLgSubsetZHeightPx(null);
        return;
      }
      const h = el.getBoundingClientRect().height;
      if (h > 0) setLgSubsetZHeightPx(Math.round(h * 10) / 10);
    };

    const ro = new ResizeObserver(apply);
    ro.observe(el);
    mq.addEventListener("change", apply);
    apply();

    return () => {
      ro.disconnect();
      mq.removeEventListener("change", apply);
    };
  }, []);

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
    if (!lightboxUrl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lightboxUrl, closeLightbox]);

  useEffect(() => {
    if (!effectiveApiKey.trim()) {
      setApiStatus("error");
      return;
    }
    setApiStatus("testing");
    testApiKey(effectiveLlmProvider, effectiveApiKey).then((isValid) => {
      setApiStatus(isValid ? "success" : "error");
    });
  }, [effectiveApiKey, effectiveLlmProvider]);

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

  const hasAnySuccessResult = useMemo(
    () => queue.some((q) => q.status === "success" && q.result),
    [queue]
  );

  const showMergedEditor = exportMode === "merged" && hasAnySuccessResult;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const commitAddFiles = useCallback((files: File[]) => {
    const newItems = files.map(newQueueFile);
    flushSync(() => {
      setQueue((prev) => {
        const next = [...prev, ...newItems];
        setSelectedId((cur) => (cur ? cur : next[0]?.id ?? null));
        return next;
      });
    });
    return newItems;
  }, []);

  const handleRequestAddFiles = (files: File[]) => {
    if (!files.length) return;
    if (queue.length === 0) {
      commitAddFiles(files);
      return;
    }
    /** 尚未进行任何识别（全部为等待中）时，直接追加，不问是否只识别新增 */
    if (queue.every((q) => q.status === "pending")) {
      commitAddFiles(files);
      return;
    }
    setPendingUploadFiles(files);
  };

  const dismissUploadDialog = useCallback(() => setPendingUploadFiles(null), []);

  useEffect(() => {
    if (!pendingUploadFiles) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissUploadDialog();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pendingUploadFiles, dismissUploadDialog]);

  const runRecognitionForNewEntries = async (entries: QueueFile[]) => {
    if (!effectiveApiKey.trim()) {
      showToast(
        apiKeySourceMode === "custom"
          ? "当前为自定义 API：请选择服务商并填写、保存 API Key。"
          : "站点默认 API 不可用，请联系管理员。"
      );
      return;
    }
    if (entries.length === 0) return;

    setIsRecognizing(true);
    try {
      await recognizeEntriesInParallel(entries, effectiveLlmProvider, effectiveApiKey, setQueue);
      showToast("新增图片识别已结束。");
    } finally {
      setIsRecognizing(false);
    }
  };

  const confirmUploadAddOnly = () => {
    if (!pendingUploadFiles) return;
    commitAddFiles(pendingUploadFiles);
    dismissUploadDialog();
  };

  const confirmUploadAndRecognize = () => {
    if (!pendingUploadFiles) return;
    const newItems = commitAddFiles(pendingUploadFiles);
    dismissUploadDialog();
    void runRecognitionForNewEntries(newItems);
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

  const removeAllFiles = useCallback(() => {
    setQueue((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setSelectedId(null);
  }, []);

  const updateReceipt = (id: string, receipt: Receipt) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, result: receipt } : item)));
  };

  const saveApiKey = (value: string) => {
    writeApiKey(value);
    setApiKey(value.trim());
    if (value.trim()) {
      showToast("自定义 API Key 已保存到本机。");
    } else {
      showToast("已清空。在「使用我自己的 Key」模式下需填写并保存后才能识别。");
    }
  };

  const setApiKeySource = (mode: ApiKeySourceMode) => {
    writeApiKeySourceMode(mode);
    setApiKeySourceMode(mode);
    showToast(
      mode === "builtin" ? "已切换为站点默认 API（智谱）。" : "已切换为自有 Key：请选择服务商并填写、保存 API Key。"
    );
  };

  const runRecognition = async () => {
    if (!effectiveApiKey.trim()) {
      showToast(
        apiKeySourceMode === "custom"
          ? "当前为自定义 API：请选择服务商并填写、保存 API Key。"
          : "站点默认 API 不可用，请联系管理员。"
      );
      return;
    }
    if (queue.length === 0) {
      showToast("请先上传小票图片。");
      return;
    }

    setIsRecognizing(true);
    try {
      await recognizeEntriesInParallel(queue, effectiveLlmProvider, effectiveApiKey, setQueue);
      showToast("批量识别已结束。");
    } finally {
      setIsRecognizing(false);
    }
  };

  const reRecognizeOne = async (id: string) => {
    if (!effectiveApiKey.trim()) {
      showToast(
        apiKeySourceMode === "custom"
          ? "当前为自定义 API：请选择服务商并填写、保存 API Key。"
          : "站点默认 API 不可用，请联系管理员。"
      );
      return;
    }
    const entry = queueRef.current.find((item) => item.id === id);
    if (!entry || entry.status === "processing") return;

    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "processing", errorMessage: undefined } : item))
    );
    try {
      const result = await recognizeReceipt(entry.file, effectiveLlmProvider, effectiveApiKey);
      setQueue((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "success", result, errorMessage: undefined } : item
        )
      );
      showToast("已重新识别该图片。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "识别失败";
      setQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "error", errorMessage: message } : item))
      );
    }
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
    <>
      {pendingUploadFiles && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-dialog-title"
          onClick={(e) => e.target === e.currentTarget && dismissUploadDialog()}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-600 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="upload-dialog-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              新增图片
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              队列中已有图片。是否仅对本次新增的{" "}
              <strong className="text-gray-900 dark:text-gray-100">{pendingUploadFiles.length}</strong>{" "}
              张一次性识别？已识别过的图片不会再次识别。
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary w-full justify-center sm:w-auto" onClick={dismissUploadDialog}>
                取消
              </button>
              <button type="button" className="btn-secondary w-full justify-center sm:w-auto" onClick={confirmUploadAddOnly}>
                仅添加
              </button>
              <button
                type="button"
                className="btn-primary w-full justify-center sm:w-auto"
                disabled={isRecognizing}
                onClick={confirmUploadAndRecognize}
              >
                {isRecognizing ? "识别进行中…" : "识别新增"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-5">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[minmax(260px,360px)_1fr] lg:items-start lg:gap-6">
          {/* 左侧（大屏）：原图预览；移动端顺序在工具区之后 */}
          <aside className="order-2 lg:order-1 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-4 lg:self-start">
            <section ref={previewCardRef} className="card flex flex-col p-3 sm:p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">原图预览</h2>
              {!selected ? (
                <div className="flex min-h-[300px] flex-1 items-center justify-center rounded-xl bg-gray-50 px-3 text-center text-xs text-gray-500 dark:bg-gray-900/40 dark:text-gray-400 sm:min-h-[360px] sm:text-sm">
                  上传图片后在此查看大图；点击可全屏预览。
                </div>
              ) : (
                <div
                  className="group/preview relative flex-1 cursor-zoom-in touch-manipulation overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-900/40"
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
                    className="max-h-[min(105vh,42rem)] w-full object-contain sm:max-h-[min(112.5vh,48rem)]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover/preview:bg-black/25 md:bg-black/0 md:group-hover/preview:bg-black/25">
                    <ZoomIn className="h-7 w-7 text-white opacity-70 drop-shadow transition-opacity sm:h-8 sm:w-8 md:opacity-0 md:group-hover/preview:opacity-100" />
                  </div>
                </div>
              )}
            </section>
          </aside>

          {/* 右侧上：子集 Z = 子集 A（API Key 上 + 上传下）| 子集 B（待识别队列） */}
          <section
            className="order-1 lg:order-2 lg:col-start-2 lg:row-start-1 lg:min-h-0"
            style={
              lgSubsetZHeightPx != null
                ? { height: lgSubsetZHeightPx, minHeight: lgSubsetZHeightPx }
                : undefined
            }
          >
            <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,360px)_minmax(0,1fr)] lg:items-stretch lg:gap-4">
              {/* 子集 A：大屏高度与预览一致，内部自上而下排列；内容过高时左侧整体滚动 */}
              <div
                className={`flex min-h-0 min-w-0 flex-col gap-4 lg:h-full ${
                  lgSubsetZHeightPx != null ? "scrollbar-hide lg:overflow-x-hidden lg:overflow-y-auto" : ""
                }`}
              >
                <ApiKeyInput
                  mode={apiKeySourceMode}
                  onModeChange={setApiKeySource}
                  customProvider={customLlmProvider}
                  onCustomProviderChange={setCustomLlmProvider}
                  customKeyValue={apiKey}
                  onSaveCustomKey={saveApiKey}
                  apiConnectionStatus={apiStatus}
                  className="shrink-0"
                />
                <ImageUploader onAddFiles={handleRequestAddFiles} className="min-h-0 flex-1" />
              </div>
              {/* 子集 B：与左侧同列等高（网格拉伸），随左侧总高度自适应 */}
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:h-full lg:w-full">
                <section className="card flex min-h-[min(14rem,40vh)] w-full min-w-0 flex-col overflow-hidden lg:min-h-0 lg:h-full">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">待识别队列</h2>
                <button
                  type="button"
                  className="touch-manipulation rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-slate-600/60 dark:hover:text-red-400"
                  title="清空全部图片"
                  aria-label="清空全部图片"
                  disabled={queue.length === 0 || isRecognizing}
                  onClick={removeAllFiles}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                已完成 {completedCount}/{queue.length}
              </span>
            </div>
            <div className="scrollbar-hide flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-x-hidden overflow-y-auto">
              {queue.length === 0 && (
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
                  还没有上传图片
                </p>
              )}
              {queue.length > 0 && (
                <div className="min-w-0 divide-y divide-slate-200 dark:divide-slate-600/50">
              {queue.map((item) => {
                const isSelected = selected?.id === item.id;
                const subtotalMismatch =
                  item.status === "success" &&
                  item.result != null &&
                  receiptHasSubtotalTotalMismatch(item.result);
                const rowTone = subtotalMismatch
                  ? isSelected
                    ? "border-2 border-red-500 bg-red-50 shadow-sm dark:border-red-400 dark:bg-red-950/40"
                    : "border-2 border-red-400/90 bg-red-50/80 hover:bg-red-50 dark:border-red-500/85 dark:bg-red-950/30 dark:hover:bg-red-950/45"
                  : isSelected
                    ? "border-2 border-transparent bg-blue-50/90 dark:bg-blue-950/35"
                    : "border-2 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/35";
                return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  title={
                    subtotalMismatch
                      ? "各行「小计」之和与「合计」不一致，请核对是否识别误差（如数字模糊）"
                      : undefined
                  }
                  aria-invalid={subtotalMismatch || undefined}
                  className={`group flex w-full min-w-0 max-w-full items-center gap-2 rounded-lg py-2.5 pl-0.5 pr-1 text-left transition-colors sm:gap-3 ${rowTone}`}
                >
                  <div
                    className="group/thumb relative h-14 w-14 shrink-0 cursor-zoom-in touch-manipulation"
                    onClick={(event) => {
                      event.stopPropagation();
                      setLightboxZoom(1);
                      setLightboxPan({ x: 0, y: 0 });
                      setLightboxDragging(false);
                      setLightboxUrl(item.previewUrl);
                    }}
                  >
                    <img src={item.previewUrl} alt={item.file.name} className="h-14 w-14 rounded-lg object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/15 transition-colors group-hover/thumb:bg-black/30 md:bg-black/0 md:group-hover/thumb:bg-black/30">
                      <ZoomIn className="h-5 w-5 text-white opacity-80 drop-shadow transition-opacity md:opacity-0 md:group-hover/thumb:opacity-100" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="truncate text-sm text-slate-800 dark:text-slate-100" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <p
                      className={`truncate text-xs ${
                        subtotalMismatch
                          ? "font-medium text-red-600 dark:text-red-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {item.status === "pending" && "等待中"}
                      {item.status === "processing" && "识别中..."}
                      {item.status === "success" && (subtotalMismatch ? "已完成 · 小计≠合计" : "已完成")}
                      {item.status === "error" && "失败"}
                    </p>
                    {item.errorMessage && <p className="truncate text-xs text-red-500">{item.errorMessage}</p>}
                  </div>
                  <span className="ml-auto flex shrink-0 items-center gap-0.5 self-center">
                    {item.status === "processing" ? (
                      <span className="rounded-full p-1.5">
                        <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" />
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="touch-manipulation rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-600/60 dark:hover:text-blue-400"
                          title="重新识别此图"
                          aria-label="重新识别此图"
                          onClick={(event) => {
                            event.stopPropagation();
                            void reRecognizeOne(item.id);
                          }}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="touch-manipulation rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-600/60"
                          title="移除"
                          aria-label="移除"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeFile(item.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </span>
                </button>
              );
              })}
                </div>
              )}
            </div>
            {queue.some((item) => item.status === "success") && (
              <div className="mt-3 flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-700/70">
                <button
                  type="button"
                  onClick={() => setExportMode("separate")}
                  className={`min-h-10 flex-1 touch-manipulation rounded-md px-2 py-2 text-xs font-medium transition-colors sm:min-h-0 sm:py-1 ${
                    exportMode === "separate"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  分 Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setExportMode("merged")}
                  className={`min-h-10 flex-1 touch-manipulation rounded-md px-2 py-2 text-xs font-medium transition-colors sm:min-h-0 sm:py-1 ${
                    exportMode === "merged"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  合并汇总
                </button>
              </div>
            )}
            <div className="mt-3 flex shrink-0 gap-2.5">
              <button
                type="button"
                className="btn-primary min-h-11 flex-[1.65] justify-center px-3 sm:min-h-0"
                onClick={runRecognition}
                disabled={isRecognizing || queue.length === 0}
              >
                {isRecognizing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                开始识别
              </button>
              <button
                type="button"
                className="btn-secondary min-h-11 flex-1 justify-center px-3 sm:min-h-0"
                onClick={exportExcel}
                disabled={queue.every((item) => item.status !== "success")}
              >
                <Download className="h-4 w-4" />
                导出 Excel
              </button>
            </div>
                </section>
              </div>
            </div>
          </section>

          {/* 右侧下：校对与编辑（无结果时为占位） */}
          <section className="order-3 min-w-0 lg:order-2 lg:col-start-2 lg:row-start-2">
            {showMergedEditor ? (
              <MergedReceiptTable queue={queue} onUpdateReceipt={updateReceipt} />
            ) : !selected?.result ? (
              <div className="card flex min-h-[min(42vh,16rem)] items-center justify-center px-3 text-center text-xs text-gray-500 sm:min-h-[280px] sm:text-sm dark:text-gray-400">
                上传并识别后，这里会显示可编辑的结构化结果。
              </div>
            ) : (
              <ReceiptTable receipt={selected.result} onChange={(next) => updateReceipt(selected.id, next)} />
            )}
          </section>
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-50 rounded-xl bg-gray-900 px-4 py-3 text-center text-sm text-white shadow-lg sm:left-1/2 sm:right-auto sm:w-auto sm:max-w-lg sm:-translate-x-1/2 sm:px-5 sm:py-2.5 dark:bg-gray-100 dark:text-gray-900">
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
            className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] min-h-11 min-w-11 touch-manipulation rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
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

          <p className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 max-w-[90vw] -translate-x-1/2 px-2 text-center text-[10px] text-white/50 sm:text-xs">
            <span className="hidden sm:inline">滚轮缩放 · </span>
            拖动平移 · 松手归中 · 双击重置 · Esc 关闭
          </p>
        </div>
      )}
    </>
  );
}
