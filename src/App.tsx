import { useEffect, useState } from "react";
import ThemeToggle from "./components/ThemeToggle";
import PageB from "./pages/PageB";
import ReceiptOcrPage, { type ReceiptOcrNavApiStatus } from "./pages/ReceiptOcrPage";
import { readTheme, type ThemeMode, writeTheme } from "./lib/storage";

type AppTab = "a" | "b";

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => readTheme());
  const [activeTab, setActiveTab] = useState<AppTab>("a");
  const [ocrNavApiStatus, setOcrNavApiStatus] = useState<ReceiptOcrNavApiStatus>("idle");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    writeTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (activeTab !== "a") {
      setOcrNavApiStatus("idle");
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors duration-200 dark:bg-gray-900 dark:text-gray-100">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-800/90">
        <div className="mx-auto max-w-7xl px-3 sm:px-4">
          {/* 第一行：固定站点标题 + 右侧 API 状态、主题切换 */}
          <div className="flex items-start justify-between gap-3 py-3 sm:items-center sm:py-3.5">
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold text-gray-900 sm:text-lg dark:text-gray-100">超市小票识别助手</h1>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray-600 sm:text-xs dark:text-gray-400">
                上传图片 → AI 识别 → 校对 → 导出 Excel
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              <div
                className="flex items-center gap-1.5 text-xs sm:gap-2 sm:text-sm"
                title={
                  activeTab !== "a"
                    ? "当前不在识别页"
                    : ocrNavApiStatus === "success"
                      ? "API 接入成功"
                      : ocrNavApiStatus === "testing"
                        ? "API 接入中..."
                        : ocrNavApiStatus === "error"
                          ? "API 未接入或无效"
                          : "API 状态"
                }
              >
                <span className="text-gray-600 dark:text-gray-300">
                  <span className="sm:hidden">API</span>
                  <span className="hidden sm:inline">API 状态</span>
                  <span className="hidden sm:inline">:</span>
                </span>
                <div className="relative flex h-3 w-3 items-center justify-center">
                  {activeTab === "a" && ocrNavApiStatus === "testing" && (
                    <>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500"></span>
                    </>
                  )}
                  {activeTab === "a" && ocrNavApiStatus === "success" && (
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
                  )}
                  {activeTab === "a" && ocrNavApiStatus === "error" && (
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                  )}
                  {(activeTab !== "a" || ocrNavApiStatus === "idle") && (
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                  )}
                </div>
              </div>
              <ThemeToggle theme={theme} onToggle={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))} />
            </div>
          </div>

          {/* 第二行：主导航 A / B */}
          <div className="border-t border-gray-200/80 py-2.5 dark:border-gray-700/80">
            <nav
              className="flex w-fit items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700/50"
              aria-label="主导航"
            >
              <button
                type="button"
                onClick={() => setActiveTab("a")}
                aria-current={activeTab === "a" ? "page" : undefined}
                className={`touch-manipulation rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "a"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("b")}
                aria-current={activeTab === "b" ? "page" : undefined}
                className={`touch-manipulation rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "b"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                B
              </button>
            </nav>
          </div>
        </div>
      </header>

      {activeTab === "a" ? (
        <ReceiptOcrPage onApiStatusChange={setOcrNavApiStatus} />
      ) : (
        <PageB />
      )}
    </div>
  );
}
