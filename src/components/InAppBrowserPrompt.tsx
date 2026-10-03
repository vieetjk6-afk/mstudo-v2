"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Copy, ExternalLink } from "lucide-react";
import {
  browserEscapeUrl,
  detectInAppBrowser,
  inAppName,
  isCustomerLinkPath,
  nativeBrowserName,
  openInBrowserSteps,
  type InAppBrowser,
} from "@/lib/in-app-browser";
import { useShareLink } from "./share/useShareLink";

/** Khách đã bấm "Ở lại" — chỉ nhớ trong phiên này, mở link lần sau vẫn nhắc. */
const STAY_KEY = "mstudo:o-lai-trong-app";

const TR = {
  vi: {
    title: (app: string) => `Bạn đang mở trong ${app}`,
    desc: (browser: string) =>
      `Mở bằng ${browser} để tải ảnh, video về máy, phát video mượt và lưu trang ra màn hình chính.`,
    open: (browser: string) => `Mở bằng ${browser}`,
    opening: "Đang mở…",
    stay: "Ở lại",
    stepsTitle: "Chưa mở được? Làm theo 2 bước:",
    copyHint: "Hoặc chép link rồi dán vào trình duyệt:",
    copy: "Chép",
    copied: "Đã chép",
  },
  en: {
    title: (app: string) => `You're viewing inside ${app}`,
    desc: (browser: string) =>
      `Open in ${browser} to save photos and videos, play videos smoothly and add the page to your home screen.`,
    open: (browser: string) => `Open in ${browser}`,
    opening: "Opening…",
    stay: "Stay here",
    stepsTitle: "Nothing happened? Two steps:",
    copyHint: "Or copy the link and paste it into your browser:",
    copy: "Copy",
    copied: "Copied",
  },
} as const;

/**
 * CẢNH BÁO NỔI "MỞ BẰNG TRÌNH DUYỆT" cho các trang mstudo gửi khách (xem
 * `isCustomerLinkPath`) khi đang ở trình duyệt trong Zalo / Facebook / Messenger /
 * Instagram / TikTok…
 *
 * Một thẻ nổi ở cuối màn hình — KHÔNG che trang, khách vẫn xem được phía sau —
 * với hai lựa chọn: "Mở bằng Safari/Chrome" và "Ở lại". Không tự nhảy ra
 * trình duyệt: khách quyết định.
 *
 * Nút mở dùng `x-safari-https://` (iPhone) / `intent://` (Android) — xem
 * @/lib/in-app-browser. App nào nuốt mất lệnh đó thì sau 1,5 giây thẻ tự mở
 * rộng phần hướng dẫn menu ⋯ + chép link.
 *
 * Mount một lần ở layout gốc; tự im lặng ở trình duyệt thật, máy tính, webapp
 * đã cài, mọi trang không nằm trong danh sách, và sau khi khách bấm "Ở lại".
 */
export default function InAppBrowserPrompt() {
  const pathname = usePathname();
  const [info, setInfo] = useState<InAppBrowser | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [stay, setStay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [lang, setLang] = useState<"vi" | "en">("vi");
  const { copied, copy } = useShareLink(url);
  const gated = isCustomerLinkPath(pathname);

  useEffect(() => {
    if (!gated) return;
    try {
      if (sessionStorage.getItem(STAY_KEY) === "1") {
        setStay(true);
        return;
      }
    } catch {
      /* chặn storage → cứ nhắc */
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInfo(detectInAppBrowser(navigator.userAgent, { standalone }));
    setUrl(window.location.href);
    // Cùng quy tắc với LangProvider (@/lib/i18n): tiếng Việt, trừ khi khách đã
    // tự chọn tiếng Anh. KHÔNG theo ngôn ngữ máy — nhiều khách Việt để điện
    // thoại tiếng Anh mà cả trang vẫn là tiếng Việt.
    try {
      if (localStorage.getItem("vk_lang") === "en") setLang("en");
    } catch {
      /* chặn storage → giữ tiếng Việt */
    }
  }, [gated, pathname]);

  if (!gated || !info || stay) return null;

  const tr = TR[lang];
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
    // Rời được thật thì trang bị ẩn → huỷ hẹn giờ. Còn ở lại nghĩa là app nuốt
    // mất lệnh mở → chỉ khách cách làm tay.
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
      role="alertdialog"
      aria-labelledby="iab-title"
      aria-describedby="iab-desc"
      className="fixed inset-x-0 bottom-0 z-[400] px-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="mx-auto w-full max-w-[420px] rounded-[18px] p-4 animate-[vkPop_.25s_ease_both]"
        style={{ background: "#1E1B1F", color: "#fff", border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 18px 50px rgba(0,0,0,.45)" }}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px]" style={{ background: "rgba(240,180,41,.16)", color: "#F0B429" }}>
            <ExternalLink size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p id="iab-title" className="text-[14.5px] font-bold leading-snug">{tr.title(app)}</p>
            <p id="iab-desc" className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "rgba(255,255,255,.66)", textWrap: "pretty" }}>
              {tr.desc(browser)}
            </p>
          </div>
        </div>

        <div className="mt-3.5 flex gap-2">
          <button
            type="button"
            onClick={keepHere}
            className="flex-none rounded-[12px] px-4 py-2.5 text-[13.5px] font-semibold"
            style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.85)" }}
          >
            {tr.stay}
          </button>
          <button
            type="button"
            onClick={openExternal}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] px-4 py-2.5 text-[13.5px] font-bold"
            style={{ background: "#fff", color: "#141215" }}
          >
            <ExternalLink size={16} /> {busy ? tr.opening : tr.open(browser)}
          </button>
        </div>

        {showSteps && (
          <div className="mt-3.5 border-t pt-3" style={{ borderColor: "rgba(255,255,255,.1)" }}>
            <p className="text-[12.5px] font-bold">{tr.stepsTitle}</p>
            <ol className="mt-1.5 space-y-1 text-[12.5px]" style={{ color: "rgba(255,255,255,.75)" }}>
              {steps.map((s, i) => (
                <li key={i}>{i + 1}. {s}</li>
              ))}
            </ol>
            <p className="mt-2.5 text-[12px]" style={{ color: "rgba(255,255,255,.55)" }}>{tr.copyHint}</p>
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
        )}
      </div>
    </div>
  );
}
