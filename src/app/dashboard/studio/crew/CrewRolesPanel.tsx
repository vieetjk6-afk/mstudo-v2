"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, RotateCcw, Tags, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, PanelHead } from "@/components/studio/ui";
import { CONTRACT_KIND_LABEL, type ContractKind } from "@/lib/contract-kind";
import { phanLoaiLoi } from "@/lib/pg-loi";
import {
  ALL_CONTRACT_KINDS,
  UNHIDEABLE_CREW_ROLE,
  allCrewRoles,
  newCrewRoleKey,
  type CrewRoleOption,
  type CrewRoleRow,
} from "@/lib/crew-roles";
import { CREW_ROLE_LABEL, type BuiltinCrewRole } from "@/lib/types";

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

const SELECT = "id, key, label, kinds, active, position";

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
  const supabase = createClient();
  const all = allCrewRoles(roles);
  const [label, setLabel] = useState("");
  const [kinds, setKinds] = useState<ContractKind[]>([...ALL_CONTRACT_KINDS]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** Dòng hiện có của một khoá, hoặc dòng đè mới cho vai trò có sẵn. */
  function rowOf(o: CrewRoleOption): CrewRoleRow {
    const ex = roles.find((r) => r.key === o.key);
    return ex
      ? { ...ex }
      : { key: o.key, label: "", kinds: o.kinds, active: o.active, position: o.position };
  }

  async function save(changed: CrewRoleRow[]) {
    setErr(null);
    if (!changed.length) return true;
    const prev = roles;
    const merged = [...roles];
    for (const c of changed) {
      const i = merged.findIndex((r) => r.key === c.key);
      if (i >= 0) merged[i] = { ...merged[i], ...c };
      else merged.push(c);
    }
    onChange(merged);
    setBusy(true);
    const { data, error } = await supabase
      .from("studio_crew_roles")
      .upsert(
        changed.map((c) => ({
          owner_id: ownerId,
          key: c.key,
          label: c.label,
          kinds: c.kinds ?? [],
          active: c.active,
          position: c.position,
        })),
        { onConflict: "owner_id,key" }
      )
      .select(SELECT);
    setBusy(false);
    if (error) {
      onChange(prev);
      setErr(
        phanLoaiLoi(error) === "thieu-bang"
          ? "Database chưa có bảng vai trò. Chạy supabase/migrations/vai_tro_tho_tu_dat.sql rồi tải lại trang."
          : `Không lưu được: ${error.message}`
      );
      return false;
    }
    // Lấy id do database cấp cho dòng mới.
    const saved = (data ?? []) as CrewRoleRow[];
    onChange(merged.map((r) => saved.find((s) => s.key === r.key) ?? r));
    return true;
  }

  async function add() {
    const name = label.trim();
    if (!name) return setErr("Cần nhập tên vai trò.");
    if (!kinds.length) return setErr("Chọn ít nhất một nhóm hợp đồng.");
    if (all.some((o) => o.label.toLowerCase() === name.toLowerCase())) return setErr("Đã có vai trò cùng tên.");
    const position = Math.max(-1, ...all.map((o) => o.position)) + 1;
    const ok = await save([{ key: newCrewRoleKey(), label: name, kinds, active: true, position }]);
    if (ok) {
      setLabel("");
      setKinds([...ALL_CONTRACT_KINDS]);
    }
  }

  async function rename(o: CrewRoleOption) {
    const name = draft.trim();
    if (!o.builtin && !name) return setErr("Tên vai trò không được để trống.");
    // Vai trò có sẵn: để trống hoặc gõ lại đúng tên mặc định = bỏ đè.
    const isDefault = o.builtin && (!name || name === CREW_ROLE_LABEL[o.key as BuiltinCrewRole]);
    const ok = await save([{ ...rowOf(o), label: isDefault ? "" : name }]);
    if (ok) setEditing(null);
  }

  function toggleActive(o: CrewRoleOption) {
    if (o.key === UNHIDEABLE_CREW_ROLE) return;
    void save([{ ...rowOf(o), active: !o.active }]);
  }

  function toggleKind(o: CrewRoleOption, k: ContractKind) {
    const has = o.kinds.includes(k);
    const next = has ? o.kinds.filter((x) => x !== k) : ALL_CONTRACT_KINDS.filter((x) => x === k || o.kinds.includes(x));
    if (!next.length) return setErr("Vai trò phải hiện ở ít nhất một nhóm hợp đồng.");
    void save([{ ...rowOf(o), kinds: next }]);
  }

  /** Đổi chỗ với vai trò kề bên, rồi đánh lại vị trí 0..n-1 cho cả danh sách. */
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= all.length) return;
    const order = [...all];
    [order[i], order[j]] = [order[j], order[i]];
    const changed = order
      .map((o, pos) => ({ o, pos }))
      .filter(({ o, pos }) => o.position !== pos)
      .map(({ o, pos }) => ({ ...rowOf(o), position: pos }));
    void save(changed);
  }

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
