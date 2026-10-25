"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/studio/Toast";
import { sortBranches, UNASSIGNED_LABEL, type BranchStats } from "@/lib/branch-rules";
import type { StudioBranch } from "@/lib/types";
import type { BranchStaff } from "./BranchesManager";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Chi nhánh (bản cũ BranchesManager và bản mới
   BranchesV2): danh sách, số liệu theo chi nhánh, thêm/sửa/xoá/tạm ẩn.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Draft = {
  id: string | null;
  name: string;
  code: string;
  address: string;
  phone: string;
  manager_id: string;
  note: string;
  active: boolean;
};

export const emptyDraft = (): Draft => ({ id: null, name: "", code: "", address: "", phone: "", manager_id: "", note: "", active: true });

/** Bản nháp để sửa một chi nhánh đã có. */
export const draftOf = (b: StudioBranch): Draft => ({
  id: b.id, name: b.name, code: b.code ?? "", address: b.address ?? "",
  phone: b.phone ?? "", manager_id: b.manager_id ?? "", note: b.note ?? "", active: b.active,
});

export function useBranches({
  ownerId, initial, stats, staff,
}: {
  ownerId: string;
  initial: StudioBranch[];
  stats: BranchStats[];
  staff: BranchStaff[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const { toast, toastNode } = useToast();
  const [list, setList] = useState<StudioBranch[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const statOf = useMemo(() => {
    const m = new Map<string | null, BranchStats>();
    for (const s of stats) m.set(s.branchId, s);
    return m;
  }, [stats]);

  const unassigned = statOf.get(null);
  // Mẫu số của thanh so sánh doanh thu: cơ sở thu nhiều nhất trong tháng.
  const maxRevenue = Math.max(1, ...stats.map((s) => s.revenue));

  const staffOf = (branchId: string | null) => staff.filter((s) => s.studio_branch_id === branchId);
  const managerName = (id: string | null) => {
    const m = staff.find((s) => s.id === id);
    return m ? m.full_name || m.email : null;
  };

  function errMsg(m?: string | null) {
    if (m?.includes("studio_branches")) return "Chưa chạy migration studio_branches.sql trong Supabase.";
    return m || "Không lưu được.";
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) { toast("Chi nhánh cần có tên."); return; }
    setBusy(true);
    const row = {
      owner_id: ownerId,
      name: draft.name.trim(),
      code: draft.code.trim() || null,
      address: draft.address.trim() || null,
      phone: draft.phone.trim() || null,
      manager_id: draft.manager_id || null,
      note: draft.note.trim() || null,
      active: draft.active,
    };
    if (draft.id) {
      const { data, error } = await supabase.from("studio_branches").update(row).eq("id", draft.id).select("*").single();
      setBusy(false);
      if (error || !data) { toast(errMsg(error?.message)); return; }
      setList((p) => sortBranches(p.map((b) => (b.id === draft.id ? (data as StudioBranch) : b))));
      toast("Đã lưu chi nhánh.");
    } else {
      const { data, error } = await supabase
        .from("studio_branches")
        .insert({ ...row, position: list.length })
        .select("*")
        .single();
      setBusy(false);
      if (error || !data) { toast(errMsg(error?.message)); return; }
      setList((p) => sortBranches([...p, data as StudioBranch]));
      toast(`Đã thêm chi nhánh ${row.name}.`);
    }
    setDraft(null);
    router.refresh(); // nạp lại số liệu theo chi nhánh
  }

  async function remove(b: StudioBranch) {
    const s = statOf.get(b.id);
    const n = (s?.contracts ?? 0) + (s?.staff ?? 0) + (s?.crew ?? 0) + (s?.appointments ?? 0);
    const warn =
      n > 0
        ? `Xoá chi nhánh “${b.name}”?\n\nDữ liệu KHÔNG bị xoá — hợp đồng, lịch, thu chi và nhân sự của chi nhánh này sẽ chuyển về “${UNASSIGNED_LABEL}”. Bạn gán lại sang chi nhánh khác được sau.`
        : `Xoá chi nhánh “${b.name}”?`;
    if (!confirm(warn)) return;
    const { error } = await supabase.from("studio_branches").delete().eq("id", b.id);
    if (error) { toast(errMsg(error.message)); return; }
    setList((p) => p.filter((x) => x.id !== b.id));
    toast("Đã xoá chi nhánh.");
    router.refresh();
  }

  async function toggleActive(b: StudioBranch) {
    const active = !b.active;
    setList((p) => sortBranches(p.map((x) => (x.id === b.id ? { ...x, active } : x))));
    const { error } = await supabase.from("studio_branches").update({ active }).eq("id", b.id);
    if (error) {
      setList((p) => sortBranches(p.map((x) => (x.id === b.id ? { ...x, active: b.active } : x))));
      toast(errMsg(error.message));
      return;
    }
    toast(active ? "Đã mở lại chi nhánh." : "Đã tạm ẩn chi nhánh — dữ liệu cũ giữ nguyên.");
  }

  return { list, draft, setDraft, busy, statOf, unassigned, maxRevenue, staffOf, managerName, save, remove, toggleActive, toastNode };
}

export type BranchesState = ReturnType<typeof useBranches>;
