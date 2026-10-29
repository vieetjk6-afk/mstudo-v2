"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, ExternalLink, Filter } from "lucide-react";
import FilterTool from "./FilterTool";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { btn } from "@/components/v2/kit";
import { Drawer } from "@/components/v2/kit-client";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const FilterToolV2 = dynamic(() => import("./FilterToolV2"));

/**
 * Popup công cụ Lọc ảnh — mở ngay trong quản lý album, KHÔNG rời trang.
 * Chức năng y hệt trang /dashboard/filter (chọn nguồn Google Drive hoặc thư mục
 * trên máy tính rồi đối chiếu danh sách ảnh khách chọn), kèm nút mở trang lọc
 * ảnh đầy đủ khi cần làm việc rộng hơn.
 */
type Props = {
  albumId?: string;
  albumTitle?: string;
  driveUrl?: string;
  onClose: () => void;
};

export default function FilterDialog(props: Props) {
  return useUiV2() ? <FilterDialogV2 {...props} /> : <FilterDialogV1 {...props} />;
}

function FilterDialogV1({ albumId, albumTitle, driveUrl, onClose }: Props) {
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

/**
 * Giao diện mới: ngăn kéo rộng của bộ khối (điện thoại: trượt từ đáy) chứa bản
 * V2 của công cụ lọc ảnh — cùng logic (useFilterTool), cùng albumId / driveUrl.
 * Nút "Công cụ ảnh" ở đầu công cụ chỉ có nghĩa trên trang /dashboard/filter nên
 * ẩn ở đây; "Mở trang lọc ảnh" nằm ở chân ngăn kéo.
 */
function FilterDialogV2({ albumId, albumTitle, driveUrl, onClose }: Props) {
  const fullPage = albumId ? `/dashboard/filter?album=${albumId}` : "/dashboard/filter";
  return (
    <Drawer
      open
      onClose={onClose}
      width={1120}
      title="Lọc ảnh"
      desc={albumTitle || undefined}
      footer={
        <>
          <Link href={fullPage} className={btn("ghost")}>
            <ExternalLink size={15} /> Mở trang lọc ảnh
          </Link>
          <button type="button" onClick={onClose} className={btn("secondary")}>
            Đóng
          </button>
        </>
      }
    >
      <div className="[&_.v2-pagehead-actions>a]:hidden">
        <FilterToolV2 albumId={albumId} driveUrl={driveUrl} />
      </div>
    </Drawer>
  );
}
