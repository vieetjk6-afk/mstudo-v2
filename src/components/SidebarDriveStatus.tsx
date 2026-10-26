"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HardDrive, Monitor } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";

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
export default function SidebarDriveStatus(props: { desktop?: boolean }) {
  return useUiV2() ? <SidebarDriveStatusV2 {...props} /> : <SidebarDriveStatusV1 {...props} />;
}

function useDriveStatus() {
  const [st, setSt] = useState<Status | null>(null);

  useEffect(() => {
    let stale = false;
    fetch("/api/studio/drive/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!stale && j) setSt(j as Status); })
      .catch(() => {});
    return () => { stale = true; };
  }, []);
  return st;
}

function SidebarDriveStatusV1({ desktop = false }: { desktop?: boolean }) {
  const st = useDriveStatus();

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

/** Giao diện mới: hai hàng gọn cùng kiểu mục menu (.v2-nav) ở chân sidebar —
 *  chấm xanh / vàng cạnh icon Drive cho biết đã kết nối hay chưa. */
function SidebarDriveStatusV2({ desktop = false }: { desktop?: boolean }) {
  const st = useDriveStatus();

  if (!st && !desktop) return null;

  const on = !!st?.connected;
  const row = "v2-nav flex items-center gap-2.5 rounded-[10px] px-2.5 py-[6px]";
  return (
    <div className="flex flex-col gap-px">
      {st && (
        <Link href="/dashboard/studio/drive-sync" className={row}>
          <span className="relative flex-none" style={{ lineHeight: 0 }}>
            <HardDrive size={18} strokeWidth={1.9} />
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full"
              style={{ background: on ? "var(--gn)" : "var(--am)", boxShadow: "0 0 0 2px var(--sf)" }}
              aria-hidden
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px]">{on ? "Đã kết nối Drive" : "Chưa kết nối Drive"}</span>
            <span className="block truncate text-[11.5px] font-normal" style={{ color: "var(--tx3)" }}>
              {on ? st.rootFolderName || "My Drive" : "Bấm để kết nối"}
            </span>
          </span>
        </Link>
      )}
      {desktop && (
        <Link href="/dashboard/studio/desktop" className={row}>
          <Monitor size={18} strokeWidth={1.9} className="flex-none" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px]">Tải MStudo Desktop</span>
            <span className="block truncate text-[11.5px] font-normal" style={{ color: "var(--tx3)" }}>
              {st ? "Cài để Drive tự đồng bộ" : "Tự lưu hợp đồng, sao lưu"}
            </span>
          </span>
        </Link>
      )}
    </div>
  );
}
