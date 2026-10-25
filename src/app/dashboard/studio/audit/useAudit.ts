"use client";

import { useMemo, useState } from "react";
import { auditGroup, type AuditGroup } from "@/lib/audit-labels";
import type { AuditRow } from "./AuditView";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của Nhật ký thao tác (bản cũ AuditView và bản mới
   AuditV2): lọc theo nhóm thao tác và người thao tác, dòng đang mở chi tiết.
   ═══════════════════════════════════════════════════════════════════════════ */

export function useAudit(rows: AuditRow[]) {
  const [group, setGroup] = useState<AuditGroup | "all">("all");
  const [actor, setActor] = useState<string>("all");
  const [open, setOpen] = useState<number | null>(null);

  const actors = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.actor_id ?? "system", r.actor_name ?? "Khách / hệ thống");
    return [...m.entries()];
  }, [rows]);
  const shown = rows.filter(
    (r) => (group === "all" || auditGroup(r.action) === group) && (actor === "all" || (r.actor_id ?? "system") === actor)
  );

  return { group, setGroup, actor, setActor, open, setOpen, actors, shown };
}
