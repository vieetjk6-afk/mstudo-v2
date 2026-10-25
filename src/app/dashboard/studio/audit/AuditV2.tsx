"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, CalendarClock, History, Search, ShieldAlert, Trash2, Users } from "lucide-react";
import { Avatar, Badge, Callout, Empty, GroupLabel, InfoList, PageHead, Stack, Stat, StatGrid, Toolbar, btn, inputCls, type Tone } from "@/components/v2/kit";
import { Drawer, SearchInput } from "@/components/v2/kit-client";
import { fmtDate, fmtDateTime, todayVN } from "@/lib/date";
import { auditFields, type AuditField } from "@/lib/audit-fields";
import { AUDIT_GROUP_LABEL, auditGroup, auditIsDestructive, type AuditGroup } from "@/lib/audit-labels";
import { noAccent } from "@/lib/studio-nav";
import type { AuditProps, AuditRow } from "./AuditView";
import { useAudit } from "./useAudit";

/* ═══════════════════════════════════════════════════════════════════════════
   NHẬT KÝ THAO TÁC — giao diện mới. Cùng dữ liệu, cùng bộ lọc với AuditView
   (./useAudit); khác ở cách sắp xếp:
     • 4 số liệu: số thao tác · hôm nay · xoá/huỷ (đỏ khi có) · số người.
     • Một thanh lọc: tìm theo nội dung + nhóm thao tác + người thao tác.
     • Dòng nhật ký nhóm theo NGÀY (Hôm nay / Hôm qua / ngày cụ thể), mỗi dòng:
       giờ · người · nội dung (đỏ nếu là xoá/huỷ) · nhóm · hợp đồng liên quan.
     • Bấm một dòng có chi tiết mở ngăn kéo: trường đã đổi (trước → sau) hoặc
       thông tin khoản vừa ghi / vừa xoá.
   Quyền xem giữ nguyên ở page.tsx (chủ studio và kế toán).
   ═══════════════════════════════════════════════════════════════════════════ */

const GROUP_TONE: Record<AuditGroup, Tone> = { money: "green", contract: "blue", addendum: "teal", voucher: "violet", security: "red", other: "gray" };

export default function AuditV2({ rows, migrated, filteredContract }: AuditProps) {
  const a = useAudit(rows);
  const [q, setQ] = useState("");
  const [peekId, setPeekId] = useState<number | null>(null);
  const peek = peekId != null ? rows.find((r) => r.id === peekId) ?? null : null;

  const today = fmtDate(todayVN());
  const yesterday = fmtDate(new Date(Date.now() - 86_400_000));
  const dayLabel = (d: string) => (d === today ? "Hôm nay" : d === yesterday ? "Hôm qua" : d);

  const todayCount = rows.filter((r) => fmtDate(r.created_at) === today).length;
  const destructive = rows.filter((r) => auditIsDestructive(r.action)).length;

  const shown = useMemo(() => {
    const n = noAccent(q.trim());
    return n
      ? a.shown.filter((r) => noAccent(`${r.summary ?? r.action} ${r.actor_name ?? ""} ${r.contract_label ?? ""}`).includes(n))
      : a.shown;
  }, [a.shown, q]);

  const groups = useMemo(() => {
    const out: { day: string; rows: AuditRow[] }[] = [];
    for (const r of shown) {
      const d = fmtDate(r.created_at);
      const last = out[out.length - 1];
      if (last && last.day === d) last.rows.push(r);
      else out.push({ day: d, rows: [r] });
    }
    return out;
  }, [shown]);

  return (
    <Stack>
      <PageHead
        title="Nhật ký thao tác"
        desc="Ai ghi, sửa, xoá tiền và hợp đồng — lúc nào. Không ai (kể cả chủ studio) sửa hay xoá được dòng nhật ký."
      />

      {!migrated ? (
        <Callout tone="amber" title="Nhật ký chưa bật">
          Chạy <code className="break-all">supabase/migrations/studio_audit_log.sql</code> trong Supabase SQL Editor — nhật ký bắt đầu ghi từ lúc đó.
        </Callout>
      ) : null}

      {filteredContract ? (
        <Callout
          tone="blue"
          icon={History}
          action={
            <Link href="/dashboard/studio/audit" className={btn("secondary", "sm")}>
              Xem tất cả
            </Link>
          }
        >
          Đang xem riêng hợp đồng <b>{filteredContract}</b>.
        </Callout>
      ) : null}

      <StatGrid>
        <Stat icon={History} tone="brand" label="Thao tác" value={rows.length} sub="500 dòng mới nhất" />
        <Stat icon={CalendarClock} tone="blue" label="Hôm nay" value={todayCount} sub={todayCount ? "thao tác từ 0 giờ" : "Chưa có thao tác nào"} />
        <Stat
          icon={Trash2}
          tone="red"
          label="Xoá / huỷ"
          value={destructive}
          valueTone={destructive > 0 ? "red" : undefined}
          sub="Thao tác làm mất dữ liệu"
        />
        <Stat icon={Users} tone="violet" label="Người thao tác" value={a.actors.length} sub="Kể cả khách / hệ thống" />
      </StatGrid>

      <div className="v2-card overflow-hidden">
        <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <Toolbar>
            <div className="min-w-[200px] flex-1">
              <SearchInput value={q} onChange={setQ} placeholder="Nội dung, người, hợp đồng…" className="w-full" />
            </div>
            <select aria-label="Nhóm thao tác" className={inputCls} value={a.group} onChange={(e) => a.setGroup(e.target.value as AuditGroup | "all")}>
              <option value="all">Mọi loại</option>
              {(Object.keys(AUDIT_GROUP_LABEL) as AuditGroup[]).map((g) => (
                <option key={g} value={g}>{AUDIT_GROUP_LABEL[g]}</option>
              ))}
            </select>
            <select aria-label="Người thao tác" className={inputCls} value={a.actor} onChange={(e) => a.setActor(e.target.value)}>
              <option value="all">Mọi người</option>
              {a.actors.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </Toolbar>
        </div>

        {shown.length === 0 ? (
          rows.length === 0 ? (
            <Empty icon={History} title="Chưa có thao tác nào" hint="Mỗi lần ghi thu, xoá khoản thu, sửa giá hay đổi trạng thái hợp đồng sẽ hiện ở đây." />
          ) : (
            <Empty compact icon={Search} title="Không có dòng nào khớp" hint="Thử chọn “Mọi loại” và “Mọi người”." />
          )
        ) : (
          groups.map((g) => (
            <Fragment key={g.day}>
              <div className="px-4 pb-2 pt-4 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <GroupLabel count={`${g.rows.length} thao tác`}>{dayLabel(g.day)}</GroupLabel>
              </div>
              {g.rows.map((r) => (
                <AuditRowV2 key={r.id} r={r} onOpen={() => setPeekId(r.id)} />
              ))}
            </Fragment>
          ))
        )}
      </div>

      <Drawer
        open={!!peek}
        onClose={() => setPeekId(null)}
        title="Chi tiết thao tác"
        desc={peek ? fmtDateTime(peek.created_at) : undefined}
        footer={
          peek?.contract_id ? (
            <Link href={`/dashboard/studio/contracts/${peek.contract_id}`} className={btn("secondary")}>
              Mở hợp đồng <ArrowUpRight size={16} />
            </Link>
          ) : null
        }
      >
        {peek ? <AuditPeek r={peek} /> : null}
      </Drawer>
    </Stack>
  );
}

function AuditRowV2({ r, onOpen }: { r: AuditRow; onOpen: () => void }) {
  const danger = auditIsDestructive(r.action);
  const group = auditGroup(r.action);
  const hasDetail = auditFields(r.before, r.after).length > 0;
  const who = r.actor_name ?? "Khách / hệ thống";
  const body = (
    <>
      <span className="v2-num w-[44px] flex-none text-[12.5px] font-semibold" style={{ color: "var(--tx3)" }}>
        {fmtDateTime(r.created_at).slice(0, 5)}
      </span>
      <Avatar name={who} size={32} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold" style={danger ? { color: "var(--rd)" } : undefined}>
          {danger ? <ShieldAlert size={14} className="-mt-0.5 mr-1 inline" /> : null}
          {r.summary || r.action}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>
          <span>{who}</span>
          {r.contract_id ? (
            <>
              <span>·</span>
              <span className="truncate" style={{ color: "var(--ac)" }}>{r.contract_label ?? "Hợp đồng đã xoá"}</span>
            </>
          ) : null}
        </p>
      </div>
      <span className="hidden sm:inline-flex">
        <Badge tone={GROUP_TONE[group]}>{AUDIT_GROUP_LABEL[group]}</Badge>
      </span>
      {hasDetail || r.contract_id ? <ChevronRight size={16} className="flex-none" style={{ color: "var(--tx3)" }} /> : <span className="w-4 flex-none" />}
    </>
  );
  return hasDetail || r.contract_id ? (
    <button type="button" onClick={onOpen} className="v2-row v2-row-link w-full items-start text-left">
      {body}
    </button>
  ) : (
    <div className="v2-row items-start">{body}</div>
  );
}

function AuditPeek({ r }: { r: AuditRow }) {
  const fields = auditFields(r.before, r.after);
  const danger = auditIsDestructive(r.action);
  const group = auditGroup(r.action);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[16px] font-semibold" style={danger ? { color: "var(--rd)" } : undefined}>{r.summary || r.action}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge tone={GROUP_TONE[group]}>{AUDIT_GROUP_LABEL[group]}</Badge>
          {danger ? <Badge tone="red" icon={ShieldAlert}>Làm mất dữ liệu</Badge> : null}
        </div>
      </div>
      <InfoList
        items={[
          { label: "Người thao tác", value: r.actor_name ?? "Khách / hệ thống" },
          { label: "Lúc", value: fmtDateTime(r.created_at) },
          ...(r.contract_id ? [{ label: "Hợp đồng", value: r.contract_label ?? "Hợp đồng đã xoá" }] : []),
        ]}
      />
      {fields.length ? (
        <div className="flex flex-col gap-2">
          <p className="v2-label">Thay đổi</p>
          <div className="v2-card overflow-hidden" style={{ boxShadow: "none" }}>
            {fields.map((f) => (
              <FieldRow key={f.label} f={f} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FieldRow({ f }: { f: AuditField }) {
  return (
    <div className="px-3.5 py-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
      <p className="text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>{f.label}</p>
      {f.lines ? (
        <ul className="mt-1 flex flex-col gap-0.5 text-[13.5px]">
          {f.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="min-w-0">
                {l.name}
                {l.qty !== "1" ? <span style={{ color: "var(--tx3)" }}> × {l.qty}</span> : null}
              </span>
              <span className="v2-num flex-none">{l.price}</span>
            </li>
          ))}
        </ul>
      ) : f.before !== undefined && f.after !== undefined ? (
        <p className="mt-0.5 break-words text-[13.5px]">
          <span style={{ color: "var(--tx3)", textDecoration: "line-through" }}>{f.before}</span>
          <span style={{ color: "var(--tx3)" }}> → </span>
          <span className="font-semibold">{f.after}</span>
        </p>
      ) : (
        <p className="mt-0.5 break-words text-[13.5px] font-semibold">{f.after ?? f.before}</p>
      )}
    </div>
  );
}
