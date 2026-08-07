"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, UserCog } from "lucide-react";

export type StaffRow = {
  id: string;
  email: string;
  full_name: string | null;
  studio_role: string | null;
  is_active: boolean;
  created_at: string;
};

const ROLE_LABEL: Record<string, string> = {
  manager: "Quản lý",
  staff: "Nhân viên",
  accountant: "Kế toán",
};

export default function StaffManager({ initial }: { initial: StaffRow[] }) {
  const router = useRouter();
  const [list, setList] = useState<StaffRow[]>(initial);
  const [f, setF] = useState({ full_name: "", email: "", password: "", role: "staff" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setErr(null);
    if (!f.email.trim() || f.password.length < 6) {
      setErr("Cần email hợp lệ và mật khẩu ≥ 6 ký tự.");
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
      setF({ full_name: "", email: "", password: "", role: "staff" });
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      const msg =
        j.error === "bad_input" ? "Thông tin chưa hợp lệ (email đúng định dạng, mật khẩu ≥ 6 ký tự)."
        : j.error === "email_taken" ? "Email này đã thuộc một tài khoản trả phí hoặc studio khác. Dùng email khác cho nhân viên."
        : j.error === "link_failed" ? "Tạo được tài khoản nhưng chưa gắn vào studio. Thử lại giúp mình."
        : j.error === "forbidden" ? "Chỉ chủ studio mới tạo được nhân viên."
        : "Không tạo được: " + (j.error || "");
      setErr(msg);
    }
  }

  async function remove(id: string) {
    if (!confirm("Xoá tài khoản nhân viên này?")) return;
    const res = await fetch(`/api/studio/staff?id=${id}`, { method: "DELETE" });
    if (res.ok) setList((p) => p.filter((s) => s.id !== id));
  }

  return (
    <div className="page-in">
      <div className="mb-4">
        <h1 className="font-serif text-2xl font-medium">Nhân viên</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>
          Tạo tài khoản cho nhân viên. Họ đăng nhập tại studio.mstudo.com bằng email/mật khẩu bạn đặt.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card h-fit p-6">
          <h2 className="mb-4 font-serif text-lg font-medium">Tạo nhân viên</h2>
          <div className="space-y-3">
            <div className="field"><label className="label">Họ tên</label><input className="input" value={f.full_name} onChange={(e) => setF((p) => ({ ...p, full_name: e.target.value }))} /></div>
            <div className="field"><label className="label">Email</label><input className="input" value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} /></div>
            <div className="field"><label className="label">Mật khẩu</label><input className="input" type="text" value={f.password} onChange={(e) => setF((p) => ({ ...p, password: e.target.value }))} /></div>
            <div className="field">
              <label className="label">Vai trò</label>
              <select className="input" value={f.role} onChange={(e) => setF((p) => ({ ...p, role: e.target.value }))}>
                <option value="manager">Quản lý (toàn quyền)</option>
                <option value="staff">Nhân viên (HĐ được giao)</option>
                <option value="accountant">Kế toán (tài chính)</option>
              </select>
            </div>
            {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
            <button onClick={add} disabled={busy} className="btn-primary w-full"><Plus size={15} /> {busy ? "Đang tạo…" : "Tạo tài khoản"}</button>
          </div>
        </div>

        <div className="lg:col-span-2">
          {list.length === 0 ? (
            <div className="card flex items-center justify-center py-16 text-sm" style={{ color: "var(--text3)" }}>Chưa có nhân viên nào.</div>
          ) : (
            <div className="space-y-2">
              {list.map((s) => (
                <div key={s.id} className="card flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <UserCog size={16} style={{ color: "var(--text3)" }} />
                    <div>
                      <p className="font-medium">{s.full_name || s.email}</p>
                      <p className="text-xs" style={{ color: "var(--text3)" }}>{s.email} · {ROLE_LABEL[s.studio_role || "staff"] || s.studio_role}</p>
                    </div>
                  </div>
                  <button onClick={() => remove(s.id)} className="btn-ghost px-2.5 py-1.5 text-xs"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
