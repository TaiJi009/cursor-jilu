import { useEffect, useState } from "react";
import ThemeToggle from "./components/ThemeToggle";
import PageB from "./pages/PageB";
import ReceiptOcrPage from "./pages/ReceiptOcrPage";
import { readTheme, type ThemeMode, writeTheme } from "./lib/storage";

type AppTab = "a" | "b";

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => readTheme());
  const [activeTab, setActiveTab] = useState<AppTab>("a");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    writeTheme(theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/95">
        <div className="mx-auto max-w-7xl px-3 sm:px-4">
          {/* 第一行：固定站点标题 + 右侧主题切换 */}
          <div className="flex items-start justify-between gap-3 py-3 sm:items-center sm:py-3.5">
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold text-gray-900 sm:text-lg dark:text-gray-100">超市小票识别助手</h1>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray-600 sm:text-xs dark:text-gray-400">
                上传图片 → AI 识别 → 校对 → 导出 Excel
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              <ThemeToggle theme={theme} onToggle={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))} />
            </div>
          </div>

          {/* 第二行：主导航 A / B */}
          <div className="border-t border-gray-200/80 py-2.5 dark:border-slate-700/80">
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
        <ReceiptOcrPage />
      ) : (
        <PageB />
      )}
    </div>
  );
}
