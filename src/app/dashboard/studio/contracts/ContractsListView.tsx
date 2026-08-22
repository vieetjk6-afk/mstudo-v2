"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Download, FileSpreadsheet, SlidersHorizontal, X, UserPlus, CalendarDays, Clock, FileText } from "lucide-react";
import { useCachedJson } from "@/lib/client-cache";
import { Panel, EmptyState } from "@/components/studio/ui";
import { avatarColor, avatarStyle, initials } from "@/lib/avatar";
import {
  contractTotal,
  sumAmounts,
  vnd,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_TONE,
  SHOOT_TYPE_LABEL,
  type ContractStatus,
  type ShootType,
} from "@/lib/types";
import { fmtDate, fmtDow } from "@/lib/date";
import { filterContracts, sortContracts, type ContractSort } from "@/lib/contract-filter";
import {
  exportContracts,
  contractsCsvRows,
  downloadCsv,
  stamp,
  type ContractExportRow,
  type ExportStudio,
} from "@/lib/studio-export";

export type ContractRow = {
  id: string;
  code: string | null;
  title: string;
  client_name: string | null;
  client_phone: string | null;
  event_date: string | null;
  event_time: string | null;
  status: ContractStatus;
  shoot_type: ShootType;
  contract_items: { qty: number; unit_price: number; name?: string | null }[];
  contract_payments: { amount: number }[];
  contract_crew: { id: string; name: string | null; role: string; status: string }[];
};

/** Nhãn sắp xếp — nói rõ chiều để không phải đoán "gần nhất" là trước hay sau. */
const SORT_OPTIONS: [ContractSort, string][] = [
  ["default", "Mới tạo trước"],
  ["event_asc", "Ngày thực hiện: cũ → mới"],
  ["event_desc", "Ngày thực hiện: mới → cũ"],
  ["code_asc", "Mã HĐ: A → Z"],
  ["code_desc", "Mã HĐ: Z → A"],
];

/** 5 tab theo bản thiết kế — lọc thẳng theo trạng thái, không gộp nhóm. */
const TABS: [string, string][] = [
  ["all", "Tất cả"],
  ["sent", "Chờ duyệt"],
  ["approved", "Đã duyệt"],
  ["in_progress", "Đang chụp"],
  ["completed", "Hoàn thành"],
];

/** Lưới cột của bảng — mọi cột là minmax(px, fr) nên không cột nào co vỡ chữ. */
const COLS = "minmax(240px,2.5fr) minmax(130px,1.25fr) minmax(96px,.95fr) minmax(112px,1.05fr) minmax(136px,1.25fr) minmax(140px,1.15fr)";
const HEADS = ["Khách / Tên job", "Dịch vụ", "Nhân sự", "Lịch chụp", "Thanh toán", "Trạng thái"];

export default function ContractsListView({
  studio,
  branchKey = "",
}: {
  studio: ExportStudio;
  /**
   * Chi nhánh đang xem, đưa vào KHOÁ CACHE. Danh sách này cache trên máy theo
   * kiểu stale-while-revalidate: nếu khoá không mang chi nhánh thì đổi chi nhánh
   * sẽ hiện lại danh sách của cơ sở TRƯỚC trong lúc chờ tải ngầm — dữ liệu sai
   * cơ sở, mà lại trông như đã tải xong.
   */
  branchKey?: string;
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [code, setCode] = useState("");
  // Khoảng NGÀY THỰC HIỆN (event_date). Cột kiểu date → "YYYY-MM-DD", so sánh
  // chuỗi là đúng thứ tự nên không cần parse ra Date.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<ContractSort>("default");
  const [exporting, setExporting] = useState(false);

  // Tải danh sách + cache trên máy: hiện tức thì bản đã lưu, làm mới ngầm.
  const { data, loading, fromCache } = useCachedJson<{ list: ContractRow[] }>(
    branchKey ? `contracts-list:${branchKey}` : "contracts-list",
    "/api/studio/contracts-list",
    { list: [] }
  );
  const rows = data.list;
  // Lần đầu chưa có cache và đang tải → hiện trạng thái tải thay vì "chưa có HĐ".
  const initialLoading = loading && !fromCache && rows.length === 0;

  // Lọc chung (tìm kiếm + mã + khoảng ngày) TRƯỚC khi chia tab, để số đếm trên
  // từng tab phản ánh đúng bộ lọc đang bật. Logic ở @/lib/contract-filter.
  const matched = useMemo(() => filterContracts(rows, { q, code, from, to }), [rows, q, code, from, to]);
  const countOf = (key: string) => (key === "all" ? matched.length : matched.filter((c) => c.status === key).length);

  const filtered = useMemo(
    () => sortContracts(tab === "all" ? matched : matched.filter((c) => c.status === tab), sort),
    [matched, tab, sort]
  );

  const filterCount = (q.trim() ? 1 : 0) + (code.trim() ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0);

  function clearFilters() {
    setQ("");
    setCode("");
    setFrom("");
    setTo("");
  }

  /**
   * Dòng dữ liệu cho file xuất ra — đúng danh sách ĐANG THẤY (tab + bộ lọc +
   * thứ tự sắp xếp), để file khớp với màn hình chứ không phải toàn bộ hợp đồng.
   */
  function exportRows(): ContractExportRow[] {
    return filtered.map((c) => {
      const total = contractTotal(c.contract_items || []);
      const collected = sumAmounts(c.contract_payments || []);
      return {
        code: c.code || "",
        title: c.title,
        client: c.client_name || "",
        phone: c.client_phone || "",
        service: SHOOT_TYPE_LABEL[c.shoot_type],
        eventDate: c.event_date,
        eventTime: c.event_time,
        status: CONTRACT_STATUS_LABEL[c.status],
        crew: (c.contract_crew || []).map((m) => m.name).filter(Boolean).join(", "),
        total,
        collected,
        balance: total - collected,
      };
    });
  }

  /** Mô tả bộ lọc đang bật — in ở đầu file để biết file này là của kỳ/lát cắt nào. */
  function exportMeta(): string[] {
    const tabLabel = TABS.find(([k]) => k === tab)?.[1] || "Tất cả";
    const bits = [
      q.trim() && `từ khoá "${q.trim()}"`,
      code.trim() && `mã "${code.trim()}"`,
      from && `từ ngày ${from}`,
      to && `đến ngày ${to}`,
    ].filter(Boolean);
    return [
      `Danh sách: ${tabLabel} · ${filtered.length} hợp đồng${bits.length ? ` · lọc theo ${bits.join(", ")}` : ""}`,
      `Ngày xuất: ${stamp()}`,
    ];
  }

  async function exportExcel() {
    setExporting(true);
    try {
      await exportContracts(studio, exportRows(), exportMeta(), `hop-dong-${tab}`);
    } finally {
      setExporting(false);
    }
  }

  function exportCsv() {
    downloadCsv(contractsCsvRows(studio, exportRows(), exportMeta()), `hop-dong-${tab}`);
  }

  const btn = "flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold";
  const btnStyle = { border: "1px solid var(--bd)", background: "var(--sf)" };

  return (
    <div className="page-in">
      {/* ── Tab trạng thái + hành động ─────────────────────────────────── */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        {/* hscroll: 5 tab không vừa bề ngang điện thoại. Trước đây chúng xuống
            hàng thứ hai, đội cả trang xuống; giờ giữ một hàng và lướt ngang. */}
        <div role="tablist" aria-label="Lọc theo trạng thái" className="hscroll min-w-0 max-w-full gap-[3px] rounded-[11px] p-[3px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
          {TABS.map(([key, label]) => {
            const on = tab === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(key)}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-[8px] px-[13px] py-[6.5px] text-[12.5px] font-semibold"
                style={{
                  color: on ? "var(--ac)" : "var(--tx2)",
                  background: on ? "var(--sf)" : "transparent",
                  boxShadow: on ? "0 1px 3px rgba(0,0,0,.10)" : "none",
                }}
              >
                {label}
                <span className="text-[11px] font-bold opacity-75">{countOf(key)}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={() => setShowFilters((v) => !v)} className={btn} style={btnStyle} aria-expanded={showFilters}>
            <SlidersHorizontal size={16} /> Bộ lọc
            {filterCount > 0 && (
              <span className="rounded-full px-1.5 text-[10px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>{filterCount}</span>
            )}
          </button>
          <button onClick={exportExcel} disabled={exporting} className={btn} style={{ ...btnStyle, opacity: exporting ? 0.6 : 1 }}>
            <FileSpreadsheet size={16} /> {exporting ? "Đang tạo…" : "Xuất Excel"}
          </button>
          <button onClick={exportCsv} className={btn} style={btnStyle} title="Bản CSV cho công cụ khác"><Download size={16} /> CSV</button>
          <Link
            href="/dashboard/studio/contracts/new"
            className="flex flex-none items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            <Plus size={16} /> Hợp đồng mới
          </Link>
        </div>
      </div>

      {/* ── Bộ lọc ─────────────────────────────────────────────────────── */}
      {showFilters && (
        <Panel className="mb-3.5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="f-q">Tìm kiếm</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tx3)" }} />
              <input
                id="f-q"
                className="input pl-9"
                placeholder="Tên HĐ, khách, ngày thực hiện, mã, SĐT…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="f-code">Mã hợp đồng</label>
            <input id="f-code" className="input" placeholder="Nhập mã…" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-sort">Sắp xếp</label>
            <select id="f-sort" className="input" value={sort} onChange={(e) => setSort(e.target.value as ContractSort)}>
              {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-from">Ngày thực hiện từ</label>
            <input id="f-from" type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-to">Đến ngày</label>
            <input id="f-to" type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          {filterCount > 0 && (
            <button onClick={clearFilters} className={`${btn} justify-self-start`} style={btnStyle}>
              <X size={14} /> Xoá bộ lọc
            </button>
          )}
        </Panel>
      )}

      {/* ── Bảng hợp đồng ──────────────────────────────────────────────
          Thẻ bao PHẢI overflow-x:auto: bảng rộng tối thiểu 1120px, dưới
          1240px là cuộn ngang chứ không được cắt mất cột. */}
      <Panel className="hidden overflow-x-auto min-[900px]:block">
        <div
          className="grid gap-3.5 px-[18px] py-2.5"
          style={{ gridTemplateColumns: COLS, minWidth: 1120, background: "var(--sf2)", borderBottom: "1px solid var(--bd)" }}
        >
          {HEADS.map((h) => (
            <span key={h} className="text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: ".7px", color: "var(--tx3)" }}>{h}</span>
          ))}
        </div>

        {initialLoading ? (
          <div className="px-5 py-14 text-center text-[13px]" style={{ color: "var(--tx3)" }}>Đang tải hợp đồng…</div>
        ) : filtered.length === 0 ? (
          rows.length === 0 ? (
            <EmptyState icon={FileText} title="Chưa có hợp đồng nào" hint="Tạo hợp đồng đầu tiên để theo dõi lịch chụp, nhân sự và thanh toán." />
          ) : (
            <EmptyState icon={Search} title="Không có hợp đồng nào khớp" hint="Thử bỏ bớt bộ lọc hoặc chuyển sang tab khác." />
          )
        ) : (
          filtered.map((c) => {
            const total = contractTotal(c.contract_items || []);
            const collected = sumAmounts(c.contract_payments || []);
            const pct = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;
            const payTone = collected >= total && total > 0 ? "var(--gn)" : collected > 0 ? "var(--ac)" : "var(--am)";
            const payLabel = total > 0 && collected >= total ? "Đã thanh toán đủ" : collected > 0 ? `Đã trả ${vnd(collected)}` : "Chưa thanh toán";
            const crew = (c.contract_crew || []).filter((x) => x.status !== "declined");
            const svc = c.contract_items?.[0]?.name?.trim();
            const st = CONTRACT_STATUS_TONE[c.status];
            return (
              <Link
                key={c.id}
                href={`/dashboard/studio/contracts/${c.id}`}
                className="nav-item grid items-center gap-3.5 px-[18px] py-[13px]"
                style={{ gridTemplateColumns: COLS, minWidth: 1120, borderBottom: "1px solid var(--bd2)" }}
              >
                {/* Khách / tên job */}
                <div className="flex min-w-0 items-center gap-[11px]">
                  <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[11px] font-bold" style={avatarStyle(c.client_name || c.title)}>
                    {initials(c.client_name || c.title)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold">{c.title}</p>
                    <p className="mt-px truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                      {[c.code, c.client_name, c.client_phone].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </div>

                {/* Dịch vụ */}
                <div className="min-w-0">
                  <div className="flex items-center gap-[7px]">
                    <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: svc ? "var(--ac)" : "var(--bl)" }} />
                    <span className="truncate text-[12.5px] font-medium">{svc || SHOOT_TYPE_LABEL[c.shoot_type]}</span>
                  </div>
                  <p className="ml-[13px] mt-px text-[11px]" style={{ color: "var(--tx3)" }}>
                    {svc ? SHOOT_TYPE_LABEL[c.shoot_type] : "Chưa có hạng mục"}
                  </p>
                </div>

                {/* Nhân sự — chồng avatar, chưa ai thì nút "Phân công" viền đứt */}
                <div>
                  {crew.length > 0 ? (
                    <div className="flex">
                      {crew.slice(0, 3).map((p) => (
                        <span
                          key={p.id}
                          title={p.name || ""}
                          className="-ml-[7px] flex h-[26px] w-[26px] items-center justify-center rounded-full text-[9.5px] font-bold text-white first:ml-0"
                          style={{ background: avatarColor(p.name), border: "2px solid var(--sf)" }}
                        >
                          {initials(p.name)}
                        </span>
                      ))}
                      {crew.length > 3 && (
                        <span className="-ml-[7px] flex h-[26px] w-[26px] items-center justify-center rounded-full text-[9.5px] font-bold" style={{ background: "var(--sf2)", color: "var(--tx2)", border: "2px solid var(--sf)" }}>
                          +{crew.length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-[20px] px-[9px] py-1 text-[11px] font-semibold"
                      style={{ border: "1px dashed var(--am)", color: "var(--am)", background: "var(--amS)" }}
                    >
                      <UserPlus size={13} /> Phân công
                    </span>
                  )}
                </div>

                {/* Lịch chụp */}
                <div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold">
                    <CalendarDays size={14} style={{ flex: "none", color: "var(--tx3)" }} />
                    {c.event_date ? `${fmtDow(c.event_date)} · ${fmtDate(c.event_date)}` : "Chưa có ngày"}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11.5px]" style={{ color: "var(--tx3)" }}>
                    <Clock size={13} style={{ flex: "none" }} />
                    {c.event_time || "Chưa có giờ"}
                  </div>
                </div>

                {/* Thanh toán */}
                <div>
                  <p className="tnum whitespace-nowrap text-[13.5px] font-bold" style={{ letterSpacing: "-.2px" }}>{vnd(total)}</p>
                  <div className="my-[5px] h-[3px] overflow-hidden rounded-[3px]" style={{ background: "var(--bd2)" }}>
                    <div className="h-full rounded-[3px]" style={{ width: `${pct}%`, background: payTone }} />
                  </div>
                  <p className="text-[11px] font-semibold" style={{ color: payTone }}>{payLabel}</p>
                </div>

                {/* Trạng thái */}
                <div>
                  <span
                    className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[20px] px-[11px] py-[5px] text-[11.5px] font-semibold"
                    style={{ background: st.bg, color: st.fg }}
                  >
                    <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: st.fg }} />
                    {CONTRACT_STATUS_LABEL[c.status]}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </Panel>

      {/* Điện thoại: bảng → THẺ (bản thiết kế: "không thu nhỏ bảng"). */}
      <div className="flex flex-col gap-2 min-[900px]:hidden">
        {initialLoading ? (
          <Panel><div className="px-5 py-10 text-center text-[13px]" style={{ color: "var(--tx3)" }}>Đang tải hợp đồng…</div></Panel>
        ) : filtered.length === 0 ? (
          <Panel>
            {rows.length === 0 ? (
              <EmptyState icon={FileText} title="Chưa có hợp đồng nào" hint="Tạo hợp đồng đầu tiên để theo dõi lịch chụp, nhân sự và thanh toán." />
            ) : (
              <EmptyState icon={Search} title="Không có hợp đồng nào khớp" hint="Thử bỏ bớt bộ lọc hoặc chuyển sang tab khác." />
            )}
          </Panel>
        ) : (
          filtered.map((c) => {
            const total = contractTotal(c.contract_items || []);
            const collected = sumAmounts(c.contract_payments || []);
            const pct = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;
            const payTone = collected >= total && total > 0 ? "var(--gn)" : collected > 0 ? "var(--ac)" : "var(--am)";
            const crew = (c.contract_crew || []).filter((x) => x.status !== "declined");
            const st = CONTRACT_STATUS_TONE[c.status];
            return (
              <Link key={c.id} href={`/dashboard/studio/contracts/${c.id}`} className="block">
                <Panel className="flex flex-col gap-2.5 px-4 py-3.5" >
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[11px] font-bold" style={avatarStyle(c.client_name || c.title)}>
                      {initials(c.client_name || c.title)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold">{c.title}</p>
                      <p className="mt-px truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                        {[c.code, c.client_name].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <span
                      className="flex-none whitespace-nowrap rounded-[20px] px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: st.bg, color: st.fg }}
                    >
                      {CONTRACT_STATUS_LABEL[c.status]}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]" style={{ color: "var(--tx2)" }}>
                    <span className="flex items-center gap-1.5 whitespace-nowrap font-semibold">
                      <CalendarDays size={13} style={{ color: "var(--tx3)" }} />
                      {c.event_date ? `${fmtDow(c.event_date)} · ${fmtDate(c.event_date)}` : "Chưa có ngày"}
                    </span>
                    {c.event_time && (
                      <span className="flex items-center gap-1.5 whitespace-nowrap"><Clock size={13} style={{ color: "var(--tx3)" }} />{c.event_time}</span>
                    )}
                    {crew.length === 0 ? (
                      <span className="whitespace-nowrap rounded-[20px] px-2 py-0.5 text-[10.5px] font-semibold" style={{ border: "1px dashed var(--am)", color: "var(--am)" }}>
                        Chưa phân công
                      </span>
                    ) : (
                      <span className="flex">
                        {crew.slice(0, 3).map((p) => (
                          <span key={p.id} className="-ml-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[9px] font-bold text-white first:ml-0" style={{ background: avatarColor(p.name), border: "2px solid var(--sf)" }}>
                            {initials(p.name)}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="tnum text-[14px] font-bold">{vnd(total)}</span>
                      <span className="text-[11px] font-semibold" style={{ color: payTone }}>
                        {total > 0 && collected >= total ? "Đã thanh toán đủ" : collected > 0 ? `Đã trả ${vnd(collected)}` : "Chưa thanh toán"}
                      </span>
                    </div>
                    <div className="mt-1.5 h-[3px] overflow-hidden rounded-[3px]" style={{ background: "var(--bd2)" }}>
                      <div className="h-full rounded-[3px]" style={{ width: `${pct}%`, background: payTone }} />
                    </div>
                  </div>
                </Panel>
              </Link>
            );
          })
        )}
      </div>

      {filtered.length > 0 && (
        <p className="mt-2.5 px-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
          {filtered.length} hợp đồng · tổng {vnd(filtered.reduce((s, c) => s + contractTotal(c.contract_items || []), 0))}
          {" · "}đã thu {vnd(filtered.reduce((s, c) => s + sumAmounts(c.contract_payments || []), 0))}
        </p>
      )}
    </div>
  );
}
