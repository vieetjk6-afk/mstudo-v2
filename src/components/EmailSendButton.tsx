"use client";

import { useState } from "react";
import { Check, Mail } from "lucide-react";

/**
 * Nút "Gửi qua email" — gửi lời nhắn (kèm link hợp đồng) tới email khách đang
 * lưu trên hợp đồng, qua /api/studio/contracts/[id]/email. Dành cho khách
 * không dùng điện thoại, hoặc gửi thêm bên cạnh Zalo.
 *
 * Chưa có email thì nút mờ và nói rõ cần nhập email ở đâu — không giấu nút
 * đi, để studio biết là có cách gửi này.
 */
const ERR: Record<string, string> = {
  no_email: "Hợp đồng chưa có email khách.",
  unsaved: "Email vừa sửa chưa lưu xong — đợi một giây rồi bấm lại.",
  not_configured: "Máy chủ chưa cấu hình gửi email (SMTP_USER / SMTP_PASS).",
  forbidden: "Bạn không có quyền gửi cho hợp đồng này.",
  rate_limited: "Gửi quá nhiều lần — thử lại sau ít phút.",
};

export default function EmailSendButton({
  contractId,
  email,
  message,
  className = "",
}: {
  contractId: string;
  email: string | null | undefined;
  message: string;
  className?: string;
}) {
  const [state, setState] = useState<"sending" | "ok" | "fail" | null>(null);
  const [err, setErr] = useState("");
  const to = (email || "").trim();
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to);

  async function send() {
    if (!valid || state === "sending") return;
    setState("sending");
    setErr("");
    try {
      const res = await fetch(`/api/studio/contracts/${contractId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: message, email: to }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && j.ok) {
        setState("ok");
        setTimeout(() => setState(null), 3000);
      } else {
        setState("fail");
        setErr(ERR[j.error || ""] || (res.status === 429 ? ERR.rate_limited : "Không gửi được email, thử lại."));
      }
    } catch {
      setState("fail");
      setErr("Lỗi mạng, thử lại.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={send}
        disabled={!valid || state === "sending"}
        className={className}
        title={valid ? `Gửi tới ${to}` : "Nhập email khách ở mục Khách hàng để gửi qua email"}
      >
        {state === "ok" ? <Check size={16} style={{ color: "var(--gn)" }} /> : <Mail size={16} />}
        <span className="min-w-0 truncate">
          {state === "sending" ? "Đang gửi email…" : state === "ok" ? `Đã gửi tới ${to}` : valid ? `Gửi qua email · ${to}` : "Gửi qua email (chưa có email khách)"}
        </span>
      </button>
      {state === "fail" && err ? (
        <p className="text-[12px] font-semibold" style={{ color: "var(--rd)" }}>{err}</p>
      ) : null}
    </div>
  );
}
