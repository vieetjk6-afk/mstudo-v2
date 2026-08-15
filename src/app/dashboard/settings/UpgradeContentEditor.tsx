"use client";

import { useState } from "react";
import { Save, Plus, Trash2, ArrowUp, ArrowDown, Heading } from "lucide-react";
import { mergeUpgradeContent, type CompareRow, type UpgradeContent } from "@/lib/upgrade-content";
import type { Plan } from "@/lib/plans";

const PLANS: { key: Plan; label: string }[] = [
  { key: "free", label: "Miễn phí" },
  { key: "basic", label: "Basic" },
  { key: "photographer", label: "Photographer" },
  { key: "photographer_plus", label: "Photographer Plus" },
  { key: "studio", label: "Studio" },
];

const isSection = (r: CompareRow): r is { section: string } => "section" in r;

export default function UpgradeContentEditor({ initial }: { initial: unknown }) {
  const [uc, setUc] = useState<UpgradeContent>(() => mergeUpgradeContent(initial));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upgrade_content: uc }),
    });
    setSaving(false);
    setMsg(res.ok ? "Đã lưu nội dung trang nâng cấp" : "Lỗi khi lưu");
    setTimeout(() => setMsg(null), 2500);
  }

  const setRows = (rows: CompareRow[]) => setUc((u) => ({ ...u, compare: rows }));
  const editRow = (i: number, patch: Partial<Extract<CompareRow, { label: string }>> & { section?: string }) =>
    setRows(uc.compare.map((r, j) => (j === i ? ({ ...r, ...patch } as CompareRow) : r)));
  const removeRow = (i: number) => setRows(uc.compare.filter((_, j) => j !== i));
  const moveRow = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= uc.compare.length) return;
    const next = [...uc.compare];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };

  const inp = "input w-full";
  const cellInp = "input w-full text-center text-[13px]";

  return (
    <div className="space-y-6">
      {msg && <p className="rounded-lg px-3 py-2 text-sm font-medium" style={{ background: "color-mix(in srgb,var(--gold) 14%,transparent)", color: "var(--gold)" }}>{msg}</p>}

      {/* Headline */}
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="block"><span className="mb-1 block text-xs font-medium" style={{ color: "var(--text2)" }}>Tiêu đề trang</span>
          <input className={inp} value={uc.headline} onChange={(e) => setUc({ ...uc, headline: e.target.value })} /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium" style={{ color: "var(--text2)" }}>Mô tả ngắn dưới tiêu đề</span>
          <input className={inp} value={uc.subheadline} onChange={(e) => setUc({ ...uc, subheadline: e.target.value })} /></label>
      </div>

      {/* Per-plan label + features */}
      <div>
        <p className="mb-2 text-sm font-medium">Tên & điểm nổi bật của từng gói</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {PLANS.map(({ key, label }) => (
            <div key={key} className="rounded-lg p-3" style={{ border: "1px solid var(--border)" }}>
              <p className="mb-2 text-xs font-semibold" style={{ color: "var(--gold)" }}>{label}</p>
              <input className={`${inp} mb-2`} value={uc.plans[key].label} onChange={(e) => setUc({ ...uc, plans: { ...uc.plans, [key]: { ...uc.plans[key], label: e.target.value } } })} placeholder="Tên gói hiển thị" />
              <textarea className={`${inp} min-h-[120px] text-[13px]`} value={uc.plans[key].features.join("\n")}
                onChange={(e) => setUc({ ...uc, plans: { ...uc.plans, [key]: { ...uc.plans[key], features: e.target.value.split("\n") } } })}
                placeholder="Mỗi dòng là một điểm nổi bật" />
              <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>Mỗi dòng = 1 gạch đầu dòng.</p>
              <textarea className={`${inp} mt-2 min-h-[60px] text-[13px]`} value={uc.plans[key].promo ?? ""}
                onChange={(e) => setUc({ ...uc, plans: { ...uc.plans, [key]: { ...uc.plans[key], promo: e.target.value } } })}
                placeholder="Banner khuyến mãi (tùy chọn) — để trống nếu không hiện" />
              <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>Dòng nổi bật màu vàng dưới danh sách tính năng. Để trống để ẩn.</p>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison table */}
      <div>
        <p className="mb-1 text-sm font-medium">Bảng so sánh tính năng</p>
        <p className="mb-3 text-[11px]" style={{ color: "var(--text3)" }}>Mỗi ô: gõ <b>✓</b> (có), <b>✗</b> hoặc để trống (không), hoặc nội dung tùy ý (vd “5 / tháng”, “∞”, “Sắp ra mắt”).</p>
        <div className="space-y-2">
          {uc.compare.map((row, i) => (
            <div key={i} className="rounded-lg p-2.5" style={{ border: "1px solid var(--border)", background: isSection(row) ? "color-mix(in srgb,var(--gold) 7%,transparent)" : "transparent" }}>
              <div className="mb-1.5 flex items-center gap-1">
                <button onClick={() => moveRow(i, -1)} className="btn-ghost px-1.5 py-1" title="Lên"><ArrowUp size={13} /></button>
                <button onClick={() => moveRow(i, 1)} className="btn-ghost px-1.5 py-1" title="Xuống"><ArrowDown size={13} /></button>
                <span className="ml-1 text-[11px]" style={{ color: "var(--text3)" }}>{isSection(row) ? "Tiêu đề nhóm" : "Dòng tính năng"}</span>
                <button onClick={() => removeRow(i)} className="btn-ghost ml-auto px-1.5 py-1 text-red-500" title="Xóa"><Trash2 size={13} /></button>
              </div>
              {isSection(row) ? (
                <input className={`${inp} font-medium`} value={row.section} onChange={(e) => editRow(i, { section: e.target.value })} placeholder="Tên nhóm (vd: Album & ảnh)" />
              ) : (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1.6fr_repeat(5,1fr)]">
                  <input className={inp} value={row.label} onChange={(e) => editRow(i, { label: e.target.value })} placeholder="Tên tính năng" />
                  <input className={cellInp} value={row.free} onChange={(e) => editRow(i, { free: e.target.value })} placeholder="Free" />
                  <input className={cellInp} value={row.basic} onChange={(e) => editRow(i, { basic: e.target.value })} placeholder="Basic" />
                  <input className={cellInp} value={row.photographer} onChange={(e) => editRow(i, { photographer: e.target.value })} placeholder="Photog." />
                  <input className={cellInp} value={row.photographer_plus} onChange={(e) => editRow(i, { photographer_plus: e.target.value })} placeholder="Photog. Plus" />
                  <input className={cellInp} value={row.studio} onChange={(e) => editRow(i, { studio: e.target.value })} placeholder="Studio" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={() => setRows([...uc.compare, { label: "", free: "✗", basic: "✗", photographer: "✗", photographer_plus: "✗", studio: "✗" }])} className="btn-ghost text-xs"><Plus size={13} /> Thêm dòng</button>
          <button onClick={() => setRows([...uc.compare, { section: "" }])} className="btn-ghost text-xs"><Heading size={13} /> Thêm tiêu đề nhóm</button>
        </div>
      </div>

      {/* Coming soon */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text2)" }}>Sắp ra mắt (mỗi dòng một mục)</span>
        <textarea className={`${inp} min-h-[100px] text-[13px]`} value={uc.comingSoon.join("\n")} onChange={(e) => setUc({ ...uc, comingSoon: e.target.value.split("\n") })} />
      </label>

      <button onClick={save} disabled={saving} className="btn-primary gap-2"><Save size={14} /> {saving ? "Đang lưu…" : "Lưu nội dung trang nâng cấp"}</button>
    </div>
  );
}
