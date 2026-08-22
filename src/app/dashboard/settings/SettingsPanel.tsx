"use client";

import { useState } from "react";
import DateInput from "@/components/DateInput";
import {
  Save, Tag, Trash2, Plus, Shuffle, Check, Crown, MessageSquare,
  Globe, LayoutTemplate, BadgeDollarSign, Settings2, ChevronDown, ChevronRight, Rocket,
} from "lucide-react";
import type { SiteSettings, UpgradeRequest, DiscountCode } from "@/lib/types";
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

/* ── Section toggle helper ──────────────────────────────────────────────────── */
function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 p-5 text-left"
        style={{ borderBottom: open ? "1px solid var(--border)" : "none" }}
      >
        <Icon size={16} style={{ color: "var(--brand, var(--gold))" }} />
        <span className="flex-1 text-sm font-semibold">{title}</span>
        {open ? <ChevronDown size={16} style={{ color: "var(--text3)" }} /> : <ChevronRight size={16} style={{ color: "var(--text3)" }} />}
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </div>
  );
}

/* ── Field helpers ──────────────────────────────────────────────────────────── */
function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {note && <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>{note}</p>}
    </div>
  );
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
  upgrades,
  codes: initialCodes,
}: {
  settings: SiteSettings | null;
  feedbacks: Feedback[];
  upgrades: UpgradeRequest[];
  codes: DiscountCode[];
}) {
  const [form, setForm] = useState<Partial<SiteSettings>>(settings ?? {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const str = (k: keyof SiteSettings) => ((form[k] ?? "") as string);

  // ── Feedback ─────────────────────────────────────────────────────────────
  const [feedbacks, setFeedbacks] = useState<Feedback[]>(initialFeedbacks);
  const [upgradeRows, setUpgradeRows] = useState<UpgradeRequest[]>(upgrades);

  async function handleFeedback(action: "handled" | "delete", id: string, handled?: boolean) {
    setFeedbacks((r) => action === "delete" ? r.filter((x) => x.id !== id) : r.map((x) => x.id === id ? { ...x, handled: !!handled } : x));
    await fetch("/api/admin/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "feedback", action, id, handled }),
    });
  }
  async function handleUpgrade(action: "handled" | "delete", id: string, handled?: boolean) {
    setUpgradeRows((r) => action === "delete" ? r.filter((x) => x.id !== id) : r.map((x) => x.id === id ? { ...x, handled: !!handled } : x));
    await fetch("/api/admin/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "upgrade", action, id, handled }),
    });
  }

  // ── Discount codes ────────────────────────────────────────────────────────
  const [codes, setCodes] = useState<DiscountCode[]>(initialCodes);
  const [newCode, setNewCode] = useState({ code: "", percent: 10, plan: "", cycle: "", uses: "many" as "1" | "many", expires: "", trial: 0 });

  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    setNewCode((n) => ({ ...n, code: s }));
  }
  async function addCode() {
    const code = newCode.code.trim().toUpperCase();
    if (!code) return;
    const res = await fetch("/api/admin/discount-codes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", code, percent: newCode.percent, plan: newCode.plan || null, cycle: newCode.cycle || null, max_uses: newCode.uses === "1" ? 1 : null, expires_at: newCode.expires || null, trial_days: newCode.trial || null }),
    });
    const data = await res.json();
    if (res.ok && data.code) { setCodes((c) => [data.code, ...c]); setNewCode({ code: "", percent: 10, plan: "", cycle: "", uses: "many", expires: "", trial: 0 }); }
    else { setMsg(data.error?.includes("duplicate") ? "Mã đã tồn tại" : "Lỗi"); setTimeout(() => setMsg(null), 2500); }
  }
  async function deleteCode(id: string) {
    setCodes((c) => c.filter((x) => x.id !== id));
    await fetch("/api/admin/discount-codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
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

      {/* ── 3b. Nội dung trang nâng cấp ──────────────────────────────────── */}
      <Section title="Nội dung trang nâng cấp" icon={Rocket}>
        <p className="text-[12px]" style={{ color: "var(--text3)" }}>
          Tiêu đề, tên &amp; điểm nổi bật của gói, bảng so sánh tính năng và mục “Sắp ra mắt” hiển thị tại <strong>/dashboard/upgrade</strong>. (Giá &amp; % giảm chỉnh ở mục “Gói &amp; giá” phía trên.)
        </p>
        <UpgradeContentEditor initial={settings?.upgrade_content ?? null} />
      </Section>

      {/* ── 4. Mã giảm giá ──────────────────────────────────────────────── */}
      <Section title="Mã giảm giá" icon={Tag}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Mã">
            <div className="flex gap-1.5">
              <input className="input" value={newCode.code} placeholder="VD: TET2026" onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })} />
              <button onClick={randomCode} type="button" className="btn-ghost px-2.5" title="Tạo ngẫu nhiên" aria-label="Tạo mã ngẫu nhiên"><Shuffle size={14} /></button>
            </div>
          </Field>
          <Field label="%"><input type="number" min={0} max={100} className="input w-16" value={newCode.percent} onChange={(e) => setNewCode({ ...newCode, percent: Number(e.target.value) })} /></Field>
          <Field label="Gói">
            <select className="input w-28" value={newCode.plan} onChange={(e) => setNewCode({ ...newCode, plan: e.target.value })}>
              <option value="">Mọi gói</option>
              <option value="basic">Basic</option>
              <option value="photographer">Photographer</option>
              <option value="photographer_plus">Photographer Plus</option>
              <option value="studio">Studio</option>
            </select>
          </Field>
          <Field label="Chu kỳ">
            <select className="input w-24" value={newCode.cycle} onChange={(e) => setNewCode({ ...newCode, cycle: e.target.value })}>
              <option value="">Mọi kỳ</option>
              <option value="month">Tháng</option>
              <option value="year">Năm</option>
            </select>
          </Field>
          <Field label="Lượt dùng">
            <select className="input w-28" value={newCode.uses} onChange={(e) => setNewCode({ ...newCode, uses: e.target.value as "1" | "many" })}>
              <option value="many">Nhiều lần</option>
              <option value="1">1 lần</option>
            </select>
          </Field>
          <Field label="Dùng thử (ngày)">
            <input type="number" min={0} className="input w-24" value={newCode.trial} onChange={(e) => setNewCode({ ...newCode, trial: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
          <Field label="Hạn dùng">
            <DateInput wrapperClassName="w-36" value={newCode.expires} onChange={(v) => setNewCode({ ...newCode, expires: v })} />
          </Field>
          <button onClick={addCode} className="btn-primary self-end"><Plus size={14} /> Thêm mã</button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { randomCode(); setNewCode((n) => ({ ...n, plan: "studio", trial: 1, percent: 0, uses: "many" })); }}
            className="text-[12px] underline underline-offset-2" style={{ color: "var(--brand, var(--gold))" }}>
            Tạo nhanh mã dùng thử Studio 1 ngày
          </button>
        </div>
        {codes.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--text3)" }}>Chưa có mã nào.</p>
        ) : (
          <div className="divide-y rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {codes.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                <span className="font-mono font-semibold" style={{ color: "var(--text)" }}>{c.code}</span>
                {c.trial_days ? <span style={{ color: "var(--success)" }}>dùng thử {c.trial_days} ngày</span>
                  : <span style={{ color: "var(--gold)" }}>-{c.percent}%</span>}
                <span style={{ color: "var(--text3)" }}>{c.plan ?? "mọi gói"}{c.cycle ? ` · ${c.cycle === "year" ? "năm" : "tháng"}` : ""}</span>
                <span style={{ color: "var(--text3)" }}>{c.max_uses == null ? `đã dùng ${c.used_count}` : `${c.used_count}/${c.max_uses}`}</span>
                {c.expires_at && <span style={{ color: new Date(c.expires_at).getTime() < Date.now() ? "var(--danger)" : "var(--text3)" }}>HH {new Date(c.expires_at).toLocaleDateString("vi-VN")}</span>}
                <button onClick={() => deleteCode(c.id)} className="ml-auto rounded-md p-1.5" style={{ color: "var(--text2)" }} aria-label="Xoá mã giảm giá"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── 5. Góp ý / Liên hệ ─────────────────────────────────────────── */}
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
                    <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>{new Date(f.created_at).toLocaleString("vi-VN")}</p>
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

      {/* ── 6. Yêu cầu nâng cấp ────────────────────────────────────────── */}
      <Section title={`Yêu cầu nâng cấp (${upgradeRows.length})`} icon={Crown}>
        {upgradeRows.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: "var(--text3)" }}>Chưa có yêu cầu nào.</p>
        ) : (
          <div className="space-y-2">
            {upgradeRows.map((u) => (
              <div key={u.id} className="rounded-xl p-4" style={{ background: "var(--surface2)", opacity: u.handled ? 0.55 : 1 }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-semibold text-sm">
                      {u.email ?? u.user_id}
                      {u.phone && <span className="font-normal text-[12px]" style={{ color: "var(--text2)" }}>📞 {u.phone}</span>}
                      {u.plan && <span className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase" style={{ background: "color-mix(in srgb, var(--gold) 18%, transparent)", color: "var(--gold)" }}>{u.plan}{u.cycle ? ` · ${u.cycle === "year" ? "năm" : "tháng"}` : ""}</span>}
                      {u.amount != null && <span className="text-[12px] font-semibold" style={{ color: "var(--gold)" }}>{u.amount.toLocaleString("vi-VN")}đ</span>}
                      {u.discount_code && <span className="rounded px-2 py-0.5 font-mono text-[11px]" style={{ background: "var(--surface)", color: "var(--text2)" }}>{u.discount_code}</span>}
                    </div>
                    {u.note && <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>{u.note}</p>}
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text3)" }}>{new Date(u.created_at).toLocaleString("vi-VN")}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => handleUpgrade("handled", u.id, !u.handled)} className="rounded-lg p-2" style={{ background: "var(--surface)", color: u.handled ? "var(--success)" : "var(--text3)" }} aria-label={u.handled ? "Đánh dấu chưa xử lý" : "Đánh dấu đã xử lý"}>
                      <Check size={15} />
                    </button>
                    <button onClick={() => handleUpgrade("delete", u.id)} className="rounded-lg p-2" style={{ background: "var(--surface)", color: "var(--danger)" }} aria-label="Xoá yêu cầu nâng cấp">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── 7. Quản lý người dùng (link nhanh) ─────────────────────────── */}
      <Section title="Quản lý nhanh" icon={LayoutTemplate}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: "/dashboard/admin", label: "Quản trị người dùng", desc: "Xem, cấp quyền, kích hoạt/khóa tài khoản" },
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
