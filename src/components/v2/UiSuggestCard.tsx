"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { setUiVersion } from "@/components/v2/ui-switch";

/** Bấm "Để sau" thì ẩn 3 ngày rồi mới gợi ý lại. */
const SNOOZE_KEY = "mstudo_ui_suggest_snooze";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Thẻ gợi ý "Thử giao diện mới" ở góc màn hình của KHUNG CŨ. Chỉ hiện với người
 * được phép dùng giao diện mới mà đang ở bản cũ (xem resolveUi). Trên điện thoại
 * thẻ nằm trên thanh tab đáy để không che nút.
 */
export default function UiSuggestCard() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let until = 0;
    try { until = Number(localStorage.getItem(SNOOZE_KEY)) || 0; } catch { /* ignore */ }
    // Hiện sau một nhịp để không chen vào lúc trang đang dựng.
    const t = setTimeout(() => setShow(Date.now() > until), 1200);
    return () => clearTimeout(t);
  }, []);

  function snooze() {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* ignore */ }
    setShow(false);
  }

  function tryNew() {
    setBusy(true);
    setUiVersion("v2");
    router.refresh();
  }

  if (!show) return null;
  return (
    <div
      role="dialog"
      aria-label="Gợi ý giao diện mới"
      className="ck-panel fixed bottom-[88px] right-3 z-40 w-[min(360px,calc(100vw-24px))] rounded-[18px] p-4 lg:bottom-5 lg:right-5"
      style={{ background: "var(--sf)", border: "1px solid var(--bd)", boxShadow: "var(--sh-toast)" }}
    >
      <div className="flex gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px]" style={{ background: "color-mix(in srgb, #0b5cc4 12%, var(--sf))", color: "#0b5cc4" }}>
          <Sparkles size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold">Thử giao diện mới</p>
          <p className="mt-0.5 text-[13px] leading-snug" style={{ color: "var(--tx2)" }}>
            Gọn hơn, dễ thao tác hơn trên cả máy tính và điện thoại. Dữ liệu giữ nguyên, quay lại bản cũ lúc nào cũng được.
          </p>
        </div>
        <button onClick={snooze} aria-label="Đóng" className="-mr-1 -mt-1 flex h-7 w-7 flex-none items-center justify-center rounded-full" style={{ color: "var(--tx3)" }}>
          <X size={15} />
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={snooze} className="rounded-[10px] px-3.5 py-2 text-[13px] font-semibold" style={{ color: "var(--tx2)" }}>
          Để sau
        </button>
        <button
          onClick={tryNew}
          disabled={busy}
          className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
          style={{ background: "#0b5cc4" }}
        >
          {busy ? "Đang chuyển…" : "Dùng thử ngay"}
        </button>
      </div>
    </div>
  );
}
