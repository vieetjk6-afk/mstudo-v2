"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StudioEquipment } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Thiết bị (bản cũ EquipmentManager và bản mới
   EquipmentV2): sổ thiết bị, thêm, xoá. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type EquipmentForm = { name: string; category: string; note: string };
export const emptyEquipmentForm = (): EquipmentForm => ({ name: "", category: "", note: "" });

export function useEquipment(ownerId: string, initial: StudioEquipment[]) {
  const supabase = createClient();
  const [list, setList] = useState<StudioEquipment[]>(initial);

  /** Thêm một thiết bị. Trả về true nếu đã lưu (để bản vẽ dọn biểu mẫu). */
  async function add(f: EquipmentForm): Promise<boolean> {
    const { data, error } = await supabase
      .from("studio_equipment")
      .insert({ owner_id: ownerId, name: f.name.trim(), category: f.category.trim() || null, note: f.note.trim() || null })
      .select("*")
      .single();
    if (!error && data) {
      setList((p) => [...p, data as StudioEquipment].sort((a, b) => a.name.localeCompare(b.name)));
      return true;
    }
    return false;
  }

  async function remove(id: string) {
    await supabase.from("studio_equipment").delete().eq("id", id);
    setList((p) => p.filter((e) => e.id !== id));
  }

  return { list, add, remove };
}
