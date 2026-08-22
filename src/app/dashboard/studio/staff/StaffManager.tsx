"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Lock, Plus, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { Panel, EmptyState } from "@/components/studio/ui";
import { useToast } from "@/components/studio/Toast";
import { avatarStyle, initials } from "@/lib/avatar";
import { STUDIO_ROLES, roleLabel } from "@/lib/studio-roles";

export type StaffRow = {
  id: string;
  email: string;
  full_name: string | null;
  studio_role: string | null;
  /** Cơ sở nhân viên làm việc. null = làm chung toàn studio. */
  studio_branch_id: string | null;
  is_active: boolean;
  created_at: string;
};

export default function StaffManager({
  initial,
  branches = [],
  canManageRoles,
  canAssignBranch,
  lockedBranchName,
}: {
  initial: StaffRow[];
  /** Chi nhánh còn hoạt động. Rỗng → không hiện gì về chi nhánh. */
  branches?: { id: string; name: string }[];
  /** Được tạo/xoá tài khoản và ĐỔI VAI TRÒ — chỉ chủ studio. */
  canManageRoles: boolean;
  /** Được gán nhân sự vào chi nhánh — chủ studio và quản lý toàn studio. */
  canAssignBranch: boolean;
  /** Có giá trị khi CHÍNH người đang xem bị ghim vào một chi nhánh. */
  lockedBranchName: string | null;
}) {
  const router = useRouter();
  const { toast, toastNode } = useToast();
  const [list, setList] = useState<StaffRow[]>(initial);
  const [f, setF] = useState({ full_name: "", email: "", password: "", role: "staff", branch_id: "" });
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

  async function add() {
    setErr(null);
    if (!f.email.trim() || f.password.length < 6) {
      setErr("Cần email hợp lệ và mật khẩu ≥ 6 ký tự.");
      return;
    }
    // "Toàn quyền chi nhánh" mà không gán chi nhánh thì họ không thấy gì —
    // chặn ngay lúc tạo thay vì để chủ studio phát hiện qua lời phàn nàn.
    if (f.role === "branch_manager" && !f.branch_id) {
      setErr("Vai trò “Toàn quyền chi nhánh” phải chọn một chi nhánh.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/studio/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    if (res.ok) {
      setF({ full_name: "", email: "", password: "", role: "staff", branch_id: "" });
      router.refresh();
      toast("Đã tạo tài khoản nhân viên.");
      return;
    }
    const j = await res.json().catch(() => ({}));
    setErr(
      j.error === "bad_input" ? "Thông tin chưa hợp lệ (email đúng định dạng, mật khẩu ≥ 6 ký tự)."
      : j.error === "email_taken" ? "Email này đã thuộc một tài khoản trả phí hoặc studio khác. Dùng email khác cho nhân viên."
      : j.error === "link_failed" ? "Tạo được tài khoản nhưng chưa gắn vào studio. Thử lại giúp mình."
      : j.error === "forbidden" ? "Chỉ chủ studio mới tạo được nhân viên."
      : "Không tạo được: " + (j.error || "")
    );
  }

  async function remove(row: StaffRow) {
    if (!confirm(`Xoá tài khoản của ${row.full_name || row.email}?\n\nHọ sẽ không đăng nhập được nữa. Hợp đồng đã giao cho họ vẫn còn.`)) return;
    const res = await fetch(`/api/studio/staff?id=${row.id}`, { method: "DELETE" });
    if (res.ok) { setList((p) => p.filter((s) => s.id !== row.id)); toast("Đã xoá tài khoản."); return; }
    toast("Không xoá được tài khoản này.");
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[13px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
        Tài khoản đăng nhập của studio và vai trò của từng người. Nhân viên đăng nhập bằng
        email/mật khẩu bạn đặt, đổi vai trò được bất cứ lúc nào sau khi tạo.
      </p>

      {lockedBranchName && (
        <p
          className="flex items-center gap-2 rounded-[11px] px-3.5 py-2.5 text-[12.5px]"
          style={{ background: "var(--acS)", color: "var(--tx2)" }}
        >
          <Lock size={15} style={{ flex: "none", color: "var(--ac)" }} />
          <span style={{ textWrap: "pretty" }}>
            Bạn đang ở vai trò <b>Toàn quyền chi nhánh</b> — chỉ thấy nhân sự của <b>{lockedBranchName}</b>.
          </span>
        </p>
      )}

      <div className="grid gap-3.5 lg:grid-cols-3">
        {/* ── Tạo nhân viên ─────────────────────────────────────────────── */}
        {canManageRoles ? (
          <Panel className="h-fit p-[18px]">
            <h2 className="mb-3.5 flex items-center gap-2 text-[14px] font-bold">
              <Plus size={16} style={{ color: "var(--ac)" }} /> Tạo nhân viên
            </h2>
            <div className="space-y-3">
              <div className="field"><label className="label">Họ tên</label><input className="input" value={f.full_name} onChange={(e) => setF((p) => ({ ...p, full_name: e.target.value }))} /></div>
              <div className="field"><label className="label">Email</label><input className="input" value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} /></div>
              <div className="field"><label className="label">Mật khẩu</label><input className="input" type="text" value={f.password} onChange={(e) => setF((p) => ({ ...p, password: e.target.value }))} /></div>
              <div className="field">
                <label className="label">Vai trò</label>
                <select className="input" value={f.role} onChange={(e) => setF((p) => ({ ...p, role: e.target.value }))}>
                  {STUDIO_ROLES.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>
              <p className="text-[11px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
                {STUDIO_ROLES.find((r) => r.key === f.role)?.hint}
              </p>
              {branches.length > 0 && (
                <div className="field">
                  <label className="label">Chi nhánh</label>
                  <select className="input" value={f.branch_id} onChange={(e) => setF((p) => ({ ...p, branch_id: e.target.value }))}>
                    <option value="">{f.role === "branch_manager" ? "— Bắt buộc chọn —" : "Toàn studio (không gán)"}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {err && <p className="text-[12.5px] font-semibold" style={{ color: "var(--rd)" }}>{err}</p>}
              <button
                onClick={add}
                disabled={busy}
                className="flex w-full items-center justify-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-bold"
                style={{ background: "var(--ac)", color: "#fff", opacity: busy ? 0.6 : 1 }}
              >
                <Plus size={16} /> {busy ? "Đang tạo…" : "Tạo tài khoản"}
              </button>
            </div>
          </Panel>
        ) : (
          <Panel className="h-fit p-[18px]">
            <h2 className="mb-2 flex items-center gap-2 text-[14px] font-bold">
              <ShieldCheck size={16} style={{ color: "var(--tx3)" }} /> Chỉ chủ studio
            </h2>
            <p className="text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
              Tạo tài khoản và đổi vai trò là việc của chủ studio. Bạn xem được danh sách để biết ai đang làm gì.
            </p>
          </Panel>
        )}

        {/* ── Danh sách ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          {list.length === 0 ? (
            <Panel>
              <EmptyState
                icon={UserCog}
                title="Chưa có tài khoản nhân viên nào"
                hint={canManageRoles ? "Tạo tài khoản ở khối bên trái để nhân viên đăng nhập được." : "Chủ studio chưa tạo tài khoản nào."}
              />
            </Panel>
          ) : (
            <div className="flex flex-col gap-2">
              {list.map((s) => (
                <Panel key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3.5">
                  <span
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12px] font-bold"
                    style={avatarStyle(s.full_name || s.email)}
                  >
                    {initials(s.full_name || s.email)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">{s.full_name || s.email}</p>
                    <p className="truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{s.email}</p>
                  </div>

                  {/* Vai trò — đổi được sau khi tạo. */}
                  <label className="flex flex-none items-center gap-1.5 text-[11px]" style={{ color: "var(--tx3)" }}>
                    <ShieldCheck size={14} />
                    {canManageRoles ? (
                      <select
                        className="input !py-1.5 !text-[11.5px]"
                        style={{ width: "auto", minWidth: 158 }}
                        value={s.studio_role ?? "staff"}
                        onChange={(e) => setRole(s, e.target.value)}
                        aria-label={`Vai trò của ${s.full_name || s.email}`}
                      >
                        {STUDIO_ROLES.map((r) => (
                          <option key={r.key} value={r.key}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-semibold" style={{ color: "var(--tx2)" }}>{roleLabel(s.studio_role)}</span>
                    )}
                  </label>

                  {/* Chi nhánh — bắt buộc với vai trò Toàn quyền chi nhánh. */}
                  {branches.length > 0 && (
                    <label className="flex flex-none items-center gap-1.5 text-[11px]" style={{ color: "var(--tx3)" }}>
                      <Building2 size={14} />
                      {canAssignBranch ? (
                        <select
                          className="input !py-1.5 !text-[11.5px]"
                          style={{
                            width: "auto",
                            minWidth: 150,
                            // Vai trò bị ghim mà chưa gán chi nhánh là cấu hình
                            // hỏng: họ không thấy dữ liệu nào. Viền đỏ để chủ
                            // studio thấy ngay trong danh sách.
                            borderColor: s.studio_role === "branch_manager" && !s.studio_branch_id ? "var(--rd)" : undefined,
                          }}
                          value={s.studio_branch_id ?? ""}
                          onChange={(e) => setBranch(s, e.target.value)}
                          aria-label={`Chi nhánh của ${s.full_name || s.email}`}
                        >
                          <option value="">{s.studio_role === "branch_manager" ? "⚠ Chưa gán" : "Toàn studio"}</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-semibold" style={{ color: "var(--tx2)" }}>
                          {branches.find((b) => b.id === s.studio_branch_id)?.name ?? "Toàn studio"}
                        </span>
                      )}
                    </label>
                  )}

                  {canManageRoles && (
                    <button
                      onClick={() => remove(s)}
                      aria-label="Xoá tài khoản"
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]"
                      style={{ border: "1px solid var(--bd)", color: "var(--tx3)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>
      {toastNode}
    </div>
  );
}
