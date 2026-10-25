"use client";

import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Pencil, Plus, RotateCcw, Tags, Trash2, X } from "lucide-react";
import { Badge, Callout, Field, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu } from "@/components/v2/kit-client";
import { CONTRACT_KIND_LABEL, type ContractKind } from "@/lib/contract-kind";
import { ALL_CONTRACT_KINDS, UNHIDEABLE_CREW_ROLE, type CrewRoleOption, type CrewRoleRow } from "@/lib/crew-roles";
import { CREW_ROLE_LABEL, type BuiltinCrewRole } from "@/lib/types";
import { useCrewRoles } from "./useCrewRoles";

/* ═══════════════════════════════════════════════════════════════════════════
   VAI TRÒ THỢ — giao diện mới. Cùng logic với CrewRolesPanel (./useCrewRoles).
   Không chiếm chỗ trên màn sổ thợ nữa: mở bằng ngăn kéo từ nút "Vai trò thợ".
   Ô thêm vai trò ở đầu; mỗi vai trò một dòng: tên + nhóm hợp đồng (bấm để bật/
   tắt với vai trò tự đặt) · ↑ ↓ đổi thứ tự · menu ⋯ đổi tên / ẩn / xoá.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CrewRolesDrawerV2({
  open,
  onClose,
  ownerId,
  roles,
  onChange,
  canEdit,
}: {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  roles: CrewRoleRow[];
  onChange: (next: CrewRoleRow[]) => void;
  canEdit: boolean;
}) {
  const r = useCrewRoles({ ownerId, roles, onChange });
  const activeCount = r.all.filter((o) => o.active).length;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      title="Vai trò thợ"
      desc={`${activeCount} vai trò đang dùng · thứ tự ở đây là thứ tự trong mọi ô chọn vai trò`}
    >
      <div className="flex flex-col gap-5">
        {canEdit ? (
          <div className="v2-card v2-card-pad flex flex-col gap-3" style={{ boxShadow: "none", background: "var(--sf2)" }}>
            <Field label="Thêm vai trò mới">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={r.label}
                  maxLength={60}
                  placeholder="VD: Flycam, Stylist, MC…"
                  onChange={(e) => r.setLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void r.add();
                  }}
                />
                <button type="button" onClick={() => void r.add()} disabled={r.busy} className={btn("primary")}>
                  <Plus size={16} /> Thêm
                </button>
              </div>
            </Field>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>Hiện ở hợp đồng</span>
              {ALL_CONTRACT_KINDS.map((k) => (
                <KindChip
                  key={k}
                  kind={k}
                  on={r.kinds.includes(k)}
                  onClick={() =>
                    r.setKinds((p) => (p.includes(k) ? p.filter((x) => x !== k) : ALL_CONTRACT_KINDS.filter((x) => x === k || p.includes(x))))
                  }
                />
              ))}
            </div>
          </div>
        ) : (
          <Callout tone="gray" icon={Tags}>
            Danh sách vai trò dùng chung cả studio. Nhờ chủ studio hoặc quản lý nếu cần thêm vai trò mới.
          </Callout>
        )}

        {r.err ? <Callout tone="red">{r.err}</Callout> : null}

        <div className="v2-card overflow-hidden" style={{ boxShadow: "none" }}>
          {r.all.map((o, i) => (
            <RoleRow key={o.key} o={o} i={i} last={i === r.all.length - 1} canEdit={canEdit} r={r} />
          ))}
        </div>

        {canEdit ? (
          <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
            Xoá vai trò chỉ bỏ nó khỏi ô chọn — hợp đồng và thợ đã gán vẫn giữ đúng tên. Nhóm hợp đồng của vai trò có sẵn do app quy định.
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}

function KindChip({ kind, on, onClick, disabled }: { kind: ContractKind; on: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold"
      style={
        on
          ? { background: "var(--acS)", color: "var(--ac)" }
          : { background: "transparent", border: "1px dashed var(--bdS)", color: "var(--tx3)" }
      }
    >
      {on ? <Check size={12} strokeWidth={2.6} /> : <Plus size={12} />}
      {CONTRACT_KIND_LABEL[kind]}
    </button>
  );
}

function RoleRow({
  o,
  i,
  last,
  canEdit,
  r,
}: {
  o: CrewRoleOption;
  i: number;
  last: boolean;
  canEdit: boolean;
  r: ReturnType<typeof useCrewRoles>;
}) {
  const editing = r.editing === o.key;
  const clickableKinds = canEdit && !o.builtin;
  return (
    <div className="v2-row flex-wrap !items-start" style={{ opacity: o.active ? 1 : 0.6 }}>
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void r.rename(o);
            }}
          >
            <input
              className={inputCls}
              value={r.draft}
              autoFocus
              maxLength={60}
              placeholder={o.builtin ? CREW_ROLE_LABEL[o.key as BuiltinCrewRole] : "Tên vai trò"}
              onChange={(e) => r.setDraft(e.target.value)}
              aria-label={`Tên mới cho ${o.label}`}
            />
            <button type="submit" disabled={r.busy} className={iconBtn()} aria-label="Lưu tên" title="Lưu tên" style={{ color: "var(--ac)" }}>
              <Check size={17} />
            </button>
            <button type="button" onClick={() => r.setEditing(null)} className={iconBtn()} aria-label="Huỷ đổi tên" title="Huỷ">
              <X size={17} />
            </button>
          </form>
        ) : (
          <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
            {o.label}
            <Badge tone={o.builtin ? "gray" : "brand"}>{o.builtin ? "Có sẵn" : "Tự đặt"}</Badge>
            {!o.active ? <Badge tone="amber">{o.builtin ? "Đang ẩn" : "Đã xoá"}</Badge> : null}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ALL_CONTRACT_KINDS.map((k) => {
            const on = o.kinds.includes(k);
            if (!clickableKinds && !on) return null;
            return clickableKinds ? (
              <KindChip key={k} kind={k} on={on} disabled={r.busy} onClick={() => r.toggleKind(o, k)} />
            ) : (
              <Badge key={k} tone="gray">{CONTRACT_KIND_LABEL[k]}</Badge>
            );
          })}
        </div>
      </div>
      {canEdit && !editing ? (
        <div className="flex flex-none items-center">
          <button type="button" className={iconBtn("disabled:opacity-30")} disabled={r.busy || i === 0} onClick={() => r.move(i, -1)} aria-label={`Đưa ${o.label} lên`} title="Lên">
            <ArrowUp size={16} />
          </button>
          <button type="button" className={iconBtn("disabled:opacity-30")} disabled={r.busy || last} onClick={() => r.move(i, 1)} aria-label={`Đưa ${o.label} xuống`} title="Xuống">
            <ArrowDown size={16} />
          </button>
          <Menu
            label={`Thao tác với vai trò ${o.label}`}
            items={[
              {
                label: "Đổi tên",
                hint: o.builtin ? "Để trống là về tên mặc định" : undefined,
                icon: Pencil,
                disabled: r.busy,
                onClick: () => {
                  r.setEditing(o.key);
                  r.setDraft(o.label);
                },
              },
              ...(o.builtin
                ? o.key !== UNHIDEABLE_CREW_ROLE
                  ? [{ label: o.active ? "Ẩn khỏi ô chọn" : "Hiện lại", icon: o.active ? EyeOff : Eye, disabled: r.busy, onClick: () => r.toggleActive(o) }]
                  : []
                : [
                    o.active
                      ? { label: "Xoá vai trò", hint: "Hợp đồng cũ vẫn giữ đúng tên", icon: Trash2, danger: true, disabled: r.busy, onClick: () => r.toggleActive(o) }
                      : { label: "Khôi phục", icon: RotateCcw, disabled: r.busy, onClick: () => r.toggleActive(o) },
                  ]),
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
