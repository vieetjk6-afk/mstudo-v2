"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { studioUrl } from "@/lib/hosts";
import { fmtDate, todayVN } from "@/lib/date";
import { loyaltyVoucherMessage } from "@/lib/share-messages";
import type { TicketData } from "@/components/voucher/VoucherTicket";
import { VOUCHER_COLS, VOUCHER_STATE_LABEL, voucherState, voucherTerms, voucherValueLabel, type Voucher } from "@/lib/vouchers";

/* ═══════════════════════════════════════════════════════════════════════════
   Logic "Voucher ưu đãi lần sau" của hợp đồng — dùng chung cho thẻ bản cũ
   (LoyaltyVoucherCard) và bản giao diện mới (LoyaltyVoucherCardV2). Tách ra
   file riêng để LoyaltyVoucherCard.tsx nhập được IssuedVoucherV2 mà không vòng
   import.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Loyalty = {
  stage: "off" | "teaser" | "pending" | "issued" | "cancelled";
  percent: number;
  tiers: { min: number; percent: number }[];
  total: number;
  next: { min: number; percent: number; max?: number | null } | null;
  progMax: number | null;
  max: number | null;
  missing: string[];
  voucher: Voucher | null;
};

export type LoyaltyMode = "program" | "off" | "custom";

export type LoyaltyVoucherProps = {
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
};

export function useLoyaltyVoucher({ contractId, initialPercent, refreshKey }: LoyaltyVoucherProps) {
  const supabase = createClient();
  const today = todayVN();
  const [l, setL] = useState<Loyalty | null>(null);
  const [others, setOthers] = useState<Voucher[]>([]);
  const [mode, setMode] = useState<LoyaltyMode>(initialPercent == null ? "program" : initialPercent === 0 ? "off" : "custom");
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

  function saveMode(next: LoyaltyMode, pct = custom) {
    setMode(next);
    call({ action: "contract_loyalty", percent: next === "program" ? null : next === "off" ? 0 : pct });
  }

  const issued = l?.voucher ?? null;
  const steps = [
    { label: "Khách ký hợp đồng", done: !l?.missing.includes("Khách ký hợp đồng") },
    { label: "Studio xác nhận đã nhận cọc", done: !l?.missing.includes("Studio xác nhận đã nhận cọc") },
    { label: "Studio ký xác nhận hợp đồng", done: !l?.missing.includes("Studio ký xác nhận hợp đồng") },
  ];

  return { today, l, others, mode, custom, setCustom, err, busy, hidden, saveMode, issued, steps };
}

export type IssuedVoucherProps = {
  v: Voucher;
  today: string;
  studioHost: string | null;
  studioName: string;
  clientName: string;
  clientPhone: string;
  clientMessenger: string;
  contractId: string | null;
};

/** Một voucher đã tặng: link, lời nhắn gửi khách, ảnh QR và dữ liệu thẻ để vẽ / tải ảnh. */
export function useIssuedVoucher({ v, today, studioHost, studioName, clientName }: IssuedVoucherProps) {
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
    // Nạp thư viện QR lúc cần (chỉ khi đã có voucher) thay vì kéo vào bundle của
    // trang hợp đồng vốn đã rất nặng. Cờ `stale` chặn setState khi link đổi/unmount.
    let stale = false;
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(link, { margin: 1, width: 480, color: { dark: "#2b2118", light: "#ffffff" } }))
      .then((url) => { if (!stale) setQr(url); })
      .catch(() => { if (!stale) setQr(null); });
    return () => { stale = true; };
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

  function copyMessage() {
    navigator.clipboard?.writeText(message).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return { qr, copied, setCopied, saving, setSaving, link, state, message, ticket, copyMessage };
}
