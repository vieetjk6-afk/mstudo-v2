"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Download, ReceiptText, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, EmptyState } from "@/components/studio/ui";
import { avatarColor, initials } from "@/lib/avatar";
import { vnd, CREW_ROLE_LABEL, CREW_STATUS_LABEL, type CrewRole, type CrewStatus } from "@/lib/types";
import { fmtDate } from "@/lib/date";

export type PayrollRow = {
  id: string;
  name: string;
  phone: string | null;
  role: CrewRole;
  salary: number;
  status: CrewStatus;
  paid: boolean;
  contract: { id: string; title: string; event_date: string | null; code?: string | null } | null;
};

function monthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [{ value: "all", label: "Tất cả thời gian" }];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value: v, label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}` });
  }
  return out;
}

export default function PayrollView({ rows }: { rows: PayrollRow[] }) {
  const supabase = createClient();
  const [month, setMonth] = useState("all");
  const [data, setData] = useState(rows);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // "person" = đối soát theo người (cuối kỳ), "job" = chốt ngay từng job.
  const [mode, setMode] = useState<"person" | "job">("person");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(
    () => (month === "all" ? data : data.filter((r) => (r.contract?.event_date || "").startsWith(month))),
    [data, month]
  );

  // Gom theo người (số điện thoại nếu có, không thì theo tên).
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; phone: string | null; rows: PayrollRow[] }>();
    for (const r of filtered) {
      const key = (r.phone && r.phone.replace(/\D/g, "")) || r.name || r.id;
      if (!map.has(key)) map.set(key, { key, name: r.name || r.phone || "—", phone: r.phone, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  // Gom theo job — nền của "chốt đối soát theo job": job xong là chốt tiền ngay,
  // không đợi cuối tháng.
  const jobs = useMemo(() => {
    const map = new Map<string, { key: string; title: string; code: string | null; date: string | null; rows: PayrollRow[] }>();
    for (const r of filtered) {
      const key = r.contract?.id || "none";
      if (!map.has(key)) {
        map.set(key, {
          key,
          title: r.contract?.title || "Không gắn hợp đồng",
          code: r.contract?.code ?? null,
          date: r.contract?.event_date ?? null,
          rows: [],
        });
      }
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [filtered]);

  const grandTotal = filtered.reduce((s, r) => s + (r.salary || 0), 0);
  const grandPaid = filtered.filter((r) => r.paid).reduce((s, r) => s + (r.salary || 0), 0);

  async function setPaid(ids: string[], next: boolean) {
    if (ids.length === 0) return;
    setBusy(ids.join(","));
    await supabase
      .from("contract_crew")
      .update({ paid: next, paid_at: next ? new Date().toISOString() : null })
      .in("id", ids);
    setData((p) => p.map((x) => (ids.includes(x.id) ? { ...x, paid: next } : x)));
    setBusy(null);
  }

  function exportCsv() {
    const out: string[][] = [["Nhân sự", "SĐT", "Vai trò", "Hợp đồng", "Ngày", "Tiền công", "Đã trả"]];
    for (const r of filtered) {
      out.push([
        r.name, r.phone || "", CREW_ROLE_LABEL[r.role], r.contract?.title || "",
        r.contract?.event_date || "", String(r.salary), r.paid ? "x" : "",
      ]);
    }
    const csv = "﻿" + out.map((x) => x.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `doi-soat-tien-cong-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const btn = "flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold";
  const btnStyle = { border: "1px solid var(--bd)", background: "var(--sf)" };

  return (
    <div className="page-in max-w-[980px]">
      <Panel className="overflow-hidden">
        {/* ── Đầu khối ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 px-[18px] py-4">
          <span className="flex-none rounded-[11px] p-2.5" style={{ background: "var(--acS)", color: "var(--ac)", lineHeight: 0 }}>
            <ReceiptText size={20} />
          </span>
          <div className="min-w-[180px] flex-1">
            <h1 className="text-[15px] font-bold">Đối soát tiền công</h1>
            <p className="mt-px text-[12px]" style={{ color: "var(--tx3)" }}>
              {filtered.length} lượt nhận job · {groups.length} nhân sự · tiền công tính theo vai trò trong từng hợp đồng
            </p>
          </div>
          <select
            className="input w-auto flex-none py-2 text-[12.5px]"
            aria-label="Chọn kỳ đối soát"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {monthOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={exportCsv} className={btn} style={btnStyle}><Download size={16} /> Xuất file</button>
        </div>

        {/* ── 3 ô tổng ──────────────────────────────────────────────────
            Trên điện thoại chia 3 cột thì mỗi cột còn ~120px, không đủ cho số
            tiền 8 chữ số ở cỡ 22px → số bị cắt mất phần đuôi, đúng chỗ quan
            trọng nhất của trang. Dưới 560px xếp 3 ô thành 3 hàng và hạ cỡ số. */}
        <div className="grid grid-cols-1 gap-px min-[560px]:grid-cols-3" style={{ background: "var(--bd2)", borderTop: "1px solid var(--bd2)", borderBottom: "1px solid var(--bd2)" }}>
          {[
            { l: "Tổng tiền công trong kỳ", v: vnd(grandTotal), c: "var(--ac)" },
            { l: "Đã trả", v: vnd(grandPaid), c: "var(--gn)" },
            { l: "Còn phải trả", v: vnd(grandTotal - grandPaid), c: "var(--am)" },
          ].map((x) => (
            <div key={x.l} className="flex items-baseline justify-between gap-3 px-[18px] py-3 min-[560px]:block min-[560px]:py-3.5" style={{ background: "var(--sf2)" }}>
              <p className="text-[11.5px] font-semibold" style={{ color: "var(--tx3)" }}>{x.l}</p>
              <p className="tnum text-[19px] font-bold min-[560px]:mt-1 min-[560px]:text-[22px]" style={{ letterSpacing: "-.6px", color: x.c }}>{x.v}</p>
            </div>
          ))}
        </div>

        {/* ── Chế độ xem ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2.5 px-[18px] py-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <div className="flex gap-[3px] rounded-[10px] p-[3px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
            {([["person", "Theo người"], ["job", "Theo job"]] as const).map(([key, label]) => {
              const on = mode === key;
              return (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className="whitespace-nowrap rounded-[7px] px-3.5 py-1.5 text-[12.5px] font-semibold"
                  style={{ color: on ? "var(--ac)" : "var(--tx2)", background: on ? "var(--sf)" : "transparent", boxShadow: on ? "0 1px 3px rgba(0,0,0,.10)" : "none" }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {mode === "job" && (
            <p className="text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
              Job xong là chốt tiền ngay, không đợi cuối tháng — bấm “Chốt job” để đánh dấu đã trả cho cả ê-kíp.
            </p>
          )}
        </div>

        {/* ── Theo người ──────────────────────────────────────────────── */}
        {mode === "person" && (
          groups.length === 0 ? (
            <EmptyState icon={Users} title="Chưa có tiền công nào trong kỳ này" hint="Phân công nhân sự cho hợp đồng, tiền công sẽ tự hiện ở đây." />
          ) : (
            groups.map((g) => {
              const tot = g.rows.reduce((s, r) => s + (r.salary || 0), 0);
              const paid = g.rows.filter((r) => r.paid).reduce((s, r) => s + (r.salary || 0), 0);
              const isOpen = open[g.key];
              const unpaidIds = g.rows.filter((r) => !r.paid).map((r) => r.id);
              return (
                <div key={g.key} style={{ borderBottom: "1px solid var(--bd2)" }}>
                  <div className="flex flex-wrap items-center gap-3 px-[18px] py-[13px]">
                    <button onClick={() => setOpen((p) => ({ ...p, [g.key]: !p[g.key] }))} className="flex min-w-[180px] flex-1 items-center gap-3 text-left">
                      {isOpen ? <ChevronDown size={16} style={{ flex: "none", color: "var(--tx3)" }} /> : <ChevronRight size={16} style={{ flex: "none", color: "var(--tx3)" }} />}
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: avatarColor(g.name) }}>
                        {initials(g.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold">{g.name}</span>
                        <span className="block text-[11.5px]" style={{ color: "var(--tx3)" }}>{g.phone || "—"} · {g.rows.length} buổi</span>
                      </span>
                    </button>
                    {/* Tiền + nút gom trong một khối: khi hàng xuống dòng trên
                        điện thoại thì cả hai cùng xuống và vẫn dính lề phải, thay
                        vì nút "Trả hết" rơi xuống một mình ở lề trái. */}
                    <div className="ml-auto flex items-center gap-3">
                      <div className="text-right">
                        <p className="tnum text-[15px] font-bold">{vnd(tot)}</p>
                        <span
                          className="mt-0.5 inline-block rounded-[20px] px-[9px] py-0.5 text-[10.5px] font-semibold"
                          style={paid >= tot ? { background: "var(--gnS)", color: "var(--gn)" } : { background: "var(--amS)", color: "var(--am)" }}
                        >
                          {paid >= tot ? "Đã trả đủ" : `Còn ${vnd(tot - paid)}`}
                        </span>
                      </div>
                      {unpaidIds.length > 0 && (
                        <button
                          onClick={() => setPaid(unpaidIds, true)}
                          disabled={busy !== null}
                          className="flex-none rounded-[9px] px-3.5 py-2 text-[12px] font-semibold"
                          style={{ background: "var(--ac)", color: "#fff", opacity: busy ? 0.6 : 1 }}
                        >
                          Trả hết
                        </button>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-[18px] pb-3" style={{ borderTop: "1px solid var(--bd2)" }}>
                      {g.rows.map((r) => (
                        <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13px]">
                          <div className="min-w-[160px] flex-1">
                            <Link href={`/dashboard/studio/contracts/${r.contract?.id}`} className="font-semibold hover:underline">
                              {r.contract?.title || "Hợp đồng"}
                            </Link>
                            <p className="text-[11px]" style={{ color: "var(--tx3)" }}>
                              {CREW_ROLE_LABEL[r.role]} · {r.contract?.event_date ? fmtDate(r.contract.event_date) : "chưa có ngày"} · {CREW_STATUS_LABEL[r.status]}
                            </p>
                          </div>
                          <span className="tnum font-semibold">{vnd(r.salary)}</span>
                          <button
                            onClick={() => setPaid([r.id], !r.paid)}
                            className="rounded-[8px] px-2.5 py-1 text-[11px] font-semibold"
                            style={r.paid ? { background: "var(--gnS)", color: "var(--gn)" } : { border: "1px solid var(--bd)", color: "var(--tx2)" }}
                          >
                            {r.paid ? "✓ Đã trả" : "Đánh dấu trả"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )
        )}

        {/* ── Theo job (chốt ngay từng job) ───────────────────────────── */}
        {mode === "job" && (
          jobs.length === 0 ? (
            <EmptyState icon={ReceiptText} title="Chưa có job nào cần đối soát" hint="Phân công nhân sự cho hợp đồng để chốt tiền công theo từng job." />
          ) : (
            jobs.map((j) => {
              const sum = j.rows.reduce((s, r) => s + (r.salary || 0), 0);
              const unpaid = j.rows.filter((r) => !r.paid);
              const done = unpaid.length === 0;
              return (
                <div key={j.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-[18px] py-[13px]" style={{ borderBottom: "1px solid var(--bd2)" }}>
                  <div className="min-w-[200px] flex-1">
                    <Link href={j.key === "none" ? "#" : `/dashboard/studio/contracts/${j.key}`} className="text-[13.5px] font-semibold hover:underline">
                      {j.title}
                    </Link>
                    <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>
                      {[j.code, j.date ? fmtDate(j.date) : null, `${j.rows.length} người`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-none">
                    {j.rows.slice(0, 4).map((p) => (
                      <span
                        key={p.id}
                        title={`${p.name} · ${CREW_ROLE_LABEL[p.role]} · ${vnd(p.salary)}`}
                        className="-ml-[7px] flex h-[26px] w-[26px] items-center justify-center rounded-full text-[9.5px] font-bold text-white first:ml-0"
                        style={{ background: avatarColor(p.name), border: "2px solid var(--sf)" }}
                      >
                        {initials(p.name)}
                      </span>
                    ))}
                  </div>
                  {/* Cũng gom tiền · trạng thái · nút vào một khối lề phải; ba
                      min-width rời nhau trước đây làm hàng vỡ thành ba dòng lệch
                      trên điện thoại. */}
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
                    <span className="tnum flex-none text-right text-[14px] font-bold">{vnd(sum)}</span>
                    <span
                      className="flex-none whitespace-nowrap rounded-[20px] px-[11px] py-1 text-center text-[11px] font-semibold"
                      style={done ? { background: "var(--gnS)", color: "var(--gn)" } : { background: "var(--amS)", color: "var(--am)" }}
                    >
                      {done ? "Đã chốt đủ" : `Còn ${vnd(unpaid.reduce((s, r) => s + r.salary, 0))}`}
                    </span>
                    {!done && (
                      <button
                        onClick={() => setPaid(unpaid.map((r) => r.id), true)}
                        disabled={busy !== null}
                        className="flex-none rounded-[9px] px-3.5 py-2 text-[12px] font-semibold"
                        style={{ background: "var(--ac)", color: "#fff", opacity: busy ? 0.6 : 1 }}
                      >
                        Chốt job
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )
        )}
      </Panel>
    </div>
  );
}
