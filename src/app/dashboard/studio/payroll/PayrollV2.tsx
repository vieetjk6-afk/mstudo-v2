"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase, Check, CheckCircle2, ChevronDown, ChevronRight, Clock, Download, FileSpreadsheet, Filter, ReceiptText, Users, Wallet,
} from "lucide-react";
import { digitsOnly, humanHours, suggestPay } from "@/lib/timesheet";
import { vnd, vndShort, CREW_STATUS_LABEL } from "@/lib/types";
import { crewRoleLabel } from "@/lib/crew-roles";
import { fmtDate } from "@/lib/date";
import { noAccent } from "@/lib/studio-nav";
import { Avatar, Badge, Empty, GroupLabel, InfoList, PageHead, Stack, Stat, StatGrid, Toolbar, btn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, SearchInput, Segmented } from "@/components/v2/kit-client";
import { monthOptions, usePayroll } from "./usePayroll";
import type { PayrollProps, PayrollRow } from "./PayrollView";

/* ═══════════════════════════════════════════════════════════════════════════
   ĐỐI SOÁT TIỀN CÔNG — giao diện mới. Cùng dữ liệu, cùng thao tác với
   PayrollView (bản cũ, logic chung ở ./usePayroll); khác ở cách sắp xếp:
     • Đầu trang: chọn kỳ + menu xuất file (Excel / CSV).
     • 4 số liệu: tổng tiền công · đã trả · còn phải trả · nhân sự.
     • Một danh sách: Theo người / Theo job, tìm, lọc còn nợ / đã trả đủ.
       Dòng còn phải trả nổi lên nhóm đầu. Nút "Trả hết" / "Chốt job" ngay
       trên dòng; bấm dòng mở ngăn kéo xem từng buổi và đánh dấu từng người.
   ═══════════════════════════════════════════════════════════════════════════ */

type Mode = "person" | "job";
type StatusFilter = "all" | "owing" | "settled";
type Bucket = { key: string; title: string; rows: PayrollRow[]; total: number; paid: number; search: string };

const sum = (rows: PayrollRow[]) => rows.reduce((s, r) => s + (r.salary || 0), 0);
const sumPaid = (rows: PayrollRow[]) => rows.filter((r) => r.paid).reduce((s, r) => s + (r.salary || 0), 0);

export default function PayrollV2(props: PayrollProps) {
  const { rates = {}, crewRoles = [] } = props;
  const {
    month, setMonth, filtered, declinedCount, groups, jobs, hoursByPhone,
    grandTotal, grandPaid, busy, setPaid, exporting, exportExcel, exportCsv,
  } = usePayroll(props);

  const [mode, setMode] = useState<Mode>("person");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [detail, setDetail] = useState<{ mode: Mode; key: string } | null>(null);

  const people: Bucket[] = useMemo(
    () =>
      groups.map((g) => ({
        key: g.key,
        title: g.name,
        rows: g.rows,
        total: sum(g.rows),
        paid: sumPaid(g.rows),
        search: `${g.name} ${g.phone ?? ""} ${g.rows.map((r) => `${r.contract?.title ?? ""} ${r.contract?.code ?? ""}`).join(" ")}`,
      })),
    [groups],
  );
  const jobBuckets: Bucket[] = useMemo(
    () =>
      jobs.map((j) => ({
        key: j.key,
        title: j.title,
        rows: j.rows,
        total: sum(j.rows),
        paid: sumPaid(j.rows),
        search: `${j.title} ${j.code ?? ""} ${j.rows.map((r) => r.name).join(" ")}`,
      })),
    [jobs],
  );
  const jobMeta = useMemo(() => Object.fromEntries(jobs.map((j) => [j.key, j])), [jobs]);
  const personMeta = useMemo(() => Object.fromEntries(groups.map((g) => [g.key, g])), [groups]);

  const list = mode === "person" ? people : jobBuckets;
  const shown = useMemo(() => {
    const needle = noAccent(q.trim());
    return list.filter((b) => {
      const settled = b.paid >= b.total;
      if (status === "owing" && settled) return false;
      if (status === "settled" && !settled) return false;
      if (needle && !noAccent(b.search).includes(needle)) return false;
      return true;
    });
  }, [list, q, status]);
  const owing = shown.filter((b) => b.paid < b.total);
  const settled = shown.filter((b) => b.paid >= b.total);
  const sections = [
    { key: "owing", label: mode === "person" ? "Còn phải trả" : "Chưa chốt", tone: "var(--am)", rows: owing },
    { key: "settled", label: mode === "person" ? "Đã trả đủ" : "Đã chốt đủ", tone: "var(--gn)", rows: settled },
  ].filter((s) => s.rows.length > 0);

  const owingPeople = people.filter((p) => p.paid < p.total).length;
  const totalHours = Object.values(hoursByPhone).reduce((s, t) => s + (t.hours || 0), 0);
  const paidPct = grandTotal > 0 ? Math.round((grandPaid / grandTotal) * 100) : 0;
  const periodLabel = monthOptions().find((m) => m.value === month)?.label ?? month;
  const filtering = !!q || status !== "all";

  /** Giờ chấm công của một người — chỉ khi studio có dùng chấm công. */
  function hoursInfo(phone: string | null) {
    const t = hoursByPhone[digitsOnly(phone ?? "")];
    if (!t || (t.hours <= 0 && t.openCount === 0 && t.problemCount === 0)) return null;
    return { t, sug: suggestPay(t.hours, rates[t.phone]) };
  }

  const detailBucket = detail ? (detail.mode === "person" ? people : jobBuckets).find((b) => b.key === detail.key) ?? null : null;

  return (
    <Stack>
      <PageHead
        desc="Tiền công tính theo vai trò trong từng hợp đồng. Đánh dấu đã trả thì khoản đó tự vào sổ chi."
        actions={
          <>
            <select aria-label="Chọn kỳ đối soát" className={inputCls} style={{ width: "auto" }} value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthOptions().map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Menu
              width={240}
              trigger={({ toggle, open }) => (
                <button type="button" onClick={toggle} aria-expanded={open} disabled={exporting} className={btn("secondary")}>
                  <Download size={16} /> {exporting ? "Đang tạo…" : "Xuất file"} <ChevronDown size={15} className="-mr-1 opacity-70" />
                </button>
              )}
              items={[
                { label: "Xuất Excel", hint: `Bảng đối soát · ${periodLabel}`, icon: FileSpreadsheet, onClick: () => void exportExcel() },
                { label: "Xuất CSV", hint: "Cho công cụ khác", icon: Download, onClick: exportCsv },
              ]}
            />
          </>
        }
      />

      <StatGrid>
        <Stat icon={ReceiptText} tone="brand" label="Tổng tiền công" value={vndShort(grandTotal)} sub={`${filtered.length} lượt nhận job · ${periodLabel.toLowerCase()}`} />
        <Stat icon={CheckCircle2} tone="green" label="Đã trả" value={vndShort(grandPaid)} sub={grandTotal > 0 ? `${paidPct}% tổng tiền công` : "Chưa có tiền công"} />
        <Stat
          icon={Wallet}
          tone="amber"
          label="Còn phải trả"
          value={vndShort(grandTotal - grandPaid)}
          valueTone={grandTotal - grandPaid > 0 ? "amber" : undefined}
          sub={owingPeople ? `${owingPeople} người chưa nhận đủ` : "Đã trả hết"}
        />
        <Stat
          icon={Users}
          tone="blue"
          label="Nhân sự"
          value={groups.length}
          sub={totalHours > 0 ? `Chấm công ${humanHours(totalHours)}` : `${jobs.length} job trong kỳ`}
        />
      </StatGrid>

      <section className="v2-card overflow-hidden">
        <header className="flex flex-col gap-3 px-5 pb-3 pt-4 max-sm:px-4">
          <Toolbar>
            <Segmented
              label="Cách xem"
              value={mode}
              onChange={(v) => {
                setMode(v);
                setDetail(null);
              }}
              options={[
                { value: "person", label: "Theo người", count: people.length },
                { value: "job", label: "Theo job", count: jobBuckets.length },
              ]}
            />
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder={mode === "person" ? "Tìm tên, số điện thoại, hợp đồng…" : "Tìm hợp đồng, mã, người làm…"}
              className="min-w-[200px] flex-1 max-sm:order-first max-sm:basis-full"
            />
            <select aria-label="Trạng thái trả" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="all">Mọi trạng thái</option>
              <option value="owing">{mode === "person" ? "Còn phải trả" : "Chưa chốt"}</option>
              <option value="settled">{mode === "person" ? "Đã trả đủ" : "Đã chốt đủ"}</option>
            </select>
          </Toolbar>
          {(mode === "job" || declinedCount > 0 || filtering) && (
            <p className="text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
              {mode === "job" ? "Job xong là chốt tiền ngay, không đợi cuối tháng: “Chốt job” đánh dấu đã trả cho cả ê-kíp. " : ""}
              {declinedCount > 0 ? `Không tính ${declinedCount} lượt phân công thợ đã từ chối. ` : ""}
              {filtering ? (
                <>
                  {shown.length} / {list.length} khớp bộ lọc ·{" "}
                  <button type="button" className="font-semibold" style={{ color: "var(--ac)" }} onClick={() => { setQ(""); setStatus("all"); }}>
                    Xoá lọc
                  </button>
                </>
              ) : null}
            </p>
          )}
        </header>

        <div style={{ borderTop: "1px solid var(--bd2)" }}>
          {list.length === 0 ? (
            mode === "person" ? (
              <Empty icon={Users} title="Chưa có tiền công nào trong kỳ này" hint="Phân công nhân sự cho hợp đồng, tiền công sẽ tự hiện ở đây." />
            ) : (
              <Empty icon={ReceiptText} title="Chưa có job nào cần đối soát" hint="Phân công nhân sự cho hợp đồng để chốt tiền công theo từng job." />
            )
          ) : shown.length === 0 ? (
            <Empty compact icon={Filter} title="Không có dòng nào khớp bộ lọc" hint="Thử bỏ bớt điều kiện lọc hoặc tìm bằng từ khác." />
          ) : (
            sections.map((sec) => (
              <div key={sec.key}>
                <div className="flex items-center gap-2 px-5 pb-2 pt-3 max-sm:px-4" style={{ background: "var(--sf2)", borderBottom: "1px solid var(--bd2)" }}>
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: sec.tone }} />
                  <GroupLabel count={`${sec.rows.length} ${mode === "person" ? "người" : "job"}`}>{sec.label}</GroupLabel>
                </div>
                {sec.rows.map((b) => {
                  const done = b.paid >= b.total;
                  const unpaidIds = b.rows.filter((r) => !r.paid).map((r) => r.id);
                  const person = mode === "person" ? personMeta[b.key] : null;
                  const job = mode === "job" ? jobMeta[b.key] : null;
                  const h = person ? hoursInfo(person.phone) : null;
                  return (
                    <div key={b.key} className="v2-row v2-row-link cursor-pointer" style={{ gap: 12 }} onClick={() => setDetail({ mode, key: b.key })}>
                      {person ? (
                        <Avatar name={b.title} size={38} />
                      ) : (
                        <DateChip date={job?.date ?? null} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="v2-row-title">{b.title}</p>
                        <p className="v2-row-sub">
                          {person
                            ? `${person.phone || "Chưa có SĐT"} · ${b.rows.length} buổi`
                            : [job?.code, job?.date ? fmtDate(job.date) : "Chưa có ngày", `${b.rows.length} người`].filter(Boolean).join(" · ")}
                        </p>
                        {h ? (
                          <p className="mt-1 flex flex-wrap items-center gap-1.5">
                            {h.t.hours > 0 ? <Badge tone="brand" icon={Clock}>Chấm công {humanHours(h.t.hours)} · {h.t.sessions} buổi</Badge> : null}
                            {h.sug !== null ? <span className="text-[12px]" style={{ color: "var(--tx3)" }}>≈ {vnd(h.sug)} theo giờ</span> : null}
                            {h.t.openCount + h.t.problemCount > 0 ? <Badge tone="amber">{h.t.openCount + h.t.problemCount} buổi chưa chốt giờ</Badge> : null}
                          </p>
                        ) : null}
                      </div>
                      {job ? (
                        <div className="hidden flex-none lg:flex" aria-hidden>
                          {b.rows.slice(0, 4).map((p, i) => (
                            <span key={p.id} className="rounded-full" style={{ marginLeft: i ? -8 : 0, boxShadow: "0 0 0 2px var(--sf)" }} title={p.name}>
                              <Avatar name={p.name} size={26} />
                            </span>
                          ))}
                          {b.rows.length > 4 ? (
                            <span className="v2-num -ml-2 flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-1 text-[11px] font-semibold" style={{ background: "var(--sf2)", color: "var(--tx2)", boxShadow: "0 0 0 2px var(--sf)" }}>
                              +{b.rows.length - 4}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="flex-none text-right">
                        <p className="v2-num text-[14.5px] font-semibold">{vnd(b.total)}</p>
                        <p className="v2-num mt-0.5 text-[12px] font-medium" style={{ color: done ? "var(--gn)" : "var(--am)" }}>
                          {done ? (mode === "person" ? "Đã trả đủ" : "Đã chốt đủ") : `Còn ${vnd(b.total - b.paid)}`}
                        </p>
                      </div>
                      <span className="hidden w-[92px] flex-none sm:block">
                        {!done ? (
                          <button
                            type="button"
                            className={btn("soft", "sm", "w-full")}
                            disabled={busy !== null}
                            onClick={(e) => {
                              e.stopPropagation();
                              void setPaid(unpaidIds, true);
                            }}
                          >
                            {mode === "person" ? "Trả hết" : "Chốt job"}
                          </button>
                        ) : null}
                      </span>
                      <ChevronRight size={16} className="flex-none" style={{ color: "var(--tx3)" }} />
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Ngăn kéo chi tiết: từng buổi, đánh dấu từng người ──────────── */}
      <Drawer
        open={!!detailBucket}
        onClose={() => setDetail(null)}
        title={detailBucket?.title ?? ""}
        desc={
          detailBucket
            ? detail?.mode === "person"
              ? `${personMeta[detailBucket.key]?.phone || "Chưa có SĐT"} · ${detailBucket.rows.length} buổi · ${periodLabel}`
              : [jobMeta[detailBucket.key]?.code, jobMeta[detailBucket.key]?.date ? fmtDate(jobMeta[detailBucket.key]!.date) : null, `${detailBucket.rows.length} người`].filter(Boolean).join(" · ")
            : undefined
        }
        width={480}
        footer={
          detailBucket ? (
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              {detail?.mode === "job" && detailBucket.key !== "none" ? (
                <Link href={`/dashboard/studio/contracts/${detailBucket.key}`} className={btn("secondary")}>
                  <Briefcase size={15} /> Mở hợp đồng
                </Link>
              ) : null}
              {detailBucket.paid < detailBucket.total ? (
                <button
                  type="button"
                  className={btn("primary")}
                  disabled={busy !== null}
                  onClick={() => void setPaid(detailBucket.rows.filter((r) => !r.paid).map((r) => r.id), true)}
                >
                  <Check size={16} /> {detail?.mode === "person" ? "Trả hết" : "Chốt job"} · {vnd(detailBucket.total - detailBucket.paid)}
                </button>
              ) : (
                <Badge tone="green" icon={CheckCircle2}>{detail?.mode === "person" ? "Đã trả đủ" : "Đã chốt đủ"}</Badge>
              )}
            </div>
          ) : null
        }
      >
        {detailBucket ? (
          <div className="flex flex-col gap-5">
            <InfoList
              items={[
                { label: "Tổng tiền công", value: <span className="v2-num font-semibold">{vnd(detailBucket.total)}</span> },
                { label: "Đã trả", value: <span className="v2-num" style={{ color: "var(--gn)" }}>{vnd(detailBucket.paid)}</span> },
                {
                  label: "Còn phải trả",
                  value: <span className="v2-num font-semibold" style={{ color: detailBucket.total > detailBucket.paid ? "var(--am)" : "var(--tx3)" }}>{vnd(detailBucket.total - detailBucket.paid)}</span>,
                },
                ...(() => {
                  const h = detail?.mode === "person" ? hoursInfo(personMeta[detailBucket.key]?.phone ?? null) : null;
                  if (!h) return [];
                  return [
                    {
                      label: "Chấm công",
                      value: (
                        <span className="text-right">
                          {h.t.hours > 0 ? `${humanHours(h.t.hours)} · ${h.t.sessions} buổi` : "Chưa có giờ"}
                          {h.sug !== null ? <span className="block text-[12px]" style={{ color: "var(--tx3)" }}>≈ {vnd(h.sug)} theo giờ</span> : null}
                          {h.t.openCount + h.t.problemCount > 0 ? (
                            <span className="block text-[12px]" style={{ color: "var(--am)" }}>{h.t.openCount + h.t.problemCount} buổi chưa chốt giờ</span>
                          ) : null}
                        </span>
                      ),
                    },
                  ];
                })(),
              ]}
            />

            <div className="flex flex-col">
              <p className="v2-label mb-1">{detail?.mode === "person" ? "Từng buổi" : "Ê-kíp"}</p>
              {detailBucket.rows.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
                  {detail?.mode === "job" ? <Avatar name={r.name} size={32} /> : null}
                  <div className="min-w-0 flex-1">
                    {detail?.mode === "person" ? (
                      r.contract ? (
                        <Link href={`/dashboard/studio/contracts/${r.contract.id}`} className="block truncate text-[13.5px] font-semibold hover:underline" title={r.contract.title}>
                          {r.contract.title}
                        </Link>
                      ) : (
                        <p className="truncate text-[13.5px] font-semibold">Hợp đồng</p>
                      )
                    ) : (
                      <p className="truncate text-[13.5px] font-semibold">{r.name}</p>
                    )}
                    <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>
                      {crewRoleLabel(r.role, crewRoles)}
                      {detail?.mode === "person" ? ` · ${r.contract?.event_date ? fmtDate(r.contract.event_date) : "chưa có ngày"}` : r.phone ? ` · ${r.phone}` : ""}
                      {` · ${CREW_STATUS_LABEL[r.status]}`}
                    </p>
                  </div>
                  <span className="v2-num flex-none text-[13.5px] font-semibold">{vnd(r.salary)}</span>
                  <button
                    type="button"
                    onClick={() => void setPaid([r.id], !r.paid)}
                    disabled={busy !== null}
                    className={btn(r.paid ? "ghost" : "secondary", "sm", "w-[104px] flex-none")}
                    style={r.paid ? { color: "var(--gn)", background: "var(--gnS)" } : undefined}
                    title={r.paid ? "Bấm để bỏ đánh dấu đã trả" : undefined}
                  >
                    {r.paid ? <><Check size={14} /> Đã trả</> : "Đánh dấu trả"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Drawer>
    </Stack>
  );
}

/** Ô ngày nhỏ đầu dòng job: "12 / T9". */
function DateChip({ date }: { date: string | null }) {
  const d = date ? date.slice(0, 10).split("-") : null;
  return (
    <span
      className="flex h-[38px] w-[38px] flex-none flex-col items-center justify-center rounded-[10px] leading-none"
      style={{ background: "var(--acS)", color: "var(--ac)" }}
      aria-hidden
    >
      {d ? (
        <>
          <span className="v2-num text-[14px] font-bold">{d[2]}</span>
          <span className="mt-0.5 text-[10px] font-semibold">T{Number(d[1])}</span>
        </>
      ) : (
        <Briefcase size={16} />
      )}
    </span>
  );
}
