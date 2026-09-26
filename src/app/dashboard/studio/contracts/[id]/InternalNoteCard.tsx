"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isMissingColumn } from "@/lib/missing-column";

/* ═══════════════════════════════════════════════════════════════════════════
   GHI CHÚ NỘI BỘ của hợp đồng (cột studio_contracts.internal_note).

   Chỗ ghi những điều chỉ người trong studio nên biết — khác mục Brief (khách
   xem và sửa được ở cổng). Tự lưu sau khi ngừng gõ, như các ô khác ở tab
   Thông tin.

   Database chưa chạy migration contract_internal_note.sql thì nói thẳng ra
   thay vì để ô nhập "lưu" vào hư không.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function InternalNoteCard({ contractId, initial }: { contractId: string; initial: string | null | undefined }) {
  const [value, setValue] = useState(initial ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "missing" | "error">("idle");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setState("saving");
      const { error } = await createClient()
        .from("studio_contracts")
        .update({ internal_note: value.trim() || null })
        .eq("id", contractId);
      if (!error) setState("saved");
      else setState(isMissingColumn(error, "internal_note") ? "missing" : "error");
    }, 700);
    return () => clearTimeout(t);
  }, [value, contractId]);

  return (
    <div className="card p-6">
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-medium">
        <Lock size={16} style={{ color: "var(--text3)" }} /> Ghi chú nội bộ
      </h2>
      <p className="mb-3 text-xs" style={{ color: "var(--text3)" }}>
        Chỉ người trong studio thấy — khách không đọc được ở cổng hợp đồng.
      </p>
      <textarea
        className="input"
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="VD: khách quen, đã bớt 1tr; cô dâu ngại chụp cận mặt; nhớ mang thêm đèn"
        aria-label="Ghi chú nội bộ"
      />
      <p
        className="mt-1.5 flex items-center gap-1 text-xs"
        style={{ color: state === "saved" ? "var(--s-green)" : state === "missing" || state === "error" ? "var(--s-red)" : "var(--text3)" }}
      >
        {state === "saving"
          ? "Đang lưu…"
          : state === "saved"
            ? <><Check size={13} /> Đã lưu</>
            : state === "missing"
              ? "Chưa lưu được: database chưa có cột ghi chú nội bộ — chủ studio chạy supabase/cap-nhat.sql (hoặc migrations/contract_internal_note.sql)."
              : state === "error"
                ? "Không lưu được — thử lại sau."
                : "Tự động lưu khi nhập"}
      </p>
    </div>
  );
}
