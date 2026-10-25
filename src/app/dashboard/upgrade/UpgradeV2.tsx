"use client";

import { useState } from "react";
import {
  Camera, Check, ChevronDown, ChevronUp, Crown, Gem, Gift, Minus, Send, Sparkles, Tag, Zap, type LucideIcon,
} from "lucide-react";
import { Badge, Callout, Card, Field, PageHead, Progress, Section, Stack, btn, inputCls, type Tone } from "@/components/v2/kit";
import { Modal, Segmented } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { formatVnd, trialDaysFor, type Plan } from "@/lib/plans";
import type { PlanUsageData } from "@/lib/plan-usage";
import { useUpgrade, type Cycle, type PaidPlan, type UpgradeSeed, type UpgradeState } from "./useUpgrade";

/* ═══════════════════════════════════════════════════════════════════════════
   GÓI PHẦN MỀM — giao diện mới. Cùng logic với UpgradeView (bản cũ,
   ./useUpgrade); khác ở cách sắp xếp:
     • Đầu trang: thẻ "Gói đang dùng" — tên gói, hạn, số album đã tạo trong
       tháng có thanh tiến độ — cạnh ô nhập mã dùng thử.
     • Một hàng chọn: Theo tháng / Theo năm + ô mã giảm giá.
     • Bốn thẻ gói trả phí, gói Studio nổi bật; mỗi thẻ đúng một nút chính.
       Gói miễn phí là một dải gọn bên dưới.
     • Bảng so sánh chi tiết ở cuối (cột đầu dính khi cuộn ngang trên điện thoại).
     • Đăng ký mở hộp thoại nhập số điện thoại → sang trang thanh toán (như cũ).
   ═══════════════════════════════════════════════════════════════════════════ */

const PAID: PaidPlan[] = ["basic", "photographer", "photographer_plus", "studio"];
const FEATURED: PaidPlan = "studio";
const ICON: Record<Plan, LucideIcon> = { free: Sparkles, basic: Zap, photographer: Camera, photographer_plus: Gem, studio: Crown };
const COMPARE_COLS: Plan[] = ["free", "basic", "photographer", "photographer_plus", "studio"];
const ZALO_SUPPORT = "https://zalo.me/g/rycw0pqcgss14ib6u2xj";
/** Số điểm nổi bật hiện sẵn trên mỗi thẻ gói — còn lại mở bằng "Xem thêm". */
const FEATURES_SHOWN = 6;

export default function UpgradeV2({ usage, seed }: { usage: PlanUsageData | null; seed?: UpgradeSeed }) {
  const u = useUpgrade(seed);
  const label = (p: Plan) => u.content.plans[p].label;

  return (
    <Stack>
      <PageHead title={u.content.headline} desc={u.content.subheadline} />

      {/* Sau khi nâng cấp / kích hoạt dùng thử: cảm ơn + link nhóm Zalo hỗ trợ */}
      {u.sentPlan || u.trialOk ? (
        <Callout
          tone="green"
          icon={Sparkles}
          title={u.trialOk ? "Đã kích hoạt dùng thử!" : "Đã ghi nhận yêu cầu nâng cấp!"}
          action={
            <a href={ZALO_SUPPORT} target="_blank" rel="noreferrer" className={btn("secondary", "sm")}>
              Vào nhóm Zalo hỗ trợ
            </a>
          }
        >
          Tham gia nhóm Zalo hỗ trợ để được hướng dẫn cài đặt &amp; kích hoạt nhanh nhất.
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <CurrentPlanCard u={u} usage={usage} label={label} />
        <TrialCodeCard u={u} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-2.5">
            <Segmented<Cycle>
              label="Chu kỳ thanh toán"
              value={u.cycle}
              onChange={u.setCycle}
              options={[
                { value: "month", label: "Theo tháng" },
                { value: "year", label: "Theo năm" },
              ]}
            />
            <Badge tone="brand" icon={Gift}>Mua theo năm tặng thêm 30 ngày</Badge>
          </div>
          <div className="flex min-w-0 gap-2 md:ml-auto">
            <div className="min-w-0 flex-1 md:w-[190px] md:flex-none">
              <input
                value={u.codeInput}
                onChange={(e) => u.setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && u.applyCode()}
                placeholder="Mã giảm giá"
                aria-label="Mã giảm giá"
                className={`${inputCls} font-mono`}
              />
            </div>
            <button type="button" onClick={() => void u.applyCode()} disabled={!u.codeInput.trim()} className={btn("secondary", "md", "flex-none")}>
              <Tag size={15} /> Áp dụng
            </button>
          </div>
        </div>
        {u.codeMsg ? (
          <p className="text-[13px] font-medium md:text-right" style={{ color: u.appliedCode ? "var(--gn)" : "var(--rd)" }}>
            {u.codeMsg}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PAID.map((plan) => (
          <PlanCard key={plan} plan={plan} u={u} label={label(plan)} />
        ))}
      </div>

      <FreePlanRow u={u} label={label("free")} />

      <CompareSection u={u} label={label} />

      <Card>
        <p className="v2-section-title">Thanh toán thế nào?</p>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["Chọn gói", "Bấm Đăng ký, để lại số điện thoại liên hệ."],
            ["Quét mã QR", "Trang thanh toán có sẵn mã QR đúng số tiền."],
            ["Báo đã chuyển", "Bấm “Tôi đã chuyển khoản” — bên mình đối chiếu sao kê và nâng gói."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                {i + 1}
              </span>
              <div className="min-w-0 text-[13px]">
                <p className="font-semibold">{t}</p>
                <p style={{ color: "var(--tx3)" }}>{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--tx3)" }}>Mã giảm giá 100% kích hoạt gói ngay, không cần chuyển khoản.</p>
      </Card>

      <RequestModal u={u} label={label} />
    </Stack>
  );
}

/* ── Gói đang dùng ────────────────────────────────────────────────────── */

function CurrentPlanCard({ u, usage, label }: { u: UpgradeState; usage: PlanUsageData | null; label: (p: Plan) => string }) {
  const Icon = ICON[u.currentPlan] ?? Sparkles;
  const ratio = usage && usage.limit ? usage.used / usage.limit : 0;
  const tone: Tone = ratio >= 1 ? "red" : ratio >= 0.8 ? "amber" : "brand";
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="v2-section-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold" style={{ color: "var(--tx3)" }}>Gói đang dùng</p>
          <p className="text-[20px] font-bold leading-tight tracking-[-0.3px]">{label(u.currentPlan)}</p>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            {usage?.expiresAt ? `Hết hạn ${fmtDate(usage.expiresAt)}` : u.currentPlan === "free" ? "Không thời hạn" : "Đang hoạt động"}
          </p>
        </div>
        {u.currentPlan === "free" ? <Badge tone="gray">Miễn phí</Badge> : <Badge tone="green" dot>Đang hoạt động</Badge>}
      </div>
      {usage ? (
        <div className="rounded-[12px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold">Album tạo trong tháng</span>
            <span className="v2-num text-[13.5px] font-bold">
              {usage.used}
              <span className="font-medium" style={{ color: "var(--tx3)" }}>{usage.limit == null ? " · không giới hạn" : ` / ${usage.limit}`}</span>
            </span>
          </div>
          {usage.limit != null ? (
            <>
              <div className="mt-2"><Progress value={ratio * 100} tone={tone} /></div>
              <p className="mt-1.5 text-[12px]" style={{ color: ratio >= 1 ? "var(--rd)" : "var(--tx3)" }}>
                {ratio >= 1 ? "Đã hết lượt tháng này — nâng gói để tạo thêm album." : `Còn ${Math.max(0, usage.limit - usage.used)} album trong tháng này.`}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function TrialCodeCard({ u }: { u: UpgradeState }) {
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="v2-section-title">Có mã dùng thử?</p>
        <p className="v2-section-desc">Nhập để kích hoạt gói ngay, không cần thanh toán.</p>
      </div>
      <div className="flex gap-2">
        <input
          value={u.trialCode}
          onChange={(e) => u.setTrialCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && u.redeemTrial()}
          placeholder="Mã dùng thử"
          aria-label="Mã dùng thử"
          className={`${inputCls} min-w-0 flex-1 font-mono`}
        />
        <button type="button" onClick={() => void u.redeemTrial()} disabled={u.trialBusy || !u.trialCode.trim()} className={btn("secondary", "md", "flex-none")}>
          <Zap size={15} /> {u.trialBusy ? "Đang kích hoạt…" : "Kích hoạt"}
        </button>
      </div>
      {u.trialMsg ? (
        <p className="text-[13px] font-medium" style={{ color: u.trialOk ? "var(--gn)" : "var(--rd)" }}>{u.trialMsg}</p>
      ) : null}
      <p className="mt-auto flex items-start gap-2 border-t pt-3 text-[12.5px]" style={{ borderColor: "var(--bd2)", color: "var(--tx3)" }}>
        <Sparkles size={14} className="mt-[2px] flex-none" />
        {u.trialUsed
          ? "Tài khoản đã dùng lượt dùng thử miễn phí."
          : u.currentPlan === "free"
            ? "Chưa có mã? Mỗi tài khoản được dùng thử miễn phí một lần — bấm “Dùng thử” ở thẻ gói bên dưới."
            : "Dùng thử miễn phí chỉ áp dụng khi đang ở gói Miễn phí."}
      </p>
    </Card>
  );
}

/* ── Thẻ gói ──────────────────────────────────────────────────────────── */

function PlanCard({ plan, u, label }: { plan: PaidPlan; u: UpgradeState; label: string }) {
  const Icon = ICON[plan];
  const featured = plan === FEATURED;
  const current = u.currentPlan === plan;
  const full = u.priceOf(plan);
  const disc = u.discountFor(plan);
  const now = u.finalPriceOf(plan);
  const info = u.content.plans[plan];
  const features = info.features.filter((f) => f.trim());
  const [allFeatures, setAllFeatures] = useState(false);
  return (
    <div
      className="v2-card relative flex flex-col p-5"
      style={featured ? { borderColor: "var(--ac)", boxShadow: "0 0 0 1px var(--ac), 0 10px 28px -14px color-mix(in srgb, var(--ac) 45%, transparent)" } : undefined}
    >
      {featured || current ? (
        <span className="absolute -top-2.5 left-5 flex gap-1.5">
          {featured ? <Badge tone="brand" solid>Đáng chọn nhất</Badge> : null}
          {current ? <Badge tone="green" solid>Gói đang dùng</Badge> : null}
        </span>
      ) : null}

      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]"
          style={featured ? { background: "var(--ac)", color: "#fff" } : { background: "var(--acS)", color: "var(--ac)" }}
        >
          <Icon size={18} />
        </span>
        <p className="min-w-0 flex-1 text-[16px] font-semibold leading-tight">{label}</p>
      </div>

      <div className="mt-4 min-h-[62px]">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="v2-num text-[26px] font-bold tracking-[-0.6px]">{formatVnd(now)}</span>
          <span className="text-[13px]" style={{ color: "var(--tx3)" }}>/{u.cycle === "month" ? "tháng" : "năm"}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
          {disc > 0 ? (
            <>
              <span className="line-through">{formatVnd(full)}</span>
              <Badge tone="green">-{disc}%</Badge>
            </>
          ) : null}
          {u.cycle === "year" ? <span>≈ {formatVnd(Math.round(now / 12))}/tháng</span> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {u.sentPlan === plan ? (
          <div className="flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-[13px] font-medium" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
            <Check size={16} className="flex-none" />
            {u.activated ? "Đã kích hoạt gói!" : "Đã gửi yêu cầu! Quản trị viên sẽ liên hệ sớm."}
          </div>
        ) : (
          <>
            <button type="button" onClick={() => u.openRequest(plan)} className={btn(featured ? "primary" : "soft", "md", "w-full")}>
              <Send size={15} /> {current ? `Gia hạn ${label}` : `Đăng ký ${label}`}
            </button>
            {!u.trialUsed && u.currentPlan === "free" ? (
              <button type="button" onClick={() => void u.startTrial(plan)} disabled={u.startingTrial !== null} className={btn("ghost", "sm", "w-full")}>
                <Sparkles size={14} /> {u.startingTrial === plan ? "Đang kích hoạt…" : `Dùng thử ${trialDaysFor(plan)} ngày miễn phí`}
              </button>
            ) : null}
          </>
        )}
      </div>

      <ul className="mt-4 flex flex-col gap-2 border-t pt-4" style={{ borderColor: "var(--bd2)" }}>
        {(allFeatures ? features : features.slice(0, FEATURES_SHOWN)).map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--tx2)" }}>
            <Check size={15} className="mt-[2px] flex-none" style={{ color: "var(--gn)" }} />
            <span className="min-w-0">{f}</span>
          </li>
        ))}
      </ul>
      {features.length > FEATURES_SHOWN ? (
        <button
          type="button"
          onClick={() => setAllFeatures((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 self-start text-[12.5px] font-semibold"
          style={{ color: "var(--ac)" }}
        >
          {allFeatures ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {allFeatures ? "Thu gọn" : `Xem thêm ${features.length - FEATURES_SHOWN} điểm`}
        </button>
      ) : null}

      {info.promo ? (
        <p className="mt-auto rounded-[10px] px-3 py-2 text-[12.5px] font-medium" style={{ background: "var(--acS)", color: "var(--ac)", marginTop: 16 }}>
          {info.promo}
        </p>
      ) : null}
    </div>
  );
}

function FreePlanRow({ u, label }: { u: UpgradeState; label: string }) {
  const info = u.content.plans.free;
  const current = u.currentPlan === "free";
  return (
    <Card className="flex flex-col gap-3 md:flex-row md:items-start md:gap-5">
      <div className="flex flex-none items-center gap-2.5 md:w-[200px]">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
          <Sparkles size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">{label}</p>
          <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>{current ? "Bạn đang dùng gói này" : "Gói cơ bản"}</p>
        </div>
      </div>
      <ul className="grid min-w-0 flex-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {info.features.filter((f) => f.trim()).map((f) => (
          <li key={f} className="flex items-start gap-2 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            <Check size={14} className="mt-[2px] flex-none" />
            <span className="min-w-0">{f}</span>
          </li>
        ))}
      </ul>
      {info.promo ? <p className="text-[12.5px] font-medium md:w-[200px]" style={{ color: "var(--ac)" }}>{info.promo}</p> : null}
    </Card>
  );
}

/* ── So sánh ──────────────────────────────────────────────────────────── */

function CompareSection({ u, label }: { u: UpgradeState; label: (p: Plan) => string }) {
  // Ô: "✓" → có, "✗"/"" → không, còn lại → chữ.
  const cell = (v: string) =>
    v === "✓" ? <Check size={16} style={{ color: "var(--gn)" }} aria-label="Có" />
    : v === "✗" || v.trim() === "" ? <Minus size={15} style={{ color: "var(--tx3)", opacity: 0.6 }} aria-label="Không" />
    : <span className="text-[12.5px] font-medium">{v}</span>;
  const tint = "color-mix(in srgb, var(--ac) 5%, transparent)";
  const sticky: React.CSSProperties = { position: "sticky", left: 0, zIndex: 1, background: "var(--sf)" };
  const [open, setOpen] = useState(false);
  const rows = u.content.compare.filter((r) => !("section" in r)).length;
  return (
    <Section
      title="So sánh chi tiết"
      desc={`${rows} tính năng của từng gói, đặt cạnh nhau.`}
      flush
      actions={
        <button type="button" onClick={() => setOpen((v) => !v)} className={btn("secondary", "sm")} aria-expanded={open}>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {open ? "Thu gọn" : "Mở bảng"}
        </button>
      }
    >
      {open ? (
      <div className="v2-table-wrap">
        <table className="v2-table" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ ...sticky, background: "var(--sf2)", minWidth: 200 }}>Tính năng</th>
              {COMPARE_COLS.map((p) => (
                <th
                  key={p}
                  className="!text-center"
                  style={p === FEATURED ? { color: "var(--ac)", background: "color-mix(in srgb, var(--ac) 9%, var(--sf2))" } : undefined}
                >
                  {label(p)}
                  {u.currentPlan === p ? <span className="block text-[10.5px] font-semibold normal-case" style={{ color: "var(--gn)" }}>Đang dùng</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {u.content.compare.map((row, i) =>
              "section" in row ? (
                <tr key={`s${i}`}>
                  <td colSpan={COMPARE_COLS.length + 1} className="!py-2" style={{ background: "var(--sf2)" }}>
                    <span className="sticky left-4 text-[12px] font-bold" style={{ color: "var(--tx2)" }}>{row.section}</span>
                  </td>
                </tr>
              ) : (
                <tr key={`r${i}`}>
                  <td className="!py-2.5" style={{ ...sticky, color: "var(--tx2)" }}>{row.label}</td>
                  {COMPARE_COLS.map((p) => (
                    <td key={p} className="!py-2.5" style={p === FEATURED ? { background: tint } : undefined}>
                      <div className="flex justify-center text-center">{cell(row[p])}</div>
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      ) : null}
    </Section>
  );
}

/* ── Hộp thoại đăng ký ────────────────────────────────────────────────── */

function RequestModal({ u, label }: { u: UpgradeState; label: (p: Plan) => string }) {
  const plan = u.modalPlan;
  const open = !!plan && plan !== "free";
  const disc = plan ? u.discountFor(plan) : 0;
  return (
    <Modal
      open={open}
      onClose={() => u.sending === null && u.setModalPlan(null)}
      icon={Send}
      title={plan ? `Đăng ký gói ${label(plan)}` : ""}
      desc={
        plan && plan !== "free" ? (
          <>
            {u.cycle === "month" ? "Theo tháng" : "Theo năm"} ·{" "}
            <b style={{ color: "var(--tx)" }}>{formatVnd(u.finalPriceOf(plan))}</b>
            {disc > 0 ? ` (-${disc}%)` : ""}
            {u.codeAppliesTo(plan) ? ` · mã ${u.appliedCode!.code}` : ""}
          </>
        ) : undefined
      }
      footer={
        plan ? (
          <>
            <button type="button" onClick={() => u.setModalPlan(null)} disabled={u.sending !== null} className={btn("ghost")}>
              Huỷ
            </button>
            <button type="button" onClick={() => void u.request(plan)} disabled={u.sending !== null} className={btn("primary")}>
              <Send size={15} /> {u.sending === plan ? "Đang gửi…" : "Xác nhận gửi"}
            </button>
          </>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={<>Số điện thoại liên hệ <span style={{ color: "var(--rd)" }}>*</span></>} htmlFor="up-phone">
          <input
            id="up-phone"
            value={u.phone}
            onChange={(e) => u.setPhone(e.target.value)}
            placeholder="VD: 0974374744"
            inputMode="tel"
            autoFocus
            className={inputCls}
          />
        </Field>
        <Field label="Lời nhắn (tuỳ chọn)" htmlFor="up-note">
          <textarea
            id="up-note"
            value={u.note}
            onChange={(e) => u.setNote(e.target.value)}
            placeholder="Nhu cầu của bạn, số lượng album dự kiến…"
            className={inputCls}
            rows={3}
          />
        </Field>
        {u.error ? <Callout tone="red">{u.error}</Callout> : null}
        <p className="text-[12px]" style={{ color: "var(--tx3)" }}>Gửi xong sẽ sang trang thanh toán có sẵn mã QR đúng số tiền.</p>
      </div>
    </Modal>
  );
}
