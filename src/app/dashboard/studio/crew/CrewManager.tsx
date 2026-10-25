"use client";

import { Building2, Pencil, Plus, Trash2, Phone } from "lucide-react";
import { mainUrl } from "@/lib/hosts";
import { fmtDate } from "@/lib/date";
import { normalizeCrewPhone } from "@/lib/crew-phone";
import { Panel, EmptyState } from "@/components/studio/ui";
import { avatarColor, initials } from "@/lib/avatar";
import { type StudioCrew, type CrewRole } from "@/lib/types";
import { crewRoleLabel, crewRolesFor, type CrewRoleRow } from "@/lib/crew-roles";
import CrewRolesPanel from "./CrewRolesPanel";
import { PROFILE_FIELDS, useCrew } from "./useCrew";

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
  // Logic dùng chung với bản mới (CrewManagerV2) — xem ./useCrew.
  const {
    list, statFor, pending, name, setName, phone, setPhone, role, setRole, note, setNote, branchId, setBranchId,
    busy, err, roles, setRoles, editId, setEditId, draft, setDraft, savingEdit, editErr,
    openEdit, saveEdit, setCrewBranch, setCrewRole, add, approve, remove,
  } = useCrew({ ownerId, initial, stats, crewRoles });

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
