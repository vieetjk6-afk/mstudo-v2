"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Download,
  FileSpreadsheet,
  SlidersHorizontal,
  UserPlus,
  CalendarDays,
  CalendarClock,
  Clock,
  FileText,
  Search,
  Briefcase,
  Wallet,
  FileSignature,
  Eye,
  Send,
  Phone,
  ArrowRight,
  Users,
  ListChecks,
} from "lucide-react";
import { vnd, vndShort, CONTRACT_STATUS_LABEL, SHOOT_TYPE_LABEL, type ContractStatus } from "@/lib/types";
import { daysFromToday, fmtDate, fmtDayMonth, fmtDow, todayVN } from "@/lib/date";
import { addDaysIso, filterContracts, sortContracts, upcomingContracts, UPCOMING_DAYS, type ContractSort } from "@/lib/contract-filter";
import { contractKind, CONTRACT_KIND_LABEL, type ContractKind } from "@/lib/contract-kind";
import { crewRoleLabel } from "@/lib/crew-roles";
import { exportContracts, contractsCsvRows, downloadCsv, type ExportStudio } from "@/lib/studio-export";
import {
  Avatar,
  Badge,
  Callout,
  Empty,
  Field,
  GroupLabel,
  InfoList,
  PageHead,
  Progress,
  Stack,
  Stat,
  StatGrid,
  Toolbar,
  btn,
  iconBtn,
  inputCls,
  type Tone,
} from "@/components/v2/kit";
import { Drawer, Menu, SearchInput, Segmented, type MenuItem } from "@/components/v2/kit-client";
import type { ContractRow } from "./ContractsListView";
import { NGHE, SORT_OPTIONS, contractExportMeta, contractExportRows, contractMoney } from "./contracts-list-shared";

/* ═══════════════════════════════════════════════════════════════════════════
   HỢP ĐỒNG & LỊCH HẸN — giao diện mới. Cùng dữ liệu, cùng thao tác với
   ContractsList (bản cũ); khác ở cách sắp xếp:
     • 4 số liệu đầu trang: đang làm · sắp chụp 7 ngày · còn phải thu · chờ
       duyệt (bấm vào là lọc ngay).
     • Một thanh lọc: tìm · nhóm trạng thái · nghề · sắp xếp. Lọc hiếm dùng (mã,
       trạng thái chi tiết, người làm, khoảng ngày) nằm trong ngăn kéo "Bộ lọc".
     • Danh sách nhóm theo LỊCH CHỤP: 7 ngày tới → đang hậu kỳ → sắp tới →
       chưa có ngày → đã chụp → đã huỷ. Ở nhóm "Sắp chụp" thì nhóm theo từng ngày.
     • Bấm một dòng mở ngăn xem nhanh (khách, lịch, tiền, nhân sự, hạng mục)
       kèm nút "Mở hợp đồng"; menu ⋯ đi thẳng tới tab Thanh toán / Nhân sự / Ký.
   ═══════════════════════════════════════════════════════════════════════════ */

type Props = {
  rows: ContractRow[];
  initialLoading?: boolean;
  studio: ExportStudio;
};

type View = "all" | "upcoming" | "sent" | "active" | "post" | "completed";
/** "schedule" = nhóm theo lịch chụp (mặc định của giao diện mới). */
type Sort = "schedule" | ContractSort;

const ACTIVE = new Set<ContractStatus>(["approved", "in_progress", "post_production"]);

const VIEWS: [View, string][] = [
  ["all", "Tất cả"],
  ["upcoming", "Sắp chụp"],
  ["sent", "Chờ duyệt"],
  ["active", "Đang làm"],
  ["post", "Đang hậu kỳ"],
  ["completed", "Hoàn thành"],
];

/** Nhãn ngắn cho ô chọn trong thanh lọc (cùng các kiểu sắp xếp của bản cũ). */
const SORT_SHORT: Partial<Record<ContractSort, string>> = {
  event_asc: "Ngày chụp: cũ → mới",
  event_desc: "Ngày chụp: mới → cũ",
};
const SORTS: [Sort, string][] = [["schedule", "Theo lịch chụp"], ...SORT_OPTIONS.map(([k, l]): [Sort, string] => [k, SORT_SHORT[k] ?? l])];

const STATUS_TONE: Record<ContractStatus, Tone> = {
  draft: "gray",
  sent: "amber",
  approved: "blue",
  in_progress: "teal",
  post_production: "violet",
  completed: "green",
  cancelled: "red",
};

const CREW_STATUS: Record<string, [string, Tone]> = {
  accepted: ["Đã nhận", "green"],
  pending: ["Chờ xác nhận", "amber"],
  declined: ["Từ chối", "red"],
};

/** Ô chọn "người làm": mọi người / chưa phân công / từng tên. */
const CREW_ALL = "";
const CREW_NONE = "__none__";

/** Hợp đồng có thuộc nhóm trạng thái `v` không ("upcoming" lọc riêng theo ngày). */
const inView = (c: ContractRow, v: View) =>
  v === "all" || v === "upcoming"
    ? true
    : v === "sent"
      ? c.status === "sent"
      : v === "active"
        ? ACTIVE.has(c.status)
        : v === "post"
          ? c.status === "post_production"
          : c.status === "completed";

const href = (id: string, tab?: string) => `/dashboard/studio/contracts/${id}${tab ? `?tab=${tab}` : ""}`;

/** Tên cho avatar chữ cái — bỏ ngoặc, dấu câu để không ra "P(". */
const avatarName = (c: ContractRow) => (c.client_name || c.title).replace(/[^\p{L}\p{N}\s]/gu, " ");

/** Thợ còn tham gia (bỏ người đã từ chối) — cùng luật với bản cũ. */
const liveCrew = (c: ContractRow) => (c.contract_crew || []).filter((x) => x.status !== "declined");

/** Ngày gần → xa, cùng ngày thì theo giờ (thiếu giờ xuống cuối ngày), rồi theo mã. */
function bySchedule(a: ContractRow, b: ContractRow) {
  const da = a.event_date || "";
  const db = b.event_date || "";
  if (da !== db) return da < db ? -1 : 1;
  const ta = a.event_time || "99:99";
  const tb = b.event_time || "99:99";
  if (ta !== tb) return ta < tb ? -1 : 1;
  return (a.code || a.title).localeCompare(b.code || b.title, "vi", { numeric: true });
}

/** "Hôm nay" / "Ngày mai" / "Còn 5 ngày" / "3 ngày trước" — null nếu không có ngày. */
function relDay(iso: string | null): { text: string; tone: Tone } | null {
  if (!iso) return null;
  const d = daysFromToday(iso);
  if (d === null) return null;
  if (d === 0) return { text: "Hôm nay", tone: "red" };
  if (d === 1) return { text: "Ngày mai", tone: "amber" };
  if (d > 1 && d <= UPCOMING_DAYS) return { text: `Còn ${d} ngày`, tone: "amber" };
  if (d > UPCOMING_DAYS) return { text: `Còn ${d} ngày`, tone: "gray" };
  return { text: `${-d} ngày trước`, tone: "gray" };
}

function dayLabel(iso: string) {
  const d = daysFromToday(iso);
  const base = `${fmtDow(iso)} · ${fmtDayMonth(iso)}`;
  return d === 0 ? `Hôm nay · ${base}` : d === 1 ? `Ngày mai · ${base}` : base;
}

/** Tình trạng tiền của một hợp đồng, nói bằng chữ. */
function payState(c: ContractRow): { total: number; collected: number; pct: number; label: string; tone: Tone } {
  const m = contractMoney(c);
  if (m.total <= 0) return { ...m, label: m.collected > 0 ? `Đã thu ${vndShort(m.collected)}` : "Chưa có giá", tone: "gray" };
  if (m.collected >= m.total) return { ...m, label: "Đã thu đủ", tone: "green" };
  if (m.collected > 0) return { ...m, label: `Còn ${vndShort(m.total - m.collected)}`, tone: "amber" };
  return { ...m, label: "Chưa thu", tone: "amber" };
}

type Group = { key: string; label: string; dot: string; rows: ContractRow[] };

export default function ContractsListV2({ rows, initialLoading = false, studio }: Props) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("all");
  const [nghe, setNghe] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("schedule");
  // Lọc hiếm dùng — trong ngăn kéo "Bộ lọc".
  const [code, setCode] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<"" | ContractStatus>("");
  const [crewF, setCrewF] = useState(CREW_ALL);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Hôm nay theo giờ VN, chốt một lần lúc mở màn (xem ghi chú ở bản cũ).
  const today = useMemo(() => todayVN(), []);
  const soonEnd = useMemo(() => addDaysIso(today, UPCOMING_DAYS), [today]);

  /* ── Số liệu đầu trang: tính trên TOÀN BỘ hợp đồng, không theo bộ lọc ── */
  const stats = useMemo(() => {
    const live = rows.filter((c) => c.status !== "cancelled");
    let remain = 0;
    let collected = 0;
    for (const c of live) {
      const m = contractMoney(c);
      remain += Math.max(0, m.total - m.collected);
      collected += m.collected;
    }
    const up = upcomingContracts(rows, today);
    return {
      active: rows.filter((c) => ACTIVE.has(c.status)).length,
      shooting: rows.filter((c) => c.status === "in_progress").length,
      post: rows.filter((c) => c.status === "post_production").length,
      upcoming: up.length,
      next: up[0] ?? null,
      remain,
      collected,
      sent: rows.filter((c) => c.status === "sent").length,
      draft: rows.filter((c) => c.status === "draft").length,
    };
  }, [rows, today]);

  /* Dải nghề chỉ có nghĩa khi dữ liệu có từ hai nghề trở lên. */
  const ngheCoMat = useMemo(() => new Set(rows.map((c) => contractKind(c.shoot_type))), [rows]);
  const crewNames = useMemo(() => {
    const s = new Set<string>();
    for (const c of rows) for (const m of liveCrew(c)) if (m.name?.trim()) s.add(m.name.trim());
    return [...s].sort((a, b) => a.localeCompare(b, "vi"));
  }, [rows]);

  // Lọc chung TRƯỚC khi chia nhóm trạng thái, để số đếm trên từng nhóm đúng
  // với bộ lọc đang bật (cùng thứ tự với bản cũ: tìm/mã/ngày → nghề → nhóm).
  const matched = useMemo(() => {
    let list = filterContracts(rows, { q, code, from, to });
    if (nghe !== "all") list = list.filter((c) => contractKind(c.shoot_type) === (nghe as ContractKind));
    if (status) list = list.filter((c) => c.status === status);
    if (crewF === CREW_NONE) list = list.filter((c) => liveCrew(c).length === 0);
    else if (crewF) list = list.filter((c) => liveCrew(c).some((m) => m.name?.trim() === crewF));
    return list;
  }, [rows, q, code, from, to, nghe, status, crewF]);

  const upcoming = useMemo(() => upcomingContracts(matched, today), [matched, today]);

  const countOf = (v: View) => (v === "upcoming" ? upcoming.length : matched.filter((c) => inView(c, v)).length);

  const groups: Group[] = useMemo(() => {
    const list = view === "upcoming" ? upcoming : matched.filter((c) => inView(c, view));
    if (sort !== "schedule") {
      const label = SORT_OPTIONS.find(([k]) => k === sort)?.[1] ?? "";
      return list.length ? [{ key: "sorted", label, dot: "var(--ac)", rows: sortContracts(list, sort) }] : [];
    }
    if (view === "upcoming") {
      // Nhóm theo từng ngày — câu hỏi "mai chụp gì" trả lời bằng một cái liếc.
      const byDay = new Map<string, ContractRow[]>();
      for (const c of list) byDay.set(c.event_date as string, [...(byDay.get(c.event_date as string) ?? []), c]);
      return [...byDay].map(([d, r]) => ({
        key: d,
        label: dayLabel(d),
        dot: d === today ? "var(--rd)" : "var(--am)",
        rows: r,
      }));
    }
    const soon: ContractRow[] = [];
    const later: ContractRow[] = [];
    const none: ContractRow[] = [];
    const past: ContractRow[] = [];
    const post: ContractRow[] = [];
    const cancelled: ContractRow[] = [];
    for (const c of list) {
      if (c.status === "cancelled") cancelled.push(c);
      // Đang hậu kỳ (đã chụp xong) tách riêng lên trên — để chung "Đã chụp" thì
      // chìm xuống cuối danh sách, khó tìm.
      else if (c.status === "post_production" && (!c.event_date || c.event_date < today)) post.push(c);
      else if (!c.event_date) none.push(c);
      else if (c.event_date < today) past.push(c);
      else if (!soonEnd || c.event_date <= soonEnd) soon.push(c);
      else later.push(c);
    }
    const out: Group[] = [
      { key: "soon", label: `${UPCOMING_DAYS} ngày tới`, dot: "var(--am)", rows: soon.sort(bySchedule) },
      { key: "post", label: "Đang hậu kỳ", dot: "var(--pu)", rows: post.sort(bySchedule) },
      { key: "later", label: "Lịch sắp tới", dot: "var(--ac)", rows: later.sort(bySchedule) },
      { key: "none", label: "Chưa có ngày chụp", dot: "var(--tx3)", rows: none },
      { key: "past", label: "Đã chụp", dot: "var(--gn)", rows: past.sort((a, b) => bySchedule(b, a)) },
      { key: "cancelled", label: "Đã huỷ", dot: "var(--rd)", rows: cancelled },
    ];
    return out.filter((g) => g.rows.length > 0);
  }, [matched, upcoming, view, sort, today, soonEnd]);

  const visible = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  const drawerFilterCount = (code.trim() ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0) + (status ? 1 : 0) + (crewF ? 1 : 0);
  const filtering = !!q.trim() || nghe !== "all" || drawerFilterCount > 0;

  function clearFilters() {
    setQ("");
    setNghe("all");
    setCode("");
    setFrom("");
    setTo("");
    setStatus("");
    setCrewF(CREW_ALL);
  }

  /* ── Xuất file: đúng danh sách đang thấy, theo đúng thứ tự trên màn ── */
  function exportMeta() {
    const viewLabel = VIEWS.find(([k]) => k === view)?.[1] ?? "Tất cả";
    const label = view === "upcoming" ? `Sắp tới · ${UPCOMING_DAYS} ngày` : viewLabel;
    const ngheLabel = nghe === "all" ? "" : ` · ${NGHE.find(([k]) => k === nghe)?.[1] ?? ""}`;
    const extra = [
      status && `trạng thái "${CONTRACT_STATUS_LABEL[status]}"`,
      crewF === CREW_NONE ? "chưa phân công" : crewF && `người làm "${crewF}"`,
    ].filter(Boolean) as string[];
    return contractExportMeta(`${label}${ngheLabel}`, visible.length, { q, code, from, to }, extra);
  }
  async function exportExcel() {
    setExporting(true);
    try {
      await exportContracts(studio, contractExportRows(visible), exportMeta(), `hop-dong-${view}`);
    } finally {
      setExporting(false);
    }
  }
  function exportCsv() {
    downloadCsv(contractsCsvRows(studio, contractExportRows(visible), exportMeta()), `hop-dong-${view}`);
  }

  const peek = peekId ? (rows.find((c) => c.id === peekId) ?? null) : null;

  const rowMenu = (c: ContractRow): MenuItem[] => [
    { label: "Xem nhanh", icon: Eye, onClick: () => setPeekId(c.id) },
    { label: "Mở hợp đồng", icon: FileText, href: href(c.id) },
    "divider",
    { label: "Thanh toán", icon: Wallet, href: href(c.id, "pay") },
    { label: "Phân công nhân sự", icon: UserPlus, href: href(c.id, "crew") },
    { label: "Ký và gửi khách", icon: Send, href: href(c.id, "send") },
  ];

  const totalLine = (() => {
    if (!visible.length) return null;
    const live = visible.filter((c) => c.status !== "cancelled");
    const cancelled = visible.length - live.length;
    // Tiền chỉ cộng hợp đồng còn sống; "đã thu" vẫn tính cả đơn huỷ (tiền đã
    // vào tài khoản) — cùng luật với dòng tổng của bản cũ.
    return `${visible.length} hợp đồng · tổng ${vnd(live.reduce((s, c) => s + contractMoney(c).total, 0))} · đã thu ${vnd(
      visible.reduce((s, c) => s + contractMoney(c).collected, 0),
    )}${cancelled > 0 ? ` · không tính ${cancelled} hợp đồng đã huỷ` : ""}`;
  })();

  const statBtn = "block w-full rounded-[16px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac)]";

  return (
    <Stack>
      <PageHead
        desc="Lịch chụp, nhân sự và tiền thu của từng hợp đồng, xếp theo ngày chụp."
        actions={
          <>
            <Menu
              label="Xuất danh sách"
              width={240}
              items={[
                {
                  label: exporting ? "Đang tạo file…" : "Xuất Excel",
                  hint: "Đúng danh sách đang xem",
                  icon: FileSpreadsheet,
                  onClick: exportExcel,
                  disabled: exporting,
                },
                { label: "Xuất CSV", hint: "Cho công cụ khác", icon: Download, onClick: exportCsv },
              ]}
            />
            <Link href="/dashboard/studio/contracts/new" className={btn("primary")}>
              <Plus size={17} /> Hợp đồng mới
            </Link>
          </>
        }
      />

      <StatGrid>
        <button type="button" className={statBtn} onClick={() => setView("active")} aria-label="Xem hợp đồng đang làm">
          <Stat
            icon={Briefcase}
            tone="teal"
            label="Đang làm"
            value={stats.active}
            sub={stats.shooting || stats.post ? `${stats.shooting} đang chụp · ${stats.post} hậu kỳ` : "Đã duyệt, chưa xong"}
          />
        </button>
        <button type="button" className={statBtn} onClick={() => setView("upcoming")} aria-label="Xem lịch chụp 7 ngày tới">
          <Stat
            icon={CalendarClock}
            tone="blue"
            label={`Sắp chụp · ${UPCOMING_DAYS} ngày`}
            value={stats.upcoming}
            sub={
              stats.next?.event_date
                ? `Gần nhất: ${dayLabel(stats.next.event_date).split(" · ")[0]}${stats.next.event_time ? ` ${stats.next.event_time}` : ""}`
                : "Lịch trống"
            }
          />
        </button>
        <Stat
          icon={Wallet}
          tone="green"
          label="Còn phải thu"
          value={vndShort(stats.remain)}
          valueTone={stats.remain > 0 ? "amber" : undefined}
          sub={`Đã thu ${vndShort(stats.collected)}`}
        />
        <button type="button" className={statBtn} onClick={() => setView("sent")} aria-label="Xem hợp đồng chờ khách duyệt">
          <Stat
            icon={FileSignature}
            tone="amber"
            label="Chờ khách duyệt"
            value={stats.sent}
            valueTone={stats.sent ? "amber" : undefined}
            sub={stats.draft ? `${stats.draft} bản nháp chưa gửi` : "Không có bản nháp"}
          />
        </button>
      </StatGrid>

      <div className="v2-card v2-card-pad flex flex-col gap-3">
        <Toolbar>
          <div className="min-w-[240px] flex-[1_1_240px]">
            <SearchInput value={q} onChange={setQ} placeholder="Tìm tên, khách, mã, SĐT, ngày…" className="w-full" />
          </div>
          {ngheCoMat.size > 1 && (
            <select aria-label="Nghề" className={inputCls} value={nghe} onChange={(e) => setNghe(e.target.value)}>
              {NGHE.filter(([k]) => k === "all" || k === nghe || ngheCoMat.has(k as ContractKind)).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          )}
          <select aria-label="Sắp xếp" className={inputCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {SORTS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button type="button" className={btn("secondary")} onClick={() => setFiltersOpen(true)} aria-label="Bộ lọc khác">
            <SlidersHorizontal size={16} /> Bộ lọc
            {drawerFilterCount > 0 && (
              <span className="rounded-full px-1.5 text-[11px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                {drawerFilterCount}
              </span>
            )}
          </button>
          {/* Nhóm trạng thái đứng riêng một hàng: là bộ lọc dùng nhiều nhất. */}
          <div className="w-full min-w-0">
            <Segmented
              label="Nhóm hợp đồng"
              value={view}
              onChange={setView}
              options={VIEWS.map(([v, l]) => ({ value: v, label: l, count: countOf(v) }))}
            />
          </div>
        </Toolbar>
        {filtering ? (
          <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
            {matched.length} / {rows.length} hợp đồng khớp bộ lọc ·{" "}
            <button type="button" className="font-semibold" style={{ color: "var(--ac)" }} onClick={clearFilters}>
              Xoá lọc
            </button>
          </p>
        ) : null}
      </div>

      {initialLoading ? (
        <div className="v2-card">
          <Empty compact icon={Clock} title="Đang tải hợp đồng…" />
        </div>
      ) : groups.length === 0 ? (
        <div className="v2-card">
          {rows.length === 0 ? (
            <Empty
              icon={FileText}
              title="Chưa có hợp đồng nào"
              hint="Tạo hợp đồng đầu tiên để theo dõi lịch chụp, nhân sự và thanh toán."
              action={
                <Link href="/dashboard/studio/contracts/new" className={btn("primary")}>
                  <Plus size={17} /> Tạo hợp đồng
                </Link>
              }
            />
          ) : view === "upcoming" ? (
            <Empty
              compact
              icon={CalendarClock}
              title={`Không có buổi chụp nào trong ${UPCOMING_DAYS} ngày tới`}
              hint="Lịch trống, hoặc buổi chụp nằm xa hơn. Xem ở nhóm Tất cả."
            />
          ) : (
            <Empty compact icon={Search} title="Không có hợp đồng nào khớp" hint="Thử bỏ bớt bộ lọc hoặc chọn nhóm khác." />
          )}
        </div>
      ) : (
        <div className="v2-card overflow-hidden">
          <ContractTable groups={groups} onPeek={setPeekId} menu={rowMenu} />
          <ContractCards groups={groups} onPeek={setPeekId} menu={rowMenu} />
          {totalLine && (
            <p
              className="px-4 py-3 text-[12.5px] sm:px-5"
              style={{ color: "var(--tx3)", borderTop: "1px solid var(--bd)", background: "var(--sf2)" }}
            >
              {totalLine}
            </p>
          )}
        </div>
      )}

      {/* ── Ngăn kéo: bộ lọc hiếm dùng ── */}
      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Bộ lọc"
        desc="Áp ngay khi chọn"
        width={420}
        footer={
          <div className="flex w-full items-center gap-2">
            <button type="button" className={btn("ghost")} onClick={clearFilters} disabled={!filtering}>
              Xoá lọc
            </button>
            <button type="button" className={btn("primary", "md", "ml-auto")} onClick={() => setFiltersOpen(false)}>
              Xem {matched.length} hợp đồng
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Mã hợp đồng" htmlFor="cf-code">
            <input id="cf-code" className={inputCls} placeholder="Nhập mã…" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="Trạng thái chi tiết" htmlFor="cf-status">
            <select id="cf-status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as "" | ContractStatus)}>
              <option value="">Mọi trạng thái</option>
              {(Object.keys(CONTRACT_STATUS_LABEL) as ContractStatus[]).map((k) => (
                <option key={k} value={k}>
                  {CONTRACT_STATUS_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Người làm" htmlFor="cf-crew" hint="Thợ đã từ chối không tính.">
            <select id="cf-crew" className={inputCls} value={crewF} onChange={(e) => setCrewF(e.target.value)}>
              <option value={CREW_ALL}>Mọi người</option>
              <option value={CREW_NONE}>Chưa phân công</option>
              {crewNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ngày chụp từ" htmlFor="cf-from">
              <input
                id="cf-from"
                type="date"
                className={inputCls}
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="Đến ngày" htmlFor="cf-to">
              <input
                id="cf-to"
                type="date"
                className={inputCls}
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Drawer>

      <ContractPeek c={peek} onClose={() => setPeekId(null)} />
    </Stack>
  );
}

/* ── Ô dùng chung giữa bảng và thẻ ─────────────────────────────────────── */
function CrewStack({ c, size = 26 }: { c: ContractRow; size?: number }) {
  const crew = liveCrew(c);
  if (crew.length === 0)
    return (
      <Badge tone="amber" icon={UserPlus}>
        Chưa phân công
      </Badge>
    );
  return (
    <span
      className="flex items-center"
      title={crew
        .map((p) => p.name)
        .filter(Boolean)
        .join(", ")}
    >
      {crew.slice(0, 3).map((p, i) => (
        <span key={p.id} className="flex-none rounded-full" style={{ marginLeft: i ? -7 : 0, boxShadow: "0 0 0 2px var(--sf)" }}>
          <Avatar name={p.name || "?"} size={size} />
        </span>
      ))}
      {crew.length > 3 && (
        <span
          className="flex flex-none items-center justify-center rounded-full text-[10.5px] font-semibold"
          style={{
            width: size,
            height: size,
            marginLeft: -7,
            background: "var(--sf2)",
            color: "var(--tx2)",
            boxShadow: "0 0 0 2px var(--sf)",
          }}
        >
          +{crew.length - 3}
        </span>
      )}
    </span>
  );
}

function PayCell({ c }: { c: ContractRow }) {
  const p = payState(c);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="v2-num text-[13.5px] font-semibold">{p.total > 0 ? vndShort(p.total) : "—"}</span>
        <span
          className="truncate text-[12px] font-semibold"
          style={{ color: `var(--${{ green: "gn", amber: "am", gray: "tx3" }[p.tone as "green" | "amber" | "gray"]})` }}
        >
          {p.label}
        </span>
      </div>
      <div className="mt-1.5">
        <Progress value={p.pct} tone={p.tone === "green" ? "green" : "brand"} />
      </div>
    </div>
  );
}

/** Nhãn nhóm nằm TRONG danh sách: chấm màu + tên nhóm + số dòng. */
function GroupHead({ g }: { g: Group }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: g.dot }} />
      <GroupLabel count={`${g.rows.length} hợp đồng`}>{g.label}</GroupLabel>
    </div>
  );
}

/* ── Bảng (máy tính) ────────────────────────────────────────────────────── */
function ContractTable({ groups, onPeek, menu }: { groups: Group[]; onPeek: (id: string) => void; menu: (c: ContractRow) => MenuItem[] }) {
  return (
    <div className="v2-table-wrap hidden lg:block">
      <table className="v2-table" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th>Khách · hợp đồng</th>
            <th style={{ width: 142 }}>Lịch chụp</th>
            <th className="hidden xl:table-cell" style={{ width: 150 }}>
              Dịch vụ
            </th>
            <th className="hidden xl:table-cell" style={{ width: 136 }}>
              Nhân sự
            </th>
            <th style={{ width: 176 }}>Thanh toán</th>
            <th style={{ width: 150 }}>Trạng thái</th>
            <th style={{ width: 56 }} aria-label="Thao tác" />
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key}>
            <tr className="v2-grouprow">
              <td colSpan={7} style={{ background: "var(--sf2)", padding: "8px 16px" }}>
                <GroupHead g={g} />
              </td>
            </tr>
            {g.rows.map((c) => {
              const rel = relDay(c.event_date);
              const svc = c.contract_items?.[0]?.name?.trim();
              return (
                <tr key={c.id} className="cursor-pointer" onClick={() => onPeek(c.id)}>
                  <td>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={avatarName(c)} size={36} />
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="block max-w-full truncate text-left text-[14px] font-semibold"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPeek(c.id);
                          }}
                          title={c.title}
                        >
                          {c.title}
                        </button>
                        <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                          {[c.code, c.client_name].filter(Boolean).join(" · ") || "Chưa có thông tin khách"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    {c.event_date ? (
                      <>
                        <p className="whitespace-nowrap text-[13.5px] font-semibold">
                          {fmtDow(c.event_date)} · {fmtDate(c.event_date)}
                        </p>
                        <p
                          className="whitespace-nowrap text-[12px]"
                          style={{ color: rel && rel.tone !== "gray" ? `var(--${rel.tone === "red" ? "rd" : "am"})` : "var(--tx3)" }}
                        >
                          {[c.event_time, rel?.text].filter(Boolean).join(" · ")}
                        </p>
                      </>
                    ) : (
                      <span className="text-[13px]" style={{ color: "var(--tx3)" }}>
                        Chưa có ngày
                      </span>
                    )}
                  </td>
                  <td className="hidden xl:table-cell">
                    <p className="truncate text-[13.5px]">{svc || SHOOT_TYPE_LABEL[c.shoot_type]}</p>
                    <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>
                      {svc ? SHOOT_TYPE_LABEL[c.shoot_type] : "Chưa có hạng mục"}
                    </p>
                  </td>
                  <td className="hidden xl:table-cell">
                    <CrewStack c={c} />
                  </td>
                  <td>
                    <PayCell c={c} />
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[c.status]} dot>
                      {CONTRACT_STATUS_LABEL[c.status]}
                    </Badge>
                  </td>
                  <td onClick={(e) => e.stopPropagation()} className="text-right">
                    <Menu items={menu(c)} label={`Thao tác cho ${c.title}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/* ── Thẻ gọn (điện thoại, máy tính bảng) ────────────────────────────────── */
function ContractCards({ groups, onPeek, menu }: { groups: Group[]; onPeek: (id: string) => void; menu: (c: ContractRow) => MenuItem[] }) {
  return (
    <div className="lg:hidden">
      {groups.map((g) => (
        <ul key={g.key}>
          <li className="px-4 py-2" style={{ background: "var(--sf2)", borderBottom: "1px solid var(--bd2)" }}>
            <GroupHead g={g} />
          </li>
          {g.rows.map((c) => {
            const rel = relDay(c.event_date);
            const p = payState(c);
            const crew = liveCrew(c);
            return (
              <li key={c.id} className="relative flex gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                {/* Lớp bấm phủ cả thẻ → mở xem nhanh; menu ⋯ nằm trên lớp này. */}
                <button type="button" className="absolute inset-0" aria-label={`Xem nhanh ${c.title}`} onClick={() => onPeek(c.id)} />
                <Avatar name={avatarName(c)} size={40} />
                <div className="pointer-events-none min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-semibold">{c.title}</p>
                      <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                        {[c.code, c.client_name].filter(Boolean).join(" · ") || "Chưa có thông tin khách"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                    <Badge tone={STATUS_TONE[c.status]} dot>
                      {CONTRACT_STATUS_LABEL[c.status]}
                    </Badge>
                    <span className="flex items-center gap-1.5 whitespace-nowrap font-medium">
                      <CalendarDays size={14} style={{ color: "var(--tx3)" }} />
                      {c.event_date
                        ? `${fmtDow(c.event_date)} · ${fmtDayMonth(c.event_date)}${c.event_time ? ` · ${c.event_time}` : ""}`
                        : "Chưa có ngày"}
                    </span>
                    {rel && rel.tone !== "gray" && (
                      <span className="whitespace-nowrap font-semibold" style={{ color: `var(--${rel.tone === "red" ? "rd" : "am"})` }}>
                        {rel.text}
                      </span>
                    )}
                    {crew.length === 0 && c.status !== "cancelled" && c.status !== "completed" && (
                      <span className="flex items-center gap-1 whitespace-nowrap font-semibold" style={{ color: "var(--am)" }}>
                        <UserPlus size={13} /> Chưa phân công
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Progress value={p.pct} tone={p.tone === "green" ? "green" : "brand"} />
                    </div>
                    <span className="v2-num whitespace-nowrap text-[12.5px] font-semibold">{p.total > 0 ? vndShort(p.total) : "—"}</span>
                    <span
                      className="whitespace-nowrap text-[12px] font-semibold"
                      style={{ color: `var(--${{ green: "gn", amber: "am", gray: "tx3" }[p.tone as "green" | "amber" | "gray"]})` }}
                    >
                      {p.label}
                    </span>
                  </div>
                </div>
                <div className="relative -mr-1.5 -mt-1 flex-none self-start">
                  <Menu items={menu(c)} label={`Thao tác cho ${c.title}`} />
                </div>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}

/* ── Ngăn xem nhanh một hợp đồng ────────────────────────────────────────── */
function ContractPeek({ c, onClose }: { c: ContractRow | null; onClose: () => void }) {
  if (!c)
    return (
      <Drawer open={false} onClose={onClose} title="">
        {null}
      </Drawer>
    );
  const p = payState(c);
  const rel = relDay(c.event_date);
  const crew = c.contract_crew || [];
  const items = c.contract_items || [];
  const kind = contractKind(c.shoot_type);
  return (
    <Drawer
      open
      onClose={onClose}
      title={c.title}
      desc={[c.code ? `Mã ${c.code}` : "Chưa có mã", CONTRACT_KIND_LABEL[kind]].join(" · ")}
      width={460}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <Link href={href(c.id, "pay")} className={btn("secondary")}>
            <Wallet size={16} /> Thanh toán
          </Link>
          <Link href={href(c.id)} className={btn("primary", "md", "ml-auto")}>
            Mở hợp đồng <ArrowRight size={16} />
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Khách */}
        <div className="flex items-center gap-3">
          <Avatar name={avatarName(c)} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{c.client_name || "Chưa có tên khách"}</p>
            <p className="truncate text-[13px]" style={{ color: "var(--tx3)" }}>
              {c.client_phone || "Chưa có số điện thoại"}
            </p>
          </div>
          {c.client_phone ? (
            <a href={`tel:${c.client_phone}`} className={iconBtn()} aria-label="Gọi khách" title="Gọi khách">
              <Phone size={17} />
            </a>
          ) : null}
          <Badge tone={STATUS_TONE[c.status]} dot>
            {CONTRACT_STATUS_LABEL[c.status]}
          </Badge>
        </div>

        <InfoList
          items={[
            { label: "Dịch vụ", value: SHOOT_TYPE_LABEL[c.shoot_type] },
            {
              label: "Ngày chụp",
              value: c.event_date
                ? `${fmtDow(c.event_date)} · ${fmtDate(c.event_date)}${c.event_time ? ` · ${c.event_time}` : ""}`
                : "Chưa có ngày",
            },
            ...(rel
              ? [
                  {
                    label: "Còn bao lâu",
                    value: (
                      <span style={{ color: rel.tone === "gray" ? undefined : `var(--${rel.tone === "red" ? "rd" : "am"})` }}>
                        {rel.text}
                      </span>
                    ),
                  },
                ]
              : []),
          ]}
        />

        {/* Tiền */}
        <div className="v2-card v2-card-pad flex flex-col gap-2.5" style={{ boxShadow: "none", background: "var(--sf2)" }}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-semibold" style={{ color: "var(--tx2)" }}>
              Thanh toán
            </p>
            <p
              className="text-[12.5px] font-semibold"
              style={{ color: `var(--${{ green: "gn", amber: "am", gray: "tx3" }[p.tone as "green" | "amber" | "gray"]})` }}
            >
              {p.label}
            </p>
          </div>
          <Progress value={p.pct} tone={p.tone === "green" ? "green" : "brand"} />
          <div className="grid grid-cols-3 gap-2 text-[12px]" style={{ color: "var(--tx3)" }}>
            <div>
              Tổng
              <p className="v2-num text-[14px] font-semibold" style={{ color: "var(--tx)" }}>
                {vnd(p.total)}
              </p>
            </div>
            <div>
              Đã thu
              <p className="v2-num text-[14px] font-semibold" style={{ color: "var(--gn)" }}>
                {vnd(p.collected)}
              </p>
            </div>
            <div>
              Còn lại
              <p className="v2-num text-[14px] font-semibold" style={{ color: p.total - p.collected > 0 ? "var(--am)" : "var(--tx)" }}>
                {vnd(Math.max(0, p.total - p.collected))}
              </p>
            </div>
          </div>
        </div>

        {/* Nhân sự */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold">
              <Users size={16} style={{ color: "var(--tx3)" }} /> Nhân sự
            </p>
            <Link href={href(c.id, "crew")} className="text-[12.5px] font-semibold" style={{ color: "var(--ac)" }}>
              {crew.length ? "Sửa phân công" : "Phân công"}
            </Link>
          </div>
          {crew.length === 0 ? (
            <Callout tone="amber" icon={UserPlus}>
              Chưa phân công ai cho buổi này.
            </Callout>
          ) : (
            <ul className="flex flex-col">
              {crew.map((m) => {
                const st = CREW_STATUS[m.status] ?? [m.status, "gray" as Tone];
                return (
                  <li key={m.id} className="flex items-center gap-2.5 py-1.5">
                    <Avatar name={m.name || "?"} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{m.name || "Chưa có tên"}</p>
                      <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>
                        {m.role.startsWith("c_") ? "Vai trò riêng" : crewRoleLabel(m.role)}
                      </p>
                    </div>
                    <Badge tone={st[1]}>{st[0]}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Hạng mục */}
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold">
            <ListChecks size={16} style={{ color: "var(--tx3)" }} /> Hạng mục
          </p>
          {items.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--tx3)" }}>
              Chưa có hạng mục nào.
            </p>
          ) : (
            <ul className="flex flex-col">
              {items.slice(0, 6).map((it, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
                  <span className="min-w-0 truncate">
                    {it.name?.trim() || "Hạng mục"}
                    {it.qty > 1 ? <span style={{ color: "var(--tx3)" }}> × {it.qty}</span> : null}
                  </span>
                  <span className="v2-num flex-none font-medium">{vnd(it.qty * it.unit_price)}</span>
                </li>
              ))}
              {items.length > 6 && (
                <li className="pt-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  và {items.length - 6} hạng mục khác
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  );
}
