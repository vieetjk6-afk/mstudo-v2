"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Portal } from "@/components/studio/Modal";

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST — xác nhận thao tác, dùng chung cho lịch studio, cổng nhân viên và
   cổng khách hàng.

   Đúng thông số bản thiết kế ("Tương tác & chuyển động dùng chung"): ghim giữa
   đáy, nền #1A1A1C, chữ trắng 12.5px/600, bo 12px, icon check màu #8FE3BC, tự
   ẩn sau 2600ms. Nền và màu icon để CỐ ĐỊNH chứ không lấy theo token: toast là
   lớp nổi trên mọi nền, kể cả trang album nền tối, nên nó phải tương phản với
   cả hai chế độ sáng/tối.

   Đi qua <Portal> ra <body> vì `.page-in` trên <main> của StudioShell biến
   <main> thành containing block của mọi con `position: fixed` — xem ghi chú đầy
   đủ trong components/studio/Modal.tsx. Không portal thì "ghim giữa đáy" hoá ra
   là ghim vào đáy của <main>, tức tuốt dưới cuối trang, ngoài vùng nhìn thấy.
   ═══════════════════════════════════════════════════════════════════════════ */

const HIDE_AFTER = 2600;

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), HIDE_AFTER);
  }, []);

  // Rời màn hình khi toast còn hẹn giờ → dọn timer, tránh setState sau unmount.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { toast, toastNode: <Toast msg={msg} /> };
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <Portal>
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[26px] left-1/2 z-[200] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2 rounded-[12px] px-[15px] py-[11px] text-[12.5px] font-semibold animate-[vkToast_.22s_ease_both]"
      style={{ background: "#1A1A1C", color: "#FFFFFF", boxShadow: "0 12px 30px rgba(0,0,0,.22)" }}
    >
      <CheckCircle2 size={16} style={{ flex: "none", color: "#8FE3BC" }} />
      <span style={{ textWrap: "pretty" }}>{msg}</span>
    </div>
    </Portal>
  );
}
