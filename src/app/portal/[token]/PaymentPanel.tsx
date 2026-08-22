"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, QrCode, Wallet, X as XIcon } from "lucide-react";
import { VietQR, type BankInfo } from "@/components/VietQR";
import { ProgressBar } from "@/components/studio/ui";
import { Modal } from "@/components/studio/Modal";
import { fmtDate } from "@/lib/date";
import { PAYMENT_KIND_LABEL, vnd } from "@/lib/types";
import type { PortalPayment, PortalPlanRow } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   THẺ THANH TOÁN CỦA CỔNG KHÁCH — đã thu / còn lại / các đợt.

   Danh sách đợt lấy từ `contract_payment_plan` (studio chia đợt 30/20/30/20…).
   Studio chưa chia đợt thì thay bằng danh sách các LẦN ĐÃ THU thật
   (`contract_payments`) — vẫn đúng, thay vì hiện một khối trống.

   Nút chính mở mã VietQR đúng số tiền của đợt tiếp theo và ghi nội dung chuyển
   khoản kèm mã hợp đồng, rồi báo studio bằng action "paid" của /api/c/[token] —
   cùng cơ chế trang hợp đồng /c/ đang dùng, không thêm endpoint mới.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PaymentPanel({
  token, phone, total, paid, plan, payments, bank, studioName, contractCode, toast,
}: {
  token: string;
  phone: string;
  total: number;
  paid: number;
  plan: PortalPlanRow[];
  payments: PortalPayment[];
  bank: BankInfo;
  studioName: string;
  contractCode: string | null;
  toast: (m: string) => void;
}) {
  const remaining = Math.max(0, total - paid);
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const [qrOpen, setQrOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  /** Đợt tiếp theo phải thu = đợt chưa thu, hạn gần nhất. */
  const nextDue = useMemo(() => plan.find((p) => !p.paid) ?? null, [plan]);
  const qrAmount = nextDue?.amount ?? remaining;
  const addInfo = `${contractCode ? `${contractCode} ` : ""}${nextDue?.label ?? "Thanh toan hop dong"}`.slice(0, 50);

  async function reportPaid() {
    setReporting(true);
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "paid", phone }),
    });
    setReporting(false);
    if (res.ok) {
      toast("Đã báo studio — cảm ơn bạn!");
      setQrOpen(false);
      return;
    }
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    toast(j.message || "Chưa gửi được thông báo, thử lại sau.");
  }

  return (
    <section className="rounded-[16px] px-5 py-[18px]" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
      <h3 className="flex items-center gap-1.5 text-[15px] font-bold">
        <Wallet size={17} style={{ color: "var(--ac)" }} /> Thanh toán
      </h3>

      <p className="tnum mt-2.5 text-[20px] font-bold leading-none" style={{ letterSpacing: "-.5px", color: "var(--gn)" }}>
        {vnd(paid)}
      </p>
      <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>đã thanh toán · {pct}% giá trị hợp đồng</p>
      <ProgressBar pct={pct} color="var(--gn)" height={8} className="mt-2" />

      <div className="tnum mt-2 flex flex-wrap items-center justify-between gap-x-3 text-[12px]">
        <span style={{ color: "var(--tx2)" }}>Tổng hợp đồng <b style={{ color: "var(--tx)" }}>{vnd(total)}</b></span>
        <span style={{ color: "var(--tx2)" }}>Còn lại <b style={{ color: "var(--am)" }}>{vnd(remaining)}</b></span>
      </div>

      {/* ── Các đợt ─────────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-col">
        {plan.length > 0
          ? plan.map((p) => (
              <Row
                key={p.id}
                paid={p.paid}
                label={p.label}
                note={p.paid ? `Đã thu ${p.paid_at ? fmtDate(p.paid_at) : ""}`.trim() : p.due_date ? `Hạn ${fmtDate(p.due_date)}` : "Chưa đặt hạn"}
                amount={p.amount}
              />
            ))
          : payments.map((p) => (
              <Row
                key={p.id}
                paid
                label={PAYMENT_KIND_LABEL[p.kind] ?? "Thanh toán"}
                note={`Đã thu ${fmtDate(p.paid_at)}`}
                amount={p.amount}
              />
            ))}
        {plan.length === 0 && payments.length === 0 && (
          <p className="rounded-[10px] px-3 py-3 text-center text-[12px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>
            Chưa có đợt thanh toán nào được ghi nhận.
          </p>
        )}
      </div>

      {remaining > 0 && (
        <>
          <button
            onClick={() => setQrOpen(true)}
            className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-[11px] py-2.5 text-[13.5px] font-bold"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            <QrCode size={17} /> {nextDue ? `Thanh toán ${nextDue.label.toLowerCase()}` : "Thanh toán đợt tiếp theo"}
          </button>
          <p className="mt-2 text-center text-[11px] leading-relaxed" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
            {bank.account
              ? `Chuyển khoản ${bank.name ?? ""} ${bank.account} — ${bank.holder ?? studioName}`
              : `Liên hệ ${studioName} để nhận thông tin chuyển khoản.`}
          </p>
        </>
      )}

      {/* ── Hộp thoại QR ────────────────────────────────────────────────── */}
      {qrOpen && (
        <Modal onClose={() => setQrOpen(false)} maxWidth={380} scope="client-doc" labelledBy="qr-dialog-title">
          <div className="px-5 py-5">
            <div className="mb-3 flex items-center gap-2">
              <h4 id="qr-dialog-title" className="text-[14.5px] font-bold">{nextDue?.label ?? "Thanh toán"}</h4>
              <span className="tnum ml-auto text-[14px] font-bold" style={{ color: "var(--ac)" }}>{vnd(qrAmount)}</span>
              <button onClick={() => setQrOpen(false)} className="flex-none rounded-[9px] p-1.5" style={{ background: "var(--sf2)", color: "var(--tx2)" }} aria-label="Đóng">
                <XIcon size={15} />
              </button>
            </div>
            <VietQR bank={bank} amount={qrAmount} addInfo={addInfo} />
            <button
              onClick={reportPaid}
              disabled={reporting}
              className="mt-3.5 w-full rounded-[11px] py-2.5 text-[13px] font-bold disabled:opacity-60"
              style={{ background: "var(--ac)", color: "#fff" }}
            >
              {reporting ? "Đang gửi…" : "Tôi đã chuyển khoản"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Row({ paid, label, note, amount }: { paid: boolean; label: string; note: string; amount: number }) {
  return (
    <div className="flex items-center gap-2.5 py-2" style={{ borderTop: "1px solid var(--bd2)" }}>
      {paid ? (
        <CheckCircle2 size={17} style={{ flex: "none", color: "var(--gn)" }} />
      ) : (
        <Clock size={17} style={{ flex: "none", color: "var(--am)" }} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold">{label}</p>
        <p className="truncate text-[11px]" style={{ color: "var(--tx3)" }}>{note}</p>
      </div>
      <span className="tnum flex-none text-[13px] font-bold">{vnd(amount)}</span>
    </div>
  );
}
