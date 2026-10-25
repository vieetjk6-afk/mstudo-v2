"use client";

import { useEffect, useState } from "react";
import type { ADSize, ADTpl, SavedDesign } from "./designer-core";
import type { SavedRow, Size, Step, Tpl } from "./designer-data";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của Thiết kế album — trang chính (album đã lưu) và
   luồng tạo mới (khổ → mẫu → trình dàn trang). Bản cũ AlbumDesigner và bản mới
   AlbumDesignerV2 chỉ khác cách vẽ — mọi lời gọi API nằm ở đây.
   ═══════════════════════════════════════════════════════════════════════════ */

export function useAlbumDesigner() {
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

  return {
    step, setStep, customW, setCustomW, customH, setCustomH, cat, setCat, edSize, edTpl, initial, saved, loadingSaved,
    opening, openSaved, del, startNew, chooseSize, chooseTpl,
  };
}
