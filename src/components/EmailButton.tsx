"use client";

import { useState } from "react";
import { Mail, Check } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { btn } from "@/components/v2/kit";

/** Send a prepared email to a client via /api/studio/email. */
export default function EmailButton({
  to,
  subject,
  message,
  label = "Gửi email",
  className,
}: {
  to: string | null | undefined;
  subject: string;
  message: string;
  label?: string;
  className?: string;
}) {
  // Giao diện mới: không truyền lớp riêng thì dùng nút phụ cỡ "sm" của bộ khối.
  const v2 = useUiV2();
  const cls = className ?? (v2 ? btn("secondary", "sm") : "btn-ghost px-3 py-2 text-xs");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  if (!to) return null;

  async function send() {
    setState("sending");
    const res = await fetch("/api/studio/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, message }),
    });
    if (res.ok) {
      setState("sent");
      setTimeout(() => setState("idle"), 2500);
      return;
    }
    setState("idle");
    const j = await res.json().catch(() => ({}));
    if (j.error === "not_configured") {
      alert("Chưa cấu hình gửi email. Thêm RESEND_API_KEY trên Vercel để bật tính năng này.");
    } else {
      alert("Không gửi được email: " + (j.error || "lỗi không xác định"));
    }
  }

  return (
    <button type="button" onClick={send} disabled={state === "sending"} className={cls} title={`Gửi email tới ${to}`}>
      {state === "sent" ? <Check size={14} /> : <Mail size={14} />} {state === "sent" ? "Đã gửi" : state === "sending" ? "Đang gửi…" : label}
    </button>
  );
}
