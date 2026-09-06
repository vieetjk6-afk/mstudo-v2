"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * `sidebar` — nút to trong sidebar studio (mặc định, giữ nguyên như trước).
 * `pill`   — viên gọn cho TRANG KHÁCH (album chọn ảnh, cổng hợp đồng): nằm cùng
 *            hàng với các viên trạng thái, chữ ngắn, không chiếm trọn chiều
 *            ngang. Trang khách là chỗ việc cài app có giá trị nhất — khách quay
 *            lại album cả chục lần và không phải đi tìm lại link trong Zalo.
 */
export default function InstallPwaButton({
  variant = "sidebar",
  label,
}: {
  variant?: "sidebar" | "pill";
  label?: string;
} = {}) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [installed, setInstalled] = useState(false);

  const text = label || "Tạo Webapp";
  const btnClass =
    variant === "pill"
      ? "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
      : "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors";
  const btnStyle =
    variant === "pill"
      ? { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }
      : { background: "var(--brandSoft)", color: "var(--brand)" };
  const iconSize = variant === "pill" ? 13 : 18;

  useEffect(() => {
    // Already running as standalone PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    // iOS Safari — no beforeinstallprompt, show manual hint instead
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) && /(safari)/i.test(ua) && !/(chrome|crios|fxios)/i.test(ua)) {
      setIsIos(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  // Android / desktop Chrome — native install prompt available
  if (prompt) {
    return (
      <button
        onClick={async () => {
          await prompt.prompt();
          const { outcome } = await prompt.userChoice;
          if (outcome === "accepted") setInstalled(true);
          setPrompt(null);
        }}
        className={btnClass}
        style={btnStyle}
      >
        <Download size={iconSize} style={{ flex: "none" }} />
        {text}
      </button>
    );
  }

  // iOS — show tooltip with instructions
  if (isIos) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowIosHint((v) => !v)}
          className={btnClass}
          style={btnStyle}
        >
          <Share size={iconSize} style={{ flex: "none" }} />
          {text}
        </button>

        {showIosHint && (
          <div
            className="absolute bottom-full left-0 mb-2 w-[min(18rem,calc(100vw-2rem))] max-w-[18rem] rounded-2xl p-4 shadow-xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", zIndex: 60 }}
          >
            <button
              onClick={() => setShowIosHint(false)}
              aria-label="Đóng"
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full"
              style={{ background: "var(--surface2)", color: "var(--text3)" }}
            >
              <X size={12} />
            </button>
            <p className="mb-2 text-sm font-bold">{variant === "pill" ? text : "Cài đặt mstudo"}</p>
            <ol className="space-y-1.5 text-[13px]" style={{ color: "var(--text2)" }}>
              <li>1. Nhấn nút <strong>Chia sẻ</strong> <span style={{ fontSize: 16 }}>⬆</span> ở thanh Safari bên dưới</li>
              <li>2. Cuộn xuống và chọn <strong>&ldquo;Thêm vào Màn hình chính&rdquo;</strong></li>
              <li>3. Nhấn <strong>Thêm</strong></li>
            </ol>
          </div>
        )}
      </div>
    );
  }

  return null;
}
