"use client";

import { useState } from "react";
import { MessageSquare, Check } from "lucide-react";

import { messengerUrl } from "@/lib/messenger-url";

export { messengerUrl };

/**
 * One-tap Messenger contact: copies the prepared message + opens the chat.
 * (Messenger can't prefill text via URL, so we copy it for pasting.)
 */
/**
 * "Gửi cho khách" — shares the prepared message via the OS share sheet
 * (navigator.share) so the studio can pick Messenger/Zalo/SMS… with the content
 * already filled in, then just tap Send. Desktop fallback: copy the message and
 * open the Messenger chat (if a link is known) to paste.
 */
export default function MessengerButton({
  link,
  message,
  label = "Gửi cho khách",
  className = "btn-ghost px-2.5 py-1.5 text-xs",
}: {
  link?: string | null | undefined;
  message: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const url = messengerUrl(link);

  return (
    <button
      type="button"
      onClick={() => {
        // Web Share only on real mobile/touch devices — on desktop the share
        // sheet often only copies a link, so there we copy the FULL message and
        // open the chat to paste.
        const isMobile =
          typeof navigator !== "undefined" &&
          (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches));
        if (isMobile && navigator.share) {
          navigator.share({ text: message }).catch(() => {});
        } else {
          navigator.clipboard?.writeText(message).catch(() => {});
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        }
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      className={className}
      title="Gửi nội dung đã soạn cho khách (chọn Messenger/Zalo/SMS…)"
    >
      {done ? <Check size={14} /> : <MessageSquare size={14} />} {done ? "Đang mở…" : label}
    </button>
  );
}
