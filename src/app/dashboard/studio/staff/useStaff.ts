"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/studio/Toast";
import { roleLabel } from "@/lib/studio-roles";
import type { StaffRow } from "./StaffManager";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của tab "Nhân viên & phân quyền" (bản cũ StaffManager
   và bản mới StaffManagerV2): danh sách tài khoản, form tạo, đổi vai trò, đổi
   chi nhánh, xoá. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type StaffForm = { full_name: string; email: string; password: string; role: string; branch_id: string };
export const emptyStaffForm = (): StaffForm => ({ full_name: "", email: "", password: "", role: "staff", branch_id: "" });

export function useStaff(initial: StaffRow[]) {
  const router = useRouter();
  const { toast, toastNode } = useToast();
  const [list, setList] = useState<StaffRow[]>(initial);
  const [f, setF] = useState<StaffForm>(emptyStaffForm);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /**
   * Sửa một dòng nhân viên. LUÔN qua API: vá C1 đã thu hồi quyền UPDATE bảng
   * profiles của client, nên `studio_role` và `studio_branch_id` gọi supabase
   * trực tiếp sẽ IM LẶNG không ghi được gì.
   */
  async function patch(id: string, body: { role?: string; branch_id?: string | null }, revert: () => void) {
    const res = await fetch("/api/studio/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (res.ok) return true;
    revert();
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    toast(
      j.error === "forbidden" ? "Bạn không có quyền sửa nhân viên này."
      : j.error === "bad_role" ? "Vai trò không hợp lệ."
      : "Không lưu được — thử lại."
    );
    return false;
  }

  async function setRole(row: StaffRow, role: string) {
    const prev = row.studio_role;
    setList((p) => p.map((s) => (s.id === row.id ? { ...s, studio_role: role } : s)));
    const ok = await patch(row.id, { role }, () =>
      setList((p) => p.map((s) => (s.id === row.id ? { ...s, studio_role: prev } : s)))
    );
    if (ok) toast(`${row.full_name || row.email} · ${roleLabel(role)}`);
  }

  async function setBranch(row: StaffRow, value: string) {
    const prev = row.studio_branch_id;
    const next = value || null;
    setList((p) => p.map((s) => (s.id === row.id ? { ...s, studio_branch_id: next } : s)));
    await patch(row.id, { branch_id: next }, () =>
      setList((p) => p.map((s) => (s.id === row.id ? { ...s, studio_branch_id: prev } : s)))
    );
  }

  /** Tạo tài khoản. Trả true khi tạo được (bản mới đóng ngăn kéo theo kết quả này). */
  async function add() {
    setErr(null);
    if (!f.email.trim() || f.password.length < 6) {
      setErr("Cần email hợp lệ và mật khẩu ≥ 6 ký tự.");
      return false;
    }
    // "Toàn quyền chi nhánh" mà không gán chi nhánh thì họ không thấy gì —
    // chặn ngay lúc tạo thay vì để chủ studio phát hiện qua lời phàn nàn.
    if (f.role === "branch_manager" && !f.branch_id) {
      setErr("Vai trò “Toàn quyền chi nhánh” phải chọn một chi nhánh.");
      return false;
    }
    setBusy(true);
    const res = await fetch("/api/studio/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    if (res.ok) {
      setF(emptyStaffForm());
      router.refresh();
      toast("Đã tạo tài khoản nhân viên.");
      return true;
    }
    const j = await res.json().catch(() => ({}));
    setErr(
      j.error === "bad_input" ? "Thông tin chưa hợp lệ (email đúng định dạng, mật khẩu ≥ 6 ký tự)."
      : j.error === "email_taken"
        ? j.message || "Email này đã có tài khoản mstudo. Hãy dùng email khác cho nhân viên, hoặc nhờ chủ email đó liên hệ với bạn."
      : j.error === "link_failed" ? "Tạo được tài khoản nhưng chưa gắn vào studio. Thử lại giúp mình."
      : j.error === "forbidden" ? "Chỉ chủ studio mới tạo được nhân viên."
      : "Không tạo được: " + (j.error || "")
    );
    return false;
  }

  async function remove(row: StaffRow) {
    if (!confirm(`Xoá tài khoản của ${row.full_name || row.email}?\n\nHọ sẽ không đăng nhập được nữa. Hợp đồng đã giao cho họ vẫn còn.`)) return;
    const res = await fetch(`/api/studio/staff?id=${row.id}`, { method: "DELETE" });
    if (res.ok) { setList((p) => p.filter((s) => s.id !== row.id)); toast("Đã xoá tài khoản."); return; }
    toast("Không xoá được tài khoản này.");
  }

  return { list, f, setF, busy, err, setErr, setRole, setBranch, add, remove, toast, toastNode };
}

export type StaffState = ReturnType<typeof useStaff>;
