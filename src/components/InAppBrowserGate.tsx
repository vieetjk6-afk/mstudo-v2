"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Copy, ExternalLink, MoreHorizontal, MoreVertical } from "lucide-react";
import {
  browserEscapeUrl,
  canAutoEscape,
  detectInAppBrowser,
  inAppName,
  isGatedPath,
  nativeBrowserName,
  openInBrowserSteps,
  type InAppBrowser,
} from "@/lib/in-app-browser";
import { useShareLink } from "./share/useShareLink";

/** Khách đã chọn "vẫn xem trong app" — chỉ nhớ trong phiên này, mở link lần sau
 *  vẫn bị nhắc lại. */
const STAY_KEY = "mstudo:o-lai-trong-app";
/** Đã TỰ thử nhảy sang trình duyệt một lần trong phiên — không thử lại, kẻo
 *  khách quay về Zalo là bị đá đi lần nữa (hoặc vòng lặp khi app nạp lại trang). */
const AUTO_KEY = "mstudo:da-tu-mo-trinh-duyet";

const TR = {
  vi: {
    title: (browser: string) => `Mở bằng ${browser} để xem đầy đủ`,
    desc: (app: string) =>
      `Bạn đang mở link trong ${app}. Trình duyệt của ${app} không tải được ảnh, video về máy, không lưu được trang ra màn hình chính và hay lỗi khi phát video.`,
    open: (browser: string) => `Mở bằng ${browser}`,
    opening: "Đang mở…",
    autoTried: (browser: string) => `Đã chuyển sang ${browser}. Nếu chưa thấy mở, bấm nút bên dưới.`,
    stepsTitle: "Nếu bấm nút không mở được:",
    hereHint: "Bấm vào đây",
    copyHint: "Hoặc chép link rồi dán vào trình duyệt:",
    copy: "Chép",
    copied: "Đã chép",
    stay: (app: string) => `Vẫn xem trong ${app} (một số tính năng sẽ không dùng được)`,
  },
  en: {
    title: (browser: string) => `Open in ${browser} for the full experience`,
    desc: (app: string) =>
      `You opened this link inside ${app}. Its built-in browser can't save photos or videos, can't add the page to your home screen and often fails to play videos.`,
    open: (browser: string) => `Open in ${browser}`,
    opening: "Opening…",
    autoTried: (browser: string) => `Sent to ${browser}. If nothing opened, tap the button below.`,
    stepsTitle: "If the button doesn't work:",
    hereHint: "Tap here",
    copyHint: "Or copy the link and paste it into your browser:",
    copy: "Copy",
    copied: "Copied",
    stay: (app: string) => `Keep viewing in ${app} (some features won't work)`,
  },
} as const;

/**
 * ÉP MỞ BẰNG TRÌNH DUYỆT THẬT cho các trang mstudo gửi khách (xem
 * `isGatedPath`) khi phát hiện đang ở trình duyệt trong Zalo / Facebook /
 * Messenger / Instagram / TikTok…
 *
 *   • Android (app đã biết): tự nhảy sang Chrome ngay khi mở, một lần mỗi phiên.
 *   • iPhone: không có cách nào để web tự rời webview (xem @/lib/in-app-browser)
 *     → màn chặn toàn trang với nút "Mở bằng Safari" + hướng dẫn menu ⋯ + mũi
 *     tên chỉ đúng góc có menu + chép link.
 *
 * Vẫn để một lối nhỏ "vẫn xem trong app" (nhớ trong phiên): có app không có lối
 * thoát nào, khoá cứng thì khách mất luôn hợp đồng / album của mình.
 *
 * Mount một lần ở layout gốc; tự im lặng ở trình duyệt thật, máy tính, webapp
 * đã cài và mọi trang không nằm trong danh sách.
 */
export default function InAppBrowserGate() {
  const pathname = usePathname();
  const [info, setInfo] = useState<InAppBrowser | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [stay, setStay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const [lang, setLang] = useState<"vi" | "en">("vi");
  const { copied, copy } = useShareLink(url);
  const gated = isGatedPath(pathname);

  useEffect(() => {
    if (!gated) return;
    const read = (k: string) => {
      try {
        return sessionStorage.getItem(k) === "1";
      } catch {
        return false;
      }
    };
    if (read(STAY_KEY)) {
      setStay(true);
      return;
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const b = detectInAppBrowser(navigator.userAgent, { standalone });
    setInfo(b);
    setUrl(window.location.href);
    // Cùng quy tắc với LangProvider (@/lib/i18n): tiếng Việt, trừ khi khách đã
    // tự chọn tiếng Anh. KHÔNG theo ngôn ngữ máy — nhiều khách Việt để điện
    // thoại tiếng Anh mà cả trang vẫn là tiếng Việt.
    try {
      if (localStorage.getItem("vk_lang") === "en") setLang("en");
    } catch {
      /* chặn storage → giữ tiếng Việt */
    }
    if (!b || !canAutoEscape(b) || read(AUTO_KEY)) return;
    const target = browserEscapeUrl(window.location.href, b.os);
    if (!target) return;
    try {
      sessionStorage.setItem(AUTO_KEY, "1");
    } catch {
      /* không ghi được thì vẫn thử một lần — lần nạp sau sẽ thử lại */
    }
    setAutoTried(true);
    window.location.href = target;
  }, [gated, pathname]);

  // Khoá cuộn trang phía sau khi màn chặn đang hiện.
  const showing = gated && !!info && !stay;
  useEffect(() => {
    if (!showing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [showing]);

  if (!showing || !info) return null;

  const tr = TR[lang];
  const app = inAppName(info.app);
  const browser = nativeBrowserName(info.os);
  const steps = openInBrowserSteps(info, lang);
  const MenuIcon = info.os === "ios" ? MoreHorizontal : MoreVertical;

  function openExternal() {
    const target = url && info ? browserEscapeUrl(url, info.os) : null;
    if (!target) return;
    setBusy(true);
    const done = () => setBusy(false);
    window.setTimeout(done, 1500);
    window.addEventListener("pagehide", done, { once: true });
    window.location.href = target;
  }

  function keepHere() {
    setStay(true);
    try {
      sessionStorage.setItem(STAY_KEY, "1");
    } catch {
      /* không lưu được thì chỉ tắt cho lần xem này */
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="iab-title"
      className="fixed inset-0 z-[400] overflow-y-auto"
      style={{ background: "#141215", color: "#fff" }}
    >
      {/* Mũi tên chỉ đúng góc phải trên — nơi Zalo / Facebook đặt menu ⋯. */}
      <div className="pointer-events-none absolute right-3 top-2 flex flex-col items-end" aria-hidden>
        <svg width="54" height="54" viewBox="0 0 54 54" className="animate-bounce" style={{ animationDuration: "1.4s" }}>
          <path d="M10 48 C 18 26, 30 14, 44 8" stroke="#F0B429" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M33 6 L45 7 L41 18" stroke="#F0B429" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="-mt-1 mr-6 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: "#F0B429", color: "#141215" }}>
          {tr.hereHint} <MenuIcon size={14} />
        </span>
      </div>

      <div
        className="mx-auto flex min-h-full w-full max-w-[440px] flex-col justify-center px-5 pt-24"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,.08)" }}>
          <ExternalLink size={26} />
        </div>
        <h1 id="iab-title" className="mt-4 font-serif text-[26px] font-semibold leading-tight" style={{ textWrap: "balance" }}>
          {tr.title(browser)}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,.7)", textWrap: "pretty" }}>
          {tr.desc(app)}
        </p>

        <button
          type="button"
          onClick={openExternal}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] py-3.5 text-[15px] font-bold"
          style={{ background: "#fff", color: "#141215" }}
        >
          <ExternalLink size={18} /> {busy ? tr.opening : tr.open(browser)}
        </button>
        {autoTried && (
          <p className="mt-2 text-center text-[12px]" style={{ color: "rgba(255,255,255,.55)" }}>{tr.autoTried(browser)}</p>
        )}

        <div className="mt-5 rounded-[14px] p-4" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}>
          <p className="text-[13px] font-bold">{tr.stepsTitle}</p>
          <ol className="mt-2 space-y-2 text-[13px]" style={{ color: "rgba(255,255,255,.78)" }}>
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold" style={{ background: "#F0B429", color: "#141215" }}>
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3.5 text-[12.5px]" style={{ color: "rgba(255,255,255,.6)" }}>{tr.copyHint}</p>
          {url && (
            <div className="mt-1.5 flex items-center gap-2 rounded-[10px] py-1.5 pl-3 pr-1.5" style={{ background: "rgba(0,0,0,.35)" }}>
              <input
                readOnly
                value={url}
                aria-label="Đường dẫn trang"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
                style={{ color: "rgba(255,255,255,.75)" }}
              />
              <button
                type="button"
                onClick={copy}
                className="flex flex-none items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-bold"
                style={{ background: copied ? "#8FE3BC" : "rgba(255,255,255,.14)", color: copied ? "#141215" : "#fff" }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? tr.copied : tr.copy}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={keepHere}
          className="mx-auto mt-6 text-[12px] underline underline-offset-2"
          style={{ color: "rgba(255,255,255,.42)" }}
        >
          {tr.stay(app)}
        </button>
      </div>
    </div>
  );
}
