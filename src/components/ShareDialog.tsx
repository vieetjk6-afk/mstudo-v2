"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useShareLink, CopyLinkRow, NativeShareButton } from "./share/useShareLink";

/**
 * Centered modal that shows a share link with a copy button and a native
 * quick-share action. Used for "share N selected photos" (the URL is built
 * after a server round-trip, so it can't be a static ShareButton).
 */
export default function ShareDialog({
  url,
  title,
  subtitle,
  onClose,
}: {
  url: string | null;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { copied, canNativeShare, copy, nativeShare } = useShareLink(url, title || t("shareDialogDefault"));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-5 animate-[vkOverlay_.25s_ease_both]"
      style={{ background: "rgba(6,6,8,.6)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || t("shareDialogTitle")}
        className="w-full max-w-sm rounded-2xl p-5 animate-[vkPop_.3s_ease_both]"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-serif text-lg font-medium">{title || t("shareDialogTitle")}</span>
          <button type="button" onClick={onClose} aria-label={t("close")} style={{ color: "var(--text3)" }}>
            <X size={18} />
          </button>
        </div>
        {subtitle && (
          <p className="mb-3 text-[13px]" style={{ color: "var(--text2)" }}>
            {subtitle}
          </p>
        )}

        <CopyLinkRow url={url} copied={copied} onCopy={copy} />

        {canNativeShare && <NativeShareButton onShare={() => nativeShare()} />}
      </div>
    </div>
  );
}
