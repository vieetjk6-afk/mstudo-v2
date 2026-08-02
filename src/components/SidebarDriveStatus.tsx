"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HardDrive } from "lucide-react";

type Status = { configured: boolean; connected: boolean; rootFolderName: string };

/**
 * Thẻ trạng thái đồng bộ Drive ở chân sidebar (bản thiết kế, mục "Cấu trúc điều
 * hướng"). Chỉ chủ studio gói Studio mới xem được trạng thái Drive → API trả
 * 403 với người khác và thẻ tự ẩn, không hiện thông tin phỏng đoán.
 */
export default function SidebarDriveStatus() {
  const [st, setSt] = useState<Status | null>(null);

  useEffect(() => {
    let stale = false;
    fetch("/api/studio/drive/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!stale && j) setSt(j as Status); })
      .catch(() => {});
    return () => { stale = true; };
  }, []);

  if (!st) return null;

  const on = st.connected;
  return (
    <Link
      href="/dashboard/studio/drive-sync"
      className="nav-item flex items-center gap-2 rounded-[10px] px-2 py-[7px]"
      style={{ background: "var(--sf2)" }}
    >
      <HardDrive size={17} style={{ flex: "none", color: on ? "var(--ac)" : "var(--tx3)" }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-semibold">
          {on ? "Đã kết nối Drive" : "Chưa kết nối Drive"}
        </span>
        <span className="block truncate text-[10.5px]" style={{ color: "var(--tx3)" }}>
          {on ? st.rootFolderName || "My Drive" : "Bấm để kết nối"}
        </span>
      </span>
    </Link>
  );
}
