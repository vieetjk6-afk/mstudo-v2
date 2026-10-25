"use client";

import { useState } from "react";
import type { VoucherProgram } from "@/lib/voucher-program";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của "Chương trình voucher ưu đãi" (bản cũ
   VoucherProgramCard và bản mới trong VouchersV2): bản nháp, có thay đổi chưa
   lưu, lưu qua /api/studio/vouchers (action program_save).
   ═══════════════════════════════════════════════════════════════════════════ */

export function useVoucherProgram(initial: VoucherProgram, toast: (m: string) => void) {
  const [p, setP] = useState<VoucherProgram>(initial);
  const [saved, setSaved] = useState<VoucherProgram>(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);

  async function save(next: VoucherProgram) {
    setBusy(true);
    try {
      const res = await fetch("/api/studio/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "program_save", ...next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(j.error === "missing_migration" ? "Cần chạy supabase/voucher-uu-dai.sql trong Supabase trước." : res.status === 403 ? "Bạn không có quyền đổi chương trình." : `Lỗi: ${j.error || res.status}`);
        return;
      }
      setP(next);
      setSaved(next);
      toast(next.enabled ? "Đã lưu — chương trình voucher đang BẬT." : "Đã lưu — chương trình voucher đang tắt.");
    } catch {
      toast("Lỗi mạng, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  return { p, setP, saved, busy, dirty, save };
}
