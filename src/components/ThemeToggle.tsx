import { Moon, Sun } from "lucide-react";
import type { ThemeMode } from "../lib/storage";

interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button type="button" className="btn-secondary shrink-0" onClick={onToggle} aria-label="切换主题">
      {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      <span className="hidden sm:inline">{theme === "dark" ? "日间模式" : "夜间模式"}</span>
    </button>
  );
}
