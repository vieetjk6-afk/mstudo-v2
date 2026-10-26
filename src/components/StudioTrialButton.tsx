"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { btn } from "@/components/v2/kit";

interface Props {
  /** Has this user already used the Studio trial? */
  used: boolean;
}

function useStudioTrial(initialUsed: boolean) {
  const [used, setUsed] = useState(initialUsed);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/trial/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "studio" }) });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && d?.ok) {
      setUsed(true);
      setMsg("Đã kích hoạt Studio 7 ngày! Tải lại trang để dùng ngay.");
    } else {
      setMsg(
        d?.error === "already_used" ? "Mỗi tài khoản chỉ được dùng thử một lần."
        : d?.error === "already_paid" ? "Bạn đang dùng gói trả phí còn hạn."
        : "Không thể kích hoạt. Vui lòng thử lại."
      );
    }
  }

  return { used, busy, msg, activate };
}

export default function StudioTrialButton(props: Props) {
  return useUiV2() ? <StudioTrialButtonV2 {...props} /> : <StudioTrialButtonV1 {...props} />;
}

function StudioTrialButtonV1({ used: initialUsed }: Props) {
  const { used, busy, msg, activate } = useStudioTrial(initialUsed);

  if (used) {
    return msg ? (
      <p className="text-xs font-medium" style={{ color: "var(--success)" }}>{msg}</p>
    ) : (
      <p className="text-xs" style={{ color: "var(--text3)" }}>Đã dùng thử Studio.</p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={activate}
        disabled={busy}
        className="btn-ghost text-sm"
        style={{ opacity: busy ? 0.6 : 1 }}
      >
        <Sparkles size={14} /> {busy ? "Đang kích hoạt…" : "Dùng thử Studio 7 ngày"}
      </button>
      {msg && <p className="text-xs" style={{ color: msg.includes("Đã kích") ? "var(--success)" : "var(--danger)" }}>{msg}</p>}
    </div>
  );
}

/** Giao diện mới: nút phụ chữ màu chủ đạo — nổi trên cả nền thẻ trắng lẫn nền
 *  <Callout> màu chủ đạo (màn đã có một nút primary riêng). */
function StudioTrialButtonV2({ used: initialUsed }: Props) {
  const { used, busy, msg, activate } = useStudioTrial(initialUsed);

  if (used) {
    return msg ? (
      <p className="text-[12.5px] font-medium" style={{ color: "var(--gn)" }}>{msg}</p>
    ) : (
      <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Đã dùng thử Studio.</p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={activate} disabled={busy} className={btn("secondary", "sm")} style={{ color: "var(--ac)" }}>
        <Sparkles size={14} /> {busy ? "Đang kích hoạt…" : "Dùng thử Studio 7 ngày"}
      </button>
      {msg && <p className="text-[12px]" style={{ color: msg.includes("Đã kích") ? "var(--gn)" : "var(--rd)" }}>{msg}</p>}
    </div>
  );
}
