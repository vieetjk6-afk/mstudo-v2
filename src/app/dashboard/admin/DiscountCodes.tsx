"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/date";
import { Plus, Shuffle, Tag, Trash2 } from "lucide-react";
import DateInput from "@/components/DateInput";
import { Section, Field } from "@/components/admin/Section";
import type { DiscountCode } from "@/lib/types";

const BLANK = { code: "", percent: 10, plan: "", cycle: "", uses: "many" as "1" | "many", expires: "", trial: 0 };

/**
 * Mã giảm giá & mã dùng thử. Ở cùng tab với tài khoản và yêu cầu nâng cấp: ba
 * việc này luôn đi liền nhau khi chốt một studio (phát mã → studio dùng → duyệt).
 */
export default function DiscountCodes({ initial }: { initial: DiscountCode[] }) {
  const [codes, setCodes] = useState<DiscountCode[]>(initial);
  const [form, setForm] = useState(BLANK);
  const [msg, setMsg] = useState<string | null>(null);

  function randomCode() {
    // Bỏ I/O/0/1 — mã hay được đọc qua điện thoại cho studio.
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    setForm((n) => ({ ...n, code: s }));
  }

  async function addCode() {
    const code = form.code.trim().toUpperCase();
    if (!code) return;
    const res = await fetch("/api/admin/discount-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        code,
        percent: form.percent,
        plan: form.plan || null,
        cycle: form.cycle || null,
        max_uses: form.uses === "1" ? 1 : null,
        expires_at: form.expires || null,
        trial_days: form.trial || null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.code) {
      setCodes((c) => [data.code, ...c]);
      setForm(BLANK);
    } else {
      setMsg(data?.error?.includes("duplicate") ? "Mã đã tồn tại" : "Lỗi");
      setTimeout(() => setMsg(null), 2500);
    }
  }

  async function deleteCode(id: string) {
    setCodes((c) => c.filter((x) => x.id !== id));
    await fetch("/api/admin/discount-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
  }

  return (
    <Section title={`Mã giảm giá (${codes.length})`} icon={Tag}>
      {msg && <p className="text-[12.5px]" style={{ color: "var(--danger)" }}>{msg}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Mã">
          <div className="flex gap-1.5">
            <input className="input" value={form.code} placeholder="VD: TET2026" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            <button onClick={randomCode} type="button" className="btn-ghost px-2.5" title="Tạo ngẫu nhiên" aria-label="Tạo mã ngẫu nhiên"><Shuffle size={14} /></button>
          </div>
        </Field>
        <Field label="%">
          <input type="number" min={0} max={100} className="input w-16" value={form.percent} onChange={(e) => setForm({ ...form, percent: Number(e.target.value) })} />
        </Field>
        <Field label="Gói">
          <select className="input w-28" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
            <option value="">Mọi gói</option>
            <option value="basic">Basic</option>
            <option value="photographer">Photographer</option>
            <option value="photographer_plus">Photographer Plus</option>
            <option value="studio">Studio</option>
          </select>
        </Field>
        <Field label="Chu kỳ">
          <select className="input w-24" value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })}>
            <option value="">Mọi kỳ</option>
            <option value="month">Tháng</option>
            <option value="year">Năm</option>
          </select>
        </Field>
        <Field label="Lượt dùng">
          <select className="input w-28" value={form.uses} onChange={(e) => setForm({ ...form, uses: e.target.value as "1" | "many" })}>
            <option value="many">Nhiều lần</option>
            <option value="1">1 lần</option>
          </select>
        </Field>
        <Field label="Dùng thử (ngày)">
          <input type="number" min={0} className="input w-24" value={form.trial} onChange={(e) => setForm({ ...form, trial: Math.max(0, Number(e.target.value) || 0) })} />
        </Field>
        <Field label="Hạn dùng">
          <DateInput wrapperClassName="w-36" value={form.expires} onChange={(v) => setForm({ ...form, expires: v })} />
        </Field>
        <button onClick={addCode} className="btn-primary self-end"><Plus size={14} /> Thêm mã</button>
      </div>
      <button
        type="button"
        onClick={() => { randomCode(); setForm((n) => ({ ...n, plan: "studio", trial: 1, percent: 0, uses: "many" })); }}
        className="text-[12px] underline underline-offset-2"
        style={{ color: "var(--brand, var(--gold))" }}
      >
        Tạo nhanh mã dùng thử Studio 1 ngày
      </button>

      {codes.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--text3)" }}>Chưa có mã nào.</p>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
          {codes.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
              <span className="font-mono font-semibold" style={{ color: "var(--text)" }}>{c.code}</span>
              {c.trial_days
                ? <span style={{ color: "var(--success)" }}>dùng thử {c.trial_days} ngày</span>
                : <span style={{ color: "var(--gold)" }}>-{c.percent}%</span>}
              <span style={{ color: "var(--text3)" }}>{c.plan ?? "mọi gói"}{c.cycle ? ` · ${c.cycle === "year" ? "năm" : "tháng"}` : ""}</span>
              <span style={{ color: "var(--text3)" }}>{c.max_uses == null ? `đã dùng ${c.used_count}` : `${c.used_count}/${c.max_uses}`}</span>
              {c.expires_at && (
                <span style={{ color: new Date(c.expires_at).getTime() < Date.now() ? "var(--danger)" : "var(--text3)" }}>
                  HH {fmtDate(c.expires_at)}
                </span>
              )}
              <button onClick={() => deleteCode(c.id)} className="ml-auto rounded-md p-1.5" style={{ color: "var(--text2)" }} aria-label="Xoá mã giảm giá"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
