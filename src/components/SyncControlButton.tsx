"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Nút "Điều khiển đồng bộ" — chỉ hiện khi web app đang chạy TRONG MStudo Desktop
 * (desktop tiêm cờ window.__MSTUDO_DESKTOP__). Bấm → mở bảng điều khiển đồng bộ
 * của app (desktop bắt đường dẫn "/__mstudo_control" và mở cửa sổ điều khiển).
 * Trên trình duyệt web thường: không hiện gì.
 */
export default function SyncControlButton() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    setIsDesktop(!!(window as unknown as { __MSTUDO_DESKTOP__?: boolean }).__MSTUDO_DESKTOP__);
  }, []);
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
