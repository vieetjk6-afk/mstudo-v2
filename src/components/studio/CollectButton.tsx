"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

/**
 * "Đã nhận" — chốt một đợt thanh toán ngay tại thẻ việc, không phải mở hợp đồng.
 *
 * Việc này chỉ có hai câu trả lời (đã thấy tiền / chưa), studio làm nhiều lần
 * mỗi tuần, mà trước đây tốn bốn bước: mở hợp đồng → tab Thanh toán → tìm đợt →
 * bấm. Có hỏi xác nhận vì đây là thao tác động tới TIỀN và không có nút hoàn
 * tác tại chỗ (gỡ dấu đã thu vẫn làm được trong hợp đồng).
 */
export default function CollectButton({
  planId,
  contractId,
  amountLabel,
}: {
  planId: string;
  contractId: string;
  /** "15.000.000đ" — nhắc lại số tiền trong câu hỏi xác nhận. */
  amountLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function collect() {
    if (!confirm(`Xác nhận ĐÃ NHẬN ${amountLabel}? Khoản này sẽ được ghi vào thu chi của hợp đồng.`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/studio/payment-plan/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      }).then((x) => x.json());
      if (r?.ok) {
        setDone(true);
        // Đợt CỌC → gửi tin xác nhận cho khách, đúng như màn hợp đồng vẫn làm.
        // Bắn rồi quên: studio đã có tiền, tin nhắn hỏng không được chặn việc.
        if (r.isDeposit) {
          fetch("/api/studio/zalo/lifecycle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contractId, event: "deposit_confirm", amount: r.amount }),
          }).catch(() => {});
        }
        router.refresh();
      } else {
        alert("Không ghi nhận được, thử lại hoặc mở hợp đồng.");
      }
    } catch {
      alert("Lỗi mạng, thử lại.");
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={collect}
      disabled={busy || done}
      className="flex-none rounded-[9px] px-3 py-2 text-[12px] font-semibold disabled:opacity-60"
      style={{ background: "var(--gnS)", color: "var(--gn)" }}
    >
      {busy ? <Loader2 size={13} className="mr-1 inline animate-spin" /> : <Check size={13} className="mr-1 inline" />}
      {done ? "Đã ghi nhận" : "Đã nhận"}
    </button>
  );
}
