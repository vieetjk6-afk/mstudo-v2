"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { WISHES } from "@/lib/collage/captions";
import { Sheet } from "./ui";

/* Thư viện lời chúc để chèn vào ảnh (bước Tuỳ chọn, tab Chữ) + danh sách
   caption gợi ý có nút "Sao chép" (bảng Tải ảnh) — lib/collage/captions.ts. */

export function WishesSheet({ title = "Thư viện lời chúc", onPick, onClose }: { title?: string; onPick: (line: string) => void; onClose: () => void }) {
  const [group, setGroup] = useState(WISHES[0].id);
  const g = WISHES.find((x) => x.id === group) ?? WISHES[0];
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="flex gap-2 overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: "none" }}>
        {WISHES.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === group}
            onClick={() => setGroup(x.id)}
            className="h-9 flex-none rounded-full px-3.5 text-[13px] font-semibold"
            style={x.id === group ? { background: "var(--acS)", color: "var(--ac)", border: "1.5px solid var(--ac)" } : { background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
          >
            {x.name}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5 px-4 pb-3">
        {g.lines.map((line) => (
          <button key={line} type="button" onClick={() => onPick(line)} className="rounded-[12px] px-3.5 py-3 text-left text-[14.5px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
            {line}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Caption gợi ý khi đăng bài, mỗi cái một nút "Sao chép". */
export function CaptionList({ captions }: { captions: string[] }) {
  const [copied, setCopied] = useState<number | null>(null);
  const copy = async (i: number) => {
    try {
      await navigator.clipboard.writeText(captions[i]);
    } catch {
      // Trình duyệt chặn clipboard: chọn chữ cho khách tự chép.
      const ta = document.createElement("textarea");
      ta.value = captions[i];
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* thôi */
      }
      ta.remove();
    }
    setCopied(i);
    setTimeout(() => setCopied((c) => (c === i ? null : c)), 1800);
  };
  return (
    <div className="flex flex-col gap-2">
      {captions.map((c, i) => (
        <div key={i} className="flex items-start gap-2 rounded-[12px] px-3 py-2.5" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
          <p className="min-w-0 flex-1 whitespace-pre-line text-[13px] leading-snug" style={{ color: "var(--tx)" }}>
            {c}
          </p>
          <button type="button" onClick={() => void copy(i)} aria-label="Sao chép caption" className="flex h-9 flex-none items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold" style={{ background: "var(--sf)", border: "1px solid var(--bd)", color: copied === i ? "var(--gn)" : "var(--tx2)" }}>
            {copied === i ? <Check size={14} /> : <Copy size={14} />} {copied === i ? "Đã chép" : "Chép"}
          </button>
        </div>
      ))}
    </div>
  );
}
