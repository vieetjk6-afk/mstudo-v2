"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { History, ChevronDown } from "lucide-react";
import { Panel, PanelHead, EmptyState } from "@/components/studio/ui";
import { fmtDateTime } from "@/lib/date";
import { AUDIT_GROUP_LABEL, auditGroup, auditIsDestructive, type AuditGroup } from "@/lib/audit-labels";

export type AuditRow = {
  id: number;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  contract_id: string | null;
  contract_label: string | null;
  summary: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
};

export default function AuditView({
  rows,
  migrated,
  filteredContract,
}: {
  rows: AuditRow[];
  migrated: boolean;
  filteredContract: string | null;
}) {
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

  return (
    <div className="space-y-3.5">
      <div>
        <h1 className="text-[21px] font-bold" style={{ letterSpacing: "-.4px" }}>Nhật ký thao tác</h1>
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>
          Ai ghi, sửa, xoá tiền và hợp đồng — lúc nào. Không ai (kể cả chủ studio) sửa hay xoá được dòng nhật ký.
        </p>
      </div>

      {!migrated && (
        <div className="rounded-[12px] px-4 py-3 text-[12.5px] font-semibold" style={{ background: "var(--amS)", color: "var(--am)", border: "1px solid var(--bd)" }}>
          Chưa chạy <code>supabase/migrations/studio_audit_log.sql</code> — nhật ký bắt đầu ghi từ lúc bạn chạy nó trong Supabase SQL Editor.
        </div>
      )}

      {filteredContract && (
        <p className="text-[12.5px]" style={{ color: "var(--tx2)" }}>
          Đang xem riêng hợp đồng <b>{filteredContract}</b> · <Link href="/dashboard/studio/audit" style={{ color: "var(--ac)" }}>Xem tất cả</Link>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <select className="input w-auto py-1.5 text-[12.5px]" value={group} onChange={(e) => setGroup(e.target.value as AuditGroup | "all")}>
          <option value="all">Mọi loại</option>
          {(Object.keys(AUDIT_GROUP_LABEL) as AuditGroup[]).map((g) => <option key={g} value={g}>{AUDIT_GROUP_LABEL[g]}</option>)}
        </select>
        <select className="input w-auto py-1.5 text-[12.5px]" value={actor} onChange={(e) => setActor(e.target.value)}>
          <option value="all">Mọi người</option>
          {actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      <Panel>
        <PanelHead icon={History} tone="brand" title="Thao tác gần đây" count={String(shown.length)} note="500 dòng mới nhất" />
        {shown.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={History} title="Chưa có thao tác nào" hint="Mỗi lần ghi thu, xoá khoản thu, sửa giá hay đổi trạng thái hợp đồng sẽ hiện ở đây." />
          </div>
        ) : (
          <ul>
            {shown.map((r) => {
              const danger = auditIsDestructive(r.action);
              const hasDetail = r.before != null || r.after != null;
              return (
                <li key={r.id} style={{ borderTop: "1px solid var(--bd2)" }}>
                  <button
                    type="button"
                    onClick={() => hasDetail && setOpen(open === r.id ? null : r.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  >
                    <span className="tnum w-[92px] flex-none text-[11.5px]" style={{ color: "var(--tx3)" }}>{fmtDateTime(r.created_at)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold" style={danger ? { color: "var(--rd)" } : undefined}>
                        {r.summary || r.action}
                      </span>
                      <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--tx3)" }}>
                        {r.actor_name ?? "Khách / hệ thống"} · {AUDIT_GROUP_LABEL[auditGroup(r.action)]}
                        {r.contract_id && (
                          <>
                            {" · "}
                            <Link href={`/dashboard/studio/contracts/${r.contract_id}`} onClick={(e) => e.stopPropagation()} style={{ color: "var(--ac)" }}>
                              {r.contract_label ?? "Hợp đồng đã xoá"}
                            </Link>
                          </>
                        )}
                      </span>
                    </span>
                    {hasDetail && <ChevronDown size={15} className="mt-0.5 flex-none" style={{ color: "var(--tx3)", transform: open === r.id ? "rotate(180deg)" : undefined }} />}
                  </button>
                  {open === r.id && (
                    <div className="grid gap-2 px-4 pb-3 sm:grid-cols-2">
                      {r.before != null && <Snapshot title="Trước" value={r.before} />}
                      {r.after != null && <Snapshot title="Sau" value={r.after} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Snapshot({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-[10px] p-2.5" style={{ background: "var(--sf2)", border: "1px solid var(--bd2)" }}>
      <p className="mb-1 text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: ".6px", color: "var(--tx3)" }}>{title}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px]" style={{ color: "var(--tx2)" }}>{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
