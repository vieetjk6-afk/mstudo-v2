"use client";

import { Save, type LucideIcon } from "lucide-react";
import { btn } from "@/components/v2/kit";

/* ═══════════════════════════════════════════════════════════════════════════
   Mảnh nhỏ dùng chung cho các màn CẤU HÌNH ở giao diện mới (dịch vụ & điều
   khoản, mẫu hợp đồng, bảng giá, chatbox, chương trình voucher):
     • <SaveBarV2>  thanh "có thay đổi chưa lưu" dính đáy màn — y kiểu của màn
       chi tiết album (AlbumEditorV2): chấm vàng + câu nói + Huỷ / Lưu.
     • <ToastV2>    thông báo nổi ngắn ở giữa đáy màn.
     • <PaneItemV2> một dòng của cột danh sách bên trái (danh sách | trình sửa).
   ═══════════════════════════════════════════════════════════════════════════ */

export function SaveBarV2({
  show,
  label = "Có thay đổi chưa lưu",
  saving,
  onSave,
  onReset,
  saveLabel = "Lưu thay đổi",
  disabled,
}: {
  show: boolean;
  label?: React.ReactNode;
  saving?: boolean;
  onSave: () => void;
  /** Bỏ trống thì không có nút "Huỷ thay đổi". */
  onReset?: () => void;
  saveLabel?: string;
  disabled?: boolean;
}) {
  if (!show) return null;
  return (
    <div className="sticky bottom-[80px] z-40 lg:bottom-5">
      <div className="v2-card flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3" style={{ boxShadow: "var(--sh-pop)" }}>
        <span className="h-2 w-2 flex-none rounded-full" style={{ background: "var(--am)" }} />
        <p className="min-w-0 flex-1 text-[13.5px] font-semibold">{label}</p>
        <div className={onReset ? "grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto" : "flex w-full sm:w-auto"}>
          {onReset ? (
            <button type="button" onClick={onReset} disabled={saving} className={btn("ghost")}>
              Huỷ thay đổi
            </button>
          ) : null}
          <button type="button" onClick={onSave} disabled={saving || disabled} className={btn("primary", "md", onReset ? "" : "w-full sm:w-auto")}>
            <Save size={16} /> {saving ? "Đang lưu…" : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastV2({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 truncate rounded-[12px] px-4 py-2.5 text-[13px] font-semibold lg:bottom-6"
      style={{ background: "var(--tx)", color: "var(--sf)", boxShadow: "var(--sh-toast)" }}
    >
      {children}
    </div>
  );
}

/** Một dòng trong cột danh sách bên trái của màn cấu hình (danh sách | trình sửa). */
export function PaneItemV2({
  icon: Icon,
  title,
  sub,
  active,
  onClick,
  trailing,
  dim,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  sub?: React.ReactNode;
  active: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
  /** Mục đang ẩn / tắt: làm mờ. */
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className="v2-row v2-row-link w-full text-left"
      style={{
        ...(active ? { background: "var(--acS)", boxShadow: "inset 3px 0 0 var(--ac)" } : null),
        ...(dim ? { opacity: 0.6 } : null),
      }}
    >
      <span
        className="v2-section-icon"
        style={active ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf2)", color: "var(--tx2)" }}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="v2-row-title" style={active ? { color: "var(--ac)" } : undefined}>{title}</p>
        {sub ? <p className="v2-row-sub">{sub}</p> : null}
      </div>
      {trailing}
    </button>
  );
}
