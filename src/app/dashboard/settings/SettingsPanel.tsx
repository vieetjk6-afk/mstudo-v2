"use client";

import { useState } from "react";
import { fmtDateTime } from "@/lib/date";
import {
  Save, Trash2, Check, MessageSquare,
  Globe, LayoutTemplate, BadgeDollarSign, Settings2, Rocket, Landmark,
} from "lucide-react";
import type { SiteSettings } from "@/lib/types";
import { Section, Field } from "@/components/admin/Section";
import UpgradeContentEditor from "./UpgradeContentEditor";

/* ── Types ─────────────────────────────────────────────────────────────────── */
export interface Feedback {
  id: string;
  name: string;
  email: string | null;
  message: string;
  handled: boolean;
  created_at: string;
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      className="input"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      className="input resize-y"
      style={{ minHeight: rows * 28 }}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function SettingsPanel({
  settings,
  feedbacks: initialFeedbacks,
}: {
  settings: SiteSettings | null;
  feedbacks: Feedback[];
}) {
  const [form, setForm] = useState<Partial<SiteSettings>>(settings ?? {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const str = (k: keyof SiteSettings) => ((form[k] ?? "") as string);

  // ── Feedback ─────────────────────────────────────────────────────────────
  const [feedbacks, setFeedbacks] = useState<Feedback[]>(initialFeedbacks);
  async function handleFeedback(action: "handled" | "delete", id: string, handled?: boolean) {
    setFeedbacks((r) => action === "delete" ? r.filter((x) => x.id !== id) : r.map((x) => x.id === id ? { ...x, handled: !!handled } : x));
    await fetch("/api/admin/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "feedback", action, id, handled }),
    });
  }
  // ── Save ──────────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setMsg(res.ok ? "Đã lưu" : "Lỗi");
    setTimeout(() => setMsg(null), 2500);
  }

  const SaveBtn = ({ label = "Lưu thay đổi" }: { label?: string }) => (
    <button onClick={save} disabled={saving} className="btn-primary gap-2">
      <Save size={14} /> {saving ? "Đang lưu…" : label}
    </button>
  );

  return (
    <div className="page-in space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Cài đặt hệ thống</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text2)" }}>Quản lý nội dung trang mstudo.com và cấu hình hệ thống</p>
        </div>
        {msg && (
          <span className="rounded-full px-4 py-1.5 text-sm font-medium" style={{ background: "color-mix(in srgb, var(--success) 14%, transparent)", color: "var(--success)" }}>
            {msg}
          </span>
        )}
      </div>

      {/* ── 1. Trang chủ mstudo.com ─────────────────────────────────────── */}
      <Section title="Nội dung trang chủ mstudo.com" icon={Globe}>
        <p className="text-[12px]" style={{ color: "var(--text3)" }}>Nội dung hiển thị trực tiếp trên trang marketing <strong>mstudo.com</strong>.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Khẩu hiệu chính (Hero title)">
            <Textarea value={str("landing_hero_title")} onChange={(v) => set("landing_hero_title" as keyof SiteSettings, v as never)} placeholder="Phần mềm quản lý studio ảnh — toàn diện & đẹp" />
          </Field>
          <Field label="Mô tả ngắn (Hero subtitle)">
            <Textarea value={str("landing_hero_sub")} onChange={(v) => set("landing_hero_sub" as keyof SiteSettings, v as never)} placeholder="Hợp đồng, đặt lịch, tài chính, đội ngũ trong một nơi…" />
          </Field>
          <Field label="Badge / nhãn nhỏ trên hero" note='Ví dụ: "Phần mềm quản lý studio ảnh"'>
            <Input value={str("landing_hero_badge")} onChange={(v) => set("landing_hero_badge" as keyof SiteSettings, v as never)} placeholder="Phần mềm quản lý studio ảnh" />
          </Field>
          <Field label="Ghi chú nhỏ dưới nút CTA" note='Ví dụ: "Miễn phí 7 ngày, không cần thẻ"'>
            <Input value={str("landing_hero_note")} onChange={(v) => set("landing_hero_note" as keyof SiteSettings, v as never)} placeholder="Miễn phí 7 ngày, không cần thẻ" />
          </Field>
        </div>
        <SaveBtn label="Lưu nội dung trang chủ" />
      </Section>

      {/* ── 2. SEO & Browser ────────────────────────────────────────────── */}
      <Section title="Trình duyệt & SEO" icon={Settings2}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Tiêu đề tab trình duyệt">
            <Input value={str("site_title")} onChange={(v) => set("site_title", v)} placeholder="mstudo — Phần mềm quản lý studio ảnh" />
          </Field>
          <Field label="Favicon (URL hình vuông .png / .ico)">
            <Input value={str("favicon_url")} onChange={(v) => set("favicon_url", v)} placeholder="https://…/logo.png" />
          </Field>
        </div>
        <Field label="Mô tả SEO (hiển thị khi chia sẻ link / Google)">
          <Textarea value={str("site_description")} onChange={(v) => set("site_description", v)} placeholder="mstudo · Phần mềm quản lý studio ảnh: hợp đồng, báo giá, đặt lịch…" />
        </Field>
        {form.favicon_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.favicon_url as string} alt="favicon" className="h-10 w-10 rounded" style={{ border: "1px solid var(--border)" }} />
        )}
        <SaveBtn label="Lưu SEO" />
      </Section>

      {/* ── 2b. Tính năng ───────────────────────────────────────────────── */}
      <Section title="Tính năng" icon={Settings2}>
        <p className="text-sm" style={{ color: "var(--text2)" }}>
          Bật/tắt hiển thị các tính năng cho studio. Khi để “Sắp ra mắt”, mục sẽ hiện nhãn và tạm khoá với studio (admin vẫn vào được để hoàn thiện).
        </p>
        <label className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--surface2)" }}>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--brand,var(--gold))]"
            checked={((form.feature_flags as Record<string, string> | null | undefined)?.story) === "coming_soon"}
            onChange={(e) => {
              const cur = { ...((form.feature_flags as Record<string, string>) ?? {}) };
              if (e.target.checked) cur.story = "coming_soon"; else delete cur.story;
              set("feature_flags" as keyof SiteSettings, cur as never);
            }}
          />
          <span className="text-sm">
            <b>Love Story</b> — hiển thị “Sắp ra mắt” &amp; tạm khoá với studio
          </span>
        </label>
        <label className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--surface2)" }}>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--brand,var(--gold))]"
            checked={((form.feature_flags as Record<string, string> | null | undefined)?.album ?? "coming_soon") !== "live"}
            onChange={(e) => {
              const cur = { ...((form.feature_flags as Record<string, string>) ?? {}) };
              cur.album = e.target.checked ? "coming_soon" : "live";
              set("feature_flags" as keyof SiteSettings, cur as never);
            }}
          />
          <span className="text-sm">
            <b>Thiết kế Album</b> — hiển thị “Sắp ra mắt” &amp; tạm khoá với studio
          </span>
        </label>
        <label className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--surface2)" }}>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--brand,var(--gold))]"
            checked={((form.feature_flags as Record<string, string> | null | undefined)?.slide ?? "coming_soon") !== "live"}
            onChange={(e) => {
              const cur = { ...((form.feature_flags as Record<string, string>) ?? {}) };
              cur.slide = e.target.checked ? "coming_soon" : "live";
              set("feature_flags" as keyof SiteSettings, cur as never);
            }}
          />
          <span className="text-sm">
            <b>Slide cưới</b> — hiển thị “Sắp ra mắt” &amp; tạm khoá với studio
          </span>
        </label>
        <label className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--surface2)" }}>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--brand,var(--gold))]"
            checked={((form.feature_flags as Record<string, string> | null | undefined)?.drive_sync ?? "coming_soon") !== "live"}
            onChange={(e) => {
              const cur = { ...((form.feature_flags as Record<string, string>) ?? {}) };
              cur.drive_sync = e.target.checked ? "coming_soon" : "live";
              set("feature_flags" as keyof SiteSettings, cur as never);
            }}
          />
          <span className="text-sm">
            <b>Đồng bộ Drive</b> — hiển thị “Sắp ra mắt” &amp; tạm khoá với studio
          </span>
        </label>
        <label className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--surface2)" }}>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--brand,var(--gold))]"
            checked={((form.feature_flags as Record<string, string> | null | undefined)?.desktop ?? "") !== "live"}
            onChange={(e) => {
              const cur = { ...((form.feature_flags as Record<string, string>) ?? {}) };
              if (e.target.checked) delete cur.desktop; else cur.desktop = "live";
              set("feature_flags" as keyof SiteSettings, cur as never);
            }}
          />
          <span className="text-sm">
            <b>MStudo Desktop</b> — ẩn hoàn toàn với studio (chỉ admin thấy); bỏ chọn để xuất bản
          </span>
        </label>

        <SaveBtn label="Lưu tính năng" />
      </Section>

      {/* ── 3. Gói & giá ────────────────────────────────────────────────── */}
      <Section title="Gói & giá (VND)" icon={BadgeDollarSign}>
        {/* Mỗi gói 1 cột: giá tháng, giá năm, giảm giá tháng, giảm giá năm. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([
            { name: "Basic", m: "price_basic_month", y: "price_basic_year", dm: "basic_discount_month_percent", dy: "basic_discount_year_percent" },
            { name: "Photographer", m: "price_photographer_month", y: "price_photographer_year", dm: "photographer_discount_month_percent", dy: "photographer_discount_year_percent" },
            { name: "Photographer Plus", m: "price_photographer_plus_month", y: "price_photographer_plus_year", dm: "photographer_plus_discount_month_percent", dy: "photographer_plus_discount_year_percent" },
            { name: "Studio", m: "price_studio_month", y: "price_studio_year", dm: "studio_discount_month_percent", dy: "studio_discount_year_percent" },
          ] as { name: string; m: keyof SiteSettings; y: keyof SiteSettings; dm: keyof SiteSettings; dy: keyof SiteSettings }[]).map((p) => (
            <div key={p.name} className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="mb-2 text-[13px] font-semibold" style={{ color: "var(--text)" }}>{p.name}</div>
              <div className="space-y-2">
                <Field label="Giá / tháng"><Input type="number" value={(form[p.m] as number) ?? 0} onChange={(v) => set(p.m, Math.max(0, Math.round(Number(v) || 0)) as never)} placeholder="0" /></Field>
                <Field label="Giá / năm"><Input type="number" value={(form[p.y] as number) ?? 0} onChange={(v) => set(p.y, Math.max(0, Math.round(Number(v) || 0)) as never)} placeholder="0" /></Field>
                <Field label="Giảm / tháng (%)"><Input type="number" value={(form[p.dm] as number) ?? 0} onChange={(v) => set(p.dm, Math.max(0, Math.min(100, Number(v) || 0)) as never)} /></Field>
                <Field label="Giảm / năm (%)"><Input type="number" value={(form[p.dy] as number) ?? 0} onChange={(v) => set(p.dy, Math.max(0, Math.min(100, Number(v) || 0)) as never)} /></Field>
              </div>
            </div>
          ))}
        </div>
        <SaveBtn label="Lưu gói & giá" />
      </Section>

      {/* ── 3a. Tài khoản nhận thanh toán ────────────────────────────────── */}
      <Section title="Tài khoản nhận thanh toán" icon={Landmark}>
        <p className="text-[12px]" style={{ color: "var(--text3)" }}>
          Mã QR trên trang thanh toán gói dịch vụ sinh từ đúng tài khoản này. Bỏ trống là studio
          không quét được mã và phải nhắn hỏi — nên điền đủ <strong>mã ngân hàng + số tài khoản</strong>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mã ngân hàng (BIN · VietQR)" note="Ví dụ 970436 = Vietcombank, 970422 = MB Bank, 970407 = Techcombank.">
            <Input value={str("pay_bank_bin")} onChange={(v) => set("pay_bank_bin", v as never)} placeholder="970436" />
          </Field>
          <Field label="Số tài khoản">
            <Input value={str("pay_bank_account")} onChange={(v) => set("pay_bank_account", v as never)} placeholder="0123456789" />
          </Field>
          <Field label="Chủ tài khoản" note="Viết KHÔNG dấu, đúng như trên app ngân hàng.">
            <Input value={str("pay_bank_holder")} onChange={(v) => set("pay_bank_holder", v as never)} placeholder="NGUYEN VAN A" />
          </Field>
          <Field label="Tên ngân hàng">
            <Input value={str("pay_bank_name")} onChange={(v) => set("pay_bank_name", v as never)} placeholder="Vietcombank" />
          </Field>
        </div>
        <SaveBtn label="Lưu tài khoản nhận tiền" />
      </Section>

      {/* ── 3b. Nội dung trang nâng cấp ──────────────────────────────────── */}
      <Section title="Nội dung trang nâng cấp" icon={Rocket}>
        <p className="text-[12px]" style={{ color: "var(--text3)" }}>
          Tiêu đề, tên &amp; điểm nổi bật của gói, bảng so sánh tính năng và mục “Sắp ra mắt” hiển thị tại <strong>/dashboard/upgrade</strong>. (Giá &amp; % giảm chỉnh ở mục “Gói &amp; giá” phía trên.)
        </p>
        <UpgradeContentEditor initial={settings?.upgrade_content ?? null} />
      </Section>

      {/* ── 4. Góp ý / Liên hệ ─────────────────────────────────────────── */}
      <Section title={`Góp ý & liên hệ (${feedbacks.length})`} icon={MessageSquare}>
        {feedbacks.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: "var(--text3)" }}>Chưa có tin nhắn nào.</p>
        ) : (
          <div className="space-y-2">
            {feedbacks.map((f) => (
              <div key={f.id} className="rounded-xl p-4" style={{ background: "var(--surface2)", opacity: f.handled ? 0.55 : 1 }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{f.name}
                      {f.email && <span className="ml-2 font-normal text-[12px]" style={{ color: "var(--text3)" }}>{f.email}</span>}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>{f.message}</p>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>{fmtDateTime(f.created_at)}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => handleFeedback("handled", f.id, !f.handled)} className="rounded-lg p-2" style={{ background: "var(--surface)", color: f.handled ? "var(--success)" : "var(--text3)" }} title={f.handled ? "Đánh dấu chưa xử lý" : "Đánh dấu đã đọc"} aria-label={f.handled ? "Đánh dấu chưa xử lý" : "Đánh dấu đã đọc"}>
                      <Check size={15} />
                    </button>
                    <button onClick={() => handleFeedback("delete", f.id)} className="rounded-lg p-2" style={{ background: "var(--surface)", color: "var(--danger)" }} title="Xoá" aria-label="Xoá góp ý">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── 5. Quản lý nhanh (link) ────────────────────────────────────── */}
      <Section title="Quản lý nhanh" icon={LayoutTemplate}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: "/dashboard/admin", label: "Người dùng & studio", desc: "Tài khoản, gói, yêu cầu nâng cấp & mã giảm giá" },
            { href: "/dashboard/upgrade", label: "Trang nâng cấp (preview)", desc: "Xem gói hiển thị với người dùng" },
          ].map((l) => (
            <a key={l.href} href={l.href} className="block rounded-xl p-4 transition-colors hover:opacity-80" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <p className="font-semibold text-sm">{l.label}</p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text3)" }}>{l.desc}</p>
            </a>
          ))}
        </div>
      </Section>
    </div>
  );
}
