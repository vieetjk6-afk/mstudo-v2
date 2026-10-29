"use client";

import dynamic from "next/dynamic";
import { Check, X, Crown, Sparkles, Send, Zap, Tag, Camera } from "lucide-react";
import PlanUsage from "@/components/PlanUsage";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { formatVnd, trialDaysFor, type Plan } from "@/lib/plans";
import type { PlanUsageData } from "@/lib/plan-usage";
import { useUpgrade, type Cycle, type PaidPlan } from "./useUpgrade";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const UpgradeV2 = dynamic(() => import("./UpgradeV2"));

/**
 * Trang "Gói phần mềm": giao diện mới (UpgradeV2) hay bản cũ — xem UiV2Context.
 * `usage`: số album đã tạo trong tháng, máy chủ chỉ tính khi đang ở giao diện
 * mới (bản cũ tự tải qua <PlanUsage/> như trước).
 */
export default function UpgradeView({ usage = null }: { usage?: PlanUsageData | null }) {
  return useUiV2() ? <UpgradeV2 usage={usage} /> : <UpgradeV1 />;
}

// Feature comparison rows, plan labels/features and headline are admin-editable —
// loaded from site_settings.upgrade_content (with code defaults).

function UpgradeV1() {
  // Logic dùng chung với bản mới — xem ./useUpgrade.
  const {
    currentPlan, content, cycle, setCycle, note, setNote, phone, setPhone,
    modalPlan, setModalPlan, openRequest, sending, sentPlan, activated, error, request,
    codeInput, setCodeInput, appliedCode, codeMsg, applyCode,
    trialCode, setTrialCode, trialBusy, trialOk, trialMsg, redeemTrial,
    trialUsed, startingTrial, startTrial,
    discountFor, priceOf, finalPriceOf,
  } = useUpgrade();

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
                  <button onClick={() => openRequest(plan)} className="btn-primary w-full rounded-xl py-3 text-[14px]">
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
