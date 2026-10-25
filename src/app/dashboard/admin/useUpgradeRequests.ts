"use client";

import { useState } from "react";
import type { UpgradePaymentStatus } from "@/lib/upgrade-payment";
import type { UpgradeRequest } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của "Yêu cầu nâng cấp" (bản cũ UpgradeRequests và bản
   mới UpgradeRequestsV2): đánh dấu đã xử lý, xoá, và chốt một đơn ĐÃ CHUYỂN
   KHOẢN (đã nhận tiền → nâng gói / chưa nhận được). Hai bản chỉ khác cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export function useUpgradeRequests(initial: UpgradeRequest[]) {
  const [rows, setRows] = useState<UpgradeRequest[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  }

  async function handle(action: "handled" | "delete", id: string, handled?: boolean) {
    setRows((r) => (action === "delete" ? r.filter((x) => x.id !== id) : r.map((x) => (x.id === id ? { ...x, handled: !!handled } : x))));
    await fetch("/api/admin/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "upgrade", action, id, handled }),
    });
  }

  // Chốt một yêu cầu ĐÃ CHUYỂN KHOẢN. Không cập nhật lạc quan như hai nút trên:
  // đây là việc động tới TIỀN và tới gói của người khác, nên chỉ đổi màn hình
  // sau khi máy chủ trả lời xong.
  async function review(id: string, action: "confirm" | "reject") {
    if (action === "confirm" && !confirm("Xác nhận ĐÃ NHẬN được tiền chuyển khoản? Gói của studio sẽ được nâng ngay.")) return;
    const note = action === "reject" ? (prompt("Lý do gửi cho studio (bỏ trống cũng được):") ?? "") : "";
    setBusy(id);
    const res = await fetch("/api/admin/upgrade-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, note }),
    });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok || !data?.ok) {
      flash(data?.error === "already_paid" ? "Đơn này đã xác nhận trước đó." : "Không cập nhật được, thử lại.");
      return;
    }
    setRows((r) =>
      r.map((x) => (x.id === id ? { ...x, payment_status: data.status as UpgradePaymentStatus, handled: data.status === "paid" } : x)),
    );
  }

  return { rows, busy, msg, handle, review };
}

export type UpgradeRequestsState = ReturnType<typeof useUpgradeRequests>;
