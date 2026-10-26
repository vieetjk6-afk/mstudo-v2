"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HardDrive, Monitor } from "lucide-react";

type Status = { configured: boolean; connected: boolean; rootFolderName: string };

/**
 * Thẻ trạng thái đồng bộ Drive ở chân sidebar (bản thiết kế, mục "Cấu trúc điều
 * hướng"). Chỉ chủ studio gói Studio mới xem được trạng thái Drive → API trả
 * 403 với người khác và dòng Drive tự ẩn, không hiện thông tin phỏng đoán.
 *
 * Ngay dưới là lối tải MStudo Desktop: Drive chỉ tự đồng bộ khi app desktop
 * chạy trên máy studio, nên để hai thứ cạnh nhau thay vì bắt studio tự đi tìm
 * app trong menu. `desktop` = gói có Desktop và trang tải đang mở với người này.
 */
export default function SidebarDriveStatus({ desktop = false }: { desktop?: boolean }) {
  const [st, setSt] = useState<Status | null>(null);

  useEffect(() => {
    let stale = false;
    fetch("/api/studio/drive/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!stale && j) setSt(j as Status); })
      .catch(() => {});
    return () => { stale = true; };
  }, []);

  if (!st && !desktop) return null;

  const on = !!st?.connected;
  return (
    <div className="flex flex-col gap-1 rounded-[10px] p-1" style={{ background: "var(--sf2)" }}>
      {st && (
        <Link href="/dashboard/studio/drive-sync" className="nav-item flex items-center gap-2 rounded-[8px] px-1.5 py-[6px]">
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
      )}
      {desktop && (
        <Link href="/dashboard/studio/desktop" className="nav-item flex items-center gap-2 rounded-[8px] px-1.5 py-[6px]">
          <Monitor size={17} style={{ flex: "none", color: "var(--ac)" }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] font-semibold">Tải MStudo Desktop</span>
            <span className="block truncate text-[10.5px]" style={{ color: "var(--tx3)" }}>
              {st ? "Cài để Drive tự đồng bộ" : "Tự lưu hợp đồng, sao lưu"}
            </span>
          </span>
        </Link>
      )}
    </div>
  );
}
