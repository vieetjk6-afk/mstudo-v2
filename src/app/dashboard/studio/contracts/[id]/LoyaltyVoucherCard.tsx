"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Ticket, Plus, Download, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { studioUrl } from "@/lib/hosts";
import { fmtDate, todayVN } from "@/lib/date";
import MoneyInput from "@/components/MoneyInput";
import DateInput from "@/components/DateInput";
import MessengerButton from "@/components/MessengerButton";
import ZaloSendButton from "@/components/ZaloSendButton";
import { VoucherTicket, saveVoucherImage, type TicketData } from "@/components/voucher/VoucherTicket";
import { loyaltyVoucherMessage } from "@/lib/share-messages";
import {
  VOUCHER_COLS,
  VOUCHER_STATE_LABEL,
  defaultExpiry,
  voucherState,
  voucherValueLabel,
  type DiscountType,
  type Voucher,
} from "@/lib/vouchers";

/**
 * "Tặng voucher lần sau" — studio tặng khách của hợp đồng ĐÃ KÝ một voucher
 * giảm giá (theo tiền hoặc %) cho hợp đồng tiếp theo. Voucher có QR trỏ về
 * /voucher/<token>: khách quét để đặt lịch kèm mã, hoặc lưu ảnh về máy.
 * Không dùng được ở chính hợp đồng này (máy chủ chặn).
 */
export default function LoyaltyVoucherCard({
  contractId,
  signed,
  clientName,
  clientPhone,
  clientMessenger,
  studioHost,
  studioName,
}: {
  contractId: string;
  signed: boolean;
  clientName: string;
  clientPhone: string;
  clientMessenger: string;
  studioHost: string | null;
  studioName: string;
}) {
  const supabase = createClient();
  const today = todayVN();
  const [list, setList] = useState<Voucher[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState<null | { type: DiscountType; amount: number; percent: number; max: number; expires: string; noExpiry: boolean }>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("studio_vouchers")
      .select(VOUCHER_COLS)
      .eq("source_contract_id", contractId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setMissing(true);
        setList((data ?? []) as Voucher[]);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  async function issue() {
    if (!form) return;
    if (form.type === "amount" && form.amount <= 0) return setErr("Nhập số tiền giảm.");
    if (form.type === "percent" && (form.percent < 1 || form.percent > 100)) return setErr("Nhập % giảm từ 1 đến 100.");
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/studio/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue",
          contractId,
          discount_type: form.type,
          amount: form.amount,
          percent: form.percent,
          max_discount: form.max,
          expires_on: form.expires,
          no_expiry: form.noExpiry,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(
          j.error === "missing_migration" ? `Cần chạy ${j.file || "supabase/voucher-uu-dai.sql"} trong Supabase trước.`
          : j.error === "contract_not_signed" ? "Hợp đồng chưa ký — tặng voucher sau khi khách đã ký."
          : res.status === 403 ? "Bạn không có quyền tặng voucher."
          : `Lỗi: ${j.error || res.status}`
        );
        return;
      }
      setList((p) => [j.voucher as Voucher, ...(p ?? [])]);
      setForm(null);
    } catch {
      setErr("Lỗi mạng, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mb-6 p-4" data-testid="loyalty-voucher-card">
      <div className="flex flex-wrap items-center gap-3">
        <Ticket size={16} style={{ color: "var(--brand)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>🎟️ Voucher ưu đãi lần sau</p>
          <p className="text-sm" style={{ color: "var(--text2)" }}>
            {signed
              ? "Tặng khách mã giảm giá cho hợp đồng tiếp theo — theo số tiền hoặc % hợp đồng, có QR để đặt lịch."
              : "Tặng được sau khi khách đã ký hợp đồng này."}
          </p>
        </div>
        {signed && !form && !missing && (
          <button
            onClick={() => { setErr(null); setForm({ type: "percent", amount: 0, percent: 10, max: 0, expires: defaultExpiry(today), noExpiry: false }); }}
            className="btn-primary px-3 py-2 text-xs"
          >
            <Plus size={14} /> Tặng voucher
          </button>
        )}
      </div>

      {missing && (
        <p className="mt-2 text-xs" style={{ color: "var(--s-amber)" }}>
          Cần chạy <code>supabase/voucher-uu-dai.sql</code> trong Supabase SQL Editor để dùng tính năng này.
        </p>
      )}

      {form && (
        <div className="mt-3 space-y-3 rounded-xl p-3" style={{ background: "var(--surface2)" }}>
          <div className="flex gap-1.5">
            {(["percent", "amount"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, type: t })}
                className="rounded-[20px] px-3 py-1.5 text-xs font-semibold"
                style={{ border: "1px solid var(--border)", background: form.type === t ? "var(--brand)" : "transparent", color: form.type === t ? "#fff" : "var(--text2)" }}
              >
                {t === "percent" ? "Giảm theo %" : "Giảm số tiền"}
              </button>
            ))}
          </div>
          {form.type === "percent" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">% giảm trên tổng hợp đồng</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={form.percent || ""}
                  onChange={(e) => setForm({ ...form, percent: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) })}
                />
              </label>
              <label className="block">
                <span className="label">Giảm tối đa (không bắt buộc)</span>
                <MoneyInput className="input" value={form.max} onChange={(n) => setForm({ ...form, max: n })} />
              </label>
            </div>
          ) : (
            <label className="block">
              <span className="label">Số tiền giảm</span>
              <MoneyInput className="input" value={form.amount} onChange={(n) => setForm({ ...form, amount: n })} />
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="label">Hạn dùng</span>
              {form.noExpiry ? (
                <p className="input flex items-center" style={{ color: "var(--text3)" }}>Không giới hạn</p>
              ) : (
                <DateInput value={form.expires} onChange={(v) => setForm({ ...form, expires: v })} />
              )}
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={form.noExpiry} onChange={(e) => setForm({ ...form, noExpiry: e.target.checked })} />
              Không giới hạn thời gian
            </label>
          </div>
          <p className="text-[11.5px]" style={{ color: "var(--text3)" }}>
            Voucher không dùng được cho chính hợp đồng này. Khi áp vào hợp đồng sau, voucher thành một dòng giảm giá.
          </p>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button onClick={issue} disabled={busy} className="btn-primary px-3 py-2 text-xs disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />} Tạo voucher
            </button>
            <button onClick={() => setForm(null)} className="btn-ghost px-3 py-2 text-xs">Huỷ</button>
          </div>
        </div>
      )}

      {list && list.length > 0 && (
        <div className="mt-4 space-y-5">
          {list.map((v) => (
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

function IssuedVoucher({
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
  contractId: string;
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
