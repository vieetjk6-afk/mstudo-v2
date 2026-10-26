"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { coordsInText } from "@/lib/weather";
import { DEFAULT_CANCEL_POLICY, type CancelPolicy } from "@/lib/contract-cancel";

/* Trạng thái + thao tác của thẻ "Chính sách studio" — dùng chung cho bản cũ
   (StudioPolicyCard) và bản giao diện mới (StudioPolicyCardV2). Xem ghi chú
   đầu StudioPolicyCard.tsx. */

export type StudioPolicyProps = {
  ownerId: string;
  initialStorageMonths: number;
  initialQuoteValidDays: number;
  /** Cọc giữ ngày khi khách đặt lịch (VND). 0 = tắt. */
  initialDeposit?: number;
  /** % cọc gợi ý khi lập đợt thanh toán của hợp đồng. 0 = không gợi ý. */
  initialContractDepositPercent?: number;
  /** Thưởng cho người giới thiệu (VND). 0 = tắt chương trình. */
  initialReferralReward?: number;
  /** Ưu đãi cho khách được giới thiệu (VND). */
  initialReferralDiscount?: number;
  /** Địa chỉ + toạ độ studio — điểm xuất phát để ước lượng đường đi tới điểm chụp. */
  initialStudioAddress?: string;
  initialStudioLat?: number | null;
  initialStudioLng?: number | null;
  /** Chính sách huỷ: gợi ý số tiền hoàn khi bấm "Huỷ HĐ". */
  initialCancelPolicy?: CancelPolicy;
};

export function useStudioPolicy({
  ownerId,
  initialStorageMonths,
  initialQuoteValidDays,
  initialDeposit = 0,
  initialContractDepositPercent = 25,
  initialReferralReward = 0,
  initialReferralDiscount = 0,
  initialStudioAddress = "",
  initialStudioLat = null,
  initialStudioLng = null,
  initialCancelPolicy = DEFAULT_CANCEL_POLICY,
}: StudioPolicyProps) {
  const supabase = createClient();
  const [months, setMonths] = useState(initialStorageMonths);
  const [days, setDays] = useState(initialQuoteValidDays);
  const [deposit, setDeposit] = useState(initialDeposit);
  const [depPct, setDepPct] = useState(initialContractDepositPercent);
  const [reward, setReward] = useState(initialReferralReward);
  const [discount, setDiscount] = useState(initialReferralDiscount);
  const [addr, setAddr] = useState(initialStudioAddress);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialStudioLat != null && initialStudioLng != null ? { lat: initialStudioLat, lng: initialStudioLng } : null
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [locNote, setLocNote] = useState<string | null>(null);
  const [cancel, setCancel] = useState<CancelPolicy>(initialCancelPolicy);
  const [clauseCopied, setClauseCopied] = useState(false);
  const pct = (n: number) => Math.max(0, Math.min(100, Math.round(n) || 0));

  /** Dán link Google Maps (hoặc "lat,lng") → tự đọc ra toạ độ. */
  function onAddr(v: string) {
    setAddr(v);
    const c = coordsInText(v);
    if (c) setCoords(c);
  }

  const money = (n: number) => Math.max(0, Math.min(100_000_000, Math.round(n) || 0));

  async function save() {
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        storage_months: Math.max(0, Math.min(120, Math.round(months) || 0)),
        quote_valid_days: Math.max(0, Math.min(365, Math.round(days) || 0)),
        booking_deposit: money(deposit),
        contract_deposit_percent: Math.max(0, Math.min(100, Math.round(depPct) || 0)),
        referral_reward: money(reward),
        referral_discount: money(discount),
      })
      .eq("id", ownerId);
    if (error) {
      setSaving(false);
      return setErr(error.message);
    }

    // Vị trí studio ghi ở lượt RIÊNG, và lỗi ở đây KHÔNG được làm hỏng phần trên.
    // Project chưa chạy supabase/migrations/weather.sql thì ba cột này chưa tồn
    // tại; nhồi chung một lượt update là cả thẻ chính sách không lưu được gì.
    setLocNote(null);
    const { error: locErr } = await supabase
      .from("profiles")
      .update({
        studio_address: addr.trim().slice(0, 300) || null,
        studio_lat: coords?.lat ?? null,
        studio_lng: coords?.lng ?? null,
      })
      .eq("id", ownerId);
    if (locErr) {
      // 42703 = cột không tồn tại; PGRST204 = schema cache của PostgREST chưa có cột.
      const missing = locErr.code === "42703" || locErr.code === "PGRST204" || /column .* does not exist/i.test(locErr.message);
      setLocNote(
        missing
          ? "Đã lưu chính sách. Riêng vị trí studio cần chạy supabase/migrations/weather.sql trước."
          : `Đã lưu chính sách, nhưng chưa lưu được vị trí studio: ${locErr.message}`
      );
    }

    // Chính sách huỷ: lượt RIÊNG như vị trí studio — chưa chạy
    // migrations/contract_cancel_reschedule.sql thì phần còn lại vẫn lưu được.
    const { error: cErr } = await supabase
      .from("profiles")
      .update({
        cancel_early_days: Math.max(0, Math.min(365, Math.round(cancel.earlyDays) || 0)),
        cancel_early_refund_pct: pct(cancel.earlyPct),
        cancel_late_refund_pct: pct(cancel.latePct),
      })
      .eq("id", ownerId);
    if (cErr) {
      const missing = cErr.code === "42703" || cErr.code === "PGRST204" || /column .* does not exist/i.test(cErr.message);
      setLocNote((prev) =>
        [prev, missing ? "Chính sách huỷ cần chạy supabase/huy-doi-lich.sql trước." : `Chưa lưu được chính sách huỷ: ${cErr.message}`]
          .filter(Boolean)
          .join(" ")
      );
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  return {
    months, setMonths, days, setDays, deposit, setDeposit, depPct, setDepPct, reward, setReward, discount, setDiscount,
    addr, onAddr, coords, saving, saved, err, locNote, cancel, setCancel, clauseCopied, setClauseCopied, pct, save,
  };
}
