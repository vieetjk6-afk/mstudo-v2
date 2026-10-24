"use client";

import { useState } from "react";
import { Check, Copy, FileText } from "lucide-react";
import { stripExtension } from "@/lib/drive";

/**
 * Hai nút "Chép mã ảnh" + "Tải .txt" cho một bộ ảnh bất kỳ (ảnh giao khách, ảnh
 * khách chia sẻ, ảnh chọn in…). Cùng định dạng với tab "Lượt chọn": tên file bỏ
 * đuôi, mỗi ảnh một dòng — dán thẳng vào ô lọc của Lightroom / công cụ Lọc ảnh.
 */
export default function PhotoCodeButtons({
  names, fileName, compact = false,
}: {
  /** Tên file gốc (còn đuôi) — nút tự bỏ đuôi. */
  names: string[];
  /** Tên file .txt tải về, không gồm đuôi. */
  fileName: string;
  /** Nút nhỏ hơn, dùng cạnh tiêu đề nhóm ảnh. */
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const text = names.map(stripExtension).join("\n");
  const cls = compact
    ? "flex items-center gap-1 rounded-[8px] px-2 py-1 text-[11.5px] font-semibold"
    : "flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold";
  const style = { border: "1px solid var(--bd)", background: "var(--sf)" };
  const icon = compact ? 13 : 15;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Trình duyệt chặn clipboard (http, iframe…) → vẫn cho chép tay.
      window.prompt("Chép danh sách mã ảnh:", text);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (names.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      <button type="button" onClick={copy} className={cls} style={style}>
        {copied ? <Check size={icon} /> : <Copy size={icon} />} {copied ? "Đã chép" : `Chép ${names.length} mã ảnh`}
      </button>
      <button type="button" onClick={download} className={cls} style={style}>
        <FileText size={icon} /> Tải .txt
      </button>
    </span>
  );
}
