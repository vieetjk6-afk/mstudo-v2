"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, Clock, Copy, Crown, Loader2, QrCode, RotateCw, X } from "lucide-react";
import { Badge, Callout, Card, Empty, PageHead, Section, btn, type Tone } from "@/components/v2/kit";
import { qrUrl } from "@/lib/vietqr";
import { vnd } from "@/lib/types";
import { UPGRADE_PAYMENT_LABEL, type UpgradePaymentStatus } from "@/lib/upgrade-payment";
import { usePayment, type PaymentProps } from "./usePayment";

/* ═══════════════════════════════════════════════════════════════════════════
   THANH TOÁN GÓI — giao diện mới. Cùng logic với PaymentView (bản cũ,
   ./usePayment); khác ở cách sắp xếp:
     • Dải các bước ở đầu trang: chuyển khoản → báo đã chuyển → đối chiếu →
       nâng gói (có SePay thì ba bước, gói tự nâng) — nhìn là biết đơn đang ở đâu.
     • Trái: thẻ mã QR kèm từng dòng thông tin chuyển khoản chép được, và nút
       chính "Tôi đã chuyển khoản". Phải: tóm tắt đơn hàng + tổng tiền.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS_TONE: Record<UpgradePaymentStatus, Tone> = { none: "gray", awaiting_confirm: "amber", paid: "green", failed: "red" };

type StepState = "done" | "current" | "error" | "todo";

export default function PaymentViewV2(props: PaymentProps) {
  const { amount, code, bank, autoConfirm = false, cycle } = props;
  const p = usePayment(props);
  const qr = p.payable ? qrUrl(bank, amount, code || "") : null;

  // Các bước — có SePay thì không cần bấm "đã chuyển", tiền về là gói tự nâng.
  const steps = autoConfirm
    ? [
        { label: "Chuyển khoản", sub: "Quét mã QR" },
        { label: "Tiền về", sub: "Tự nhận trong vài giây" },
        { label: "Nâng gói", sub: "Tự động" },
      ]
    : [
        { label: "Chuyển khoản", sub: "Quét mã QR" },
        { label: "Báo đã chuyển", sub: "Bấm nút bên dưới" },
        { label: "Đối chiếu", sub: "mstudo xem sao kê" },
        { label: "Nâng gói", sub: "Dùng ngay" },
      ];
  const at =
    p.status === "paid" ? steps.length
    : p.status === "none" ? 0
    : autoConfirm ? 1 : 2; // awaiting_confirm / failed
  const stateOf = (i: number): StepState =>
    i < at ? "done" : i === at ? (p.status === "failed" ? "error" : "current") : "todo";

  const statusText =
    p.status === "awaiting_confirm"
      ? "Bên mình sẽ xác nhận sau khi thấy tiền trong sao kê. Trang này tự cập nhật, bạn không cần chờ ở đây."
      : p.status === "paid"
        ? "Gói đã được kích hoạt — tải lại trang để dùng ngay các tính năng mới."
        : p.status === "failed"
          ? p.note || "Bên mình chưa nhận được tiền. Kiểm tra lại nội dung chuyển khoản rồi báo lại nhé."
          : "";

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <div className="flex flex-col gap-5">
        <PageHead
          title={`Gói ${p.planLabel} · ${p.cycleLabel}`}
          desc={
            autoConfirm
              ? "Quét mã QR (giữ nguyên số tiền & nội dung). Tiền về là gói được nâng tự động sau vài giây, trang này tự cập nhật."
              : "Chuyển khoản đúng số tiền & nội dung, rồi bấm “Tôi đã chuyển khoản”. Bên mình đối chiếu sao kê và nâng gói cho bạn."
          }
          actions={
            <Link href="/dashboard/upgrade" className={btn("ghost", "sm")}>
              <ArrowLeft size={15} /> Về trang gói
            </Link>
          }
        />

        {/* Các bước */}
        <Card>
          <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((s, i) => (
              <StepItem key={s.label} n={i + 1} label={s.label} sub={s.sub} state={stateOf(i)} last={i === steps.length - 1} />
            ))}
          </ol>
          {/* "Chờ chuyển khoản" đã nói ở đầu trang + nhãn đơn hàng — chỉ hiện lời
              nhắn khi đơn đã sang bước khác. */}
          {p.status !== "none" ? (
          <div className="mt-4">
            <Callout
              tone={STATUS_TONE[p.status] === "gray" ? "blue" : STATUS_TONE[p.status]}
              icon={p.status === "paid" ? Crown : p.status === "failed" ? AlertCircle : p.status === "awaiting_confirm" ? Clock : QrCode}
              title={UPGRADE_PAYMENT_LABEL[p.status]}
            >
              {statusText}
            </Callout>
          </div>
          ) : null}
        </Card>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          {p.status === "paid" ? (
            <div className="v2-card">
              <Empty
                icon={Crown}
                title={`Đã nâng lên gói ${p.planLabel}`}
                hint="Tải lại trang để dùng ngay các tính năng mới."
                action={
                  <button type="button" onClick={() => window.location.reload()} className={btn("primary")}>
                    <RotateCw size={16} /> Tải lại trang
                  </button>
                }
              />
            </div>
          ) : (
            <Section icon={QrCode} title="Quét mã để chuyển khoản" desc="Mở app ngân hàng → quét mã. Số tiền và nội dung đã điền sẵn.">
              {qr ? (
                <div className="flex flex-col gap-5">
                  <div className="grid items-center gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="mx-auto rounded-[16px] p-2.5" style={{ background: "#fff", border: "1px solid var(--bd)" }}>
                      <img src={qr} alt="Mã QR chuyển khoản" width={200} height={200} className="block h-auto min-h-[200px] w-[200px] object-contain" />
                    </div>
                    <dl className="v2-info min-w-0">
                      <TransferRow label="Ngân hàng" value={bank.name || bank.bin || "—"} />
                      <TransferRow label="Số tài khoản" value={(bank.account || "").replace(/\s/g, "")} copy mono />
                      {bank.holder ? <TransferRow label="Chủ tài khoản" value={bank.holder} /> : null}
                      <TransferRow label="Số tiền" value={vnd(amount)} copy={String(Math.round(amount))} strong />
                      {code ? (
                        <div className="v2-info-row items-center">
                          <dt>Nội dung</dt>
                          <dd className="flex min-w-0 items-center justify-end gap-1.5">
                            <span className="truncate rounded-[6px] px-1.5 py-0.5 font-mono font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>{code}</span>
                            <button type="button" onClick={p.copyCode} className="v2-icon-btn !h-7 !w-7" aria-label="Chép nội dung chuyển khoản" title="Chép">
                              {p.copied ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                  {code ? (
                    <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                      Ghi đúng nội dung <b style={{ color: "var(--tx)" }}>{code}</b> để bên mình đối chiếu được ngay.
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => void p.declare()} disabled={p.busy} className={btn("primary", "lg", "w-full")}>
                      {p.busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
                      {p.busy ? "Đang gửi…" : p.status === "awaiting_confirm" ? "Báo lại là đã chuyển khoản" : "Tôi đã chuyển khoản"}
                    </button>
                    {p.err ? (
                      <p className="flex items-center justify-center gap-1.5 text-[12.5px]" style={{ color: "var(--rd)" }}>
                        <X size={14} /> {p.err}
                      </p>
                    ) : null}
                    <p className="text-center text-[12px]" style={{ color: "var(--tx3)" }}>
                      Bấm nút này là <b>báo</b> đã chuyển — gói chỉ lên sau khi bên mình xác nhận đã nhận được tiền.
                    </p>
                  </div>
                </div>
              ) : (
                <Empty
                  compact
                  icon={QrCode}
                  title={amount > 0 ? "Chưa có tài khoản nhận tiền" : "Đơn này không cần thanh toán"}
                  hint={
                    amount > 0
                      ? "MStudo chưa cấu hình tài khoản nhận thanh toán — nhắn nhóm Zalo hỗ trợ để được hướng dẫn chuyển khoản."
                      : undefined
                  }
                />
              )}
            </Section>
          )}

          {/* Tóm tắt đơn */}
          <Card className="lg:sticky lg:top-[84px]">
            <div className="flex items-center justify-between gap-2">
              <p className="v2-section-title">Đơn hàng</p>
              <Badge tone={STATUS_TONE[p.status]} dot>{UPGRADE_PAYMENT_LABEL[p.status]}</Badge>
            </div>
            <dl className="v2-info mt-3">
              <div className="v2-info-row"><dt>Gói</dt><dd>{p.planLabel}</dd></div>
              <div className="v2-info-row"><dt>Thời hạn</dt><dd>{p.cycleLabel}{cycle === "year" ? " + 30 ngày tặng" : ""}</dd></div>
              {code ? <div className="v2-info-row"><dt>Mã đơn</dt><dd className="font-mono">{code}</dd></div> : null}
            </dl>
            <div className="mt-3 flex items-end justify-between gap-3 rounded-[12px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
              <span className="text-[13px] font-semibold" style={{ color: "var(--tx2)" }}>Tổng thanh toán</span>
              <span className="v2-num text-[22px] font-bold tracking-[-0.4px]">{vnd(amount)}</span>
            </div>
            <p className="mt-3 text-[12px]" style={{ color: "var(--tx3)" }}>
              Số tiền đã chốt lúc bạn chọn gói (gồm mã giảm giá nếu có).
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StepItem({ n, label, sub, state, last }: { n: number; label: string; sub: string; state: StepState; last: boolean }) {
  const circle: React.CSSProperties =
    state === "done" ? { background: "var(--gn)", color: "#fff" }
    : state === "current" ? { background: "var(--acS)", color: "var(--ac)", boxShadow: "inset 0 0 0 2px var(--ac)" }
    : state === "error" ? { background: "var(--rd)", color: "#fff" }
    : { background: "var(--sf2)", color: "var(--tx3)", boxShadow: "inset 0 0 0 1px var(--bd)" };
  return (
    <li className="relative flex min-w-0 flex-col items-center text-center">
      {!last ? (
        <span
          aria-hidden
          className="absolute top-[15px] h-[2px]"
          style={{ left: "calc(50% + 22px)", right: "calc(-50% + 22px)", background: state === "done" ? "var(--gn)" : "var(--bd)" }}
        />
      ) : null}
      <span className="relative flex h-[32px] w-[32px] items-center justify-center rounded-full text-[13px] font-bold" style={circle}>
        {state === "done" ? <Check size={16} strokeWidth={3} /> : state === "error" ? <X size={16} strokeWidth={3} /> : n}
      </span>
      <span
        className="mt-2 text-[13px] font-semibold leading-tight"
        style={{ color: state === "todo" ? "var(--tx3)" : state === "error" ? "var(--rd)" : "var(--tx)" }}
      >
        {label}
      </span>
      <span className="mt-0.5 hidden text-[12px] sm:block" style={{ color: "var(--tx3)" }}>{sub}</span>
    </li>
  );
}

/** Một dòng thông tin chuyển khoản; `copy` = chép giá trị (hoặc chuỗi riêng). */
function TransferRow({ label, value, copy, mono, strong }: { label: string; value: string; copy?: boolean | string; mono?: boolean; strong?: boolean }) {
  const [done, setDone] = useState(false);
  const text = typeof copy === "string" ? copy : value;
  return (
    <div className="v2-info-row items-center">
      <dt>{label}</dt>
      <dd className="flex min-w-0 items-center justify-end gap-1.5">
        <span className={`truncate ${mono ? "font-mono" : ""}`} style={strong ? { fontWeight: 700, fontSize: 15 } : undefined}>{value}</span>
        {copy ? (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(text);
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            }}
            className="v2-icon-btn !h-7 !w-7"
            aria-label={`Chép ${label.toLowerCase()}`}
            title="Chép"
          >
            {done ? <Check size={14} /> : <Copy size={14} />}
          </button>
        ) : null}
      </dd>
    </div>
  );
}
