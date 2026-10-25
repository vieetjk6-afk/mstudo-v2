"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StudioPackage } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Thẻ buổi (bản cũ PackagesManager và bản mới
   PackagesV2): tạo thẻ, trừ/hoàn buổi, đánh dấu đã thu, xoá.
   ═══════════════════════════════════════════════════════════════════════════ */

export function usePackages(ownerId: string, initial: StudioPackage[]) {
  const supabase = createClient();
  const [list, setList] = useState<StudioPackage[]>(initial);
  const [f, setF] = useState({ client_name: "", client_phone: "", name: "Thẻ buổi", total_sessions: 1, price: 0 });
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!f.client_name.trim()) return false;
    setBusy(true);
    const { data, error } = await supabase
      .from("studio_packages")
      .insert({
        owner_id: ownerId,
        client_name: f.client_name.trim(),
        client_phone: f.client_phone.trim() || null,
        name: f.name.trim() || "Thẻ buổi",
        total_sessions: Math.max(1, Math.round(Number(f.total_sessions) || 1)),
        price: Math.max(0, Math.round(Number(f.price) || 0)),
      })
      .select("*")
      .single();
    setBusy(false);
    if (!error && data) {
      setList((p) => [data as StudioPackage, ...p]);
      setF({ client_name: "", client_phone: "", name: "Thẻ buổi", total_sessions: 1, price: 0 });
      return true;
    }
    return false;
  }

  async function setUsed(p: StudioPackage, delta: number) {
    const next = Math.max(0, Math.min(p.total_sessions, p.used_sessions + delta));
    if (next === p.used_sessions) return;
    await supabase.from("studio_packages").update({ used_sessions: next }).eq("id", p.id);
    setList((l) => l.map((x) => (x.id === p.id ? { ...x, used_sessions: next } : x)));
  }

  async function togglePaid(p: StudioPackage) {
    await supabase.from("studio_packages").update({ paid: !p.paid }).eq("id", p.id);
    setList((l) => l.map((x) => (x.id === p.id ? { ...x, paid: !x.paid } : x)));
  }

  async function remove(id: string) {
    if (!confirm("Xoá thẻ buổi này?")) return;
    await supabase.from("studio_packages").delete().eq("id", id);
    setList((l) => l.filter((x) => x.id !== id));
  }

  return { list, f, setF, busy, add, setUsed, togglePaid, remove };
}
