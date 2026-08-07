"use client";

import { useEffect, useState } from "react";
import { Check, X, Crown, Sparkles, Send, Zap, Tag, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PlanUsage from "@/components/PlanUsage";
import { Panel } from "@/components/studio/ui";
import { PLAN_PRICING, PLAN_LABEL, formatVnd, trialDaysFor, type Plan } from "@/lib/plans";
import { mergeUpgradeContent, UPGRADE_DEFAULTS, type UpgradeContent } from "@/lib/upgrade-content";

type Cycle = "month" | "year";

interface Prices {
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

type PaidPlan = "basic" | "photographer" | "photographer_plus" | "studio";

const DEFAULT_PRICES: Prices = {
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

// Feature comparison rows, plan labels/features, headline & coming-soon list are
// admin-editable — loaded from site_settings.upgrade_content (with code defaults).

export default function UpgradePage() {
  const [currentPlan, setCurrentPlan] = useState<Plan>("free");
  const [content, setContent] = useState<UpgradeContent>(UPGRADE_DEFAULTS);
  const [prices, setPrices] = useState<Prices>(DEFAULT_PRICES);
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
  const [trialUsed, setTrialUsed] = useState(false);
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

  // Effective discount % for a plan, combining the base promo and any code.
  function discountFor(plan: Plan): number {
    const m = cycle === "month";
    let base = 0;
    if (plan === "basic") base = m ? prices.basicDiscMonth : prices.basicDiscYear;
    else if (plan === "photographer") base = m ? prices.photographerDiscMonth : prices.photographerDiscYear;
    else if (plan === "photographer_plus") base = m ? prices.photographerPlusDiscMonth : prices.photographerPlusDiscYear;
    else if (plan === "studio") base = m ? prices.studioDiscMonth : prices.studioDiscYear;
    const codeApplies =
      appliedCode &&
      (!appliedCode.plan || appliedCode.plan === plan) &&
      (!appliedCode.cycle || appliedCode.cycle === cycle);
    const codePct = codeApplies ? appliedCode!.percent : 0;
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
    const usedCode =
      appliedCode && (!appliedCode.plan || appliedCode.plan === plan) && (!appliedCode.cycle || appliedCode.cycle === cycle)
        ? appliedCode.code
        : null;
    const amount = plan === "free" ? null : finalPriceOf(plan);
    const res = await fetch("/api/upgrade-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, cycle, note, discount_code: usedCode, phone, amount }),
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
      }
    } else {
      setError("Gửi yêu cầu thất bại, thử lại sau.");
    }
  }

  function priceBlock(plan: PaidPlan) {
    const full = priceOf(plan);
    const disc = discountFor(plan);
    const now = Math.round(full * (1 - disc / 100));
    const perMonth = Math.round(now / 12);
    return (
      <>
        {disc > 0 && (
          <p className="tnum text-[13px] line-through" style={{ color: "var(--tx3)" }}>{formatVnd(full)}</p>
        )}
        <p className="tnum text-[26px] font-bold" style={{ letterSpacing: "-.8px" }}>
          {formatVnd(now)}
          <span className="text-[13px] font-medium" style={{ color: "var(--tx3)" }}>/{cycle === "month" ? "tháng" : "năm"}</span>
          {disc > 0 && (
            <span className="ml-2 whitespace-nowrap rounded-[20px] px-[9px] py-[3px] align-middle text-[10.5px] font-bold" style={{ background: "var(--ac)", color: "#fff" }}>-{disc}%</span>
          )}
        </p>
        {cycle === "year" && (
          <p className="tnum mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>≈ {formatVnd(perMonth)}/tháng</p>
        )}
      </>
    );
  }

  const cards: { plan: Plan; icon: typeof Sparkles; accent: boolean }[] = [
    { plan: "free", icon: Sparkles, accent: false },
    { plan: "basic", icon: Zap, accent: true },
    { plan: "photographer", icon: Camera, accent: true },
    { plan: "photographer_plus", icon: Sparkles, accent: true },
    { plan: "studio", icon: Crown, accent: true },
  ];

  // Cell convention: "✓" -> check, "✗"/"" -> cross, anything else -> text.
  const cellOf = (v: string) =>
    v === "✓" ? <Check size={16} style={{ color: "var(--gn)" }} />
    : (v === "✗" || v.trim() === "") ? <X size={15} style={{ color: "var(--tx3)" }} />
    : <span style={{ color: "var(--tx)" }}>{v}</span>;
  const planLabel = (p: Plan) => content.plans[p].label;

  return (
    <div className="page-in flex flex-col gap-3.5">
      {/* Dòng dẫn — topbar đã hiện tên màn nên không lặp lại tiêu đề lớn. */}
      <div>
        <p className="text-[15px] font-bold" style={{ letterSpacing: "-.3px" }}>{content.headline}</p>
        <p className="mt-1 max-w-2xl text-[13px] leading-[1.6]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
          {content.subheadline}
        </p>
      </div>

      {/* Sau khi nâng cấp / kích hoạt dùng thử: cảm ơn + link nhóm Zalo hỗ trợ */}
      {(sentPlan || trialOk) && (
        <Panel className="flex flex-col gap-3 px-[18px] py-4 sm:flex-row sm:items-center" >
          <span className="flex-none rounded-[10px] p-[9px]" style={{ background: "var(--gnS)", color: "var(--gn)", lineHeight: 0 }}>
            <Sparkles size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold">{trialOk ? "Đã kích hoạt dùng thử 🎉" : "Đã ghi nhận yêu cầu nâng cấp 🎉"}</p>
            <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
              Vào nhóm Zalo hỗ trợ để được hướng dẫn cài đặt &amp; kích hoạt nhanh nhất.
            </p>
          </div>
          <a
            href="https://zalo.me/g/rycw0pqcgss14ib6u2xj"
            target="_blank"
            rel="noreferrer"
            className="flex-none whitespace-nowrap rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            Vào nhóm Zalo hỗ trợ →
          </a>
        </Panel>
      )}

      <PlanUsage showUpgrade={false} variant="panel" />

      {/* Chu kỳ thanh toán + mã giảm giá + mã dùng thử — một hàng công cụ. */}
      <Panel className="flex flex-wrap items-center gap-2.5 px-[18px] py-3.5">
        <div className="flex flex-none gap-[3px] rounded-[11px] p-[3px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
          {(["month", "year"] as Cycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className="rounded-[8px] px-[15px] py-[6.5px] text-[12.5px] font-semibold"
              style={cycle === c ? { background: "var(--sf)", color: "var(--tx)", boxShadow: "0 1px 2px rgba(20,15,25,.08)" } : { color: "var(--tx2)" }}
            >
              {c === "month" ? "Theo tháng" : "Theo năm"}
            </button>
          ))}
        </div>
        <span className="flex-none whitespace-nowrap rounded-[20px] px-[11px] py-[5px] text-[11.5px] font-semibold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
          🎁 Mua theo năm tặng thêm 30 ngày
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="Mã giảm giá" className="input w-36" />
          <button onClick={applyCode} className="flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold" style={{ border: "1px solid var(--bd)" }}>
            <Tag size={14} /> Áp dụng
          </button>
          <input value={trialCode} onChange={(e) => setTrialCode(e.target.value.toUpperCase())} placeholder="Mã dùng thử" className="input w-36" />
          <button
            onClick={redeemTrial}
            disabled={trialBusy}
            className="flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold disabled:opacity-60"
            style={{ background: "var(--acS)", color: "var(--ac)" }}
          >
            <Zap size={14} /> {trialBusy ? "Đang kích hoạt…" : "Kích hoạt"}
          </button>
        </div>
        {codeMsg && (
          <p className="w-full text-[12px] font-semibold" style={{ color: appliedCode ? "var(--gn)" : "var(--rd)" }}>{codeMsg}</p>
        )}
        {trialMsg && (
          <p className="w-full text-[12px] font-semibold" style={{ color: trialOk ? "var(--gn)" : "var(--rd)" }}>{trialMsg}</p>
        )}
      </Panel>

      {/* Thẻ gói — viền 1.5px, gói đang dùng nổi bằng viền màu nhấn + nền nhạt. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(216px,1fr))] gap-3">
        {cards.map(({ plan, icon: Icon, accent }) => {
          const isCurrent = currentPlan === plan;
          return (
            <div
              key={plan}
              className="flex flex-col rounded-[14px] p-[18px]"
              style={{
                background: isCurrent ? "var(--acS)" : "var(--sf)",
                border: `1.5px solid ${isCurrent ? "var(--ac)" : "var(--bd)"}`,
              }}
            >
              <div className="flex items-center gap-2">
                <Icon size={17} style={{ flex: "none", color: accent ? "var(--ac)" : "var(--tx3)" }} />
                <p className="text-[15px] font-bold" style={{ letterSpacing: "-.3px" }}>{planLabel(plan)}</p>
                {isCurrent && (
                  <span className="flex-none whitespace-nowrap rounded-[20px] px-[9px] py-[3px] text-[10.5px] font-bold" style={{ background: "var(--ac)", color: "#fff" }}>
                    Đang dùng
                  </span>
                )}
              </div>

              <div className="mt-3.5">
                {plan === "free"
                  ? <p className="text-[26px] font-bold" style={{ letterSpacing: "-.8px" }}>Miễn phí</p>
                  : priceBlock(plan)}
              </div>

              <div className="my-4 flex flex-1 flex-col gap-2">
                {content.plans[plan].features.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <Check size={16} className="mt-px flex-none" style={{ color: "var(--gn)" }} />
                    <span className="text-[12.5px] leading-[1.45]" style={{ color: "var(--tx2)" }}>{f}</span>
                  </div>
                ))}
              </div>

              {content.plans[plan].promo && (
                <p className="mb-3 rounded-[10px] px-3 py-2 text-[11.5px] font-semibold" style={{ background: "var(--amS)", color: "var(--am)" }}>
                  {content.plans[plan].promo}
                </p>
              )}

              {plan === "free" ? (
                <p className="text-center text-[12px]" style={{ color: "var(--tx3)" }}>
                  {isCurrent ? "Bạn đang dùng gói này" : "Gói cơ bản"}
                </p>
              ) : sentPlan === plan ? (
                <div className="flex items-center gap-2 rounded-[10px] px-3 py-2.5" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
                  <Check size={16} className="flex-none" />
                  <span className="text-[12px] font-semibold">{activated ? "Đã kích hoạt gói 🎉" : "Đã gửi yêu cầu, quản trị viên sẽ liên hệ."}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => { setError(null); setModalPlan(plan); }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13px] font-bold"
                    style={{ background: "var(--ac)", color: "#fff" }}
                  >
                    <Send size={15} /> Đăng ký
                  </button>
                  {!trialUsed && currentPlan === "free" && (
                    <button
                      onClick={() => startTrial(plan)}
                      disabled={startingTrial !== null}
                      className="flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[12.5px] font-semibold disabled:opacity-60"
                      style={{ background: "var(--acS)", color: "var(--ac)" }}
                    >
                      <Sparkles size={14} /> {startingTrial === plan ? "Đang kích hoạt…" : `Dùng thử ${trialDaysFor(plan)} ngày`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* So sánh tính năng — đầu bảng và ô kẻ theo quy tắc chung của shell. */}
      <Panel className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>So sánh tính năng</th>
              <th style={{ minWidth: 84, textAlign: "center" }}>Miễn phí</th>
              <th style={{ minWidth: 84, textAlign: "center" }}>Basic</th>
              <th style={{ minWidth: 110, textAlign: "center" }}>Photographer</th>
              <th style={{ minWidth: 84, textAlign: "center", color: "var(--ac)" }}>Studio</th>
            </tr>
          </thead>
          <tbody>
            {content.compare.map((row) => {
              if ("section" in row) {
                return (
                  <tr key={row.section}>
                    <td
                      colSpan={5}
                      className="text-[10.5px] font-extrabold uppercase"
                      style={{ letterSpacing: ".7px", color: "var(--ac)", background: "var(--acS)" }}
                    >
                      {row.section}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={row.label}>
                  <td style={{ color: "var(--tx2)" }}>{row.label}</td>
                  <td><div className="flex justify-center">{cellOf(row.free)}</div></td>
                  <td><div className="flex justify-center">{cellOf(row.basic)}</div></td>
                  <td><div className="flex justify-center">{cellOf(row.photographer)}</div></td>
                  <td><div className="flex justify-center">{cellOf(row.studio)}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      {/* Sắp ra mắt */}
      <Panel className="px-[18px] py-4">
        <p className="mb-3 flex items-center gap-2 text-[13.5px] font-bold">
          <Sparkles size={16} style={{ color: "var(--ac)" }} /> Tính năng sắp ra mắt
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {content.comingSoon.map((f) => (
            <div key={f} className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--tx2)" }}>
              <span className="flex-none rounded-[20px] px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>Sắp có</span>
              {f}
            </div>
          ))}
        </div>
      </Panel>

      <p className="text-center text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
        Thanh toán &amp; kích hoạt gói hiện xử lý thủ công — gửi yêu cầu rồi quản trị viên liên hệ. Mã giảm giá 100% kích hoạt gói ngay.
      </p>

      {/* Hộp xác nhận — nhập số điện thoại trước khi gửi */}
      {modalPlan && modalPlan !== "free" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,15,25,.5)" }}
          onClick={() => sending === null && setModalPlan(null)}
        >
          <div
            className="w-full max-w-md rounded-[14px] p-5"
            style={{ background: "var(--sf)", border: "1px solid var(--bd)", boxShadow: "var(--sh-modal)", animation: "vkPop .2s ease" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] font-bold" style={{ letterSpacing: "-.3px" }}>Đăng ký gói {planLabel(modalPlan)}</p>
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>
              {cycle === "month" ? "Theo tháng" : "Theo năm"} ·{" "}
              <b className="tnum" style={{ color: "var(--ac)" }}>
                {formatVnd(finalPriceOf(modalPlan as PaidPlan))}
              </b>
              {discountFor(modalPlan) > 0 && ` (-${discountFor(modalPlan)}%)`}
              {appliedCode && (!appliedCode.plan || appliedCode.plan === modalPlan) && (!appliedCode.cycle || appliedCode.cycle === cycle) && ` · mã ${appliedCode.code}`}
            </p>

            <label className="label mb-1 mt-4 block uppercase">Số điện thoại liên hệ *</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="VD: 0974374744"
              inputMode="tel"
              autoFocus
              className="input"
            />
            <label className="label mb-1 mt-3 block uppercase">Lời nhắn (tuỳ chọn)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nhu cầu của bạn, số lượng album dự kiến…" className="input min-h-[70px] resize-y" />

            {error && <p className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--rd)" }}>{error}</p>}

            <div className="mt-4 flex gap-2.5">
              <button
                onClick={() => setModalPlan(null)}
                disabled={sending !== null}
                className="flex-1 rounded-[10px] py-2.5 text-[13px] font-semibold"
                style={{ border: "1px solid var(--bd)" }}
              >
                Huỷ
              </button>
              <button
                onClick={() => request(modalPlan)}
                disabled={sending !== null}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13px] font-bold"
                style={{ background: "var(--ac)", color: "#fff" }}
              >
                <Send size={15} /> {sending === modalPlan ? "Đang gửi…" : "Xác nhận gửi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
