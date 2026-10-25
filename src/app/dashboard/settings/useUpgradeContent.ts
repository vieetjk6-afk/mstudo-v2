"use client";

import { useState } from "react";
import { mergeUpgradeContent, type CompareRow, type UpgradeContent } from "@/lib/upgrade-content";
import type { Plan } from "@/lib/plans";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của trình sửa "Nội dung trang nâng cấp" (bản cũ
   UpgradeContentEditor và bản mới UpgradeContentEditorV2): tiêu đề, tên &
   điểm nổi bật từng gói, bảng so sánh (thêm / sửa / xoá / đổi chỗ), lưu.
   ═══════════════════════════════════════════════════════════════════════════ */

export const PLANS: { key: Plan; label: string }[] = [
  { key: "free", label: "Miễn phí" },
  { key: "basic", label: "Basic" },
  { key: "photographer", label: "Photographer" },
  { key: "photographer_plus", label: "Photographer Plus" },
  { key: "studio", label: "Studio" },
];

export const isSection = (r: CompareRow): r is { section: string } => "section" in r;

export function useUpgradeContent(initial: unknown) {
  const [uc, setUc] = useState<UpgradeContent>(() => mergeUpgradeContent(initial));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /** Lưu nội dung trang nâng cấp. Trả true khi lưu được. */
  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upgrade_content: uc }),
    });
    setSaving(false);
    setMsg(res.ok ? "Đã lưu nội dung trang nâng cấp" : "Lỗi khi lưu");
    setTimeout(() => setMsg(null), 2500);
    return res.ok;
  }

  const setRows = (rows: CompareRow[]) => setUc((u) => ({ ...u, compare: rows }));
  const editRow = (i: number, patch: Partial<Extract<CompareRow, { label: string }>> & { section?: string }) =>
    setRows(uc.compare.map((r, j) => (j === i ? ({ ...r, ...patch } as CompareRow) : r)));
  const removeRow = (i: number) => setRows(uc.compare.filter((_, j) => j !== i));
  const moveRow = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= uc.compare.length) return;
    const next = [...uc.compare];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };
  const addFeatureRow = () => setRows([...uc.compare, { label: "", free: "✗", basic: "✗", photographer: "✗", photographer_plus: "✗", studio: "✗" }]);
  const addSectionRow = () => setRows([...uc.compare, { section: "" }]);

  return { uc, setUc, saving, msg, save, setRows, editRow, removeRow, moveRow, addFeatureRow, addSectionRow };
}

export type UpgradeContentState = ReturnType<typeof useUpgradeContent>;
