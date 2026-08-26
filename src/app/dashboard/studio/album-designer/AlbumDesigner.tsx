"use client";

import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/date";
import { Check, ArrowRight, Plus, Trash2, Loader2, Clock, BookImage } from "lucide-react";
import AlbumEditor, { type ADSize, type ADTpl, type SavedDesign } from "./AlbumEditor";

/**
 * Thiết kế Album — trình thiết kế album cưới.
 *   Trang chính: album đã lưu (mở lại) + "Tạo mới".
 *   Tạo mới: Chọn khổ → Chọn mẫu → Editor (kéo-thả, AI rải ảnh, xuất PDF in).
 * Album được LƯU trên server nên có thể làm dở rồi quay lại.
 */

type Size = { id: string; name: string; dim: string; w: number; h: number; tag: string };
const SIZES: Size[] = [
  { id: "sq30", name: "Vuông 30×30", dim: "30 × 30 cm", w: 30, h: 30, tag: "Bán chạy nhất" },
  { id: "sq25", name: "Vuông 25×25", dim: "25 × 25 cm", w: 25, h: 25, tag: "Gọn nhẹ" },
  { id: "ls32", name: "Ngang 30×20", dim: "30 × 20 cm", w: 30, h: 20, tag: "Kể chuyện" },
  { id: "ls43", name: "Ngang 40×30", dim: "40 × 30 cm", w: 40, h: 30, tag: "Khổ lớn" },
  { id: "pt23", name: "Dọc 20×30", dim: "20 × 30 cm", w: 20, h: 30, tag: "Chân dung" },
  { id: "a4l", name: "A4 Ngang", dim: "29.7 × 21 cm", w: 29.7, h: 21, tag: "Tiêu chuẩn" },
  { id: "a4p", name: "A4 Dọc", dim: "21 × 29.7 cm", w: 21, h: 29.7, tag: "Tiêu chuẩn" },
  { id: "sq20", name: "Vuông 20×20", dim: "20 × 20 cm", w: 20, h: 20, tag: "Mini" },
];

type Tpl = { id: string; name: string; cat: string; page: string; ink: string; font: string; sample: string; upper?: boolean };
const CM = "var(--font-cormorant), serif";
const SC = "var(--font-script), cursive";
const TEMPLATES: Tpl[] = [
  { id: "blanc", name: "Blanc", cat: "Hiện đại", page: "#ffffff", ink: "#17181a", font: CM, sample: "Blanc" },
  { id: "grid", name: "Grid Studio", cat: "Hiện đại", page: "#f5f4f1", ink: "#1b1b1b", font: "var(--font-manrope), sans-serif", sample: "STUDIO", upper: true },
  { id: "vogue", name: "Éditorial", cat: "Editorial", page: "#fbfaf8", ink: "#111111", font: CM, sample: "Vol. 01" },
  { id: "kinfolk", name: "Kinfolk", cat: "Editorial", page: "#f2f0ea", ink: "#2a2723", font: CM, sample: "Moments" },
  { id: "amour", name: "Amour", cat: "Lãng mạn", page: "#fbf5ef", ink: "#4a3b34", font: SC, sample: "Amour" },
  { id: "bloom", name: "Bloom", cat: "Lãng mạn", page: "#fcf6f3", ink: "#5b4a45", font: CM, sample: "In Bloom" },
  { id: "noir", name: "Noir", cat: "Sang trọng", page: "#1a1a1c", ink: "#ece7dd", font: CM, sample: "NOIR", upper: true },
  { id: "velvet", name: "Velvet", cat: "Sang trọng", page: "#241d24", ink: "#efe6ea", font: CM, sample: "Velvet" },
  { id: "lumen", name: "Lumen", cat: "Hiện đại", page: "#f7f7f5", ink: "#1c1c1e", font: "var(--font-manrope), sans-serif", sample: "Lumen" },
  { id: "korea", name: "Hàn Quốc", cat: "Hiện đại", page: "#f4f2ee", ink: "#2b2a28", font: "var(--font-manrope), sans-serif", sample: "Seoul" },
  { id: "ivory", name: "Ivory", cat: "Editorial", page: "#faf7f1", ink: "#26221c", font: CM, sample: "Ivory" },
  { id: "film", name: "Film", cat: "Lãng mạn", page: "#efe7db", ink: "#4b3f31", font: CM, sample: "Kodak" },
  { id: "sage", name: "Sage", cat: "Lãng mạn", page: "#eef1ea", ink: "#38402f", font: CM, sample: "Sage" },
  { id: "onyx", name: "Onyx", cat: "Sang trọng", page: "#101012", ink: "#e8e6e2", font: CM, sample: "ONYX", upper: true },
  { id: "mocha", name: "Mocha", cat: "Sang trọng", page: "#efe7df", ink: "#4a3b30", font: CM, sample: "Mocha" },
];
const CATS = ["Tất cả", "Hiện đại", "Editorial", "Lãng mạn", "Sang trọng"];

type SavedRow = { id: string; name: string; size: ADSize; tpl: ADTpl; updated_at: string };
type Step = "home" | "size" | "template" | "editor";

export default function AlbumDesigner() {
  const [step, setStep] = useState<Step>("home");
  const [customW, setCustomW] = useState("30");
  const [customH, setCustomH] = useState("30");
  const [cat, setCat] = useState("Tất cả");
  // Trạng thái mở editor.
  const [edSize, setEdSize] = useState<ADSize | null>(null);
  const [edTpl, setEdTpl] = useState<ADTpl | null>(null);
  const [initial, setInitial] = useState<SavedDesign | null>(null);
  // Album đã lưu.
  const [saved, setSaved] = useState<SavedRow[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  async function loadSaved() {
    setLoadingSaved(true);
    try {
      const res = await fetch("/api/album-designer/designs");
      const d = await res.json();
      setSaved(d.designs || []);
    } catch { /* bỏ qua */ } finally { setLoadingSaved(false); }
  }
  useEffect(() => { if (step === "home") loadSaved(); }, [step]);

  async function openSaved(id: string) {
    setOpening(id);
    try {
      const res = await fetch(`/api/album-designer/designs?id=${id}`);
      const d = await res.json();
      if (!res.ok || !d.design) return;
      const dg = d.design as { id: string; name: string; size: ADSize; tpl: ADTpl; spreads: unknown[]; folder?: string };
      setEdSize(dg.size); setEdTpl(dg.tpl);
      setInitial({ id: dg.id, name: dg.name, folder: dg.folder, spreads: dg.spreads as SavedDesign["spreads"] });
      setStep("editor");
    } finally { setOpening(null); }
  }

  async function del(id: string) {
    setSaved((p) => p.filter((s) => s.id !== id));
    await fetch(`/api/album-designer/designs?id=${id}`, { method: "DELETE" }).catch(() => {});
  }

  function startNew() { setInitial(null); setEdSize(null); setEdTpl(null); setStep("size"); }
  function chooseSize(s: Size) { setEdSize({ name: s.name, w: s.w, h: s.h }); setStep("template"); }
  function chooseTpl(t: Tpl) { setEdTpl({ id: t.id, name: t.name, page: t.page, ink: t.ink, font: t.font }); setStep("editor"); }

  const eyebrow = "text-[11px] font-bold uppercase tracking-[0.05em]";
  const h2 = "text-[26px] font-extrabold tracking-tight sm:text-[28px]";
  const card = "rounded-2xl p-4 transition-all";
  const cardStyle: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "0 1px 2px rgba(20,24,33,.05), 0 8px 24px rgba(20,24,33,.05)" };

  // ── Editor ────────────────────────────────────────────────────────────────
  if (step === "editor" && edSize && edTpl) {
    return <AlbumEditor size={edSize} tpl={edTpl} initial={initial} onBack={() => setStep("home")} />;
  }

  return (
    <div className="page-in pb-16">
      {/* ── TRANG CHÍNH — album đã lưu ── */}
      {step === "home" && (
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className={eyebrow} style={{ color: "var(--brand)" }}>Thiết kế Album</span>
              <h1 className={`${h2} mt-1`}>Album của bạn</h1>
              <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>Mở album đang làm dở, hoặc tạo album mới để in.</p>
            </div>
            <button onClick={startNew} className="btn-primary gap-1.5"><Plus size={16} /> Tạo album mới</button>
          </div>

          {loadingSaved ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: "var(--brand)" }} /></div>
          ) : saved.length === 0 ? (
            <button onClick={startNew} className={`${card} flex w-full flex-col items-center py-16 text-center`} style={{ ...cardStyle, borderStyle: "dashed" }}>
              <BookImage size={30} style={{ color: "var(--brand)" }} />
              <p className="mt-3 font-semibold">Chưa có album nào</p>
              <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>Nhấn để tạo album đầu tiên — chọn khổ, rồi AI tự rải ảnh & dàn trang.</p>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {saved.map((s) => {
                const ar = s.size?.w && s.size?.h ? (s.size.w / s.size.h) : 1;
                return (
                  <div key={s.id} className={`${card} text-left`} style={cardStyle}>
                    <button onClick={() => openSaved(s.id)} disabled={!!opening} className="block w-full">
                      <div className="flex h-[110px] items-center justify-center rounded-xl" style={{ background: s.tpl?.page || "var(--surface2)" }}>
                        {opening === s.id ? <Loader2 className="animate-spin" /> : <div style={{ width: ar >= 1 ? 84 : 84 * ar, height: ar >= 1 ? 84 / ar : 84, border: `2px solid ${s.tpl?.ink || "var(--brand)"}`, opacity: 0.5, borderRadius: 4 }} />}
                      </div>
                      <p className="mt-2 truncate text-[14px] font-bold">{s.name}</p>
                      <p className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text3)" }}><Clock size={11} /> {fmtDate(s.updated_at)} · {s.size?.name}</p>
                    </button>
                    <button onClick={() => del(s.id)} className="mt-2 flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#cc4b4b" }}><Trash2 size={12} /> Xoá</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step bar (chỉ khi tạo mới) */}
      {(step === "size" || step === "template") && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {([["size", "Khổ giấy"], ["template", "Bộ mẫu"]] as const).map(([k, l], i) => {
            const active = step === k;
            const done = (k === "size" && step === "template");
            return (
              <button key={k} onClick={() => setStep(k)} className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold" style={{ background: active ? "var(--brandSoft)" : "transparent", color: active ? "var(--brand)" : "var(--text2)" }}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ background: done || active ? "var(--brand)" : "var(--surface2)", color: done || active ? "#fff" : "var(--text3)" }}>{done ? <Check size={13} /> : i + 1}</span>
                {l}
              </button>
            );
          })}
          <button onClick={() => setStep("home")} className="ml-auto text-xs font-semibold" style={{ color: "var(--text3)" }}>← Về album của tôi</button>
        </div>
      )}

      {/* STEP 1 — Chọn khổ */}
      {step === "size" && (
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 text-center">
            <span className={eyebrow} style={{ color: "var(--brand)" }}>Bước 1 / 2</span>
            <h1 className={`${h2} mt-1`}>Chọn khổ album</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>Chọn khổ in cố định trước khi thiết kế.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {SIZES.map((s) => {
              const ar = s.w / s.h, maxPx = 98;
              const pw = ar >= 1 ? maxPx : maxPx * ar, ph = ar >= 1 ? maxPx / ar : maxPx;
              return (
                <button key={s.id} onClick={() => chooseSize(s)} className={`${card} text-left hover:-translate-y-0.5`} style={cardStyle}>
                  <div className="flex h-[120px] items-center justify-center">
                    <div style={{ width: pw, height: ph, border: "2px solid var(--brand)", borderRadius: 6, background: "linear-gradient(135deg, var(--brandSoft), var(--surface2))" }} />
                  </div>
                  <p className="text-[15px] font-extrabold">{s.name}</p>
                  <p className="text-[12.5px]" style={{ color: "var(--text2)" }}>{s.dim}</p>
                  <p className="mt-0.5 text-[11px] font-semibold" style={{ color: "var(--text3)" }}>{s.tag}</p>
                </button>
              );
            })}
          </div>
          <div className={`${card} mt-4 flex flex-wrap items-end gap-3`} style={cardStyle}>
            <div className="flex-1">
              <p className="text-[15px] font-extrabold">Khổ tùy chỉnh</p>
              <p className="text-[12.5px]" style={{ color: "var(--text2)" }}>Nhập kích thước riêng (cm).</p>
            </div>
            <label className="text-xs" style={{ color: "var(--text2)" }}>Rộng<input value={customW} onChange={(e) => setCustomW(e.target.value)} inputMode="decimal" className="input ml-2 w-[74px]" /></label>
            <label className="text-xs" style={{ color: "var(--text2)" }}>Cao<input value={customH} onChange={(e) => setCustomH(e.target.value)} inputMode="decimal" className="input ml-2 w-[74px]" /></label>
            <button onClick={() => { const w = parseFloat(customW) || 30, h = parseFloat(customH) || 30; chooseSize({ id: "custom", name: `Tùy chỉnh ${w}×${h}`, dim: `${w} × ${h} cm`, w, h, tag: "Tùy chỉnh" }); }} className="btn-primary gap-1.5">Tiếp tục <ArrowRight size={15} /></button>
          </div>
        </div>
      )}

      {/* STEP 2 — Chọn mẫu */}
      {step === "template" && (
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 text-center">
            <span className={eyebrow} style={{ color: "var(--brand)" }}>Bước 2 / 2</span>
            <h1 className={`${h2} mt-1`}>Chọn bộ mẫu</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>Phông chữ + màu trang + phong cách dàn trang.</p>
          </div>
          <div className="mb-6 flex flex-wrap justify-center gap-2">
            {CATS.map((c) => (
              <button key={c} onClick={() => setCat(c)} className="rounded-full px-3.5 py-1.5 text-sm font-semibold" style={{ background: cat === c ? "var(--brand)" : "var(--surface)", color: cat === c ? "#fff" : "var(--text2)", border: "1px solid var(--border)" }}>{c}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.filter((t) => cat === "Tất cả" || t.cat === cat).map((t) => (
              <button key={t.id} onClick={() => chooseTpl(t)} className={`${card} text-left hover:-translate-y-[3px]`} style={cardStyle}>
                <div className="flex h-[150px] items-center justify-center gap-[5px] overflow-hidden rounded-[11px] p-3.5" style={{ background: t.page }}>
                  <span style={{ fontFamily: t.font, color: t.ink, fontSize: 26, textTransform: t.upper ? "uppercase" : "none", letterSpacing: t.upper ? ".08em" : undefined }}>{t.sample}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="text-[15px] font-extrabold">{t.name}</p>
                    <p className="text-[12px]" style={{ color: "var(--text2)" }}>{t.cat}</p>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: "var(--brand)", background: "var(--brandSoft)" }}>Dùng mẫu</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
