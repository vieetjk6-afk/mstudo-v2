"use client";

import { useState } from "react";
import { Mail, Check } from "lucide-react";

/** Send a prepared email to a client via /api/studio/email. */
export default function EmailButton({
  to,
  subject,
  message,
  label = "Gửi email",
  className = "btn-ghost px-3 py-2 text-xs",
}: {
  to: string | null | undefined;
  subject: string;
  message: string;
  label?: string;
  className?: string;
}) {
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
    <button type="button" onClick={send} disabled={state === "sending"} className={className} title={`Gửi email tới ${to}`}>
      {state === "sent" ? <Check size={14} /> : <Mail size={14} />} {state === "sent" ? "Đã gửi" : state === "sending" ? "Đang gửi…" : label}
    </button>
  );
}
