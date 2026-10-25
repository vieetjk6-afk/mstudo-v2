"use client";

import { useState } from "react";
import type { DiscountCode } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của "Mã giảm giá" (bản cũ DiscountCodes và bản mới
   DiscountCodesV2): form tạo mã (kể cả mã dùng thử), tạo mã ngẫu nhiên, xoá.
   ═══════════════════════════════════════════════════════════════════════════ */

export const BLANK_CODE = { code: "", percent: 10, plan: "", cycle: "", uses: "many" as "1" | "many", expires: "", trial: 0 };
export type CodeForm = typeof BLANK_CODE;

export function useDiscountCodes(initial: DiscountCode[]) {
  const [codes, setCodes] = useState<DiscountCode[]>(initial);
  const [form, setForm] = useState<CodeForm>(BLANK_CODE);
  const [msg, setMsg] = useState<string | null>(null);

  function randomCode() {
    // Bỏ I/O/0/1 — mã hay được đọc qua điện thoại cho studio.
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    setForm((n) => ({ ...n, code: s }));
  }

  /** Điền sẵn mã dùng thử gói Studio 1 ngày (mã ngẫu nhiên). */
  function quickTrial() {
    randomCode();
    setForm((n) => ({ ...n, plan: "studio", trial: 1, percent: 0, uses: "many" }));
  }

  /** Tạo mã từ `form`. Trả true khi tạo được (bản mới đóng ngăn kéo theo kết quả này). */
  async function addCode() {
    const code = form.code.trim().toUpperCase();
    if (!code) return false;
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
      setForm(BLANK_CODE);
      return true;
    }
    setMsg(data?.error?.includes("duplicate") ? "Mã đã tồn tại" : "Lỗi");
    setTimeout(() => setMsg(null), 2500);
    return false;
  }

  async function deleteCode(id: string) {
    setCodes((c) => c.filter((x) => x.id !== id));
    await fetch("/api/admin/discount-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
  }

  return { codes, form, setForm, msg, randomCode, quickTrial, addCode, deleteCode };
}

export type DiscountCodesState = ReturnType<typeof useDiscountCodes>;
