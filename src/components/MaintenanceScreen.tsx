"use client";

/**
 * Trang chặn khi khu quản trị đang bảo trì (xem `@/lib/maintenance`).
 * Đếm ngược tới giờ mở lại; hết giờ thì tự tải lại một lần để vào thẳng webapp.
 */

import { useEffect, useState } from "react";
import { Wrench, Clock, Check } from "lucide-react";

const RELOAD_ONCE_KEY = "mstudo-maintenance-reloaded";

/** "6 giờ 12 phút 03 giây" */
function fmtLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h} giờ ${pad(m)} phút ${pad(s)} giây` : `${m} phút ${pad(s)} giây`;
}

export default function MaintenanceScreen({
  untilIso,
  untilLabel,
  reason,
}: {
  untilIso: string;
  untilLabel: string;
  reason: string;
}) {
  const until = Date.parse(untilIso);
  const [left, setLeft] = useState<number | null>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(until)) return;
    const tick = () => {
      const ms = until - Date.now();
      if (ms <= 0) {
        setOver(true);
        setLeft(0);
        // Hết giờ: tự vào lại MỘT lần. Nếu máy chủ vẫn báo bảo trì (đồng hồ máy
        // khách chạy nhanh) thì dừng ở nút bấm tay, tránh vòng lặp tải lại.
        if (typeof window !== "undefined" && !sessionStorage.getItem(RELOAD_ONCE_KEY)) {
          sessionStorage.setItem(RELOAD_ONCE_KEY, "1");
          window.location.reload();
        }
        return;
      }
      setOver(false);
      setLeft(ms);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="card w-full max-w-lg p-8 text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "var(--brandSoft)", color: "var(--brand)" }}
        >
          <Wrench size={26} />
        </div>

        <h1 className="mt-5 font-serif text-2xl font-medium">
          Quản trị đang bảo trì
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
          {reason}
        </p>

        <div
          className="mt-5 rounded-lg px-4 py-3"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-center gap-2 text-sm font-semibold">
            <Clock size={16} style={{ color: "var(--brand)" }} />
            Mở lại lúc {untilLabel}
          </div>
          <div className="mt-1 text-[13px]" style={{ color: "var(--text3)" }}>
            {over
              ? "Đã đến giờ mở lại — bấm nút bên dưới để vào quản trị."
              : left == null
              ? "Đang tính thời gian còn lại…"
              : `Còn ${fmtLeft(left)}`}
          </div>
        </div>

        <div
          className="mt-5 rounded-lg px-4 py-3 text-left text-[13px]"
          style={{ background: "var(--brandSoft)", color: "var(--text2)" }}
        >
          <div className="mb-1.5 flex items-center gap-2 font-semibold" style={{ color: "var(--brand)" }}>
            <Check size={15} />
            Khách của bạn KHÔNG bị ảnh hưởng
          </div>
          Trang chủ mstudo.com, website studio, album chọn ảnh, thiệp cưới, form
          và báo giá gửi khách vẫn hoạt động bình thường. Chỉ khu quản trị tạm
          khoá trong lúc bảo trì.
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href="/dashboard" className="btn-primary">
            {over ? "Vào quản trị" : "Thử lại"}
          </a>
          <a href="/" className="btn-ghost">
            Về trang chủ
          </a>
        </div>

        <p className="mt-5 text-[12px]" style={{ color: "var(--text3)" }}>
          Cần gấp trong lúc bảo trì? Liên hệ hỗ trợ MStudo để được xử lý riêng.
        </p>
      </div>
    </div>
  );
}
