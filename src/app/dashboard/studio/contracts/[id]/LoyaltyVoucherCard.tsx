"use client";

import { Ticket, Download, Copy, Check, ExternalLink, CircleDashed, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { vnd } from "@/lib/types";
import MessengerButton from "@/components/MessengerButton";
import ZaloSendButton from "@/components/ZaloSendButton";
import { VoucherTicket, saveVoucherImage } from "@/components/voucher/VoucherTicket";
import { voucherValueLabel } from "@/lib/vouchers";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { useIssuedVoucher, useLoyaltyVoucher, type IssuedVoucherProps, type LoyaltyVoucherProps } from "./useLoyaltyVoucher";
import { IssuedVoucherV2 } from "./LoyaltyVoucherCardV2";

/**
 * Voucher ưu đãi của hợp đồng theo CHƯƠNG TRÌNH của studio (cài ở Voucher &
 * thẻ quà). Studio không phải bấm tặng: đủ ba điều kiện (khách ký, studio xác
 * nhận cọc, studio ký) là máy chủ tự phát, và khách thấy ngay trên cổng hợp
 * đồng. Ở đây studio xem tiến độ, tắt hoặc đặt % riêng cho hợp đồng này, và
 * gửi / tải voucher khi đã có.
 */
export default function LoyaltyVoucherCard(props: LoyaltyVoucherProps) {
  const { contractId, clientName, clientPhone, clientMessenger, studioHost, studioName } = props;
  const { today, l, others, mode, custom, setCustom, err, busy, hidden, saveMode, issued, steps } = useLoyaltyVoucher(props);

  if (hidden) return null;

  return (
    <div className="card mb-6 p-4" data-testid="loyalty-voucher-card">
      <div className="flex flex-wrap items-start gap-3">
        <Ticket size={16} className="mt-0.5" style={{ color: "var(--brand)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>🎟️ Voucher ưu đãi lần sau</p>
          <p className="text-sm" style={{ color: "var(--text2)" }}>
            {!l ? "Đang tải…"
              : issued ? `Đã tặng khách voucher ${voucherValueLabel(issued).replace(/^Giảm/, "giảm")} cho hợp đồng lần sau.`
              : l.stage === "cancelled" ? "Hợp đồng đã huỷ — không tặng voucher."
              : l.stage === "off" ? (mode === "off" ? "Đã tắt voucher cho hợp đồng này." : l.tiers.length && l.total > 0 ? `Hợp đồng ${vnd(l.total)} chưa đạt mốc tặng voucher thấp nhất.` : "Chương trình voucher đang tắt hoặc hợp đồng chưa có giá.")
              : `Hợp đồng ${vnd(l.total)} → khách nhận voucher giảm ${l.percent}%${l.max ? ` (tối đa ${vnd(l.max)})` : ""} cho hợp đồng lần sau khi đủ điều kiện. Cổng khách đang hiện lời mời này.${l.next ? ` Lên từ ${vnd(l.next.min)} được ${l.next.percent}%${(l.next.max ?? l.progMax) ? ` (tối đa ${vnd((l.next.max ?? l.progMax) as number)})` : ""}.` : ""}`}
          </p>
        </div>
        <Link href="/dashboard/studio/vouchers" className="text-xs font-semibold" style={{ color: "var(--brand)" }}>Cài đặt chương trình →</Link>
      </div>

      {!issued && l?.stage !== "cancelled" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span style={{ color: "var(--text3)" }}>Hợp đồng này:</span>
          {([["program", "Theo chương trình"], ["custom", "% riêng"], ["off", "Tắt"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => saveMode(k)}
              disabled={busy}
              className="rounded-[20px] px-2.5 py-1 font-semibold"
              style={{ border: "1px solid var(--border)", background: mode === k ? "var(--brand)" : "transparent", color: mode === k ? "#fff" : "var(--text2)" }}
            >
              {label}
            </button>
          ))}
          {mode === "custom" && (
            <span className="flex items-center gap-1">
              <input
                className="input w-16 py-1 text-center"
                inputMode="numeric"
                value={custom || ""}
                onChange={(e) => setCustom(Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0))}
                onBlur={() => custom > 0 && saveMode("custom", custom)}
              />
              %
            </span>
          )}
        </div>
      )}

      {!issued && l && (l.stage === "teaser" || l.stage === "pending") && (
        <ul className="mt-3 space-y-1 text-[12.5px]">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5" style={{ color: s.done ? "var(--s-green)" : "var(--text3)" }}>
              {s.done ? <CheckCircle2 size={14} /> : <CircleDashed size={14} />} {s.label}
            </li>
          ))}
        </ul>
      )}

      {err && <p className="mt-2 text-xs text-red-500">{err}</p>}

      {(issued || others.length > 0) && (
        <div className="mt-4 space-y-5">
          {[...(issued ? [issued] : []), ...others].map((v) => (
            <IssuedVoucher
              key={v.id}
              v={v}
              today={today}
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
  );
}

/**
 * Một voucher đã tặng: thẻ có QR + các nút gửi/chép/tải. Màn Voucher & thẻ quà
 * dùng lại — trong khung giao diện mới thì vẽ bản V2 (IssuedVoucherV2).
 */
export function IssuedVoucher(props: IssuedVoucherProps) {
  return useUiV2() ? <IssuedVoucherV2 {...props} /> : <IssuedVoucherV1 {...props} />;
}

function IssuedVoucherV1(props: IssuedVoucherProps) {
  const { v, clientName, clientPhone, clientMessenger, contractId } = props;
  const { qr, copied, setCopied, saving, setSaving, link, state, message, ticket } = useIssuedVoucher(props);

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,360px)_1fr] sm:items-center">
      <VoucherTicket d={ticket} />
      <div className="flex flex-wrap gap-2">
        {state === "usable" && link && (
          <>
            <ZaloSendButton phone={clientPhone} name={clientName} audience="client" contractId={contractId} kind="loyalty_voucher" message={message} className="act-btn" />
            <MessengerButton link={clientMessenger} label="Messenger" message={message} />
            <button
              onClick={() => { navigator.clipboard?.writeText(message).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="btn-ghost px-2.5 py-1.5 text-xs"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Đã chép lời nhắn" : "Chép link kèm lời nhắn"}
            </button>
          </>
        )}
        <button
          onClick={async () => { setSaving(true); try { await saveVoucherImage(ticket); } finally { setSaving(false); } }}
          disabled={!qr || saving}
          className="btn-ghost px-2.5 py-1.5 text-xs disabled:opacity-50"
        >
          <Download size={13} /> {saving ? "Đang tạo ảnh…" : "Tải ảnh voucher"}
        </button>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs">
            <ExternalLink size={13} /> Mở trang voucher
          </a>
        )}
        {v.redeemed_contract_id && (
          <a href={`/dashboard/studio/contracts/${v.redeemed_contract_id}`} className="btn-ghost px-2.5 py-1.5 text-xs">
            Đã dùng ở hợp đồng →
          </a>
        )}
      </div>
    </div>
  );
}
