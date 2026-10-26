"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, ExternalLink, Filter } from "lucide-react";
import FilterTool from "./FilterTool";

/**
 * Popup công cụ Lọc ảnh — mở ngay trong quản lý album, KHÔNG rời trang.
 * Chức năng y hệt trang /dashboard/filter (chọn nguồn Google Drive hoặc thư mục
 * trên máy tính rồi đối chiếu danh sách ảnh khách chọn), kèm nút mở trang lọc
 * ảnh đầy đủ khi cần làm việc rộng hơn.
 */
export default function FilterDialog({
  albumId,
  albumTitle,
  driveUrl,
  onClose,
}: {
  albumId?: string;
  albumTitle?: string;
  driveUrl?: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Esc để đóng + khoá cuộn nền khi popup đang mở.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;

  const fullPage = albumId ? `/dashboard/filter?album=${albumId}` : "/dashboard/filter";

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-3 sm:p-5 animate-[vkOverlay_.25s_ease_both]"
      style={{ background: "rgba(6,6,8,.6)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Công cụ lọc ảnh"
        className="my-auto w-full max-w-5xl rounded-2xl animate-[vkPop_.3s_ease_both]"
        style={{ background: "var(--bg2)", border: "1px solid var(--border2)", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}
      >
        {/* Header dính khi cuộn để nút Đóng / Mở trang luôn với tới được. */}
        <div
          className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-t-2xl px-4 py-3 sm:px-5"
          style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)" }}
        >
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-serif text-lg font-medium">
              <Filter size={16} /> Lọc ảnh
            </p>
            {albumTitle && (
              <p className="truncate text-[12.5px]" style={{ color: "var(--text3)" }}>
                {albumTitle}
              </p>
            )}
          </div>
          <Link href={fullPage} className="btn-ghost py-1.5 text-xs">
            <ExternalLink size={13} /> Mở trang lọc ảnh
          </Link>
          <button type="button" onClick={onClose} aria-label="Đóng" className="btn-ghost py-1.5 text-xs">
            <X size={14} /> Đóng
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <p className="mb-4 text-[13px] leading-relaxed" style={{ color: "var(--text2)" }}>
            Chọn <b>Google Drive</b> hoặc <b>Máy tính</b> làm nguồn ảnh, rồi đối chiếu với danh sách ảnh khách chọn để copy sang Drive / thư mục đích / tải ZIP.
          </p>
          <FilterTool albumId={albumId} driveUrl={driveUrl} compact />
        </div>
      </div>
    </div>,
    document.body
  );
}
