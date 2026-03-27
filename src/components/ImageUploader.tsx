import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";

interface ImageUploaderProps {
  onAddFiles: (files: File[]) => void;
  className?: string;
}

const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ImageUploader({ onAddFiles, className }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const pickFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const filtered = Array.from(files).filter((file) => SUPPORTED_TYPES.includes(file.type));
    if (filtered.length) onAddFiles(filtered);
  };

  return (
    <section
      className={`card flex h-full min-h-0 min-w-0 flex-col overflow-hidden !p-3 sm:!p-4 ${className ?? ""}`}
    >
      <div
        className={`flex min-h-0 w-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed px-2 py-3 text-center transition-colors sm:gap-1.5 sm:rounded-2xl sm:px-3 sm:py-4 ${
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/25"
            : "border-slate-300 hover:border-blue-400 dark:border-slate-500 dark:hover:border-blue-500/80"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          pickFiles(event.dataTransfer.files);
        }}
      >
        <ImagePlus className="h-7 w-7 shrink-0 text-blue-600 sm:h-9 sm:w-9 dark:text-blue-400" />
        <p className="min-w-0 shrink px-1 text-sm font-semibold text-slate-800 sm:text-base dark:text-slate-100">
          上传小票图片
        </p>
        <p className="min-w-0 max-w-[18rem] shrink px-1 text-[11px] leading-snug text-slate-600 sm:text-xs sm:text-sm dark:text-slate-400">
          点击选择；电脑可拖拽多张（JPG / PNG / WEBP）
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(event) => pickFiles(event.target.files)}
      />
    </section>
  );
}
