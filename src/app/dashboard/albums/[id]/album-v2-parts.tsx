"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { retryAltHost, stripExtension, thumbnailUrl } from "@/lib/drive";

/* ═══════════════════════════════════════════════════════════════════════════
   Mảnh nhỏ dùng chung cho các màn album ở giao diện mới (chi tiết album, lựa
   chọn của khách, ảnh in): ô ảnh thu nhỏ, thông báo nổi, chép/tải mã ảnh.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Ảnh thu nhỏ lấp đầy khung cha. Hỏng thì thử một lần host Google còn lại
 * (retryAltHost), hỏng nữa thì hiện ô trống có biểu tượng — không để lộ icon
 * ảnh vỡ và tên file chen giữa lưới.
 */
export function Thumb({
  fileId,
  src,
  alt,
  w = 400,
  eager = false,
}: {
  fileId?: string | null;
  src?: string | null;
  alt: string;
  w?: number;
  eager?: boolean;
}) {
  const url = src || (fileId ? thumbnailUrl(fileId, w) : null);
  const [failed, setFailed] = useState<string | null>(null);
  // Ảnh chỉ hiện khi đã tải xong — đang tải hay đang thử host khác thì vẫn là ô
  // trống gọn gàng, không lộ icon ảnh vỡ kèm chữ alt.
  const [loaded, setLoaded] = useState<string | null>(null);
  const placeholder = (
    <span className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--sf2)", color: "var(--tx3)" }} aria-hidden>
      <ImageIcon size={18} strokeWidth={1.6} />
    </span>
  );
  if (!url || failed === url) {
    return (
      <span className="relative block h-full w-full" role="img" aria-label={alt}>
        {placeholder}
      </span>
    );
  }
  return (
    <span className="relative block h-full w-full">
      {loaded !== url && placeholder}
      <img
        // Ảnh đã có trong bộ nhớ đệm có thể tải xong trước khi React gắn onLoad.
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0) setLoaded(url);
        }}
        src={url}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="relative h-full w-full object-cover transition-opacity duration-200"
        style={{ opacity: loaded === url ? 1 : 0 }}
        onLoad={() => setLoaded(url)}
        onError={(e) => {
          const im = e.currentTarget;
          if (!im.dataset.retried) {
            const before = im.src;
            retryAltHost(e);
            if (im.src !== before) return;
          }
          setFailed(url);
        }}
      />
    </span>
  );
}

/** Thông báo nổi đáy màn (trên thanh tab điện thoại). */
export function Toast({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-[70] max-w-[92vw] -translate-x-1/2 truncate rounded-[12px] px-4 py-2.5 text-[13px] font-semibold lg:bottom-6"
      style={{ background: "var(--tx)", color: "var(--sf)", boxShadow: "var(--sh-toast)" }}
    >
      {children}
    </div>
  );
}

/** Mã ảnh = tên file bỏ đuôi, mỗi ảnh một dòng (cùng định dạng PhotoCodeButtons). */
export function codesText(names: string[]) {
  return names.map(stripExtension).join("\n");
}

/** Chép chữ; trình duyệt chặn clipboard thì mở hộp để chép tay. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Chép danh sách mã ảnh:", text);
    return false;
  }
}

/** Tải chữ thành file .txt. `fileName` không cần đuôi. */
export function downloadText(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".txt") ? fileName : `${fileName}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Mã ngắn của một mã chọn (session) — 6 ký tự in hoa như bản cũ. */
export const shortCode = (sessionId: string) => sessionId.slice(0, 6).toUpperCase();
