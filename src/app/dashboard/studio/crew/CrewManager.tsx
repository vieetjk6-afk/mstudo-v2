"use client";

import { useState } from "react";
import { Building2, Pencil, Plus, Trash2, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mainUrl } from "@/lib/hosts";
import { fmtDate } from "@/lib/date";
import { isMissingColumn } from "@/lib/missing-column";
import { crewPhoneError, normalizeCrewPhone } from "@/lib/crew-phone";
import { Panel, EmptyState } from "@/components/studio/ui";
import { avatarColor, initials } from "@/lib/avatar";
import { type StudioCrew, type CrewRole } from "@/lib/types";
import { crewRoleLabel, crewRolesFor, type CrewRoleRow } from "@/lib/crew-roles";
import CrewRolesPanel from "./CrewRolesPanel";

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
const PROFILE_FIELDS: { key: keyof StudioCrew & string; label: string; type?: string }[] = [
  { key: "name", label: "Họ tên" },
  { key: "email", label: "Email", type: "email" },
  { key: "address", label: "Địa chỉ" },
  { key: "bank_name", label: "Tên ngân hàng" },
  { key: "bank_account", label: "Số tài khoản" },
  { key: "skills", label: "Kỹ năng (chụp, quay, dựng…)" },
  { key: "equipment", label: "Thiết bị (body, lens, gimbal…)" },
  { key: "note", label: "Ghi chú" },
];

export default function CrewManager({
  ownerId,
  initial,
  stats,
  registerUrl = "",
  registerError = null,
  branches = [],
  crewRoles = [],
  canEditCrewRoles = false,
}: {
  ownerId: string;
  initial: StudioCrew[];
  stats: Record<string, { total: number; accepted: number; declined: number }>;
  /** Link riêng của studio để thợ tự đăng ký vào sổ. */
  registerUrl?: string;
  /** Vì sao chưa cấp được link (thường là DB chưa có cột crew_token). */
  registerError?: string | null;
  /** Chi nhánh còn hoạt động. Rỗng → không hiện gì về chi nhánh. */
  branches?: { id: string; name: string }[];
  /** Vai trò studio tự đặt / đè vai trò có sẵn (studio_crew_roles). */
  crewRoles?: CrewRoleRow[];
  /** Chủ studio / quản lý toàn studio — được sửa danh sách vai trò. */
  canEditCrewRoles?: boolean;
}) {
  const supabase = createClient();
  // Giữ trong state: đổi SĐT thì thống kê lời mời phải đi theo sang số mới.
  const [statMap, setStatMap] = useState(stats);
  const statFor = (phone: string) => statMap[(phone || "").replace(/\D/g, "")] || null;
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

  function openEdit(c: StudioCrew) {
    if (editId === c.id) {
      setEditId(null);
      return;
    }
    const d: Record<string, string> = { phone: c.phone ?? "" };
    for (const f of PROFILE_FIELDS) d[f.key] = (c[f.key] as string | null | undefined) ?? "";
    setDraft(d);
    setEditErr(null);
    setEditId(c.id);
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

  async function add() {
    setErr(null);
    if (!phone.trim()) {
      setErr("Cần nhập số điện thoại.");
      return;
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
      return;
    }
    if (data) {
      setList((p) => [...p, data as StudioCrew].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setPhone("");
      setNote("");
      setRole("photographer");
    }
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

  return (
    <div className="page-in">
      <div className="mb-3.5">
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
          Lưu photographer / cameramen theo số điện thoại để gán nhanh vào hợp đồng.
          Thợ vào <span style={{ color: "var(--text)" }}>{mainUrl("/crew")}</span> để xem việc và
          tự báo lịch đã nhận — mỗi thợ chỉ thấy lịch của mình.
          Xem lịch cả đội ở <a href="/dashboard/studio/calendar?tab=team" style={{ color: "var(--text)" }}>Lịch đội ngũ</a>.
        </p>
      </div>

      {/* Không cấp được link thì NÓI RA — trước đây card lặng lẽ biến mất và
          không ai biết vì sao. */}
      {!registerUrl && registerError && (
        <div className="card mb-4 p-4">
          <p className="text-[13px] font-medium" style={{ color: "var(--s-amber)" }}>Chưa cấp được link đăng ký cho thợ</p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
            Chưa ghi được mã link vào hồ sơ studio. Thường là do chưa chạy
            {" "}<code>supabase/migrations/crew_profile_show.sql</code>. Chạy xong tải lại trang.
          </p>
          <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--text3)" }}>{registerError}</p>
        </div>
      )}

      {registerUrl && (
        <div className="card mb-4 p-4">
          <p className="text-[13px] font-medium">Link đăng ký cho thợ</p>
          <p className="mb-2 text-[11px]" style={{ color: "var(--text3)" }}>
            Gửi link này cho thợ để họ tự khai thông tin và xin vào sổ. Link mang mã riêng của studio bạn —
            trang /crew chung không biết thợ thuộc studio nào.
          </p>
          <input className="input text-[12px]" readOnly value={registerUrl} aria-label="Link đăng ký thợ" onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}

      {pending.length > 0 && (
        <div className="card mb-4 p-4">
          <p className="mb-2 text-[13px] font-medium" style={{ color: "var(--s-amber)" }}>
            {pending.length} thợ xin vào sổ
          </p>
          <ul className="space-y-2">
            {pending.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "var(--surface2)" }}>
                <span className="min-w-0">
                  <span className="block truncate text-sm">{c.name || c.phone}</span>
                  <span className="block text-[11px]" style={{ color: "var(--text3)" }}>{c.phone}</span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button onClick={() => approve(c.id)} className="btn-primary px-3 py-1.5 text-xs">Nhận</button>
                  <button onClick={() => remove(c.id)} className="btn-ghost px-3 py-1.5 text-xs">Từ chối</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CrewRolesPanel ownerId={ownerId} roles={roles} onChange={setRoles} canEdit={canEditCrewRoles} />

      {/* grid-cols-1 = minmax(0, 1fr): KHÔNG để mặc định. Lưới không khai cột
          thì cột ngầm rộng bằng phần tử rộng nhất bên trong (dòng thợ có hai ô
          chọn + hai nút) — trên điện thoại cả form lẫn danh sách tràn ra ngoài
          mép phải, nút Sửa/Xoá bị đẩy khỏi màn hình. */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        {/* Add form */}
        <Panel className="h-fit p-[18px]">
          <h2 className="mb-3.5 text-[14px] font-bold">Thêm thợ vào sổ</h2>
          <div className="space-y-3">
            <div className="field">
              <label className="label">Tên</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Số điện thoại</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Vai trò</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as CrewRole)}>
                {crewRolesFor(null, roles, role).map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
            </div>
            {branches.length > 0 && (
              <div className="field">
                <label className="label">Chi nhánh</label>
                <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">Toàn studio (không gán)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label className="label">Ghi chú</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
            <button
              onClick={add}
              disabled={busy}
              className="flex w-full items-center justify-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
              style={{ background: "var(--ac)", color: "#fff", opacity: busy ? 0.6 : 1 }}
            >
              <Plus size={16} /> {busy ? "Đang thêm…" : "Thêm vào sổ"}
            </button>
          </div>
        </Panel>

        {/* List */}
        <div className="min-w-0 lg:col-span-2">
          {list.length === 0 ? (
            <Panel>
              <EmptyState
                icon={Phone}
                title="Chưa có thợ nào trong sổ"
                hint="Thêm thợ ở khối bên trái, hoặc gửi link đăng ký để thợ tự khai thông tin."
              />
            </Panel>
          ) : (
            <div className="flex flex-col gap-2">
              {list.map((c) => (
                <Panel key={c.id} className="px-4 py-3.5">
                  {/* Điện thoại: thông tin thợ ở trên, hàng ô chọn + nút xuống dòng dưới.
                      Từ sm trở lên mới đứng cùng một hàng. */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: avatarColor(c.name || c.phone) }}>
                      {initials(c.name || c.phone)}
                    </span>
                    <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold">{c.name || "(chưa đặt tên)"}</p>
                    <p className="flex items-start gap-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                      <Phone size={12} className="mt-[3px] flex-none" />
                      <span className="min-w-0 break-words">
                        {c.phone} · {crewRoleLabel(c.role, roles)}
                        {c.note ? ` · ${c.note}` : ""}
                      </span>
                    </p>
                    {(() => {
                      const s = statFor(c.phone);
                      if (!s || s.total === 0) return null;
                      const rate = Math.round((s.accepted / s.total) * 100);
                      return (
                        <p className="mt-1 text-[11px]" style={{ color: "var(--tx3)" }}>
                          <span style={{ color: "var(--gn)", fontWeight: 700 }}>{s.accepted} buổi đã nhận</span> · {s.total} lời mời · nhận {rate}%
                          {s.declined ? ` · từ chối ${s.declined}` : ""}
                        </p>
                      );
                    })()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:flex-none sm:flex-nowrap">
                    <select
                      className="input !py-1.5 !text-[11.5px]"
                      style={{ width: "auto", minWidth: 110, maxWidth: "100%" }}
                      value={c.role}
                      onChange={(e) => setCrewRole(c.id, e.target.value)}
                      aria-label={`Vai trò của ${c.name || c.phone}`}
                    >
                      {crewRolesFor(null, roles, c.role).map((r) => (
                        <option key={r.key} value={r.key}>{r.label}</option>
                      ))}
                    </select>
                    {branches.length > 0 && (
                      <label className="flex min-w-0 items-center gap-1.5 text-[11px]" style={{ color: "var(--tx3)" }}>
                        <Building2 size={13} className="flex-none" />
                        <select
                          className="input !py-1.5 !text-[11.5px]"
                          style={{ width: "auto", minWidth: 120, maxWidth: "100%" }}
                          value={c.branch_id ?? ""}
                          onChange={(e) => setCrewBranch(c.id, e.target.value)}
                          aria-label={`Chi nhánh của ${c.name || c.phone}`}
                        >
                          <option value="">Toàn studio</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button
                      onClick={() => openEdit(c)}
                      aria-label={`Sửa thông tin ${c.name || c.phone}`}
                      aria-expanded={editId === c.id}
                      title="Sửa thông tin thợ"
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]"
                      style={
                        editId === c.id
                          ? { border: "1px solid var(--acM)", background: "var(--acS)", color: "var(--ac)" }
                          : { border: "1px solid var(--bd)", color: "var(--tx3)" }
                      }
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      aria-label="Xoá thợ"
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]"
                      style={{ border: "1px solid var(--bd)", color: "var(--tx3)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  </div>

                  {editId === c.id && (
                    <div className="mt-3.5 pt-3.5" style={{ borderTop: "1px solid var(--bd2)" }}>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div className="field">
                          <label className="label">Số điện thoại</label>
                          <input
                            className="input"
                            type="tel"
                            inputMode="tel"
                            autoComplete="off"
                            value={draft.phone ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                          />
                          {normalizeCrewPhone(draft.phone) !== normalizeCrewPhone(c.phone) && (
                            <p className="w-full text-[11px]" style={{ color: "var(--tx3)" }}>
                              Thợ sẽ đăng nhập /crew bằng số mới; phân công, lịch và chấm công ở studio này chuyển theo.
                            </p>
                          )}
                        </div>
                        {PROFILE_FIELDS.map((f) => (
                          <div key={f.key} className="field">
                            <label className="label">{f.label}</label>
                            <input
                              className="input"
                              type={f.type ?? "text"}
                              value={draft[f.key] ?? ""}
                              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                            />
                          </div>
                        ))}
                      </div>
                      {c.self_filled_at && (
                        <p className="mt-2 text-[11px]" style={{ color: "var(--tx3)" }}>
                          Thợ tự cập nhật lần cuối ngày {fmtDate(c.self_filled_at)}.
                        </p>
                      )}
                      {editErr && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{editErr}</p>}
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => saveEdit(c)} disabled={savingEdit} className="btn-primary px-4 py-2 text-xs">
                          {savingEdit ? "Đang lưu…" : "Lưu thông tin"}
                        </button>
                        <button onClick={() => setEditId(null)} className="btn-ghost px-4 py-2 text-xs">Huỷ</button>
                      </div>
                    </div>
                  )}
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
