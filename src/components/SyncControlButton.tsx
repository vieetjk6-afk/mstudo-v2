"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";

/**
 * Nút "Điều khiển đồng bộ" — chỉ hiện khi web app đang chạy TRONG MStudo Desktop
 * (desktop tiêm cờ window.__MSTUDO_DESKTOP__). Bấm → mở bảng điều khiển đồng bộ
 * của app (desktop bắt đường dẫn "/__mstudo_control" và mở cửa sổ điều khiển).
 * Trên trình duyệt web thường: không hiện gì.
 */
export default function SyncControlButton() {
  return useUiV2() ? <SyncControlButtonV2 /> : <SyncControlButtonV1 />;
}

function useIsDesktopApp() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    setIsDesktop(!!(window as unknown as { __MSTUDO_DESKTOP__?: boolean }).__MSTUDO_DESKTOP__);
  }, []);
  return isDesktop;
}

function SyncControlButtonV1() {
  const isDesktop = useIsDesktopApp();
  if (!isDesktop) return null;
  return (
    <button
      // Tải lại TRANG THẬT chứ không điều hướng phía client: /__mstudo_control
      // là cửa điều khiển đồng bộ, phải đi qua middleware một lượt mới đúng.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      onClick={() => { window.location.href = "/__mstudo_control"; }}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
      style={{ background: "var(--surface2)", color: "var(--text)" }}
    >
      <RefreshCw size={16} style={{ color: "var(--brand)" }} /> Điều khiển đồng bộ
    </button>
  );
}

/** Giao diện mới: một hàng kiểu mục menu (.v2-nav) ở chân sidebar / ngăn kéo. */
function SyncControlButtonV2() {
  const isDesktop = useIsDesktopApp();
  if (!isDesktop) return null;
  return (
    <button
      type="button"
      // Tải lại TRANG THẬT — xem ghi chú ở bản cũ phía trên.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      onClick={() => { window.location.href = "/__mstudo_control"; }}
      className="v2-nav flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-left text-[13px]"
    >
      <RefreshCw size={18} strokeWidth={1.9} className="flex-none" style={{ color: "var(--ac)" }} />
      <span className="min-w-0 flex-1 truncate">Điều khiển đồng bộ</span>
    </button>
  );
}
