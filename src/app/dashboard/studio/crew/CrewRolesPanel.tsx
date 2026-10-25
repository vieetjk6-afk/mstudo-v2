"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, RotateCcw, Tags, Trash2 } from "lucide-react";
import { Panel, PanelHead } from "@/components/studio/ui";
import { CONTRACT_KIND_LABEL } from "@/lib/contract-kind";
import { ALL_CONTRACT_KINDS, UNHIDEABLE_CREW_ROLE, type CrewRoleRow } from "@/lib/crew-roles";
import { CREW_ROLE_LABEL, type BuiltinCrewRole } from "@/lib/types";
import { useCrewRoles } from "./useCrewRoles";

/* ═══════════════════════════════════════════════════════════════════════════
   VAI TRÒ THỢ — khối quản lý trong tab "Đội ngũ thợ".

   Bảy vai trò có sẵn + vai trò studio tự thêm, chung một danh sách:
     • đổi tên (có sẵn: để trống = về tên mặc định)
     • ẩn / hiện khỏi ô chọn (có sẵn) — "Khác" không ẩn được, là lối thoát
     • thêm vai trò mới, chọn nó hiện ở nhóm hợp đồng nào
     • xoá MỀM vai trò tự thêm (hợp đồng cũ vẫn ra đúng tên), khôi phục được
     • đổi thứ tự ↑ ↓ — thứ tự này là thứ tự trong mọi ô chọn vai trò

   Ghi thẳng qua RLS (studio_crew_roles). Chỉ chủ studio / quản lý toàn studio
   được sửa; người khác chỉ xem.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CrewRolesPanel({
  ownerId,
  roles,
  onChange,
  canEdit,
}: {
  ownerId: string;
  roles: CrewRoleRow[];
  onChange: (next: CrewRoleRow[]) => void;
  canEdit: boolean;
}) {
  // Logic dùng chung với bản mới (CrewRolesPanelV2) — xem ./useCrewRoles.
  const { all, label, setLabel, kinds, setKinds, editing, setEditing, draft, setDraft, busy, err, add, rename, toggleActive, toggleKind, move } =
    useCrewRoles({ ownerId, roles, onChange });

  return (
    <Panel className="mb-3.5">
      <PanelHead
        icon={Tags}
        tone="brand"
        title="Vai trò"
        count={String(all.filter((o) => o.active).length)}
        note={canEdit ? "Thứ tự ở đây là thứ tự trong ô chọn vai trò" : "Chỉ chủ studio / quản lý được sửa"}
      />
      <div className="grid gap-3.5 p-4 lg:grid-cols-3">
        <ul className="flex flex-col gap-1.5 lg:col-span-2">
          {all.map((o, i) => (
            <li
              key={o.key}
              className="flex flex-wrap items-center gap-2 rounded-[10px] px-3 py-2"
              style={{ background: "var(--sf2)", opacity: o.active ? 1 : 0.55 }}
            >
              <div className="min-w-0 flex-1">
                {editing === o.key ? (
                  <form
                    className="flex gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void rename(o);
                    }}
                  >
                    <input
                      className="input !py-1.5 !text-[12.5px]"
                      value={draft}
                      autoFocus
                      maxLength={60}
                      placeholder={o.builtin ? CREW_ROLE_LABEL[o.key as BuiltinCrewRole] : "Tên vai trò"}
                      onChange={(e) => setDraft(e.target.value)}
                      aria-label={`Tên mới cho ${o.label}`}
                    />
                    <button type="submit" disabled={busy} className="btn-primary px-3 py-1.5 text-xs">Lưu</button>
                    <button type="button" onClick={() => setEditing(null)} className="btn-ghost px-3 py-1.5 text-xs">Huỷ</button>
                  </form>
                ) : (
                  <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
                    {o.label}
                    <span className="rounded-[20px] px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: "var(--bd2)", color: "var(--tx2)" }}>
                      {o.builtin ? "Có sẵn" : "Tự đặt"}
                    </span>
                    {!o.active && (
                      <span className="text-[11px] font-normal" style={{ color: "var(--tx3)" }}>
                        {o.builtin ? "· đang ẩn" : "· đã xoá"}
                      </span>
                    )}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {ALL_CONTRACT_KINDS.map((k) => {
                    const on = o.kinds.includes(k);
                    // Nhóm của vai trò có sẵn do app quy định (CREW_ROLES_BY_KIND).
                    const clickable = canEdit && !o.builtin;
                    if (!clickable && !on) return null;
                    return (
                      <button
                        key={k}
                        type="button"
                        disabled={!clickable || busy}
                        onClick={() => toggleKind(o, k)}
                        aria-pressed={on}
                        className="rounded-[20px] px-2 py-0.5 text-[10.5px]"
                        style={
                          on
                            ? { background: "var(--acS)", color: "var(--ac)", fontWeight: 650 }
                            : { background: "transparent", border: "1px dashed var(--bd)", color: "var(--tx3)" }
                        }
                      >
                        {CONTRACT_KIND_LABEL[k]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {canEdit && editing !== o.key && (
                <div className="flex flex-none items-center gap-1">
                  <IconBtn label="Lên" disabled={busy || i === 0} onClick={() => move(i, -1)}><ArrowUp size={13} /></IconBtn>
                  <IconBtn label="Xuống" disabled={busy || i === all.length - 1} onClick={() => move(i, 1)}><ArrowDown size={13} /></IconBtn>
                  <IconBtn
                    label="Đổi tên"
                    disabled={busy}
                    onClick={() => {
                      setEditing(o.key);
                      setDraft(o.label);
                    }}
                  >
                    <Pencil size={13} />
                  </IconBtn>
                  {o.builtin ? (
                    o.key !== UNHIDEABLE_CREW_ROLE && (
                      <IconBtn label={o.active ? "Ẩn khỏi ô chọn" : "Hiện lại"} disabled={busy} onClick={() => toggleActive(o)}>
                        {o.active ? <EyeOff size={13} /> : <Eye size={13} />}
                      </IconBtn>
                    )
                  ) : (
                    <IconBtn label={o.active ? "Xoá vai trò" : "Khôi phục"} disabled={busy} onClick={() => toggleActive(o)}>
                      {o.active ? <Trash2 size={13} /> : <RotateCcw size={13} />}
                    </IconBtn>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        {canEdit ? (
          <div className="flex h-fit flex-col gap-3">
            <div className="field">
              <label className="label">Thêm vai trò mới</label>
              <input
                className="input"
                value={label}
                maxLength={60}
                placeholder="VD: Flycam, Stylist, MC…"
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void add();
                }}
              />
            </div>
            <div>
              <p className="label mb-1.5">Hiện ở hợp đồng</p>
              <div className="flex flex-wrap gap-2">
                {ALL_CONTRACT_KINDS.map((k) => (
                  <label key={k} className="flex items-center gap-1.5 text-[12.5px]">
                    <input
                      type="checkbox"
                      checked={kinds.includes(k)}
                      onChange={(e) =>
                        setKinds((p) => (e.target.checked ? ALL_CONTRACT_KINDS.filter((x) => x === k || p.includes(x)) : p.filter((x) => x !== k)))
                      }
                    />
                    {CONTRACT_KIND_LABEL[k]}
                  </label>
                ))}
              </div>
            </div>
            {err && <p className="text-[12.5px]" style={{ color: "var(--danger)" }}>{err}</p>}
            <button
              onClick={add}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 rounded-[10px] px-4 py-2 text-[13px] font-semibold"
              style={{ background: "var(--ac)", color: "#fff", opacity: busy ? 0.6 : 1 }}
            >
              <Plus size={15} /> Thêm vai trò
            </button>
            <p className="text-[11px]" style={{ color: "var(--tx3)" }}>
              Xoá vai trò chỉ bỏ nó khỏi ô chọn — hợp đồng và thợ đã gán vẫn giữ đúng tên.
            </p>
          </div>
        ) : (
          <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
            Danh sách vai trò dùng chung cả studio. Nhờ chủ studio hoặc quản lý nếu cần thêm vai trò mới.
          </p>
        )}
      </div>
    </Panel>
  );
}

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-[8px]"
      style={{ border: "1px solid var(--bd)", color: "var(--tx3)", opacity: disabled ? 0.4 : 1 }}
    >
      {children}
    </button>
  );
}
