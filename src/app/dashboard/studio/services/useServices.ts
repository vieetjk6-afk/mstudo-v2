"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fullClauseText } from "@/lib/contract-clauses";
import type { StudioService } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của tab "Điều khoản dịch vụ" (bản cũ ServicesManager
   và bản mới ServicesV2): danh sách dịch vụ, dịch vụ đang mở, thêm/lưu/xoá.
   ═══════════════════════════════════════════════════════════════════════════ */

export function useServices(ownerId: string, initial: StudioService[]) {
  const supabase = createClient();
  const [services, setServices] = useState<StudioService[]>(initial);
  const [selId, setSelId] = useState<string | null>(initial[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sel = services.find((s) => s.id === selId) || null;
  const [name, setName] = useState(sel?.name ?? "");
  const [clauses, setClauses] = useState(sel?.clauses ?? "");
  // Bản đã lưu của dịch vụ đang mở — để bản mới biết có thay đổi chưa lưu.
  const [base, setBase] = useState({ name: sel?.name ?? "", clauses: sel?.clauses ?? "" });
  const dirty = !!sel && (name !== base.name || clauses !== base.clauses);

  function toast(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2000);
  }

  function select(s: StudioService) {
    setSelId(s.id);
    setName(s.name);
    setClauses(s.clauses);
    setBase({ name: s.name, clauses: s.clauses });
  }

  /** Bỏ thay đổi chưa lưu của dịch vụ đang mở. */
  function reset() {
    setName(base.name);
    setClauses(base.clauses);
  }

  async function createService() {
    setBusy(true);
    const { data, error } = await supabase
      .from("studio_services")
      .insert({ owner_id: ownerId, name: "Dịch vụ mới", clauses: fullClauseText(), position: services.length })
      .select("*")
      .single();
    setBusy(false);
    if (!error && data) {
      const s = data as StudioService;
      setServices((p) => [...p, s]);
      select(s);
      toast("Đã tạo dịch vụ.");
    } else {
      toast(error?.message.includes("studio_services") ? "Chưa chạy migration studio_services." : (error?.message || "Lỗi"));
    }
  }

  async function saveService() {
    if (!sel) return;
    setBusy(true);
    const patch = { name: name.trim() || "Dịch vụ", clauses };
    await supabase.from("studio_services").update(patch).eq("id", sel.id);
    setServices((p) => p.map((s) => (s.id === sel.id ? { ...s, ...patch } : s)));
    setBase({ name, clauses });
    setBusy(false);
    toast("Đã lưu.");
  }

  async function deleteService(s: StudioService) {
    if (!confirm(`Xoá dịch vụ "${s.name}"? Các hợp đồng/báo giá đã tạo không bị ảnh hưởng.`)) return;
    await supabase.from("studio_services").delete().eq("id", s.id);
    const next = services.filter((x) => x.id !== s.id);
    setServices(next);
    if (selId === s.id) {
      const first = next[0] ?? null;
      setSelId(first?.id ?? null);
      setName(first?.name ?? "");
      setClauses(first?.clauses ?? "");
      setBase({ name: first?.name ?? "", clauses: first?.clauses ?? "" });
    }
  }

  return { services, selId, sel, busy, msg, name, setName, clauses, setClauses, dirty, reset, select, createService, saveService, deleteService };
}

export type ServicesState = ReturnType<typeof useServices>;
