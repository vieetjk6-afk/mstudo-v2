"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import {
  browserEscapeUrl,
  detectInAppBrowser,
  inAppName,
  nativeBrowserName,
  openInBrowserSteps,
  type InAppBrowser,
} from "@/lib/in-app-browser";
import { useShareLink, CopyLinkRow } from "./share/useShareLink";

const DISMISS_KEY = "mstudo:mo-trinh-duyet";

const TR = {
  vi: {
    title: (app: string) => `Đang mở trong ${app}`,
    desc: (browser: string) =>
      `Tải ảnh về máy và lưu album ra màn hình chính chỉ chạy đầy đủ ở ${browser}.`,
    open: (browser: string) => `Mở bằng ${browser}`,
    opening: "Đang mở…",
    stepsTitle: "Chưa mở được? Làm theo 2 bước:",
    copyHint: "Hoặc copy link rồi dán vào trình duyệt:",
    close: "Đóng",
  },
  en: {
    title: (app: string) => `Opened inside ${app}`,
    desc: (browser: string) =>
      `Downloading photos and saving the album to your home screen only work fully in ${browser}.`,
    open: (browser: string) => `Open in ${browser}`,
    opening: "Opening…",
    stepsTitle: "Nothing happened? Two steps:",
    copyHint: "Or copy the link and paste it into your browser:",
    close: "Close",
  },
} as const;

/**
 * Khách bấm link album trong Zalo/Messenger thì trang nằm trong webview của app
 * đó — tải ảnh, cài webapp, đăng nhập Google đều kẹt. Không có API nào để trang
 * web TỰ thoát ra Safari (xem @/lib/in-app-browser), nên đây là đường ngắn nhất
 * còn lại: một thanh nhắc + nút bấm một lần ra trình duyệt thật, và khi nút
 * không ăn thì chỉ luôn menu ⋯ của app + copy link.
 *
 * Tự ẩn khi đang ở trình duyệt thật, ở máy tính, trong webapp đã cài, hoặc khi
 * khách đã tắt nó trong phiên này.
 */
export default function OpenInBrowserNotice({ lang = "vi" }: { lang?: "vi" | "en" } = {}) {
  const [info, setInfo] = useState<InAppBrowser | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [closed, setClosed] = useState(false);
  const { copied, copy } = useShareLink(url);
  const tr = TR[lang];

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* trình duyệt chặn storage — cứ hiện */
    }
    if (dismissed) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInfo(detectInAppBrowser(navigator.userAgent, { standalone }));
    setUrl(window.location.href);
  }, []);

  const close = useCallback(() => {
    setClosed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* không lưu được thì thôi, tắt cho phiên hiện tại */
    }
  }, []);

  if (!info || closed) return null;

  const app = inAppName(info.app);
  const browser = nativeBrowserName(info.os);
  const steps = openInBrowserSteps(info, lang);

  function openExternal() {
    const target = url && info ? browserEscapeUrl(url, info.os) : null;
    if (!target) {
      setShowSteps(true);
      return;
    }
    setBusy(true);
    // Rời được thật thì trang bị ẩn/huỷ → huỷ hẹn giờ. Còn ở lại nghĩa là app
    // nuốt mất lược đồ lạ (hoặc hiện hộp lỗi) → chỉ khách cách làm tay.
    const timer = window.setTimeout(() => {
      setBusy(false);
      setShowSteps(true);
    }, 1500);
    const cancel = () => {
      window.clearTimeout(timer);
      setBusy(false);
    };
    window.addEventListener("pagehide", cancel, { once: true });
    const onHide = () => {
      if (document.hidden) {
        cancel();
        document.removeEventListener("visibilitychange", onHide);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.location.href = target;
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] px-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="mx-auto w-full max-w-md rounded-2xl p-3.5 shadow-xl animate-[vkPop_.25s_ease_both]"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start gap-2.5">
          <ExternalLink size={16} style={{ color: "var(--gold)", flex: "none", marginTop: 2 }} />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold">{tr.title(app)}</p>
            <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--text2)" }}>
              {tr.desc(browser)}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={tr.close}
            className="flex h-6 w-6 flex-none items-center justify-center rounded-full"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}
          >
            <X size={12} />
          </button>
        </div>

        <button
          type="button"
          onClick={openExternal}
          disabled={busy}
          className="btn-primary mt-3 w-full py-2 text-[13.5px]"
        >
          <ExternalLink size={15} />
          {busy ? tr.opening : tr.open(browser)}
        </button>

        {showSteps && (
          <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <p className="text-[12.5px] font-semibold">{tr.stepsTitle}</p>
            <ol className="mt-1.5 space-y-1 text-[12.5px]" style={{ color: "var(--text2)" }}>
              {steps.map((s, i) => (
                <li key={i}>
                  {i + 1}. {s}
                </li>
              ))}
            </ol>
            <p className="mb-1.5 mt-2.5 text-[12.5px]" style={{ color: "var(--text2)" }}>
              {tr.copyHint}
            </p>
            {url && <CopyLinkRow url={url} copied={copied} onCopy={copy} />}
          </div>
        )}
      </div>
    </div>
  );
}
