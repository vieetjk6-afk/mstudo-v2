"use client";

import Link from "next/link";
import { ArrowUpRight, Check, CheckCircle2, CircleDashed, Copy, Download, ExternalLink, Ticket } from "lucide-react";
import MessengerButton from "@/components/MessengerButton";
import ZaloSendButton from "@/components/ZaloSendButton";
import { VoucherTicket, saveVoucherImage } from "@/components/voucher/VoucherTicket";
import { Badge, Callout, Section, btn, inputCls, type Tone } from "@/components/v2/kit";
import { Segmented } from "@/components/v2/kit-client";
import { vnd } from "@/lib/types";
import { VOUCHER_STATE_LABEL, voucherValueLabel, type VoucherState } from "@/lib/vouchers";
import { useIssuedVoucher, useLoyaltyVoucher, type IssuedVoucherProps, type LoyaltyMode, type LoyaltyVoucherProps } from "./useLoyaltyVoucher";

/* ═══════════════════════════════════════════════════════════════════════════
   VOUCHER ƯU ĐÃI LẦN SAU — giao diện mới (tab Thanh toán). Cùng logic với thẻ
   bản cũ (useLoyaltyVoucher): câu trạng thái, chọn cách áp cho hợp đồng này
   (theo chương trình · % riêng · tắt), ba điều kiện để tự tặng, và voucher đã
   tặng kèm nút gửi / tải ảnh.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATE_TONE: Record<VoucherState, Tone> = { usable: "green", unpaid: "amber", expired: "gray", redeemed: "blue", void: "red" };

export default function LoyaltyVoucherCardV2(props: LoyaltyVoucherProps) {
  const { contractId, clientName, clientPhone, clientMessenger, studioHost, studioName } = props;
  const lv = useLoyaltyVoucher(props);
  const { l, issued, mode, custom, busy, steps } = lv;
  if (lv.hidden) return null;

  const status = !l
    ? "Đang tải…"
    : issued
      ? `Đã tặng khách voucher ${voucherValueLabel(issued).replace(/^Giảm/, "giảm")} cho hợp đồng lần sau.`
      : l.stage === "cancelled"
        ? "Hợp đồng đã huỷ — không tặng voucher."
        : l.stage === "off"
          ? mode === "off"
            ? "Đã tắt voucher cho hợp đồng này."
            : l.tiers.length && l.total > 0
              ? `Hợp đồng ${vnd(l.total)} chưa đạt mốc tặng voucher thấp nhất.`
              : "Chương trình voucher đang tắt hoặc hợp đồng chưa có giá."
          : `Hợp đồng ${vnd(l.total)} → khách nhận voucher giảm ${l.percent}%${l.max ? ` (tối đa ${vnd(l.max)})` : ""} cho hợp đồng lần sau khi đủ điều kiện. Cổng khách đang hiện lời mời này.`;
  const nextTier =
    !issued && l && l.stage !== "off" && l.stage !== "cancelled" && l.next
      ? `Lên từ ${vnd(l.next.min)} được ${l.next.percent}%${(l.next.max ?? l.progMax) ? ` (tối đa ${vnd((l.next.max ?? l.progMax) as number)})` : ""}.`
      : null;
  const badge: { tone: Tone; text: string } | null = !l
    ? null
    : issued
      ? { tone: "green", text: "Đã tặng" }
      : l.stage === "cancelled" || l.stage === "off"
        ? { tone: "gray", text: "Không tặng" }
        : { tone: "amber", text: "Chờ đủ điều kiện" };
  const vouchers = [...(issued ? [issued] : []), ...lv.others];

  return (
    <div data-testid="loyalty-voucher-card" className="contents">
      <Section
        title="Voucher ưu đãi lần sau"
        icon={Ticket}
        desc="Tự tặng khi khách ký, studio xác nhận cọc và studio ký — khách thấy ngay trên cổng hợp đồng."
        actions={
          <Link href="/dashboard/studio/vouchers" className={btn("ghost", "sm")}>
            <span className="hidden sm:inline">Cài đặt chương trình</span>
            <span className="sm:hidden">Cài đặt</span> <ArrowUpRight size={15} />
          </Link>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-3">
            <p className="min-w-0 flex-1 text-[13.5px]" style={{ color: "var(--tx2)" }}>
              {status}
              {nextTier ? <span style={{ color: "var(--tx3)" }}> {nextTier}</span> : null}
            </p>
            {badge && (
              <span className="order-first flex-none sm:order-none">
                <Badge tone={badge.tone} dot>
                  {badge.text}
                </Badge>
              </span>
            )}
          </div>

          {!issued && l?.stage !== "cancelled" && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
              <span className="text-[13px] font-medium" style={{ color: "var(--tx2)" }}>
                Hợp đồng này
              </span>
              <div className={busy ? "pointer-events-none opacity-60" : ""}>
                <Segmented<LoyaltyMode>
                  size="sm"
                  label="Cách tặng voucher cho hợp đồng này"
                  value={mode}
                  onChange={(m) => lv.saveMode(m)}
                  options={[
                    { value: "program", label: "Theo chương trình" },
                    { value: "custom", label: "% riêng" },
                    { value: "off", label: "Tắt" },
                  ]}
                />
              </div>
              {mode === "custom" && (
                <span className="flex items-center gap-1.5 text-[13.5px]">
                  <input
                    className={`${inputCls} !h-8 !w-16 text-center`}
                    inputMode="numeric"
                    aria-label="Phần trăm giảm riêng"
                    value={custom || ""}
                    onChange={(e) => lv.setCustom(Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0))}
                    onBlur={() => custom > 0 && lv.saveMode("custom", custom)}
                  />
                  %
                </span>
              )}
            </div>
          )}

          {!issued && l && (l.stage === "teaser" || l.stage === "pending") && (
            <ol className="flex flex-col gap-1.5" aria-label="Điều kiện tự tặng voucher">
              {steps.map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-[13px]" style={{ color: s.done ? "var(--gn)" : "var(--tx3)" }}>
                  {s.done ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}
                  <span style={{ color: s.done ? "var(--tx)" : undefined }}>{s.label}</span>
                </li>
              ))}
            </ol>
          )}

          {lv.err && <Callout tone="red">{lv.err}</Callout>}

          {vouchers.length > 0 && (
            <div className="flex flex-col gap-5 pt-1" style={{ borderTop: "1px solid var(--bd2)", paddingTop: 16 }}>
              {vouchers.map((v) => (
                <IssuedVoucherV2
                  key={v.id}
                  v={v}
                  today={lv.today}
                  studioHost={studioHost}
                  studioName={studioName}
                  clientName={clientName}
                  clientPhone={clientPhone}
                  clientMessenger={clientMessenger}
                  contractId={contractId}
                />
              ))}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

/** Một voucher đã tặng (giao diện mới): thẻ có QR + các nút gửi / chép / tải. Màn Voucher & thẻ quà dùng lại qua IssuedVoucher. */
export function IssuedVoucherV2(props: IssuedVoucherProps) {
  const { v, clientName, clientPhone, clientMessenger, contractId } = props;
  const iv = useIssuedVoucher(props);
  const usable = iv.state === "usable";
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)] sm:items-center">
      <VoucherTicket d={iv.ticket} />
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[14px] font-bold">{v.code}</span>
          <Badge tone={STATE_TONE[iv.state]} dot>
            {VOUCHER_STATE_LABEL[iv.state]}
          </Badge>
        </div>
        {usable && iv.link && (
          <div className="flex flex-col gap-2">
            <ZaloSendButton
              phone={clientPhone}
              name={clientName}
              audience="client"
              contractId={contractId}
              kind="loyalty_voucher"
              message={iv.message}
              className={btn("secondary", "md", "flex-1")}
              friendsBtnClass={btn("secondary", "md", "!px-3")}
            />
            <div className="grid grid-cols-2 gap-2">
              <MessengerButton link={clientMessenger} label="Messenger" message={iv.message} className={btn("secondary", "md", "w-full")} />
              <button type="button" onClick={iv.copyMessage} className={btn("secondary", "md", "w-full")}>
                {iv.copied ? <Check size={16} style={{ color: "var(--gn)" }} /> : <Copy size={16} />} {iv.copied ? "Đã chép" : "Chép lời nhắn"}
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              iv.setSaving(true);
              try {
                await saveVoucherImage(iv.ticket);
              } finally {
                iv.setSaving(false);
              }
            }}
            disabled={!iv.qr || iv.saving}
            className={btn("ghost", "sm")}
          >
            <Download size={15} /> {iv.saving ? "Đang tạo ảnh…" : "Tải ảnh voucher"}
          </button>
          {iv.link && (
            <a href={iv.link} target="_blank" rel="noreferrer" className={btn("ghost", "sm")}>
              <ExternalLink size={15} /> Mở trang voucher
            </a>
          )}
          {v.redeemed_contract_id && (
            <Link href={`/dashboard/studio/contracts/${v.redeemed_contract_id}`} className={btn("ghost", "sm")}>
              Đã dùng ở hợp đồng <ArrowUpRight size={15} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
