"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Check, X } from "lucide-react";
import { useShareLink, CopyLinkRow, NativeShareButton } from "./share/useShareLink";

/**
 * Share an album/gallery link. Shows the full URL with a one-tap copy button and
 * a quick-share action that opens the device's native share sheet (which lists
 * Messenger / Zalo / etc. on mobile).
 *
 * `path` may be absolute (https://…) or relative (/a/slug). Relative paths are
 * resolved against the current origin on the client.
 */
export default function ShareButton({
  path,
  title,
  label = "Chia sẻ",
  className = "btn-ghost",
  compact = false,
  message,
}: {
  path: string;
  title?: string;
  label?: string;
  className?: string;
  /** Skip the popover: clicking shares (native) / copies the link directly.
   * Useful inside cards with `overflow-hidden` that would clip a popover. */
  compact?: boolean;
  /** Lời nhắn có sẵn link (như tin Zalo) — nút chép sẽ chép cả lời nhắn này. */
  message?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(path);
  const popRef = useRef<HTMLDivElement>(null);
  const { copied, canNativeShare, copy, nativeShare, quickShareOrCopy } = useShareLink(
    url,
    title || "Album ảnh",
    message,
  );

  useEffect(() => {
    const abs = /^https?:\/\//i.test(path)
      ? path
      : `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`;
    setUrl(abs);
  }, [path]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => quickShareOrCopy()}
        title="Chia sẻ link album"
        className={className}
      >
        {copied ? <Check size={15} /> : <Share2 size={15} />} {label}
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        className={className}
      >
        <Share2 size={15} /> {label}
      </button>

      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Chia sẻ album"
          className="absolute right-0 z-50 mt-2 w-[320px] rounded-xl p-4 shadow-xl animate-[vkPop_.25s_ease_both]"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">Chia sẻ album</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              style={{ color: "var(--text3)" }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Link + copy */}
          <CopyLinkRow url={url} copied={copied} onCopy={copy} withMessage={!!message} />

          {/* Quick share via the native share sheet (Messenger / Zalo / …) */}
          {canNativeShare && <NativeShareButton onShare={() => nativeShare()} />}
        </div>
      )}
    </div>
  );
}
