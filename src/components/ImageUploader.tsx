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
    <section className={`card flex min-h-0 flex-col ${className ?? ""}`}>
      <div
        className={`flex min-h-[11rem] flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-colors sm:min-h-[12rem] sm:rounded-2xl sm:p-6 ${
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
            : "border-gray-300 hover:border-blue-400 dark:border-gray-600"
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
        <ImagePlus className="mx-auto mb-2 h-8 w-8 text-blue-600 sm:mb-3 sm:h-10 sm:w-10 dark:text-blue-400" />
        <p className="text-sm font-semibold text-gray-800 sm:text-base dark:text-gray-100">上传小票图片</p>
        <p className="mt-1.5 text-xs text-gray-600 sm:mt-2 sm:text-sm dark:text-gray-400">
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
