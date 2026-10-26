"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeDollarSign, Check, ExternalLink, Globe, Landmark, MessageSquare, QrCode, Rocket, RotateCcw, Search,
  Settings2, ToggleRight, Trash2, Users,
} from "lucide-react";
import { Avatar, Badge, Callout, Empty, Field, ListRow, PageHead, Section, Stack, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Segmented, Switch } from "@/components/v2/kit-client";
import { SaveBarV2, ToastV2 } from "@/app/dashboard/studio/services/settings-v2";
import { BANKS } from "@/lib/banks";
import { fmtDateTime } from "@/lib/date";
import { formatVnd } from "@/lib/plans";
import { qrUrl } from "@/lib/vietqr";
import type { SiteSettings } from "@/lib/types";
import { mergeUpgradeContent } from "@/lib/upgrade-content";
import { SectionNavV2 } from "./SectionNavV2";
import UpgradeContentEditorV2 from "./UpgradeContentEditorV2";
import { FEATURE_FLAGS, PRICE_ROWS, toPercent, toPrice, useSettings, type Feedback, type SettingsState } from "./useSettings";
import { useUpgradeContent } from "./useUpgradeContent";

/* ═══════════════════════════════════════════════════════════════════════════
   CẤU HÌNH MSTUDO (admin) — giao diện mới. Cùng logic với SettingsPanel +
   UpgradeContentEditor (bản cũ, ./useSettings và ./useUpgradeContent); khác ở
   cách sắp xếp:
     • Mục lục bên trái (máy tính) — 7 khối: Trang chủ · SEO · Tính năng ·
       Gói & giá · Nhận thanh toán · Trang nâng cấp · Góp ý.
     • Bỏ 6 nút "Lưu …" rải khắp trang (bản cũ nút nào cũng lưu CẢ form):
       có thay đổi là hiện MỘT thanh lưu dính đáy, có nút huỷ thay đổi. Nội
       dung trang nâng cấp vẫn lưu bằng lời gọi riêng như cũ, cùng thanh đó.
     • Tính năng: công tắc "mở cho studio" kèm nhãn trạng thái, thay cho ô tích
       "Sắp ra mắt" ngược nghĩa. Giá trị lưu xuống giữ nguyên.
     • Gói & giá thành một bảng 4 gói × 4 ô, kèm giá sau giảm; tài khoản nhận
       tiền có xem trước mã QR; SEO có xem trước kết quả tìm kiếm.
   ═══════════════════════════════════════════════════════════════════════════ */

const UI_V2_OPTIONS = [
  { value: "admin", label: "Chỉ admin dùng thử" },
  { value: "beta", label: "Mọi studio thấy gợi ý, tự bật" },
  { value: "default", label: "Mặc định cho mọi studio" },
];

const QUICK_LINKS = [
  { href: "/dashboard/admin", label: "Người dùng & studio", desc: "Tài khoản, gói, yêu cầu nâng cấp & mã giảm giá", icon: Users },
  { href: "/dashboard/upgrade", label: "Trang nâng cấp (preview)", desc: "Xem gói hiển thị với người dùng", icon: Rocket },
];

export default function SettingsPanelV2({ settings, feedbacks }: { settings: SiteSettings | null; feedbacks: Feedback[] }) {
  const s = useSettings(settings, feedbacks);
  const c = useUpgradeContent(settings?.upgrade_content ?? null);

  // Mốc "đã lưu" để biết có thay đổi chưa lưu (form chung và nội dung trang nâng cấp lưu riêng).
  const [formSnap, setFormSnap] = useState(() => JSON.stringify(settings ?? {}));
  const [ucSnap, setUcSnap] = useState(() => JSON.stringify(mergeUpgradeContent(settings?.upgrade_content ?? null)));
  const formDirty = JSON.stringify(s.form) !== formSnap;
  const ucDirty = JSON.stringify(c.uc) !== ucSnap;
  const saving = s.saving || c.saving;

  async function saveAll() {
    if (formDirty) {
      const snap = JSON.stringify(s.form);
      if (await s.save()) setFormSnap(snap);
    }
    if (ucDirty) {
      const snap = JSON.stringify(c.uc);
      if (await c.save()) setUcSnap(snap);
    }
  }
  function resetAll() {
    s.setForm(JSON.parse(formSnap));
    c.setUc(JSON.parse(ucSnap));
  }

  const openFeedback = s.feedbacks.filter((f) => !f.handled).length;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <SectionNavV2
        items={[
          { id: "trang-chu", label: "Trang chủ mstudo.com", icon: Globe },
          { id: "seo", label: "Trình duyệt & SEO", icon: Settings2 },
          { id: "tinh-nang", label: "Tính năng", icon: ToggleRight },
          { id: "goi-gia", label: "Gói & giá", icon: BadgeDollarSign },
          { id: "thanh-toan", label: "Nhận thanh toán", icon: Landmark },
          { id: "trang-nang-cap", label: "Trang nâng cấp", icon: Rocket },
          {
            id: "gop-y",
            label: "Góp ý & liên hệ",
            icon: MessageSquare,
            badge: openFeedback ? <span className="v2-tab-count" style={{ background: "var(--amS)", color: "var(--am)" }}>{openFeedback}</span> : null,
          },
        ]}
        footer={
          <div className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>Quản lý nhanh</p>
            {QUICK_LINKS.map((x) => (
              <Link key={x.href} href={x.href} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium hover:bg-[var(--sf2)]" style={{ color: "var(--tx2)" }}>
                <x.icon size={15} className="flex-none" />
                <span className="truncate">{x.label}</span>
              </Link>
            ))}
          </div>
        }
      />

      <Stack className="min-w-0">
        <PageHead desc="Nội dung mstudo.com, SEO, tính năng mở cho studio, gói & giá, trang nâng cấp. Có thay đổi là hiện thanh Lưu ở đáy màn." />

        <HomeSection s={s} />
        <SeoSection s={s} />
        <FeatureSection s={s} />
        <PriceSection s={s} />
        <PayAccountSection s={s} />

        <Section
          id="trang-nang-cap"
          icon={Rocket}
          title="Nội dung trang nâng cấp"
          desc="Tiêu đề, tên & điểm nổi bật của gói, bảng so sánh ở trang Gói phần mềm. Giá & % giảm chỉnh ở mục Gói & giá."
          actions={
            <Link href="/dashboard/upgrade" className={btn("ghost", "sm")}>
              <ExternalLink size={15} /> Xem trang
            </Link>
          }
        >
          <UpgradeContentEditorV2 c={c} />
        </Section>

        <FeedbackSection s={s} />

        <div className="v2-card overflow-hidden lg:hidden">
          <p className="v2-section-title px-4 pt-3.5">Quản lý nhanh</p>
          <div className="mt-1">
            {QUICK_LINKS.map((x) => (
              <ListRow key={x.href} href={x.href} leading={<span className="v2-section-icon"><x.icon size={16} /></span>} title={x.label} sub={x.desc} />
            ))}
          </div>
        </div>

        <SaveBarV2
          show={formDirty || ucDirty}
          label={formDirty && ucDirty ? "Cấu hình và nội dung trang nâng cấp có thay đổi chưa lưu" : "Có thay đổi chưa lưu"}
          saving={saving}
          onSave={() => void saveAll()}
          onReset={resetAll}
        />
      </Stack>
      <ToastV2>{s.msg ?? c.msg}</ToastV2>
    </div>
  );
}

/* ── Các khối ─────────────────────────────────────────────────────────── */

function HomeSection({ s }: { s: SettingsState }) {
  const field = (k: keyof SiteSettings) => ({
    value: s.str(k),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => s.set(k, e.target.value as never),
  });
  return (
    <Section id="trang-chu" icon={Globe} title="Nội dung trang chủ mstudo.com" desc="Hiện trực tiếp trên trang giới thiệu mstudo.com.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Khẩu hiệu chính (tiêu đề lớn)">
          <textarea className={inputCls} rows={3} placeholder="Phần mềm quản lý studio ảnh — toàn diện & đẹp" {...field("landing_hero_title" as keyof SiteSettings)} />
        </Field>
        <Field label="Mô tả ngắn dưới khẩu hiệu">
          <textarea className={inputCls} rows={3} placeholder="Hợp đồng, đặt lịch, tài chính, đội ngũ trong một nơi…" {...field("landing_hero_sub" as keyof SiteSettings)} />
        </Field>
        <Field label="Nhãn nhỏ trên tiêu đề" hint="Ví dụ: “Phần mềm quản lý studio ảnh”">
          <input className={inputCls} placeholder="Phần mềm quản lý studio ảnh" {...field("landing_hero_badge" as keyof SiteSettings)} />
        </Field>
        <Field label="Ghi chú nhỏ dưới nút bắt đầu" hint="Ví dụ: “Miễn phí 7 ngày, không cần thẻ”">
          <input className={inputCls} placeholder="Miễn phí 7 ngày, không cần thẻ" {...field("landing_hero_note" as keyof SiteSettings)} />
        </Field>
      </div>
    </Section>
  );
}

function SeoSection({ s }: { s: SettingsState }) {
  const title = s.str("site_title");
  const desc = s.str("site_description");
  const icon = s.form.favicon_url as string | null | undefined;
  return (
    <Section id="seo" icon={Settings2} title="Trình duyệt & SEO" desc="Tên tab trình duyệt, biểu tượng và mô tả khi chia sẻ link hoặc hiện trên Google.">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Field label="Tiêu đề tab trình duyệt">
            <input className={inputCls} value={title} placeholder="mstudo — Phần mềm quản lý studio ảnh" onChange={(e) => s.set("site_title", e.target.value)} />
          </Field>
          <Field label="Favicon" hint="Link ảnh vuông .png / .ico">
            <div className="flex items-center gap-2">
              <input className={`${inputCls} min-w-0 flex-1`} value={s.str("favicon_url")} placeholder="https://…/logo.png" onChange={(e) => s.set("favicon_url", e.target.value)} />
              {icon ? (
                <img src={icon} alt="favicon" className="h-[38px] w-[38px] flex-none rounded-[10px] object-contain p-1" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }} />
              ) : null}
            </div>
          </Field>
          <Field label="Mô tả SEO" hint="Hiện khi chia sẻ link / trên Google.">
            <textarea className={inputCls} rows={3} value={desc} placeholder="mstudo · Phần mềm quản lý studio ảnh: hợp đồng, báo giá, đặt lịch…" onChange={(e) => s.set("site_description", e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <p className="v2-label">Xem trước trên Google</p>
          <div className="rounded-[14px] p-4" style={{ background: "var(--sf2)" }}>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 flex-none items-center justify-center overflow-hidden rounded-full" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
                {icon ? <img src={icon} alt="" className="h-4 w-4 object-contain" /> : <Globe size={13} style={{ color: "var(--tx3)" }} />}
              </span>
              <span className="text-[12px]" style={{ color: "var(--tx2)" }}>mstudo.com</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[15px] font-medium" style={{ color: "var(--bl)" }}>{title || "mstudo — Phần mềm quản lý studio ảnh"}</p>
            <p className="mt-0.5 line-clamp-3 text-[12.5px]" style={{ color: "var(--tx2)" }}>{desc || "Chưa có mô tả — Google sẽ tự lấy một đoạn trong trang."}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function FeatureSection({ s }: { s: SettingsState }) {
  return (
    <Section
      id="tinh-nang"
      icon={ToggleRight}
      title="Tính năng"
      desc="Bật là mở cho mọi studio. Tắt là hiện nhãn “Sắp ra mắt” và tạm khoá với studio — admin vẫn vào được để hoàn thiện."
    >
      <div className="flex flex-col gap-4">
        {/* Giao diện mới (thử nghiệm) — xem @/lib/ui-version. Ba mức: chỉ
            admin → studio tự bật → mặc định cho mọi người. */}
        <div className="grid gap-3 rounded-[14px] p-4 sm:grid-cols-[minmax(0,1fr)_280px] sm:items-center" style={{ background: "var(--acS)" }}>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">Giao diện mới (thử nghiệm)</p>
            <p className="text-[12.5px]" style={{ color: "var(--tx2)" }}>
              Ai được dùng khung giao diện mới. Dữ liệu dùng chung với bản cũ; người dùng luôn quay về bản cũ được trong menu tài khoản.
            </p>
            {s.uiV2Value !== "default" && (
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                Trang gửi khách (hợp đồng, album, cổng khách…) chỉ đổi sang giao diện mới khi chọn “Mặc định cho mọi studio”.
                Góp ý của studio dùng thử về mục “Góp ý & liên hệ” bên dưới và chuông thông báo.
              </p>
            )}
          </div>
          <select className={inputCls} value={s.uiV2Value} onChange={(e) => s.setUiV2(e.target.value)} aria-label="Giao diện mới (thử nghiệm)">
            {UI_V2_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-[14px]" style={{ border: "1px solid var(--bd2)" }}>
          {FEATURE_FLAGS.map((f, i) => {
            const locked = s.flagLocked(f.key);
            const hiddenKind = f.key === "desktop";
            return (
              <div key={f.key} className="px-4 py-1" style={i ? { borderTop: "1px solid var(--bd2)" } : undefined}>
                <Switch
                  checked={!locked}
                  onChange={(open) => s.setFlagLocked(f.key, !open)}
                  label={
                    <span className="flex flex-wrap items-center gap-2">
                      {f.label}
                      {locked ? (
                        <Badge tone={hiddenKind ? "gray" : "amber"}>{hiddenKind ? "Đang ẩn" : "Sắp ra mắt"}</Badge>
                      ) : (
                        <Badge tone="green">{hiddenKind ? "Đã xuất bản" : "Đang mở"}</Badge>
                      )}
                    </span>
                  }
                  desc={f.desc}
                />
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

function PriceSection({ s }: { s: SettingsState }) {
  const num = (k: keyof SiteSettings) => (s.form[k] as number) ?? 0;
  const after = (price: number, pct: number) => Math.round(price * (1 - pct / 100));
  return (
    <Section id="goi-gia" icon={BadgeDollarSign} title="Gói & giá (VND)" desc="Giá niêm yết và % giảm sẵn của từng gói, theo tháng và theo năm." flush>
      {/* Máy tính: một bảng 4 gói × 4 ô */}
      <div className="v2-table-wrap hidden md:block">
        <table className="v2-table">
          <thead>
            <tr>
              <th>Gói</th>
              <th>Giá / tháng</th>
              <th>Giá / năm</th>
              <th style={{ width: 120 }}>Giảm tháng</th>
              <th style={{ width: 120 }}>Giảm năm</th>
              <th className="num">Khách trả</th>
            </tr>
          </thead>
          <tbody>
            {PRICE_ROWS.map((p) => (
              <tr key={p.name}>
                <td className="whitespace-nowrap font-semibold">{p.name}</td>
                <td><PriceInput value={num(p.m)} onChange={(v) => s.set(p.m, toPrice(v) as never)} label={`${p.name} — giá tháng`} /></td>
                <td><PriceInput value={num(p.y)} onChange={(v) => s.set(p.y, toPrice(v) as never)} label={`${p.name} — giá năm`} /></td>
                <td><PctInput value={num(p.dm)} onChange={(v) => s.set(p.dm, toPercent(v) as never)} label={`${p.name} — giảm tháng`} /></td>
                <td><PctInput value={num(p.dy)} onChange={(v) => s.set(p.dy, toPercent(v) as never)} label={`${p.name} — giảm năm`} /></td>
                <td className="num text-[12.5px]" style={{ color: "var(--tx2)" }}>
                  <span className="block">{formatVnd(after(num(p.m), num(p.dm)))}/tháng</span>
                  <span className="block">{formatVnd(after(num(p.y), num(p.dy)))}/năm</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Điện thoại: mỗi gói một khối 2×2 */}
      <div className="md:hidden">
        {PRICE_ROWS.map((p, i) => (
          <div key={p.name} className="v2-card-pad flex flex-col gap-3" style={i ? { borderTop: "1px solid var(--bd2)" } : undefined}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[14px] font-semibold">{p.name}</p>
              <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
                Khách trả {formatVnd(after(num(p.m), num(p.dm)))}/th · {formatVnd(after(num(p.y), num(p.dy)))}/năm
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Giá / tháng"><PriceInput value={num(p.m)} onChange={(v) => s.set(p.m, toPrice(v) as never)} /></Field>
              <Field label="Giá / năm"><PriceInput value={num(p.y)} onChange={(v) => s.set(p.y, toPrice(v) as never)} /></Field>
              <Field label="Giảm tháng"><PctInput value={num(p.dm)} onChange={(v) => s.set(p.dm, toPercent(v) as never)} /></Field>
              <Field label="Giảm năm"><PctInput value={num(p.dy)} onChange={(v) => s.set(p.dy, toPercent(v) as never)} /></Field>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PriceInput({ value, onChange, label }: { value: number; onChange: (v: string) => void; label?: string }) {
  return (
    <input type="number" min={0} className={`${inputCls} v2-num`} value={value ?? ""} placeholder="0" aria-label={label} onChange={(e) => onChange(e.target.value)} />
  );
}
function PctInput({ value, onChange, label }: { value: number; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="relative">
      <input type="number" min={0} max={100} className={`${inputCls} v2-num`} style={{ paddingRight: 30 }} value={value ?? ""} aria-label={label} onChange={(e) => onChange(e.target.value)} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "var(--tx3)" }}>%</span>
    </div>
  );
}

function PayAccountSection({ s }: { s: SettingsState }) {
  const bin = s.str("pay_bank_bin");
  const account = s.str("pay_bank_account");
  const holder = s.str("pay_bank_holder");
  const bankName = BANKS.find((b) => b.bin === bin.trim())?.name;
  const qr = qrUrl({ bin: bin.trim() || null, account: account.trim() || null, holder: holder || null, name: null }, 0, "");
  return (
    <Section id="thanh-toan" icon={Landmark} title="Tài khoản nhận thanh toán" desc="Mã QR trên trang thanh toán gói dịch vụ sinh từ đúng tài khoản này.">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex min-w-0 flex-col gap-4">
          {!bin.trim() || !account.trim() ? (
            <Callout tone="amber" icon={QrCode} title="Chưa đủ thông tin để tạo mã QR">
              Bỏ trống là studio không quét được mã và phải nhắn hỏi — điền đủ <b>mã ngân hàng + số tài khoản</b>.
            </Callout>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mã ngân hàng (BIN · VietQR)" hint={bankName ? `${bin.trim()} = ${bankName}` : "Ví dụ 970436 = Vietcombank, 970422 = MB Bank, 970407 = Techcombank."}>
              <input className={inputCls} inputMode="numeric" value={bin} placeholder="970436" onChange={(e) => s.set("pay_bank_bin", e.target.value as never)} />
            </Field>
            <Field label="Số tài khoản">
              <input className={inputCls} inputMode="numeric" value={account} placeholder="0123456789" onChange={(e) => s.set("pay_bank_account", e.target.value as never)} />
            </Field>
            <Field label="Chủ tài khoản" hint="Viết KHÔNG dấu, đúng như trên app ngân hàng.">
              <input className={inputCls} value={holder} placeholder="NGUYEN VAN A" onChange={(e) => s.set("pay_bank_holder", e.target.value as never)} />
            </Field>
            <Field label="Tên ngân hàng">
              <input className={inputCls} value={s.str("pay_bank_name")} placeholder="Vietcombank" onChange={(e) => s.set("pay_bank_name", e.target.value as never)} />
            </Field>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-[14px] p-4" style={{ background: "var(--sf2)" }}>
          <p className="v2-label self-start">Xem trước mã QR</p>
          {qr ? (
            <img src={qr} alt="Mã QR xem trước" className="h-auto w-full max-w-[180px] rounded-[10px] bg-white p-1.5" />
          ) : (
            <div className="flex aspect-square w-full max-w-[180px] items-center justify-center rounded-[10px]" style={{ border: "1px dashed var(--bdS)", color: "var(--tx3)" }}>
              <QrCode size={32} />
            </div>
          )}
          <p className="text-center text-[11.5px]" style={{ color: "var(--tx3)" }}>Trang thanh toán tự điền số tiền & nội dung.</p>
        </div>
      </div>
    </Section>
  );
}

type FbFilter = "open" | "all";

function FeedbackSection({ s }: { s: SettingsState }) {
  const open = s.feedbacks.filter((f) => !f.handled).length;
  const [filter, setFilter] = useState<FbFilter>(open ? "open" : "all");
  const shown = filter === "open" ? s.feedbacks.filter((f) => !f.handled) : s.feedbacks;
  return (
    <section id="gop-y" className="v2-card overflow-hidden">
      <header className="v2-section-head">
        <span className="v2-section-icon"><MessageSquare size={17} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="v2-section-title">Góp ý & liên hệ</h3>
          <p className="v2-section-desc">Tin nhắn gửi từ form liên hệ của mstudo.com.</p>
        </div>
      </header>
      {s.feedbacks.length ? (
        <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <Segmented<FbFilter>
            label="Lọc góp ý"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "open", label: "Chưa xử lý", count: open },
              { value: "all", label: "Tất cả", count: s.feedbacks.length },
            ]}
          />
        </div>
      ) : null}
      {s.feedbacks.length === 0 ? (
        <Empty compact icon={MessageSquare} title="Chưa có tin nhắn nào" />
      ) : shown.length === 0 ? (
        <Empty compact icon={Search} title="Đã xử lý hết góp ý" hint="Chọn “Tất cả” để xem lại." />
      ) : (
        shown.map((f) => (
          <div key={f.id} className="v2-row !items-start" style={f.handled ? { opacity: 0.6 } : undefined}>
            <Avatar name={f.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 text-[14px] font-semibold">
                {f.name}
                {f.email ? <span className="text-[12.5px] font-normal" style={{ color: "var(--tx3)" }}>{f.email}</span> : null}
                {!f.handled ? <Badge tone="amber" dot>Mới</Badge> : null}
              </p>
              <p className="mt-1 whitespace-pre-line text-[13.5px]" style={{ color: "var(--tx2)" }}>{f.message}</p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--tx3)" }}>{fmtDateTime(f.created_at)}</p>
            </div>
            <div className="flex flex-none items-center gap-1">
              <button
                type="button"
                onClick={() => void s.handleFeedback("handled", f.id, !f.handled)}
                className={iconBtn()}
                title={f.handled ? "Đánh dấu chưa xử lý" : "Đánh dấu đã đọc"}
                aria-label={f.handled ? "Đánh dấu chưa xử lý" : "Đánh dấu đã đọc"}
                style={f.handled ? undefined : { color: "var(--gn)" }}
              >
                {f.handled ? <RotateCcw size={16} /> : <Check size={17} />}
              </button>
              <button type="button" onClick={() => void s.handleFeedback("delete", f.id)} className={iconBtn()} title="Xoá" aria-label="Xoá góp ý" style={{ color: "var(--rd)" }}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
