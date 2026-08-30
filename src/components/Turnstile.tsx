"use client";

import { useEffect, useRef } from "react";

import { TURNSTILE_UNAVAILABLE } from "@/lib/turnstile";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  /**
   * Kích thước ô captcha — đúng bộ giá trị Turnstile nhận:
   * "normal" (mặc định) | "compact" | "flexible".
   *
   * KHÔNG phải "chế độ hiện/ẩn". Widget quản lý (managed) hay vô hình
   * (invisible) là thiết lập của SITE KEY trên bảng điều khiển Cloudflare,
   * không truyền được từ đây.
   */
  size?: "normal" | "compact" | "flexible";
  className?: string;
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";
// Cloudflare's "always passes" test key. When the real key is absent we use it
// so login still works in dev / un-configured deploys instead of being blocked.
const IS_TEST_KEY = SITE_KEY === "1x00000000000000000000AA";

export default function Turnstile({ onVerify, onExpire, onError, size = "normal", className }: TurnstileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const rendered = useRef(false);

  // Keep the latest callbacks in refs so the widget renders exactly once and
  // never churns when the parent re-renders (which would reset the token and
  // leave the submit button permanently disabled).
  const cbs = useRef({ onVerify, onExpire, onError });
  cbs.current = { onVerify, onExpire, onError };

  useEffect(() => {
    let cancelled = false;
    let verified = false;
    let retried = false;
    let recovery: ReturnType<typeof setTimeout> | null = null;

    // Chưa khai NEXT_PUBLIC_TURNSTILE_SITE_KEY trên Vercel thì trang chạy bằng
    // khóa thử của Cloudflare: ô captcha có hiện nhưng ghi "Testing only" và
    // KHÔNG chặn được bot nào. Nói ra ở console để người quản trị biết đường
    // khai biến, thay vì tưởng captcha đang chạy thật.
    if (IS_TEST_KEY) {
      console.warn(
        "[Turnstile] Chưa có NEXT_PUBLIC_TURNSTILE_SITE_KEY — đang dùng khóa THỬ của Cloudflare. " +
          "Captcha không bảo vệ gì cho tới khi khai đủ NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY."
      );
    }

    const pass = (token: string) => {
      verified = true;
      cbs.current.onVerify(token);
    };

    // Fallback timer: if the Cloudflare script is blocked (ad-blockers, network
    // policy) the widget can never verify and login would be impossible. After
    // a grace period, auto-pass so the user is not locked out.
    const fallback = setTimeout(() => {
      if (!cancelled && !widgetId.current) pass(TURNSTILE_UNAVAILABLE);
    }, 6000);

    // Widget ĐÃ hiện rồi mới lỗi (error-callback) là ngõ cụt tệ nhất: fallback ở
    // trên đã bị clearTimeout, người dùng chỉ thấy nút Đăng nhập xám vĩnh viễn
    // mà không có lời giải thích nào. Hay gặp trong webview nhúng (MStudo
    // Desktop / WebView2), mạng công ty chặn challenges.cloudflare.com, hoặc
    // đồng hồ máy sai giờ. Thử reset widget MỘT lần; vẫn không có token thì
    // chuyển sang mã "không dùng được" — máy chủ nhận mã này nhưng KHÔNG coi là
    // đã xác minh: nó siết hạn mức theo IP thay vì mở cửa (xem lib/turnstile.ts).
    const recoverFromError = () => {
      if (cancelled || verified) return;
      if (!retried && widgetId.current && window.turnstile) {
        retried = true;
        cbs.current.onError?.();
        try { window.turnstile.reset(widgetId.current); } catch { /* ignore */ }
        recovery = setTimeout(() => { if (!cancelled && !verified) pass(TURNSTILE_UNAVAILABLE); }, 8000);
        return;
      }
      pass(TURNSTILE_UNAVAILABLE);
    };

    const renderWidget = () => {
      if (cancelled || rendered.current || !ref.current || !window.turnstile) return;
      rendered.current = true;
      clearTimeout(fallback);
      try {
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          // `size` là tham số THẬT của Turnstile ("normal" | "compact" |
          // "flexible"). Trước đây chỗ này truyền `appearance: "normal"` —
          // `appearance` chỉ nhận "always" | "execute" | "interaction-only",
          // nên "normal" là giá trị KHÔNG hợp lệ: Cloudflare ném lỗi ngay
          // trong render(), rơi vào catch bên dưới và tự bỏ qua captcha. Kết
          // quả là ô captcha KHÔNG BAO GIỜ hiện trên bất kỳ form nào.
          size,
          theme: "auto",
          callback: (token: string) => {
            if (recovery) { clearTimeout(recovery); recovery = null; }
            pass(token);
          },
          "expired-callback": () => {
            verified = false;
            cbs.current.onExpire?.();
            // Tự lấy mã mới thay vì chờ người dùng bấm lại — hết hạn mà đứng im
            // cũng khoá nút gửi y như lỗi.
            if (widgetId.current && window.turnstile) {
              try { window.turnstile.reset(widgetId.current); } catch { /* ignore */ }
            }
          },
          "error-callback": () => {
            // On a hard error with the test key, don't lock the user out.
            if (IS_TEST_KEY) pass(TURNSTILE_UNAVAILABLE);
            else recoverFromError();
          },
        });
      } catch (err) {
        // Ném ở đây gần như luôn là tham số render sai — im lặng nuốt lỗi chính
        // là thứ đã giấu mất bug "captcha không hiện" suốt thời gian qua.
        console.error("[Turnstile] render() thất bại — bỏ qua captcha cho lần gửi này.", err);
        pass(TURNSTILE_UNAVAILABLE);
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      window.onTurnstileLoad = renderWidget;
      if (!document.getElementById("cf-turnstile-script")) {
        const script = document.createElement("script");
        script.id = "cf-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
        script.async = true;
        script.defer = true;
        script.onerror = () => cbs.current.onVerify(TURNSTILE_UNAVAILABLE);
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      if (recovery) clearTimeout(recovery);
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* ignore */ }
        widgetId.current = null;
        rendered.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className={className} />;
}
