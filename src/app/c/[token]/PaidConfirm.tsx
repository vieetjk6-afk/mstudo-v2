"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { vnd } from "@/lib/types";
import { fmtDate, fmtDateTime } from "@/lib/date";

/** Một khoản tiền vừa về (studio ghi tay hoặc SePay tự ghi). */
export type PaidEvent = {
  amount: number;
  paidAt: string | null;
  /** paidAt có GIỜ (đợt thanh toán, timestamptz) hay chỉ có ngày (lần thu, kiểu date). */
  hasTime: boolean;
  /** Tên đợt vừa thu ("Đặt cọc", "Đợt 2"…) nếu khớp được đợt. */
  label: string | null;
  deposit: boolean;
};

type PayRow = { id: string; amount: number; kind: string | null; paid_at: string | null };
type PlanRow = { id: string; label: string; paid: boolean; paid_at: string | null; payment_id?: string | null };

const POLL_MS = 12_000;
/** Ngừng hỏi sau 30 phút không có thao tác thanh toán nào — tránh trang mở quên. */
const IDLE_STOP_MS = 30 * 60_000;

/**
 * Theo dõi tiền về khi khách đang ở trang hợp đồng: hỏi nhẹ máy chủ mỗi 12 giây
 * (chỉ khi trang đang hiện), và hỏi ngay khi khách quay lại từ app ngân hàng.
 * Có khoản thu MỚI → gọi onPaid để trang chuyển sang màn "Đã nhận cọc".
 */
export function usePaymentWatch({
  token,
  phone,
  active,
  knownIds,
  nudge,
  onPaid,
}: {
  token: string;
  phone: string;
  /** Còn tiền phải trả và đã mở khoá hợp đồng. */
  active: boolean;
  /** Các lần thu đã có lúc tải trang — không báo lại. */
  knownIds: string[];
  /** Đổi giá trị mỗi khi khách có thao tác thanh toán (mở QR, báo đã chuyển…) → hỏi tiếp 30 phút. */
  nudge: number;
  onPaid: (e: PaidEvent) => void;
}) {
  const known = useRef(new Set<string>());
  const cb = useRef(onPaid);
  cb.current = onPaid;
  useEffect(() => {
    for (const id of knownIds) known.current.add(id);
  }, [knownIds]);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let busy = false;
    const until = Date.now() + IDLE_STOP_MS;

    async function check() {
      if (stopped || busy || document.visibilityState !== "visible" || Date.now() > until) return;
      busy = true;
      try {
        const r = await fetch(`/api/c/${token}/pay-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        if (!r.ok) return;
        const j = (await r.json()) as { payments?: PayRow[]; plan?: PlanRow[] };
        const fresh = (j.payments ?? []).filter((p) => !known.current.has(p.id) && p.amount > 0 && p.kind !== "refund" && p.kind !== "voucher");
        if (!fresh.length || stopped) return;
        for (const p of fresh) known.current.add(p.id);
        const amount = fresh.reduce((t, p) => t + p.amount, 0);
        // Tên đợt: CHỈ đợt gắn đúng lần thu mới (payment_id) — không đoán theo
        // "đợt thu gần nhất", kẻo khoản thu lẻ bị gọi nhầm là "Đặt cọc".
        const ids = new Set(fresh.map((p) => p.id));
        const plan = (j.plan ?? []).find((p) => p.payment_id && ids.has(p.payment_id)) ?? null;
        const label = plan?.label ?? null;
        const deposit = fresh.some((p) => p.kind === "deposit") || /cọc|deposit/i.test(label ?? "");
        const day = fresh.map((p) => p.paid_at).filter(Boolean).sort().pop() ?? null;
        cb.current({ amount, paidAt: plan?.paid_at ?? day, hasTime: !!plan?.paid_at, label, deposit });
      } catch {
        /* mạng chập chờn: lần sau hỏi lại */
      } finally {
        busy = false;
      }
    }

    const iv = window.setInterval(check, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      stopped = true;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [active, token, phone, nudge]);
}

/** Màn xác nhận đã nhận tiền — hiện đè lên trang hợp đồng ngay khi tiền về. */
export function PaidConfirmScreen({
  e,
  lang,
  studioName,
  contractRef,
  eventDate,
  remaining,
  onClose,
}: {
  e: PaidEvent;
  lang: "vi" | "en";
  studioName: string;
  contractRef: string;
  eventDate: string | null;
  remaining: number;
  onClose: () => void;
}) {
  const vi = lang === "vi";
  const title = e.deposit
    ? vi ? "Đã nhận cọc!" : "Deposit received!"
    : vi ? "Đã nhận thanh toán!" : "Payment received!";
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.6)" }}
      role="dialog"
      aria-modal="true"
      data-testid="paid-confirm"
    >
      <div className="w-full max-w-[380px] rounded-[20px] px-6 py-7 text-center" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <CheckCircle2 size={64} className="mx-auto" style={{ color: "var(--gn)" }} strokeWidth={1.6} />
        <p className="mt-3 text-[22px] font-extrabold" style={{ letterSpacing: "-.4px" }}>{title}</p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--tx2)" }}>
          {vi ? `${studioName} đã nhận được khoản chuyển của bạn.` : `${studioName} has received your transfer.`}
        </p>
        <div className="mt-5 space-y-2 rounded-[14px] px-4 py-3 text-left text-[13px]" style={{ background: "var(--sf2)" }}>
          <Row k={vi ? "Số tiền" : "Amount"} v={<b style={{ color: "var(--gn)" }}>{vnd(e.amount)}</b>} />
          {e.label && <Row k={vi ? "Khoản" : "For"} v={e.label} />}
          <Row k={vi ? "Hợp đồng" : "Contract"} v={contractRef} />
          {e.paidAt && <Row k={vi ? "Thời gian" : "Time"} v={e.hasTime ? fmtDateTime(e.paidAt) : fmtDate(e.paidAt)} />}
          {e.deposit && eventDate && <Row k={vi ? "Lịch đã giữ" : "Date held"} v={fmtDate(eventDate)} />}
          <Row k={vi ? "Còn lại" : "Remaining"} v={remaining > 0 ? vnd(remaining) : vi ? "Đã thanh toán đủ" : "Fully paid"} />
        </div>
        <button onClick={onClose} className="mt-5 w-full rounded-[12px] py-3 text-[14px] font-bold text-white" style={{ background: "var(--ac)" }}>
          {vi ? "Xem hợp đồng" : "View contract"}
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span style={{ color: "var(--tx3)" }}>{k}</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
}
