"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Crown, Sparkles, Send, Zap, Tag, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PlanUsage from "@/components/PlanUsage";
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

// Feature comparison rows, plan labels/features and headline are admin-editable —
// loaded from site_settings.upgrade_content (with code defaults).

export default function UpgradePage() {
  const router = useRouter();
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

  function priceBlock(plan: PaidPlan) {
    const full = priceOf(plan);
    const disc = discountFor(plan);
    const now = Math.round(full * (1 - disc / 100));
    const perMonth = Math.round(now / 12);
    return (
      <>
      <div className="flex items-baseline gap-2">
        {disc > 0 && <span className="text-[15px] line-through" style={{ color: "var(--text3)" }}>{formatVnd(full)}</span>}
        <span className="font-serif text-2xl font-medium">{formatVnd(now)}</span>
        <span className="text-[13px]" style={{ color: "var(--text2)" }}>/{cycle === "month" ? "tháng" : "năm"}</span>
        {disc > 0 && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--gold)", color: "#1a1205" }}>-{disc}%</span>}
      </div>
      {cycle === "year" && (
        <div className="mt-1 text-[12px]" style={{ color: "var(--text3)" }}>≈ {formatVnd(perMonth)}/tháng</div>
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
    v === "✓" ? <Check size={16} style={{ color: "var(--gold)" }} />
    : (v === "✗" || v.trim() === "") ? <X size={15} style={{ color: "var(--text3)" }} />
    : <span style={{ color: "var(--text)" }}>{v}</span>;
  const planLabel = (p: Plan) => content.plans[p].label;

  return (
    <div
      className="page-in"
      style={{
        // Sync the upgrade page with the brand-green identity used across the
        // studio workspace & landing (instead of the album shell's gold/silver).
        ["--gold" as string]: "var(--brand, #3fb98a)",
        ["--accent" as string]: "var(--brand, #3fb98a)",
        ["--accentInk" as string]: "var(--brandFg, #06120c)",
      } as React.CSSProperties}
    >
      <div className="mb-8">
        <p className="eyebrow mb-1.5">Gói dịch vụ</p>
        <h1 className="font-serif text-[clamp(28px,4vw,44px)] font-medium leading-none">{content.headline}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--text2)" }}>
          {content.subheadline}
        </p>
      </div>

      {/* Sau khi nâng cấp / kích hoạt dùng thử: cảm ơn + link nhóm Zalo hỗ trợ */}
      {(sentPlan || trialOk) && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between" style={{ background: "color-mix(in srgb, var(--brand) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--brand) 40%, transparent)" }}>
          <div className="flex items-start gap-2.5">
            <Sparkles size={18} style={{ color: "var(--brand)", marginTop: 2 }} />
            <div>
              <p className="text-[14px] font-semibold">{trialOk ? "Đã kích hoạt dùng thử! 🎉" : "Đã ghi nhận yêu cầu nâng cấp! 🎉"}</p>
              <p className="text-[13px]" style={{ color: "var(--text2)" }}>Tham gia nhóm Zalo hỗ trợ để được hướng dẫn cài đặt &amp; kích hoạt nhanh nhất.</p>
            </div>
          </div>
          <a href="https://zalo.me/g/rycw0pqcgss14ib6u2xj" target="_blank" rel="noreferrer" className="btn-primary whitespace-nowrap">Vào nhóm Zalo hỗ trợ →</a>
        </div>
      )}

      <PlanUsage showUpgrade={false} />

      {/* Billing cycle */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
          {(["month", "year"] as Cycle[]).map((c) => (
            <button key={c} onClick={() => setCycle(c)} className="px-4 py-2 text-[13px] font-medium" style={cycle === c ? { background: "var(--accent)", color: "var(--accentInk)" } : { background: "var(--surface2)", color: "var(--text2)" }}>
              {c === "month" ? "Theo tháng" : "Theo năm"}
            </button>
          ))}
        </div>
        <span className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: "color-mix(in srgb, var(--gold) 18%, transparent)", color: "var(--gold)" }}>
          🎁 Mua theo năm tặng thêm 30 ngày
        </span>
        {/* Discount code */}
        <div className="flex items-end gap-2">
          <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="Mã giảm giá" className="input w-40" />
          <button onClick={applyCode} className="btn-ghost"><Tag size={14} /> Áp dụng</button>
        </div>
      </div>
      {codeMsg && <p className="mb-4 text-[13px]" style={{ color: appliedCode ? "var(--gold)" : "var(--danger)" }}>{codeMsg}</p>}

      {/* Trial code — instant activation */}
      <div className="card mb-6 p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-medium"><Sparkles size={15} style={{ color: "var(--gold)" }} /> Dùng thử</h3>
        <p className="mb-3 text-[13px]" style={{ color: "var(--text2)" }}>Có mã dùng thử? Nhập để kích hoạt gói ngay, không cần thanh toán.</p>
        <div className="flex flex-wrap items-end gap-2">
          <input value={trialCode} onChange={(e) => setTrialCode(e.target.value.toUpperCase())} placeholder="Mã dùng thử" className="input w-44" />
          <button onClick={redeemTrial} disabled={trialBusy} className="btn-primary"><Zap size={14} /> {trialBusy ? "Đang kích hoạt…" : "Kích hoạt dùng thử"}</button>
        </div>
        {trialMsg && <p className="mt-2 text-[13px]" style={{ color: trialOk ? "#5fd29a" : "var(--danger)" }}>{trialMsg}</p>}
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {cards.map(({ plan, icon: Icon, accent }) => (
          <div key={plan} className="card flex flex-col p-4" style={accent ? { borderColor: "var(--gold)" } : undefined}>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: accent ? "var(--gold)" : "var(--surface2)", color: accent ? "#1a1205" : "var(--text2)" }}>
                <Icon size={18} />
              </span>
              <div>
                <h2 className="font-serif text-lg font-medium leading-tight">{planLabel(plan)}</h2>
                {currentPlan === plan && <p className="text-[12px]" style={{ color: "var(--gold)" }}>Gói hiện tại</p>}
              </div>
            </div>

            <div className="mb-4">{plan === "free" ? <span className="font-serif text-2xl font-medium">Miễn phí</span> : priceBlock(plan)}</div>

            <ul className="mb-5 space-y-2.5">
              {content.plans[plan].features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13.5px]" style={{ color: "var(--text2)" }}>
                  <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: accent ? "var(--gold)" : "var(--text3)" }} />
                  {f}
                </li>
              ))}
            </ul>

            {content.plans[plan].promo && <p className="mb-4 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: "color-mix(in srgb, var(--gold) 14%, transparent)", color: "var(--gold)" }}>{content.plans[plan].promo}</p>}

            <div className="mt-auto">
              {plan === "free" ? (
                <p className="text-center text-[13px]" style={{ color: "var(--text3)" }}>{currentPlan === "free" ? "Bạn đang dùng gói này" : "Gói cơ bản"}</p>
              ) : sentPlan === plan ? (
                <div className="flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: "color-mix(in srgb,#3fbf7f 14%,transparent)", border: "1px solid color-mix(in srgb,#3fbf7f 40%,transparent)" }}>
                  <Check size={17} style={{ color: "#5fd29a" }} />
                  <span className="text-[13px]">{activated ? "Đã kích hoạt gói! 🎉" : "Đã gửi yêu cầu! Quản trị viên sẽ liên hệ sớm."}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <button onClick={() => { setError(null); setModalPlan(plan); }} className="btn-primary w-full rounded-xl py-3 text-[14px]">
                    <Send size={15} /> {`Đăng ký ${planLabel(plan)}`}
                  </button>
                  {!trialUsed && currentPlan === "free" && (
                    <button onClick={() => startTrial(plan)} disabled={startingTrial !== null} className="btn-ghost w-full rounded-xl py-2.5 text-[13px] disabled:opacity-60">
                      <Sparkles size={14} /> {startingTrial === plan ? "Đang kích hoạt…" : `Dùng thử ${trialDaysFor(plan)} ngày miễn phí`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Feature comparison */}
      <div className="mt-8 card overflow-x-auto p-0">
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--text2)", minWidth: 200 }}>So sánh tính năng</th>
              <th className="px-3 py-3 text-center font-medium" style={{ minWidth: 84 }}>Miễn phí</th>
              <th className="px-3 py-3 text-center font-medium" style={{ minWidth: 84 }}>Basic</th>
              <th className="px-3 py-3 text-center font-medium" style={{ minWidth: 110 }}>Photographer</th>
              <th className="px-3 py-3 text-center font-medium" style={{ minWidth: 110 }}>Photographer Plus</th>
              <th className="px-3 py-3 text-center font-medium" style={{ color: "var(--gold)", minWidth: 84 }}>Studio</th>
            </tr>
          </thead>
          <tbody>
            {content.compare.map((row, i) => {
              if ("section" in row) {
                return (
                  <tr key={row.section}>
                    <td
                      colSpan={6}
                      className="px-4 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--gold)", borderTop: i === 0 ? "none" : "1px solid var(--border)", background: "color-mix(in srgb, var(--gold) 6%, transparent)" }}
                    >
                      {row.section}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={row.label} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-2" style={{ color: "var(--text2)" }}>{row.label}</td>
                  <td className="px-3 py-2"><div className="flex justify-center">{cellOf(row.free)}</div></td>
                  <td className="px-3 py-2"><div className="flex justify-center">{cellOf(row.basic)}</div></td>
                  <td className="px-3 py-2"><div className="flex justify-center">{cellOf(row.photographer)}</div></td>
                  <td className="px-3 py-2"><div className="flex justify-center">{cellOf(row.photographer_plus)}</div></td>
                  <td className="px-3 py-2"><div className="flex justify-center">{cellOf(row.studio)}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-center text-[12.5px]" style={{ color: "var(--text3)" }}>
        Chọn gói → sang trang thanh toán có sẵn mã QR đúng số tiền → chuyển khoản rồi bấm “Tôi đã chuyển khoản”. Bên mình đối chiếu sao kê và nâng gói cho bạn. Mã giảm giá 100% kích hoạt gói ngay, không cần chuyển khoản.
      </p>

      {/* Confirm modal — enter phone before sending */}
      {modalPlan && modalPlan !== "free" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.6)" }}
          onClick={() => sending === null && setModalPlan(null)}
        >
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-2xl font-medium">Đăng ký gói {planLabel(modalPlan)}</h3>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text2)" }}>
              {cycle === "month" ? "Theo tháng" : "Theo năm"} ·{" "}
              <b style={{ color: "var(--gold)" }}>
                {formatVnd(finalPriceOf(modalPlan as "basic" | "photographer" | "studio"))}
              </b>
              {discountFor(modalPlan) > 0 && ` (-${discountFor(modalPlan)}%)`}
              {appliedCode && (!appliedCode.plan || appliedCode.plan === modalPlan) && (!appliedCode.cycle || appliedCode.cycle === cycle) && ` · mã ${appliedCode.code}`}
            </p>

            <label className="mt-4 mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>
              Số điện thoại liên hệ <span style={{ color: "var(--gold)" }}>*</span>
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="VD: 0974374744"
              inputMode="tel"
              autoFocus
              className="input"
            />
            <label className="mt-3 mb-1 block text-[13px]" style={{ color: "var(--text2)" }}>Lời nhắn (tuỳ chọn)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nhu cầu của bạn, số lượng album dự kiến…" className="input min-h-[70px] resize-y" />

            {error && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

            <div className="mt-4 flex gap-2.5">
              <button onClick={() => setModalPlan(null)} disabled={sending !== null} className="btn-ghost flex-1 py-2.5">
                Huỷ
              </button>
              <button onClick={() => request(modalPlan)} disabled={sending !== null} className="btn-primary flex-1 py-2.5">
                <Send size={15} /> {sending === modalPlan ? "Đang gửi…" : "Xác nhận gửi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
