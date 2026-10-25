"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PLAN_PRICING, PLAN_LABEL, type Plan } from "@/lib/plans";
import { mergeUpgradeContent, UPGRADE_DEFAULTS, type UpgradeContent } from "@/lib/upgrade-content";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của trang "Gói phần mềm" (bản cũ UpgradeView và bản
   mới UpgradeV2): đọc gói hiện tại + bảng giá + nội dung trang, mã giảm giá,
   mã dùng thử, dùng thử miễn phí, gửi yêu cầu nâng cấp rồi sang trang thanh
   toán. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Cycle = "month" | "year";

export interface Prices {
  basicMonth: number;
  basicYear: number;
  photographerMonth: number;
  photographerYear: number;
  photographerPlusMonth: number;
  photographerPlusYear: number;
  studioMonth: number;
  studioYear: number;
  basicDiscMonth: number; basicDiscYear: number;
  photographerDiscMonth: number; photographerDiscYear: number;
  photographerPlusDiscMonth: number; photographerPlusDiscYear: number;
  studioDiscMonth: number; studioDiscYear: number;
}

export type PaidPlan = "basic" | "photographer" | "photographer_plus" | "studio";

export const DEFAULT_PRICES: Prices = {
  basicMonth: PLAN_PRICING.basic.month,
  basicYear: PLAN_PRICING.basic.year,
  photographerMonth: PLAN_PRICING.photographer.month,
  photographerYear: PLAN_PRICING.photographer.year,
  photographerPlusMonth: PLAN_PRICING.photographer_plus.month,
  photographerPlusYear: PLAN_PRICING.photographer_plus.year,
  studioMonth: PLAN_PRICING.studio.month,
  studioYear: PLAN_PRICING.studio.year,
  basicDiscMonth: 0, basicDiscYear: 0,
  photographerDiscMonth: 0, photographerDiscYear: 0,
  photographerPlusDiscMonth: 0, photographerPlusDiscYear: 0,
  studioDiscMonth: 0, studioDiscYear: 50,
};

/** CHỈ cho màn xem trước (/uipreview): có thì dùng số này, không hỏi Supabase. */
export type UpgradeSeed = { currentPlan: Plan; trialUsed: boolean; content?: UpgradeContent; prices?: Prices };

// Feature comparison rows, plan labels/features and headline are admin-editable —
// loaded from site_settings.upgrade_content (with code defaults).

export function useUpgrade(seed?: UpgradeSeed) {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<Plan>(seed?.currentPlan ?? "free");
  const [content, setContent] = useState<UpgradeContent>(seed?.content ?? UPGRADE_DEFAULTS);
  const [prices, setPrices] = useState<Prices>(seed?.prices ?? DEFAULT_PRICES);
  const [cycle, setCycle] = useState<Cycle>("month");
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState("");
  const [modalPlan, setModalPlan] = useState<Plan | null>(null); // plan whose confirm form is open
  const [sending, setSending] = useState<Plan | null>(null);
  const [sentPlan, setSentPlan] = useState<Plan | null>(null);
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Discount code
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<{ code: string; percent: number; plan: string | null; cycle: string | null } | null>(null);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);

  // Trial code (instant self-serve)
  const [trialCode, setTrialCode] = useState("");
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialOk, setTrialOk] = useState(false);
  const [trialMsg, setTrialMsg] = useState<string | null>(null);

  // Free self-serve trial per plan (1 lần / tài khoản)
  const [trialUsed, setTrialUsed] = useState(seed?.trialUsed ?? false);
  const [startingTrial, setStartingTrial] = useState<Plan | null>(null);

  async function startTrial(plan: Plan) {
    setStartingTrial(plan); setTrialMsg(null);
    const res = await fetch("/api/trial/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
    const d = await res.json().catch(() => null);
    setStartingTrial(null);
    if (res.ok && d?.ok) {
      setTrialUsed(true); setTrialOk(true); setCurrentPlan(plan);
      setTrialMsg(`Đã kích hoạt dùng thử gói ${PLAN_LABEL[plan]} ${d.trial_days} ngày miễn phí! Tải lại trang để bắt đầu.`);
    } else {
      setTrialOk(false);
      setTrialMsg(d?.error === "already_used" ? "Mỗi tài khoản chỉ được dùng thử một lần." : d?.error === "already_paid" ? "Bạn đang dùng gói trả phí còn hạn." : "Không kích hoạt được, thử lại nhé.");
    }
  }

  async function redeemTrial() {
    const c = trialCode.trim().toUpperCase();
    if (!c) return;
    setTrialBusy(true);
    setTrialMsg(null);
    const res = await fetch("/api/discount/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: c }),
    });
    const d = await res.json().catch(() => null);
    setTrialBusy(false);
    if (res.ok && d?.ok) {
      setTrialOk(true);
      setCurrentPlan(d.plan as Plan);
      setTrialMsg(`Đã kích hoạt gói ${PLAN_LABEL[d.plan as Plan]} dùng thử ${d.trial_days} ngày! Tải lại trang để bắt đầu dùng.`);
    } else {
      setTrialOk(false);
      setTrialMsg(
        d?.error === "already_used" ? "Bạn đã dùng mã này rồi."
        : d?.error === "expired" ? "Mã đã hết hạn."
        : d?.error === "used_up" ? "Mã đã hết lượt dùng."
        : d?.error === "not_trial" ? "Mã này không phải mã dùng thử."
        : "Mã không hợp lệ hoặc đã hết hiệu lực."
      );
    }
  }

  useEffect(() => {
    if (seed) return;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("plan, trial_used_at").eq("id", user.id).maybeSingle();
        if (profile?.plan) setCurrentPlan(profile.plan as Plan);
        if (profile?.trial_used_at) setTrialUsed(true);
      }
      const { data: s } = await supabase
        .from("site_settings")
        .select("price_basic_month, price_basic_year, price_photographer_month, price_photographer_year, price_photographer_plus_month, price_photographer_plus_year, price_studio_month, price_studio_year, basic_discount_month_percent, basic_discount_year_percent, photographer_discount_month_percent, photographer_discount_year_percent, photographer_plus_discount_month_percent, photographer_plus_discount_year_percent, studio_discount_month_percent, studio_discount_year_percent, upgrade_content")
        .eq("id", 1)
        .maybeSingle();
      if (s) {
        setContent(mergeUpgradeContent((s as { upgrade_content?: unknown }).upgrade_content));
        setPrices({
          basicMonth: s.price_basic_month ?? DEFAULT_PRICES.basicMonth,
          basicYear: s.price_basic_year ?? DEFAULT_PRICES.basicYear,
          photographerMonth: s.price_photographer_month ?? DEFAULT_PRICES.photographerMonth,
          photographerYear: s.price_photographer_year ?? DEFAULT_PRICES.photographerYear,
          photographerPlusMonth: s.price_photographer_plus_month ?? DEFAULT_PRICES.photographerPlusMonth,
          photographerPlusYear: s.price_photographer_plus_year ?? DEFAULT_PRICES.photographerPlusYear,
          studioMonth: s.price_studio_month ?? DEFAULT_PRICES.studioMonth,
          studioYear: s.price_studio_year ?? DEFAULT_PRICES.studioYear,
          basicDiscMonth: s.basic_discount_month_percent ?? 0,
          basicDiscYear: s.basic_discount_year_percent ?? 0,
          photographerDiscMonth: s.photographer_discount_month_percent ?? 0,
          photographerDiscYear: s.photographer_discount_year_percent ?? 0,
          photographerPlusDiscMonth: s.photographer_plus_discount_month_percent ?? 0,
          photographerPlusDiscYear: s.photographer_plus_discount_year_percent ?? 0,
          studioDiscMonth: s.studio_discount_month_percent ?? 0,
          studioDiscYear: s.studio_discount_year_percent ?? 50,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyCode() {
    const c = codeInput.trim().toUpperCase();
    if (!c) return;
    setCodeMsg(null);
    const res = await fetch("/api/discount/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: c, cycle }),
    });
    const d = await res.json().catch(() => null);
    if (d?.valid) {
      setAppliedCode({ code: d.code, percent: d.percent, plan: d.plan, cycle: d.cycle });
      setCodeMsg(
        `Đã áp dụng mã ${d.code}: -${d.percent}%${d.plan ? ` (gói ${d.plan})` : ""}${d.cycle ? ` (${d.cycle === "year" ? "theo năm" : "theo tháng"})` : ""}.`
      );
    } else {
      setAppliedCode(null);
      setCodeMsg(
        d?.reason === "already_used"
          ? "Bạn đã sử dụng mã này rồi."
          : d?.reason === "wrong_cycle"
          ? "Mã chỉ áp dụng cho chu kỳ khác."
          : d?.reason === "wrong_plan"
          ? "Mã chỉ áp dụng cho gói khác."
          : "Mã không hợp lệ hoặc đã hết hiệu lực."
      );
    }
  }

  /** Mã giảm giá đang áp có dùng được cho gói này (ở chu kỳ đang chọn) không. */
  const codeAppliesTo = (plan: Plan) =>
    !!appliedCode && (!appliedCode.plan || appliedCode.plan === plan) && (!appliedCode.cycle || appliedCode.cycle === cycle);

  // Effective discount % for a plan, combining the base promo and any code.
  function discountFor(plan: Plan): number {
    const m = cycle === "month";
    let base = 0;
    if (plan === "basic") base = m ? prices.basicDiscMonth : prices.basicDiscYear;
    else if (plan === "photographer") base = m ? prices.photographerDiscMonth : prices.photographerDiscYear;
    else if (plan === "photographer_plus") base = m ? prices.photographerPlusDiscMonth : prices.photographerPlusDiscYear;
    else if (plan === "studio") base = m ? prices.studioDiscMonth : prices.studioDiscYear;
    const codePct = codeAppliesTo(plan) ? appliedCode!.percent : 0;
    return Math.max(base, codePct);
  }
  function priceOf(plan: PaidPlan): number {
    if (plan === "basic") return cycle === "month" ? prices.basicMonth : prices.basicYear;
    if (plan === "photographer") return cycle === "month" ? prices.photographerMonth : prices.photographerYear;
    if (plan === "photographer_plus") return cycle === "month" ? prices.photographerPlusMonth : prices.photographerPlusYear;
    return cycle === "month" ? prices.studioMonth : prices.studioYear;
  }
  function finalPriceOf(plan: PaidPlan): number {
    return Math.round(priceOf(plan) * (1 - discountFor(plan) / 100));
  }

  async function request(plan: Plan) {
    if (!phone.trim()) {
      setError("Vui lòng nhập số điện thoại liên hệ trước khi gửi yêu cầu.");
      return;
    }
    setSending(plan);
    setError(null);
    const usedCode = codeAppliesTo(plan) ? appliedCode!.code : null;
    // Số tiền KHÔNG gửi lên nữa: máy chủ tự chốt từ bảng giá + mức giảm đã xác
    // thực, rồi in lên mã QR. Con số trên màn hình chỉ để xem trước.
    const res = await fetch("/api/upgrade-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, cycle, note, discount_code: usedCode, phone }),
    });
    const data = await res.json().catch(() => null);
    setSending(null);
    if (res.ok) {
      setSentPlan(plan);
      setModalPlan(null);
      setNote("");
      if (data?.activated) {
        setActivated(true);
        setCurrentPlan(plan);
        return;
      }
      // Gói phải trả tiền → sang thẳng trang thanh toán (mã QR đúng số tiền của
      // gói vừa chọn) thay vì để studio ngồi chờ ai đó gọi lại.
      if (data?.requestId) router.push(`/dashboard/upgrade/thanh-toan/${data.requestId}`);
    } else {
      setError("Gửi yêu cầu thất bại, thử lại sau.");
    }
  }

  /** Mở form xác nhận (nhập số điện thoại) của một gói. */
  function openRequest(plan: Plan) {
    setError(null);
    setModalPlan(plan);
  }

  return {
    currentPlan, content, prices, cycle, setCycle,
    note, setNote, phone, setPhone,
    modalPlan, setModalPlan, openRequest, sending, sentPlan, activated, error, request,
    codeInput, setCodeInput, appliedCode, codeMsg, applyCode, codeAppliesTo,
    trialCode, setTrialCode, trialBusy, trialOk, trialMsg, redeemTrial,
    trialUsed, startingTrial, startTrial,
    discountFor, priceOf, finalPriceOf,
  };
}

export type UpgradeState = ReturnType<typeof useUpgrade>;
