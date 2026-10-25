"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ContractKind } from "@/lib/contract-kind";
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
   Phần LOGIC dùng chung của khối "Vai trò thợ" (bản cũ CrewRolesPanel và bản
   mới CrewRolesPanelV2): đổi tên, ẩn/hiện, thêm, xoá mềm, đổi thứ tự. Ghi thẳng
   qua RLS (studio_crew_roles).
   ═══════════════════════════════════════════════════════════════════════════ */

const SELECT = "id, key, label, kinds, active, position";

export function useCrewRoles({
  ownerId,
  roles,
  onChange,
}: {
  ownerId: string;
  roles: CrewRoleRow[];
  onChange: (next: CrewRoleRow[]) => void;
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

  return { all, label, setLabel, kinds, setKinds, editing, setEditing, draft, setDraft, busy, err, add, rename, toggleActive, toggleKind, move };
}

export type CrewRolesState = ReturnType<typeof useCrewRoles>;
