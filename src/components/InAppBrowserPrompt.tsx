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
 * Hộp thoại nổi GIỮA màn hình trên một lớp mờ nhẹ — trang vẫn nhìn thấy phía
 * sau nhưng chưa bấm được, khách BẮT BUỘC chọn một trong hai: "Mở bằng
 * Safari/Chrome" hoặc "Ở lại". Không đóng bằng cách chạm ra ngoài, không tự
 * nhảy ra trình duyệt: khách quyết định.
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

  // Khoá cuộn trang phía sau trong lúc hộp thoại đang chờ khách chọn.
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
      aria-modal="true"
      aria-labelledby="iab-title"
      aria-describedby="iab-desc"
      className="fixed inset-0 z-[400] overflow-y-auto animate-[vkOverlay_.2s_ease_both]"
      style={{ background: "rgba(10,8,11,.55)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
    >
      {/* min-h-full + items-center: giữa màn hình khi vừa, cuộn được (không
          bị cắt đầu) khi phần hướng dẫn mở rộng trên điện thoại nhỏ. */}
      <div className="flex min-h-full items-center justify-center px-4 py-6">
      <div
        className="w-full max-w-[360px] rounded-[22px] px-5 pb-5 pt-6 text-center animate-[vkPop_.25s_ease_both]"
        style={{ background: "#1E1B1F", color: "#fff", border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 24px 70px rgba(0,0,0,.5)" }}
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px]" style={{ background: "rgba(240,180,41,.16)", color: "#F0B429" }}>
          <ExternalLink size={22} />
        </span>
        <p id="iab-title" className="mt-3.5 text-[17px] font-bold leading-snug">{tr.title(app)}</p>
        <p id="iab-desc" className="mx-auto mt-1.5 max-w-[290px] text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,.68)", textWrap: "pretty" }}>
          {tr.desc(browser)}
        </p>

        <button
          type="button"
          onClick={openExternal}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-[13px] px-4 py-3 text-[14.5px] font-bold"
          style={{ background: "#fff", color: "#141215" }}
        >
          <ExternalLink size={17} /> {busy ? tr.opening : tr.open(browser)}
        </button>
        <button
          type="button"
          onClick={keepHere}
          className="mt-2 w-full rounded-[13px] px-4 py-3 text-[14px] font-semibold"
          style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.85)" }}
        >
          {tr.stay}
        </button>

        {showSteps && (
          <div className="mt-4 border-t pt-3.5 text-left" style={{ borderColor: "rgba(255,255,255,.1)" }}>
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
    </div>
  );
}
