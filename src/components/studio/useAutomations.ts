"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AUTOMATION_RULES, clampDays, effectiveConfig, type AutomationConfig } from "@/lib/automations";

/* Trạng thái + thao tác của thẻ "Việc tự động" — dùng chung cho bản cũ
   (AutomationsCard) và bản giao diện mới (AutomationsCardV2). Xem ghi chú đầu
   AutomationsCard.tsx. */

export type AutomationRow = { enabled: boolean; days: number; message: string };

export function useAutomations(ownerId: string, initial: Record<string, AutomationConfig | undefined>) {
  const supabase = createClient();
  const [rows, setRows] = useState<Record<string, AutomationRow>>(() =>
    Object.fromEntries(AUTOMATION_RULES.map((r) => [r.key, effectiveConfig(r, initial[r.key])]))
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (key: string, patch: Partial<AutomationRow>) =>
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  async function save() {
    setSaving(true);
    setErr(null);
    // upsert theo (owner_id, rule) — khoá unique của bảng. Ghi CẢ TÁM dòng một
    // lượt: studio bấm Lưu là chốt trọn bộ, không phải lưu từng luật.
    const payload = AUTOMATION_RULES.map((r) => ({
      owner_id: ownerId,
      rule: r.key,
      enabled: rows[r.key].enabled,
      offset_days: r.days === null ? null : clampDays(rows[r.key].days),
      // Câu chữ trùng y hệt mặc định thì lưu null, để lần sau sửa câu mặc định
      // trong code là studio được hưởng bản mới — chứ không bị đóng đinh bản cũ.
      message: rows[r.key].message.trim() === r.message.trim() ? null : rows[r.key].message.trim() || null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("studio_automations").upsert(payload, { onConflict: "owner_id,rule" });
    setSaving(false);
    if (error) {
      // Chưa chạy migration automations.sql thì bảng chưa tồn tại — nói rõ, đừng
      // để studio bấm Lưu mãi mà không hiểu vì sao không đổi gì.
      const missing = error.code === "42P01" || error.code === "PGRST205";
      return setErr(
        missing
          ? "Cần chạy supabase/migrations/automations.sql trước khi bật việc tự động."
          : error.message
      );
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  const onCount = AUTOMATION_RULES.filter((r) => rows[r.key].enabled).length;

  return { rows, set, openKey, setOpenKey, saving, saved, err, save, onCount };
}
