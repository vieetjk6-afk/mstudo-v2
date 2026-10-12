"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FolderPlus, Laptop, Link2 } from "lucide-react";
import { isDesktopReady, readinessHints, type AlbumMode, type AlbumModeReadiness } from "@/lib/album-mode";

/** Trạng thái /api/studio/album-mode-status trả về. */
export type AlbumModeStatus = AlbumModeReadiness & {
  ready?: boolean;
  lastDesktopSyncAt?: string | null;
};

/**
 * Chọn "Album ảnh của hợp đồng": (A) album mặc định tự đồng bộ từ mstudo
 * desktop, hoặc (B) nhập link ảnh riêng. Dùng ở màn tạo hợp đồng và tab Sản
 * phẩm. Chưa đủ điều kiện cho (A) thì khoá lựa chọn đó, nói rõ còn thiếu gì kèm
 * đường dẫn tới trang cài đặt — chỗ gọi tự chọn (B).
 *
 * `status` = null nghĩa là đang kiểm tra.
 */
export default function AlbumModePicker({
  value,
  onChange,
  status,
  onStatus,
  disabled = false,
  name = "album-mode",
}: {
  value: AlbumMode | null;
  onChange: (m: AlbumMode) => void;
  status: AlbumModeStatus | null;
  /** Nhận trạng thái mới sau khi bấm "Tạo thư mục trên Drive". */
  onStatus?: (s: AlbumModeStatus) => void;
  disabled?: boolean;
  name?: string;
}) {
  const ready = isDesktopReady(status);
  const hints = status ? readinessHints(status) : [];
  const [rootBusy, setRootBusy] = useState(false);
  const [rootErr, setRootErr] = useState<string | null>(null);

  async function createRoot() {
    setRootBusy(true);
    setRootErr(null);
    try {
      const res = await fetch("/api/studio/album-mode-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_root" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setRootErr(d?.error || `Lỗi ${res.status}`);
      else onStatus?.(d as AlbumModeStatus);
    } catch {
      setRootErr("Lỗi mạng, thử lại nhé.");
    } finally {
      setRootBusy(false);
    }
  }

  const option = (m: AlbumMode, icon: ReactNode, title: string, desc: string, locked: boolean) => {
    const on = value === m;
    return (
      <label
        className="flex cursor-pointer gap-2.5 rounded-[11px] px-3 py-2.5"
        style={{
          background: on ? "var(--acS)" : "var(--sf)",
          border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`,
          opacity: locked ? 0.6 : 1,
          cursor: locked || disabled ? "not-allowed" : "pointer",
        }}
      >
        <input
          type="radio"
          name={name}
          className="mt-1"
          checked={on}
          disabled={locked || disabled}
          onChange={() => onChange(m)}
        />
        <span className="flex-none pt-0.5" style={{ color: on ? "var(--ac)" : "var(--tx3)" }}>{icon}</span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold">{title}</span>
          <span className="mt-0.5 block text-[11.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>{desc}</span>
        </span>
      </label>
    );
  };

  return (
    <div className="space-y-2">
      {option(
        "desktop",
        <Laptop size={17} />,
        "Album mặc định — tự đồng bộ từ mstudo desktop",
        "Thợ đổ ảnh vào thư mục hợp đồng trên máy, mstudo desktop tự đưa lên Google Drive; album chọn ảnh và giao khách tự tạo, tự cập nhật.",
        !ready
      )}
      {option(
        "manual",
        <Link2 size={17} />,
        "Nhập link ảnh riêng",
        "Khách xác nhận hợp đồng thì tạo sẵn MỘT album. Có ảnh thì dán link Google Drive vào album đó — dùng để khách chọn ảnh, rồi giao ảnh hoàn thiện trên cùng album.",
        false
      )}

      {status === null ? (
        <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>Đang kiểm tra kết nối mstudo desktop & Google Drive…</p>
      ) : ready ? (
        <p className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--success)" }}>
          <CheckCircle2 size={13} /> Đã kết nối mstudo desktop và thư mục mặc định trên Google Drive.
        </p>
      ) : (
        <div className="flex gap-2.5 rounded-[11px] px-3 py-2.5" style={{ background: "var(--amS)" }}>
          <AlertTriangle size={16} style={{ flex: "none", color: "var(--am)", marginTop: 1 }} />
          <div className="min-w-0 text-[12px] leading-relaxed" style={{ color: "var(--tx2)" }}>
            <p className="font-semibold" style={{ color: "var(--am)" }}>
              Chưa dùng được album mặc định — tạm dùng cách nhập link ảnh riêng.
            </p>
            <ul className="mt-1 space-y-1">
              {hints.map((h) => (
                <li key={h.key}>
                  • {h.text}{" "}
                  {h.action === "create_root" ? (
                    <button type="button" onClick={createRoot} disabled={rootBusy} className="inline-flex items-center gap-1 font-semibold underline" style={{ color: "var(--ac)" }}>
                      <FolderPlus size={12} /> {rootBusy ? "Đang tạo…" : "Tạo thư mục trên Drive"}
                    </button>
                  ) : (
                    <Link href={h.href} className="font-semibold underline" style={{ color: "var(--ac)" }} target="_blank">
                      Cài đặt
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            {rootErr && <p className="mt-1 font-semibold" style={{ color: "var(--rd)" }}>{rootErr}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
