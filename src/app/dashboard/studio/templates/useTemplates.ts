"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { contractTotal, type ShootType } from "@/lib/types";
import type { TemplateWithItems } from "./TemplatesManager";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của tab "Mẫu hợp đồng" (bản cũ TemplatesManager và bản
   mới TemplatesV2): danh sách mẫu, mẫu đang mở, hạng mục, thêm/lưu/xoá.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ItemRow = { name: string; qty: number; unit_price: number };

export function useTemplates(ownerId: string, initial: TemplateWithItems[]) {
  const supabase = createClient();
  const [templates, setTemplates] = useState<TemplateWithItems[]>(initial);
  const [selId, setSelId] = useState<string | null>(initial[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sel = templates.find((t) => t.id === selId) || null;

  // local edit state derived from selection
  const [name, setName] = useState(sel?.name ?? "");
  const [shootType, setShootType] = useState<ShootType>(sel?.shoot_type ?? "photo");
  const [note, setNote] = useState(sel?.note ?? "");
  const [items, setItems] = useState<ItemRow[]>(
    (sel?.contract_template_items ?? []).map((i) => ({ name: i.name, qty: i.qty, unit_price: i.unit_price }))
  );
  // Bản đã lưu của mẫu đang mở — để bản mới biết có thay đổi chưa lưu.
  const [base, setBase] = useState(() => JSON.stringify([name, shootType, note, items]));
  const dirty = !!sel && JSON.stringify([name, shootType, note, items]) !== base;

  function toast(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2000);
  }

  function selectTemplate(t: TemplateWithItems) {
    const nextItems = (t.contract_template_items ?? []).sort((a, b) => a.position - b.position).map((i) => ({ name: i.name, qty: i.qty, unit_price: i.unit_price }));
    setSelId(t.id);
    setName(t.name);
    setShootType(t.shoot_type);
    setNote(t.note ?? "");
    setItems(nextItems);
    setBase(JSON.stringify([t.name, t.shoot_type, t.note ?? "", nextItems]));
  }

  /** Bỏ thay đổi chưa lưu của mẫu đang mở. */
  function reset() {
    const [n, st, no, it] = JSON.parse(base) as [string, ShootType, string, ItemRow[]];
    setName(n);
    setShootType(st);
    setNote(no);
    setItems(it);
  }

  async function createTemplate() {
    setBusy(true);
    const { data, error } = await supabase
      .from("contract_templates")
      .insert({ owner_id: ownerId, name: "Mẫu mới", shoot_type: "photo" })
      .select("*, contract_template_items(*)")
      .single();
    setBusy(false);
    if (!error && data) {
      const t = data as unknown as TemplateWithItems;
      setTemplates((p) => [t, ...p]);
      selectTemplate(t);
    }
  }

  async function saveTemplate() {
    if (!sel) return;
    setBusy(true);
    await supabase
      .from("contract_templates")
      .update({ name: name.trim() || "Mẫu", shoot_type: shootType, note: note.trim() || null })
      .eq("id", sel.id);
    const clean = items
      .map((i) => ({ name: i.name.trim(), qty: Math.max(0, Math.round(Number(i.qty) || 0)), unit_price: Math.max(0, Math.round(Number(i.unit_price) || 0)) }))
      .filter((i) => i.name);
    await supabase.from("contract_template_items").delete().eq("template_id", sel.id);
    if (clean.length) {
      await supabase.from("contract_template_items").insert(clean.map((i, idx) => ({ ...i, template_id: sel.id, position: idx })));
    }
    // refresh local list
    const { data } = await supabase
      .from("contract_templates")
      .select("*, contract_template_items(*)")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    setTemplates((data ?? []) as unknown as TemplateWithItems[]);
    setBase(JSON.stringify([name, shootType, note, items]));
    setBusy(false);
    toast("Đã lưu mẫu.");
  }

  async function deleteTemplate() {
    if (!sel || !confirm("Xoá mẫu này?")) return;
    await supabase.from("contract_templates").delete().eq("id", sel.id);
    const rest = templates.filter((t) => t.id !== sel.id);
    setTemplates(rest);
    if (rest[0]) selectTemplate(rest[0]);
    else {
      setSelId(null);
      setName("");
      setNote("");
      setItems([]);
    }
  }

  const total = contractTotal(items);

  return {
    templates, selId, sel, busy, msg, name, setName, shootType, setShootType, note, setNote, items, setItems, total, dirty, reset,
    selectTemplate, createTemplate, saveTemplate, deleteTemplate,
  };
}

export type TemplatesState = ReturnType<typeof useTemplates>;
