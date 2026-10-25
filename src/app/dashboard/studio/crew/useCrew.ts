"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isMissingColumn } from "@/lib/missing-column";
import { crewPhoneError, normalizeCrewPhone } from "@/lib/crew-phone";
import type { StudioCrew, CrewRole } from "@/lib/types";
import type { CrewRoleRow } from "@/lib/crew-roles";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của sổ thợ (bản cũ CrewManager và bản mới
   CrewManagerV2): danh sách thợ, thống kê lời mời, thêm thợ, nhận/từ chối thợ
   tự đăng ký, đổi vai trò/chi nhánh, sửa hồ sơ (kể cả đổi SĐT), xoá.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Thông tin thợ studio sửa được — đúng bộ trường thợ tự khai ở /crew (xem
 * SELF_FIELDS trong api/crew/profile) cộng ghi chú của studio. Trước đây chỉ
 * thợ sửa được, studio nhìn không thấy cũng không sửa được gì ngoài vai trò và
 * chi nhánh.
 *
 * SĐT không nằm ở đây: nó là danh tính của thợ — thợ đăng nhập /crew và nhận
 * lịch theo số này, phân công / lịch bận rảnh / chấm công cũng lưu theo số này.
 * Đổi số đi qua /api/studio/crew/phone để chuyển cả những dòng đó theo (xoá
 * rồi thêm lại thì mất hết lịch cũ của thợ).
 */
export const PROFILE_FIELDS: { key: keyof StudioCrew & string; label: string; type?: string }[] = [
  { key: "name", label: "Họ tên" },
  { key: "email", label: "Email", type: "email" },
  { key: "address", label: "Địa chỉ" },
  { key: "bank_name", label: "Tên ngân hàng" },
  { key: "bank_account", label: "Số tài khoản" },
  { key: "skills", label: "Kỹ năng (chụp, quay, dựng…)" },
  { key: "equipment", label: "Thiết bị (body, lens, gimbal…)" },
  { key: "note", label: "Ghi chú" },
];

export type CrewStat = { total: number; accepted: number; declined: number };

export function useCrew({
  ownerId,
  initial,
  stats,
  crewRoles = [],
}: {
  ownerId: string;
  initial: StudioCrew[];
  stats: Record<string, CrewStat>;
  crewRoles?: CrewRoleRow[];
}) {
  const supabase = createClient();
  // Giữ trong state: đổi SĐT thì thống kê lời mời phải đi theo sang số mới.
  const [statMap, setStatMap] = useState(stats);
  const statFor = (phone: string): CrewStat | null => statMap[(phone || "").replace(/\D/g, "")] || null;
  const [list, setList] = useState<StudioCrew[]>(initial);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<CrewRole>("photographer");
  const [note, setNote] = useState("");
  const [branchId, setBranchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [roles, setRoles] = useState<CrewRoleRow[]>(crewRoles);
  // Thợ tự đăng ký qua link riêng — chờ studio nhận vào sổ.
  const pending = list.filter((c) => c.status === "pending");
  // Thợ đang mở khung sửa thông tin (một thợ một lúc).
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  /** Mở khung sửa của một thợ (luôn mở, nạp lại bản nháp từ dữ liệu thợ). */
  function beginEdit(c: StudioCrew) {
    const d: Record<string, string> = { phone: c.phone ?? "" };
    for (const f of PROFILE_FIELDS) d[f.key] = (c[f.key] as string | null | undefined) ?? "";
    setDraft(d);
    setEditErr(null);
    setEditId(c.id);
  }

  /** Bấm nút sửa ở bản cũ: đang mở đúng thợ đó thì đóng lại. */
  function openEdit(c: StudioCrew) {
    if (editId === c.id) {
      setEditId(null);
      return;
    }
    beginEdit(c);
  }

  /**
   * Studio sửa thông tin thợ. Hồ sơ đi qua RLS thường nên ghi trực tiếp; SĐT thì
   * đổi qua máy chủ trước (xem PROFILE_FIELDS), hỏng là dừng luôn.
   */
  async function saveEdit(c: StudioCrew) {
    const id = c.id;
    const nextPhone = normalizeCrewPhone(draft.phone);
    // So theo số đã chuẩn hoá: số cũ lưu dạng "0912 345 678" thì mở ra bấm lưu
    // không được tính là đổi số.
    const phoneChanged = nextPhone !== normalizeCrewPhone(c.phone);
    if (phoneChanged) {
      const bad = crewPhoneError(nextPhone);
      if (bad) {
        setEditErr(bad);
        return;
      }
      const ok = window.confirm(
        `Đổi SĐT của ${c.name || c.phone} từ ${c.phone} sang ${nextPhone}?\n\n` +
          "Phân công hợp đồng, lịch bận/rảnh và chấm công của thợ ở studio này sẽ chuyển theo số mới. " +
          "Từ giờ thợ đăng nhập /crew bằng số mới."
      );
      if (!ok) return;
    }

    const patch: Record<string, string | null> = {};
    for (const f of PROFILE_FIELDS) patch[f.key] = draft[f.key]?.trim() || null;
    // Cột name NOT NULL: để trống thì giữ tên cũ, đừng xoá mất.
    if (!patch.name) delete patch.name;
    setSavingEdit(true);
    setEditErr(null);

    if (phoneChanged) {
      const res = await fetch("/api/studio/crew/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, phone: nextPhone }),
      }).catch(() => null);
      const out = await res?.json().catch(() => null);
      if (!res?.ok || !out?.crew) {
        setSavingEdit(false);
        setEditErr(out?.error || "Không đổi được số điện thoại. Kiểm tra mạng rồi thử lại.");
        return;
      }
      const oldKey = (c.phone || "").replace(/\D/g, "");
      setStatMap((m) => (m[oldKey] && !m[nextPhone] ? { ...m, [nextPhone]: m[oldKey] } : m));
      setList((p) => p.map((x) => (x.id === id ? { ...x, phone: (out.crew as StudioCrew).phone } : x)));
      if (Array.isArray(out.warnings) && out.warnings.length) window.alert(out.warnings.join("\n"));
    }

    const { data, error } = await supabase.from("studio_crew").update(patch).eq("id", id).select("*").single();
    setSavingEdit(false);
    if (error || !data) {
      setEditErr(
        PROFILE_FIELDS.some((f) => isMissingColumn(error, f.key))
          ? "Database chưa có cột hồ sơ thợ — chạy supabase/migrations/crew_profile_show.sql rồi thử lại."
          : `Không lưu được thông tin thợ: ${error?.message ?? "không rõ lỗi"}`
      );
      return;
    }
    setList((p) => p.map((c) => (c.id === id ? (data as StudioCrew) : c)));
    setEditId(null);
  }

  /** Đổi chi nhánh của một thợ. studio_crew đi qua RLS thường nên ghi trực tiếp. */
  async function setCrewBranch(id: string, value: string) {
    const next = value || null;
    const prev = list.find((c) => c.id === id)?.branch_id ?? null;
    setList((p) => p.map((c) => (c.id === id ? { ...c, branch_id: next } : c)));
    const { error } = await supabase.from("studio_crew").update({ branch_id: next }).eq("id", id);
    if (error) {
      setList((p) => p.map((c) => (c.id === id ? { ...c, branch_id: prev } : c)));
      setErr("Không đổi được chi nhánh của thợ này.");
    }
  }

  /** Đổi vai trò của thợ đã có trong sổ (trước đây chỉ chọn được lúc thêm). */
  async function setCrewRole(id: string, value: string) {
    const prev = list.find((c) => c.id === id)?.role;
    if (!value || value === prev) return;
    setList((p) => p.map((c) => (c.id === id ? { ...c, role: value } : c)));
    const { error } = await supabase.from("studio_crew").update({ role: value }).eq("id", id);
    if (error) {
      setList((p) => p.map((c) => (c.id === id ? { ...c, role: prev ?? c.role } : c)));
      setErr("Không đổi được vai trò của thợ này.");
    }
  }

  /** Thêm thợ vào sổ. Trả true khi thêm được (bản mới đóng ngăn kéo theo kết quả này). */
  async function add() {
    setErr(null);
    if (!phone.trim()) {
      setErr("Cần nhập số điện thoại.");
      return false;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("studio_crew")
      .insert({
        owner_id: ownerId,
        name: name.trim(),
        phone: phone.trim(),
        role,
        note: note.trim() || null,
        branch_id: branchId || null,
      })
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      setErr(error.code === "23505" ? "Số điện thoại này đã có trong sổ thợ." : error.message);
      return false;
    }
    if (data) {
      setList((p) => [...p, data as StudioCrew].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setPhone("");
      setNote("");
      setRole("photographer");
    }
    return true;
  }

  /** Nhận thợ tự đăng ký vào sổ chính thức. */
  async function approve(id: string) {
    await supabase.from("studio_crew").update({ status: "active" }).eq("id", id);
    setList((p) => p.map((c) => (c.id === id ? { ...c, status: "active" } : c)));
  }

  async function remove(id: string) {
    await supabase.from("studio_crew").delete().eq("id", id);
    setList((p) => p.filter((c) => c.id !== id));
  }

  return {
    list, statFor, pending,
    name, setName, phone, setPhone, role, setRole, note, setNote, branchId, setBranchId,
    busy, err, setErr, roles, setRoles,
    editId, setEditId, draft, setDraft, savingEdit, editErr, setEditErr,
    beginEdit, openEdit, saveEdit, setCrewBranch, setCrewRole, add, approve, remove,
  };
}

export type CrewState = ReturnType<typeof useCrew>;
