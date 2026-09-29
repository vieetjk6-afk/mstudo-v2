"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Ticket, Download, Copy, Check, ExternalLink, CircleDashed, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { studioUrl } from "@/lib/hosts";
import { fmtDate, todayVN } from "@/lib/date";
import { vnd } from "@/lib/types";
import MessengerButton from "@/components/MessengerButton";
import ZaloSendButton from "@/components/ZaloSendButton";
import { VoucherTicket, saveVoucherImage, type TicketData } from "@/components/voucher/VoucherTicket";
import { loyaltyVoucherMessage } from "@/lib/share-messages";
import { VOUCHER_COLS, VOUCHER_STATE_LABEL, voucherState, voucherTerms, voucherValueLabel, type Voucher } from "@/lib/vouchers";

type Loyalty = {
  stage: "off" | "teaser" | "pending" | "issued" | "cancelled";
  percent: number;
  amount: number;
  max: number | null;
  missing: string[];
  voucher: Voucher | null;
};

/**
 * Voucher ưu đãi của hợp đồng theo CHƯƠNG TRÌNH của studio (cài ở Voucher &
 * thẻ quà). Studio không phải bấm tặng: đủ ba điều kiện (khách ký, studio xác
 * nhận cọc, studio ký) là máy chủ tự phát, và khách thấy ngay trên cổng hợp
 * đồng. Ở đây studio xem tiến độ, tắt hoặc đặt % riêng cho hợp đồng này, và
 * gửi / tải voucher khi đã có.
 */
export default function LoyaltyVoucherCard({
  contractId,
  initialPercent,
  refreshKey,
  clientName,
  clientPhone,
  clientMessenger,
  studioHost,
  studioName,
}: {
  contractId: string;
  /** studio_contracts.loyalty_percent: null theo chương trình · 0 tắt · n% riêng */
  initialPercent: number | null;
  /** Đổi khi thu tiền / ký thay đổi → hỏi lại máy chủ (có thể vừa đủ điều kiện). */
  refreshKey: string;
  clientName: string;
  clientPhone: string;
  clientMessenger: string;
  studioHost: string | null;
  studioName: string;
}) {
  const supabase = createClient();
  const today = todayVN();
  const [l, setL] = useState<Loyalty | null>(null);
  const [others, setOthers] = useState<Voucher[]>([]);
  const [mode, setMode] = useState<"program" | "off" | "custom">(initialPercent == null ? "program" : initialPercent === 0 ? "off" : "custom");
  const [custom, setCustom] = useState<number>(initialPercent && initialPercent > 0 ? initialPercent : 5);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Vai trò không có quyền voucher (vd. thợ) → ẩn cả thẻ thay vì "Đang tải…" mãi. */
  const [hidden, setHidden] = useState(false);

  const call = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await fetch("/api/studio/vouchers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractId, ...body }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          setHidden(true);
          return;
        }
        if (!res.ok) {
          setErr(j.error === "missing_migration" ? "Cần chạy supabase/voucher-uu-dai.sql trong Supabase trước." : `Lỗi: ${j.error || res.status}`);
          return;
        }
        setErr(null);
        setL(j.loyalty as Loyalty);
      } catch {
        setErr("Lỗi mạng, thử lại nhé.");
      } finally {
        setBusy(false);
      }
    },
    [contractId]
  );

  useEffect(() => {
    call({ action: "loyalty_status" });
  }, [call, refreshKey]);

  // Voucher tặng TAY từ trước (bản cũ) vẫn hiện để studio gửi / theo dõi.
  useEffect(() => {
    supabase
      .from("studio_vouchers")
      .select(VOUCHER_COLS)
      .eq("source_contract_id", contractId)
      .eq("program_issued", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => setOthers((data ?? []) as Voucher[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  function saveMode(next: "program" | "off" | "custom", pct = custom) {
    setMode(next);
    call({ action: "contract_loyalty", percent: next === "program" ? null : next === "off" ? 0 : pct });
  }

  const issued = l?.voucher ?? null;
  const steps = [
    { label: "Khách ký hợp đồng", done: !l?.missing.includes("Khách ký hợp đồng") },
    { label: "Studio xác nhận đã nhận cọc", done: !l?.missing.includes("Studio xác nhận đã nhận cọc") },
    { label: "Studio ký xác nhận hợp đồng", done: !l?.missing.includes("Studio ký xác nhận hợp đồng") },
  ];

  if (hidden) return null;

  return (
    <div className="card mb-6 p-4" data-testid="loyalty-voucher-card">
      <div className="flex flex-wrap items-start gap-3">
        <Ticket size={16} className="mt-0.5" style={{ color: "var(--brand)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>🎟️ Voucher ưu đãi lần sau</p>
          <p className="text-sm" style={{ color: "var(--text2)" }}>
            {!l ? "Đang tải…"
              : issued ? `Đã tặng khách voucher ${vnd(issued.amount)} (${l.percent}% giá trị hợp đồng).`
              : l.stage === "cancelled" ? "Hợp đồng đã huỷ — không tặng voucher."
              : l.stage === "off" ? (mode === "off" ? "Đã tắt voucher cho hợp đồng này." : "Chương trình voucher đang tắt hoặc hợp đồng chưa có giá.")
              : `Khách sẽ nhận voucher ~${vnd(l.amount)} (${l.percent}%${l.max ? `, tối đa ${vnd(l.max)}` : ""}) khi đủ điều kiện. Cổng khách đang hiện lời mời này.`}
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

/** Một voucher đã tặng: thẻ có QR + các nút gửi/chép/tải. Màn Voucher & thẻ quà dùng lại. */
export function IssuedVoucher({
  v,
  today,
  studioHost,
  studioName,
  clientName,
  clientPhone,
  clientMessenger,
  contractId,
}: {
  v: Voucher;
  today: string;
  studioHost: string | null;
  studioName: string;
  clientName: string;
  clientPhone: string;
  clientMessenger: string;
  contractId: string | null;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const link = v.public_token ? studioUrl(studioHost, `/voucher/${v.public_token}`) : null;
  const state = voucherState(v, today);
  const expires = v.expires_on ? fmtDate(v.expires_on) : null;
  const message = link
    ? loyaltyVoucherMessage({ name: clientName, value: voucherValueLabel(v), code: v.code, link, expires, studio: studioName })
    : "";

  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link, { margin: 1, width: 480, color: { dark: "#2b2118", light: "#ffffff" } }).then(setQr).catch(() => setQr(null));
  }, [link]);

  const ticket: TicketData = {
    studio: studioName,
    title: v.title,
    value: voucherValueLabel(v),
    code: v.code,
    expires,
    recipient: v.recipient_name,
    qr,
    stateLabel: state === "usable" ? null : VOUCHER_STATE_LABEL[state],
    terms: voucherTerms(v),
  };

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
