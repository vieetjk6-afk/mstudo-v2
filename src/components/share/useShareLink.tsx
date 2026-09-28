"use client";

import { useEffect, useState } from "react";
import { Share2, Copy, Check } from "lucide-react";

/**
 * Shared share-link logic used by both ShareButton and ShareDialog.
 *
 * Handles:
 *  - detecting native share support (client-only, avoids SSR mismatch)
 *  - copy-to-clipboard with a transient "copied" state
 *  - invoking the native share sheet
 *
 * `url` may be null (e.g. while a share link is still being built server-side);
 * copy / share become no-ops until it resolves.
 */
/**
 * `message` (tuỳ chọn) — lời nhắn đã có link bên trong. Có thì "Chép" chép cả
 * lời nhắn, và bảng chia sẻ hệ điều hành nhận lời nhắn làm nội dung, đúng như
 * tin studio gửi qua Zalo.
 */
export function useShareLink(url: string | null, shareTitle?: string, message?: string) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(message || url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  }

  async function nativeShare(fallbackTitle = "Chia sẻ") {
    if (!url) return;
    try {
      await navigator.share({ title: shareTitle || fallbackTitle, ...(message ? { text: message } : {}), url });
    } catch {
      /* cancelled */
    }
  }

  /** Prefer the native share sheet, fall back to clipboard copy. */
  async function quickShareOrCopy(fallbackTitle = "Chia sẻ") {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle || fallbackTitle, ...(message ? { text: message } : {}), url });
        return;
      } catch {
        /* cancelled — fall through to copy */
      }
    }
    await copy();
  }

  return { copied, canNativeShare, copy, nativeShare, quickShareOrCopy };
}

/** Read-only URL field with a one-tap copy button. */
export function CopyLinkRow({
  url,
  copied,
  onCopy,
  withMessage = false,
}: {
  url: string;
  copied: boolean;
  onCopy: () => void;
  /** Nút chép chép cả lời nhắn — nói rõ trên nhãn để studio không bất ngờ khi dán. */
  withMessage?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-2.5 py-2"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
    >
      <input
        readOnly
        value={url}
        aria-label="Đường dẫn chia sẻ"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
        style={{ color: "var(--text2)" }}
      />
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? "Đã chép đường dẫn" : "Chép đường dẫn"}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium"
        style={{ background: "var(--accent)", color: "var(--accentInk)" }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Đã chép" : withMessage ? "Chép kèm lời nhắn" : "Chép"}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Đã chép đường dẫn vào bộ nhớ tạm" : ""}
      </span>
    </div>
  );
}


/** Full-width "quick share" button that opens the native share sheet. */
export function NativeShareButton({ onShare }: { onShare: () => void }) {
  return (
    <button
      type="button"
      onClick={onShare}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium"
      style={{ background: "var(--accent)", color: "var(--accentInk)" }}
    >
      <Share2 size={15} /> Chia sẻ nhanh
    </button>
  );

}
