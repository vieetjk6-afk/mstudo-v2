"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/lib/theme";

/* ═══════════════════════════════════════════════════════════════════════════
   HỘP THOẠI — LUÔN đi qua portal ra <body>.

   VÌ SAO BẮT BUỘC: `<main>` của StudioShell mang class `.page-in`, tức
   `animation: pageIn .35s ease both`, và animation đó animate `transform`. Với
   `fill-mode: both` animation CÒN HIỆU LỰC MÃI MÃI (không chỉ 0,35s đầu), nên
   Chromium giữ `<main>` làm CONTAINING BLOCK cho mọi con `position: fixed`.

   Hệ quả đo được (Chromium, khung nhìn 493px, main cao 2044px):
       chỉ overflow-x:clip → lớp phủ inset-0 cao 493  (đúng, neo khung nhìn)
       có .page-in         → lớp phủ inset-0 cao 2044 (neo vào <main>)

   Một hộp thoại `fixed inset-0 flex items-center` khi đó bị canh giữa theo
   <main> cao 2000px chứ không theo màn hình → phần đầu (kèm nút Đóng) trôi lên
   trên vùng nhìn thấy và không bấm được. Portal ra <body> là cách duy nhất
   thoát: nó cũng thoát luôn `overflow-x-clip` của <main> nếu sau này ai đó đổi
   `clip` thành `hidden`.

   BẪY THỨ HAI của portal: ra <body> là RA KHỎI khối token `.studio-shell` /
   `.client-doc`, nên `var(--ac)` rơi về bí danh ở `:root` (= `--gold`, màu nâu)
   và nút chính đổi từ xanh mstudo sang nâu. Vì vậy lớp phủ TỰ MANG class phạm vi
   (`scope`) + `data-theme`, để hộp thoại giữ đúng bảng màu của khu nó thuộc về.

   Dùng khối này cho MỌI hộp thoại mới, đừng tự viết `fixed inset-0` trong cây
   <main>.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Chỉ dựng phần con sau khi đã mount (portal cần `document`, SSR thì chưa có). */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

/**
 * Lớp phủ + thẻ hộp thoại. Đóng được bằng ba đường — nút Đóng của phần con,
 * bấm ra ngoài, và Esc: người dùng không bao giờ bị kẹt trong một hộp thoại,
 * kể cả khi thẻ bị tràn khỏi màn hình vì một lý do nào khác.
 *
 * Khoá cuộn trang nền trong lúc mở, nếu không thì trên điện thoại cuộn bên
 * trong hộp thoại tới cuối là trang phía sau cuộn theo.
 */
export function Modal({
  onClose,
  children,
  maxWidth = 560,
  labelledBy,
  scope = "studio-shell",
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  labelledBy?: string;
  /** Khối token mà hộp thoại phải theo: khu quản lý hay trang gửi khách. */
  scope?: "studio-shell" | "client-doc";
}) {
  const { theme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <Portal>
      <div
        // Class phạm vi nằm NGAY trên lớp phủ: vừa là lớp phủ, vừa dựng lại khối
        // token đã mất khi portal ra <body>.
        className={`${scope} fixed inset-0 z-[150] flex items-end justify-center p-0 sm:items-center sm:p-4`}
        // `.studio-shell` đổi màu theo data-theme của chính nó (khu quản lý có
        // công tắc sáng/tối riêng); `.client-doc` theo data-theme của <html> nên
        // không cần đặt lại.
        data-theme={scope === "studio-shell" ? theme : undefined}
        style={{ background: "rgba(12,10,14,.5)" }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <div
          // Bấm trong thẻ không được đóng hộp thoại — chỉ bấm ra vùng nền.
          onClick={(e) => e.stopPropagation()}
          className="flex w-full flex-col overflow-hidden rounded-t-[18px] sm:rounded-[16px]"
          style={{
            maxWidth,
            // 100dvh trên điện thoại: 100vh tính cả thanh địa chỉ của Safari iOS
            // nên hàng nút dưới cùng bị đẩy xuống dưới mép màn hình.
            maxHeight: "min(92dvh, 92vh)",
            background: "var(--sf)",
            border: "1px solid var(--bd)",
            boxShadow: "var(--sh-modal)",
          }}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}
