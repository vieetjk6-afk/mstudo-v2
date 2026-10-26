"use client";

import { AlertCircle, CheckCircle2, Clock, Landmark, Loader2, QrCode, Receipt, Wallet } from "lucide-react";
import { VietQR, type BankInfo } from "@/components/VietQR";
import { Badge, Card, Empty, InfoList, Progress, Section, Stack, btn } from "@/components/v2/kit";
import { Modal } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { PAYMENT_KIND_LABEL, vnd } from "@/lib/types";
import type { PortalPayment, PortalPlanRow } from "./types";
import type { usePortalPayment } from "./usePortal";

/* ═══════════════════════════════════════════════════════════════════════════
   THANH TOÁN — cổng khách, giao diện mới. Cùng dữ liệu và cùng thao tác với
   PaymentPanel (bản cũ): đợt tiếp theo, mã VietQR, báo "Tôi đã chuyển khoản"
   qua action "paid" của /api/c/[token]. Logic ở ./usePortal (usePortalPayment).

   Bố cục: một thẻ tóm tắt (còn phải trả + MỘT nút thanh toán) → danh sách đợt
   gọn từng dòng → thông tin chuyển khoản. Mã QR mở trong hộp thoại.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PortalPay = ReturnType<typeof usePortalPayment>;

export default function PaymentPanelV2({
  pay, total, paid, plan, payments, bank, studioName, today,
}: {
  pay: PortalPay;
  total: number;
  paid: number;
  plan: PortalPlanRow[];
  payments: PortalPayment[];
  bank: BankInfo;
  studioName: string;
  today: string;
}) {
  const { remaining, pct, nextDue } = pay;
  const overdue = !!nextDue?.due_date && nextDue.due_date < today;
  const done = total > 0 && remaining === 0;

  return (
    <Stack>
      {/* ── Tóm tắt ─────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium" style={{ color: "var(--tx2)" }}>{done ? "Hợp đồng" : "Còn phải trả"}</p>
            <p className="tnum mt-1 text-[28px] font-bold leading-none" style={{ letterSpacing: "-.8px", color: done ? "var(--gn)" : "var(--tx)" }}>
              {done ? "Đã thanh toán đủ" : vnd(remaining)}
            </p>
            <p className="tnum mt-2 text-[13px]" style={{ color: "var(--tx3)" }}>
              Đã trả <b style={{ color: "var(--gn)" }}>{vnd(paid)}</b> / {vnd(total)} · {pct}%
            </p>
          </div>
          <span className="v2-stat-icon" style={{ width: 40, height: 40, borderRadius: 12, background: done ? "var(--gnS)" : "var(--acS)", color: done ? "var(--gn)" : "var(--ac)" }}>
            {done ? <CheckCircle2 size={20} /> : <Wallet size={20} />}
          </span>
        </div>
        <div className="mt-3">
          <Progress value={pct} tone="green" />
        </div>

        {remaining > 0 && (
          <>
            {nextDue && (
              <div className="mt-4 flex items-center gap-3 rounded-[12px] px-3.5 py-3" style={{ background: overdue ? "var(--rdS)" : "var(--sf2)" }}>
                {overdue ? <AlertCircle size={18} style={{ color: "var(--rd)", flex: "none" }} /> : <Clock size={18} style={{ color: "var(--am)", flex: "none" }} />}
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px]" style={{ color: overdue ? "var(--rd)" : "var(--tx3)" }}>
                    Đợt tiếp theo · {nextDue.due_date ? `${overdue ? "quá hạn từ" : "hạn"} ${fmtDate(nextDue.due_date)}` : "chưa đặt hạn"}
                  </p>
                  <p className="text-[14px] font-semibold leading-snug" style={{ textWrap: "pretty" }}>{nextDue.label}</p>
                </div>
                <span className="tnum flex-none text-[14px] font-bold">{vnd(nextDue.amount)}</span>
              </div>
            )}
            <button type="button" onClick={() => pay.setQrOpen(true)} className={btn("primary", "lg", "mt-4 w-full")}>
              <QrCode size={18} /> {nextDue ? `Thanh toán ${nextDue.label.toLowerCase()}` : "Thanh toán đợt tiếp theo"}
            </button>
            <p className="mt-2 text-center text-[12px] leading-relaxed" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
              {bank.account
                ? "Quét mã QR bằng app ngân hàng — số tiền và nội dung đã điền sẵn."
                : `Liên hệ ${studioName} để nhận thông tin chuyển khoản.`}
            </p>
          </>
        )}
      </Card>

      {/* ── Các đợt ─────────────────────────────────────────────────────── */}
      <Section
        title={plan.length > 0 ? "Các đợt thanh toán" : "Các lần đã thanh toán"}
        desc={plan.length > 0 ? `${plan.filter((p) => p.paid).length}/${plan.length} đợt đã thanh toán` : undefined}
        icon={Receipt}
        flush
      >
        {plan.length > 0 ? (
          plan.map((p) => {
            const late = !p.paid && !!p.due_date && p.due_date < today;
            return (
              <PayRow
                key={p.id}
                state={p.paid ? "paid" : late ? "late" : "due"}
                label={p.label}
                note={p.paid ? `Đã thu ${p.paid_at ? fmtDate(p.paid_at) : ""}`.trim() : p.due_date ? `${late ? "Quá hạn từ" : "Hạn"} ${fmtDate(p.due_date)}` : "Chưa đặt hạn"}
                amount={p.amount}
                next={!p.paid && p.id === nextDue?.id}
              />
            );
          })
        ) : payments.length > 0 ? (
          payments.map((p) => (
            <PayRow key={p.id} state="paid" label={PAYMENT_KIND_LABEL[p.kind] ?? "Thanh toán"} note={`Đã thu ${fmtDate(p.paid_at)}`} amount={p.amount} />
          ))
        ) : (
          <Empty compact icon={Receipt} title="Chưa có đợt thanh toán nào" hint="Các đợt studio ghi nhận sẽ hiện ở đây." />
        )}
      </Section>

      {/* ── Thông tin chuyển khoản ──────────────────────────────────────── */}
      {remaining > 0 && bank.account && (
        <Section title="Thông tin chuyển khoản" desc="Dùng khi bạn muốn tự nhập trong app ngân hàng." icon={Landmark}>
          <InfoList
            items={[
              ...(bank.name ? [{ label: "Ngân hàng", value: bank.name }] : []),
              { label: "Số tài khoản", value: <span className="tnum">{bank.account}</span> },
              { label: "Chủ tài khoản", value: bank.holder ?? studioName },
              { label: "Nội dung", value: pay.addInfo },
            ]}
          />
        </Section>
      )}
    </Stack>
  );
}

function PayRow({ state, label, note, amount, next }: { state: "paid" | "late" | "due"; label: string; note: string; amount: number; next?: boolean }) {
  const ic =
    state === "paid"
      ? { Icon: CheckCircle2, fg: "var(--gn)", bg: "var(--gnS)" }
      : state === "late"
        ? { Icon: AlertCircle, fg: "var(--rd)", bg: "var(--rdS)" }
        : { Icon: Clock, fg: next ? "var(--am)" : "var(--tx3)", bg: next ? "var(--amS)" : "var(--sf2)" };
  return (
    <div className="v2-row">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full" style={{ background: ic.bg, color: ic.fg }}>
        <ic.Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="v2-row-title">{label}</p>
        <p className="v2-row-sub" style={state === "late" ? { color: "var(--rd)" } : undefined}>{note}</p>
      </div>
      <div className="flex flex-none flex-col items-end gap-1">
        <span className="tnum text-[14px] font-semibold" style={{ color: state === "paid" ? "var(--tx2)" : "var(--tx)" }}>{vnd(amount)}</span>
        {state === "paid" ? <Badge tone="green">Đã thu</Badge> : state === "late" ? <Badge tone="red">Quá hạn</Badge> : next ? <Badge tone="amber">Tiếp theo</Badge> : null}
      </div>
    </div>
  );
}

/** Hộp thoại mã QR của đợt tiếp theo + nút báo đã chuyển khoản. */
export function PaymentQrModalV2({ pay, bank }: { pay: PortalPay; bank: BankInfo }) {
  return (
    <Modal
      open={pay.qrOpen}
      onClose={() => pay.setQrOpen(false)}
      title={pay.nextDue?.label ?? "Thanh toán"}
      desc={<>Số tiền <b className="tnum" style={{ color: "var(--tx)" }}>{vnd(pay.qrAmount)}</b> — quét mã bằng app ngân hàng.</>}
      icon={QrCode}
      width={420}
      footer={
        <>
          <button type="button" onClick={() => pay.setQrOpen(false)} className={btn("ghost")}>
            Để sau
          </button>
          <button type="button" onClick={pay.reportPaid} disabled={pay.reporting} className={btn("primary", "md", "flex-1 sm:flex-none")}>
            {pay.reporting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {pay.reporting ? "Đang gửi…" : "Tôi đã chuyển khoản"}
          </button>
        </>
      }
    >
      <div className="rounded-[14px] px-3 py-4" style={{ background: "var(--sf2)" }}>
        <VietQR bank={bank} amount={pay.qrAmount} addInfo={pay.addInfo} />
      </div>
      <p className="mt-3 text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
        Chuyển xong, bấm “Tôi đã chuyển khoản” để studio đối chiếu và xác nhận.
      </p>
    </Modal>
  );
}
