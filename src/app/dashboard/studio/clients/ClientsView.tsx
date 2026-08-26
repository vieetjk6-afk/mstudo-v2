"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Download, FileSpreadsheet, HeartHandshake, Users, UserPlus } from "lucide-react";
import MessengerButton from "@/components/MessengerButton";
import { Panel, EmptyState } from "@/components/studio/ui";
import { avatarStyle, initials } from "@/lib/avatar";
import { vnd, vndShort, LEAD_SOURCE_LABEL } from "@/lib/types";
import { fmtDate } from "@/lib/date";
import {
  exportClients,
  clientsCsvRows,
  downloadCsv,
  stamp,
  type ClientExportRow,
  type ExportStudio,
} from "@/lib/studio-export";

export type ClientAgg = {
  key: string;
  name: string;
  phone: string;
  count: number;
  value: number;
  collected: number;
  last: string | null;
  source: string | null;
};

const digits = (s: string) => (s || "").replace(/\D/g, "");

/** Đường tới hồ sơ khách — dùng chung cho bảng (máy tính) và thẻ (điện thoại). */
const clientHref = (c: ClientAgg) => `/dashboard/studio/clients/${encodeURIComponent(digits(c.phone) || c.key)}`;
const sourceLabel = (c: ClientAgg) => (c.source ? LEAD_SOURCE_LABEL[c.source] || c.source : "Không rõ nguồn");
const lastLabel = (c: ClientAgg) => (c.last ? `gần nhất ${fmtDate(c.last)}` : "chưa có buổi nào");

/** Lưới cột bảng khách hàng — bản thiết kế: min-width 940px, cuộn ngang dưới 1240px. */
const COLS = "minmax(230px,2fr) minmax(96px,1fr) minmax(128px,1.1fr) minmax(120px,1.1fr) minmax(140px,1.2fr)";
const HEADS = ["Khách hàng", "Số job", "Tổng chi tiêu", "Còn nợ", "Nguồn / gần nhất"];

export default function ClientsView({ clients, studio }: { clients: ClientAgg[]; studio: ExportStudio }) {
  const [q, setQ] = useState("");
  const [onlyOld, setOnlyOld] = useState(false);
  const [sort, setSort] = useState<"recent" | "value" | "count">("recent");
  const [exporting, setExporting] = useState(false);

  // "Lâu chưa quay lại": lần chụp gần nhất đã quá 6 tháng.
  const cutoff = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  }, []);
  const isOld = (c: ClientAgg) => !!c.last && c.last < cutoff;
  const oldCount = clients.filter(isOld).length;

  /** Hai nhãn của một khách + nút mời lại — dùng chung cho bảng (máy tính) và
   *  thẻ (điện thoại), để hai cách trình bày không lệch nội dung. */
  const Tags = ({ c }: { c: ClientAgg }) => (
    <>
      {c.count > 1 && (
        <span className="flex-none rounded-[20px] px-[7px] py-0.5 text-[10px] font-bold" style={{ background: "var(--gnS)", color: "var(--gn)" }}>khách cũ</span>
      )}
      {isOld(c) && (
        <span className="flex-none rounded-[20px] px-[7px] py-0.5 text-[10px] font-bold" style={{ background: "var(--amS)", color: "var(--am)" }}>cần chăm sóc</span>
      )}
    </>
  );
  const InviteBack = ({ c }: { c: ClientAgg }) => (
    <MessengerButton
      label="Mời lại"
      message={`Xin chào ${c.name}, đã lâu chưa được phục vụ anh/chị. Studio đang có ưu đãi cho khách cũ, anh/chị có dịp nào muốn chụp lại không ạ? Cảm ơn anh/chị!`}
    />
  );

  const returning = clients.filter((c) => c.count > 1).length;
  const totalSpent = clients.reduce((s, c) => s + c.value, 0);
  const totalDebt = clients.reduce((s, c) => s + Math.max(0, c.value - c.collected), 0);
  const kpis = [
    { v: String(clients.length), l: "Khách đã từng chụp" },
    { v: clients.length ? `${Math.round((returning / clients.length) * 100)}%` : "0%", l: "Khách quay lại" },
    { v: clients.length ? vndShort(Math.round(totalSpent / clients.length)) : "0", l: "Giá trị trung bình / khách" },
    { v: vndShort(totalDebt), l: "Đang còn nợ" },
  ];

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = clients.filter((c) => {
      if (onlyOld && !isOld(c)) return false;
      if (!n) return true;
      return c.name.toLowerCase().includes(n) || c.phone.toLowerCase().includes(n);
    });
    const sorted = [...list];
    if (sort === "value") sorted.sort((a, b) => b.value - a.value);
    else if (sort === "count") sorted.sort((a, b) => b.count - a.count || b.value - a.value);
    else sorted.sort((a, b) => (b.last || "").localeCompare(a.last || ""));
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, q, onlyOld, cutoff, sort]);

  /** Dòng dữ liệu cho file xuất ra — đúng danh sách đang lọc/sắp xếp. */
  function exportRows(): ClientExportRow[] {
    return filtered.map((c) => ({
      name: c.name,
      phone: c.phone,
      jobs: c.count,
      value: c.value,
      collected: c.collected,
      last: c.last,
      source: c.source ? LEAD_SOURCE_LABEL[c.source] || c.source : "",
    }));
  }

  const exportMeta = () => [
    `Danh sách: ${onlyOld ? "khách lâu chưa quay lại" : "tất cả khách"}${q.trim() ? ` · từ khoá "${q.trim()}"` : ""} · ${filtered.length} khách`,
    `Ngày xuất: ${stamp()}`,
  ];

  async function exportExcel() {
    setExporting(true);
    try {
      await exportClients(studio, exportRows(), exportMeta(), "khach-hang");
    } finally {
      setExporting(false);
    }
  }

  function exportCsv() {
    downloadCsv(clientsCsvRows(studio, exportRows(), exportMeta()), "khach-hang");
  }

  const btn = "flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold";
  const btnStyle = { border: "1px solid var(--bd)", background: "var(--sf)" };

  if (clients.length === 0) {
    return (
      <div className="page-in">
        <Panel>
          <EmptyState
            icon={Users}
            title="Chưa có khách hàng nào"
            hint="Danh bạ tự sinh ra từ hợp đồng — tạo hợp đồng đầu tiên là khách xuất hiện ở đây."
          />
          <div className="pb-8 text-center">
            <Link
              href="/dashboard/studio/contracts/new"
              className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
              style={{ background: "var(--ac)", color: "#fff" }}
            >
              <UserPlus size={17} /> Tạo hợp đồng đầu tiên
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="page-in flex flex-col gap-3.5">
      {/* ── 4 thẻ số liệu ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4">
        {kpis.map((k) => (
          <Panel key={k.l} className="px-4 py-3.5">
            <p className="tnum text-[23px] font-bold leading-none" style={{ letterSpacing: "-.7px" }}>{k.v}</p>
            <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>{k.l}</p>
          </Panel>
        ))}
      </div>

      {/* ── Thanh công cụ ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tx3)" }} />
          <input className="input pl-9" placeholder="Tên hoặc số điện thoại…" aria-label="Tìm khách hàng" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select
          className="input w-auto flex-none py-2 text-[12.5px]"
          aria-label="Sắp xếp khách hàng"
          value={sort}
          onChange={(e) => setSort(e.target.value as "recent" | "value" | "count")}
        >
          <option value="recent">Gần đây nhất</option>
          <option value="value">Chi nhiều nhất</option>
          <option value="count">Nhiều hợp đồng nhất</option>
        </select>
        <button
          onClick={() => setOnlyOld((v) => !v)}
          className={btn}
          style={onlyOld ? { border: "1px solid var(--acM)", background: "var(--acS)", color: "var(--ac)" } : btnStyle}
        >
          <HeartHandshake size={15} /> Lâu chưa quay lại
          <span className="text-[11px] font-bold opacity-75">{oldCount}</span>
        </button>
        <button onClick={exportExcel} disabled={exporting} className={btn} style={{ ...btnStyle, opacity: exporting ? 0.6 : 1 }}>
          <FileSpreadsheet size={16} /> {exporting ? "Đang tạo…" : "Xuất Excel"}
        </button>
        <button onClick={exportCsv} className={btn} style={btnStyle} title="Bản CSV cho công cụ khác"><Download size={16} /> CSV</button>
      </div>

      {/* ── Danh sách khách hàng ──────────────────────────────────────────
          Hai cách trình bày cho hai khổ màn, KHÔNG phải một bảng cuộn ngang:
          bảng 940px trên điện thoại thì ba cột tiền (chi tiêu, công nợ, nguồn)
          khuất hẳn khỏi mép phải, mà cuộn ngang nằm trong một trang cuộn dọc
          thì vừa không có dấu hiệu gì báo, vừa khó vuốt trúng. Dưới sm dựng
          thành THẺ: mỗi khách một khối, mọi con số nhìn thấy hết. */}
      <Panel className="hidden sm:block sm:overflow-x-auto">
        <div
          className="grid gap-3.5 px-[18px] py-2.5"
          style={{ gridTemplateColumns: COLS, minWidth: 940, background: "var(--sf2)", borderBottom: "1px solid var(--bd)" }}
        >
          {HEADS.map((h) => (
            <span key={h} className="text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: ".7px", color: "var(--tx3)" }}>{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Search} title="Không tìm thấy khách phù hợp" hint="Thử bỏ bộ lọc “Lâu chưa quay lại” hoặc gõ ít chữ hơn." />
        ) : (
          filtered.map((c) => {
            const debt = Math.max(0, c.value - c.collected);
            return (
              <div
                key={c.key}
                className="nav-item grid items-center gap-3.5 px-[18px] py-3"
                style={{ gridTemplateColumns: COLS, minWidth: 940, borderBottom: "1px solid var(--bd2)" }}
              >
                <Link href={clientHref(c)} className="flex min-w-0 items-center gap-[11px]">
                  <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[11px] font-bold" style={avatarStyle(c.name)}>
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-[7px]">
                      <p className="truncate text-[13.5px] font-semibold">{c.name}</p>
                      <Tags c={c} />
                    </div>
                    <p className="mt-px truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{c.phone || "—"}</p>
                  </div>
                </Link>

                <span className="whitespace-nowrap text-[12.5px]" style={{ color: "var(--tx2)" }}>{c.count} hợp đồng</span>
                <span className="tnum whitespace-nowrap text-[13px] font-bold">{vnd(c.value)}</span>
                <span className="tnum whitespace-nowrap text-[13px] font-semibold" style={{ color: debt > 0 ? "var(--am)" : "var(--gn)" }}>
                  {debt > 0 ? vnd(debt) : "Đã thu đủ"}
                </span>

                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px]">{sourceLabel(c)}</p>
                    <p className="mt-px text-[11px]" style={{ color: "var(--tx3)" }}>{lastLabel(c)}</p>
                  </div>
                  {isOld(c) && c.phone && <InviteBack c={c} />}
                </div>
              </div>
            );
          })
        )}
      </Panel>

      {/* Điện thoại: mỗi khách một thẻ, không cuộn ngang. */}
      <div className="flex flex-col gap-2 sm:hidden">
        {filtered.length === 0 ? (
          <Panel>
            <EmptyState icon={Search} title="Không tìm thấy khách phù hợp" hint="Thử bỏ bộ lọc “Lâu chưa quay lại” hoặc gõ ít chữ hơn." />
          </Panel>
        ) : (
          filtered.map((c) => {
            const debt = Math.max(0, c.value - c.collected);
            return (
              <Panel key={c.key} className="p-3.5">
                <Link href={clientHref(c)} className="flex min-w-0 items-center gap-[11px]">
                  <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[11px] font-bold" style={avatarStyle(c.name)}>
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{c.name}</p>
                    <p className="mt-px truncate text-[12px]" style={{ color: "var(--tx3)" }}>{c.phone || "—"}</p>
                  </div>
                </Link>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Tags c={c} />
                  <span className="text-[12px]" style={{ color: "var(--tx2)" }}>{c.count} hợp đồng</span>
                </div>

                {/* Hai con số quan trọng nhất đứng cạnh nhau, không phải khuất
                    sau một cú vuốt ngang. */}
                <div className="mt-2.5 grid grid-cols-2 gap-px overflow-hidden rounded-[10px]" style={{ background: "var(--bd2)" }}>
                  <div className="px-3 py-2" style={{ background: "var(--sf2)" }}>
                    <p className="text-[10.5px] font-semibold uppercase" style={{ letterSpacing: ".6px", color: "var(--tx3)" }}>Tổng chi tiêu</p>
                    <p className="tnum mt-0.5 text-[14px] font-bold">{vnd(c.value)}</p>
                  </div>
                  <div className="px-3 py-2" style={{ background: "var(--sf2)" }}>
                    <p className="text-[10.5px] font-semibold uppercase" style={{ letterSpacing: ".6px", color: "var(--tx3)" }}>Còn nợ</p>
                    <p className="tnum mt-0.5 text-[14px] font-bold" style={{ color: debt > 0 ? "var(--am)" : "var(--gn)" }}>
                      {debt > 0 ? vnd(debt) : "Đã thu đủ"}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                    {sourceLabel(c)} · {lastLabel(c)}
                  </p>
                  {isOld(c) && c.phone && <InviteBack c={c} />}
                </div>
              </Panel>
            );
          })
        )}
      </div>

      <p className="px-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
        {filtered.length} khách · tổng chi tiêu {vnd(filtered.reduce((s, c) => s + c.value, 0))}
      </p>
    </div>
  );
}
