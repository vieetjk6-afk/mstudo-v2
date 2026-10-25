"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, BookOpen, CalendarClock, Check, CheckCircle2, Eye, FileText, Film,
  Image as ImageIcon, Layers, Package, Play, RotateCcw, Search, Truck, UserPlus, type LucideIcon,
} from "lucide-react";
import {
  Avatar, Badge, Callout, Empty, Field, GroupLabel, InfoList, PageHead, Stack, Stat, StatGrid, Toolbar, btn, inputCls,
  toneFg, type Tone,
} from "@/components/v2/kit";
import { Drawer, Menu, SearchInput, Segmented, Tabs, type MenuItem } from "@/components/v2/kit-client";
import { PRODUCT_STATUS_LABEL, vnd, type ProductStatus } from "@/lib/types";
import { fmtDate, fmtDayMonth, fmtDow } from "@/lib/date";
import {
  ORDER_STATUS_LABEL, ORDER_STATUS_TONE, daysToDue, dueLabel, lateness, sortByUrgency, type VendorOrder,
} from "@/lib/vendors";
import type { ProductRow, ProductionViewProps } from "./ProductionView";
import { PRODUCT_ORDER, toVendorOrder, useProduction } from "./useProduction";

/* ═══════════════════════════════════════════════════════════════════════════
   XỬ LÝ HÌNH ẢNH — giao diện mới. Cùng dữ liệu, cùng thao tác với
   ProductionView (bản cũ, logic chung ở ./useProduction); khác ở cách bày:
     • 4 số liệu: đang xử lý · quá hạn giao · sắp tới hạn · đã giao.
     • Một thanh lọc: tìm · bước (đang xử lý / đã đặt / đang làm / đã giao /
       tất cả) · người làm · loại việc (ảnh, video, in ấn — chỉ khi có từ 2 loại).
     • Danh sách NHÓM THEO HẠN GIAO: quá hạn → trong 7 ngày → còn thời gian →
       chưa có hạn → đã giao. Mỗi dòng: hạn giao, người làm, tiến độ 3 bước và
       đúng MỘT nút bước tiếp theo (Bắt đầu / Hoàn tất); bước khác trong ⋯.
     • Bấm một việc mở ngăn kéo: đổi tiến độ, giao người làm, xem hợp đồng và
       các đơn đặt ngoài (in album…) của cùng hợp đồng.
     • Đơn đặt ngoài đang chạy thành tab thứ hai thay vì khối chen giữa trang.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Hạn giao trong bao nhiêu ngày thì xếp vào nhóm "sắp tới hạn". */
const SOON_DAYS = 7;

type Stage = "open" | ProductStatus | "all";
type View = "work" | "orders";

const STAGE_TONE: Record<ProductStatus, Tone> = { ordered: "amber", in_progress: "teal", done: "green" };
const STAGE_ICON: Record<ProductStatus, LucideIcon> = { ordered: RotateCcw, in_progress: Play, done: Check };

/* ── Loại việc: đoán theo tên hạng mục, chỉ để có icon và một bộ lọc ── */
type Kind = "photo" | "video" | "print" | "other";
const KIND_LABEL: Record<Kind, string> = { photo: "Ảnh", video: "Video", print: "In ấn", other: "Khác" };
const KIND_ICON: Record<Kind, LucideIcon> = { photo: ImageIcon, video: Film, print: BookOpen, other: Package };
const KIND_RULES: [Kind, RegExp][] = [
  ["video", /video|phim|clip|quay|dựng|flycam|highlight|trailer|teaser/i],
  ["print", /album|(^|\s)in(\s|$)|in ấn|phóng|khung|canvas|photobook|lịch|thiệp|poster|ép gỗ|pha lê/i],
  ["photo", /ảnh|hình|file|chỉnh|retouch|photo|blend|hậu kỳ/i],
];
const kindOf = (name: string): Kind => KIND_RULES.find(([, re]) => re.test(name))?.[0] ?? "other";

/** Ô chọn "người làm": mọi người / chưa giao / từng người. */
const WHO_ALL = "";
const WHO_NONE = "__none__";

/* ── Hạn giao ── */
type GroupKey = "late" | "soon" | "later" | "none" | "done";
const GROUPS: { key: GroupKey; label: string; dot: string }[] = [
  { key: "late", label: "Quá hạn giao", dot: "var(--rd)" },
  { key: "soon", label: `Hạn trong ${SOON_DAYS} ngày`, dot: "var(--am)" },
  { key: "later", label: "Còn thời gian", dot: "var(--ac)" },
  { key: "none", label: "Chưa có hạn giao", dot: "var(--tx3)" },
  { key: "done", label: "Đã giao", dot: "var(--gn)" },
];

const dueOf = (r: ProductRow) => r.contract?.delivery_due ?? null;

function groupOf(r: ProductRow, today: string): GroupKey {
  if (r.status === "done") return "done";
  const d = daysToDue(dueOf(r), today);
  if (d === null) return "none";
  if (d < 0) return "late";
  if (d <= SOON_DAYS) return "soon";
  return "later";
}

/** Hạn giao nói bằng chữ + màu: "Trễ 3 ngày" / "Hôm nay" / "Còn 2 ngày"… */
function dueBadge(r: ProductRow, today: string): { text: string; tone: Tone } {
  const due = dueOf(r);
  const d = daysToDue(due, today);
  if (d === null) return { text: "Chưa có hạn", tone: "gray" };
  if (r.status === "done") return { text: `Hạn ${fmtDayMonth(due)}`, tone: "gray" };
  if (d < 0) return { text: `Trễ ${-d} ngày`, tone: "red" };
  if (d === 0) return { text: "Hạn hôm nay", tone: "red" };
  if (d === 1) return { text: "Hạn ngày mai", tone: "amber" };
  if (d <= SOON_DAYS) return { text: `Còn ${d} ngày`, tone: "amber" };
  return { text: `Còn ${d} ngày`, tone: "gray" };
}

/** Bước tiếp theo — nút chữ duy nhất trên mỗi dòng. */
function nextStep(s: ProductStatus): { to: ProductStatus; short: string; long: string; icon: LucideIcon } | null {
  if (s === "ordered") return { to: "in_progress", short: "Bắt đầu", long: "Bắt đầu làm", icon: Play };
  if (s === "in_progress") return { to: "done", short: "Hoàn tất", long: "Đánh dấu đã giao", icon: Check };
  return null;
}

const contractHref = (id: string) => `/dashboard/studio/contracts/${id}`;

/** Gần → xa; thiếu hạn xuống cuối; cùng hạn thì theo hợp đồng rồi theo tên. */
function byDue(a: ProductRow, b: ProductRow) {
  const da = dueOf(a) || "9999";
  const db = dueOf(b) || "9999";
  if (da !== db) return da < db ? -1 : 1;
  const ca = a.contract?.title || "";
  const cb = b.contract?.title || "";
  if (ca !== cb) return ca.localeCompare(cb, "vi");
  return a.name.localeCompare(b.name, "vi");
}

export default function ProductionV2({ initial, staff, orders = [] }: ProductionViewProps) {
  const { rows, today, counts, doneCount, pct, setStatus, setAssignee } = useProduction(initial, staff);
  const [view, setView] = useState<View>("work");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage>("open");
  const [who, setWho] = useState(WHO_ALL);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [peekId, setPeekId] = useState<string | null>(null);

  const nameById = useMemo(() => new Map(staff.map((s) => [s.id, s.full_name || s.email])), [staff]);
  const nameOf = (id: string | null) => (id ? nameById.get(id) ?? "" : "");

  /* ── Số liệu đầu trang: tính trên TOÀN BỘ việc, không theo bộ lọc ── */
  const stats = useMemo(() => {
    let late = 0;
    let soon = 0;
    let unassigned = 0;
    for (const r of rows) {
      if (r.status === "done") continue;
      const g = groupOf(r, today);
      if (g === "late") late++;
      else if (g === "soon") soon++;
      if (!r.assigned_to) unassigned++;
    }
    return { late, soon, unassigned, open: (counts.ordered || 0) + (counts.in_progress || 0) };
  }, [rows, today, counts]);

  const kindsPresent = useMemo(() => new Set(rows.map((r) => kindOf(r.name))), [rows]);

  // Lọc chung (tìm, người làm, loại) TRƯỚC khi chia bước, để số đếm trên từng
  // nút bước khớp với bộ lọc đang bật.
  const matched = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (who === WHO_NONE ? !!r.assigned_to : who !== WHO_ALL && r.assigned_to !== who) return false;
      if (kind !== "all" && kindOf(r.name) !== kind) return false;
      if (!n) return true;
      const assignee = r.assigned_to ? nameById.get(r.assigned_to) : "";
      return [r.name, r.note, r.contract?.title, r.contract?.client_name, assignee].some((v) => v?.toLowerCase().includes(n));
    });
  }, [rows, q, who, kind, nameById]);

  const inStage = (r: ProductRow, s: Stage) => (s === "all" ? true : s === "open" ? r.status !== "done" : r.status === s);
  const countOf = (s: Stage) => matched.filter((r) => inStage(r, s)).length;

  const groups = useMemo(() => {
    const list = matched.filter((r) => (stage === "all" ? true : stage === "open" ? r.status !== "done" : r.status === stage));
    return GROUPS.map((g) => {
      const rs = list.filter((r) => groupOf(r, today) === g.key).sort(byDue);
      return { ...g, rows: g.key === "done" ? rs.reverse() : rs };
    }).filter((g) => g.rows.length > 0);
  }, [matched, stage, today]);

  const shownCount = groups.reduce((s, g) => s + g.rows.length, 0);
  const filtering = !!q.trim() || who !== WHO_ALL || kind !== "all";
  const clearFilters = () => {
    setQ("");
    setWho(WHO_ALL);
    setKind("all");
  };

  /* ── Đơn đặt ngoài (in album, makeup thuê ngoài…) ── */
  const vendorOrders = useMemo(() => sortByUrgency(orders.map(toVendorOrder), today), [orders, today]);
  const lateOrders = vendorOrders.filter((o) => lateness(o, today).level === "late").length;
  const jobOf = (o: VendorOrder) => rows.find((r) => r.contract?.id === o.contractId)?.contract ?? null;

  const peek = peekId ? (rows.find((r) => r.id === peekId) ?? null) : null;

  const rowMenu = (r: ProductRow): MenuItem[] => [
    { label: "Xem chi tiết · giao việc", icon: Eye, onClick: () => setPeekId(r.id) },
    ...(r.contract ? [{ label: "Mở hợp đồng", icon: FileText, href: contractHref(r.contract.id) }] : []),
    "divider",
    ...PRODUCT_ORDER.filter((s) => s !== r.status).map((s) => ({
      label: `Chuyển sang “${PRODUCT_STATUS_LABEL[s]}”`,
      icon: STAGE_ICON[s],
      onClick: () => void setStatus(r.id, s),
    })),
  ];

  const workList =
    rows.length === 0 ? (
      <div className="v2-card">
        <Empty
          icon={Package}
          title="Chưa có việc xử lý nào"
          hint="Thêm hạng mục sản xuất trong hợp đồng (ảnh, video, in ấn) để giao người làm và theo dõi hạn giao ở đây."
          action={
            <Link href="/dashboard/studio/contracts" className={btn("secondary")}>
              <FileText size={16} /> Mở danh sách hợp đồng
            </Link>
          }
        />
      </div>
    ) : (
      <div className="v2-card overflow-hidden">
        <div className="v2-card-pad flex flex-col gap-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <Toolbar>
            <div className="min-w-[220px] flex-[1_1_240px]">
              <SearchInput value={q} onChange={setQ} placeholder="Tìm việc, hợp đồng, khách…" className="w-full" />
            </div>
            {staff.length > 0 && (
              <select aria-label="Người làm" className={inputCls} value={who} onChange={(e) => setWho(e.target.value)}>
                <option value={WHO_ALL}>Mọi người làm</option>
                <option value={WHO_NONE}>Chưa giao ai</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </option>
                ))}
              </select>
            )}
            {kindsPresent.size > 1 && (
              <select aria-label="Loại việc" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as Kind | "all")}>
                <option value="all">Mọi loại việc</option>
                {(Object.keys(KIND_LABEL) as Kind[])
                  .filter((k) => kindsPresent.has(k))
                  .map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
              </select>
            )}
            <div className="w-full min-w-0">
              <Segmented<Stage>
                label="Bước xử lý"
                value={stage}
                onChange={setStage}
                options={[
                  { value: "open", label: "Đang xử lý", count: countOf("open") },
                  { value: "ordered", label: PRODUCT_STATUS_LABEL.ordered, count: countOf("ordered") },
                  { value: "in_progress", label: PRODUCT_STATUS_LABEL.in_progress, count: countOf("in_progress") },
                  { value: "done", label: PRODUCT_STATUS_LABEL.done, count: countOf("done") },
                  { value: "all", label: "Tất cả", count: matched.length },
                ]}
              />
            </div>
          </Toolbar>
          {filtering ? (
            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
              {matched.length} / {rows.length} việc khớp bộ lọc ·{" "}
              <button type="button" className="font-semibold" style={{ color: "var(--ac)" }} onClick={clearFilters}>
                Xoá lọc
              </button>
            </p>
          ) : null}
        </div>

        {groups.length === 0 ? (
          stage === "open" && !filtering ? (
            <Empty compact icon={CheckCircle2} title="Đã giao hết mọi việc" hint="Không còn hạng mục nào đang chờ. Xem lại ở nhóm “Đã giao”." />
          ) : (
            <Empty compact icon={Search} title="Không có việc nào khớp" hint="Thử chọn bước khác hoặc bỏ bớt bộ lọc." />
          )
        ) : (
          <>
            <WorkTable groups={groups} today={today} nameOf={nameOf} onPeek={setPeekId} onStep={setStatus} menu={rowMenu} />
            <WorkCards groups={groups} today={today} nameOf={nameOf} onPeek={setPeekId} onStep={setStatus} menu={rowMenu} />
            <p className="px-4 py-3 text-[12.5px] sm:px-5" style={{ color: "var(--tx3)", borderTop: "1px solid var(--bd)", background: "var(--sf2)" }}>
              Đang xem {shownCount} việc · đã giao {doneCount}/{rows.length} việc ({pct}%)
            </p>
          </>
        )}
      </div>
    );

  return (
    <Stack>
      <PageHead desc="Việc gần hạn giao nằm trên cùng. Bấm một việc để giao người làm hoặc đổi tiến độ." />

      {rows.length > 0 && (
        <StatGrid>
          <Stat
            icon={Layers}
            tone="brand"
            label="Đang xử lý"
            value={stats.open}
            sub={stats.unassigned ? `${stats.unassigned} việc chưa giao người làm` : `${counts.ordered || 0} chưa bắt đầu · ${counts.in_progress || 0} đang làm`}
          />
          <Stat
            icon={AlertTriangle}
            tone="red"
            label="Quá hạn giao"
            value={stats.late}
            valueTone={stats.late ? "red" : undefined}
            sub={stats.late ? "Đã qua hạn giao khách" : "Không có việc trễ"}
          />
          <Stat
            icon={CalendarClock}
            tone="amber"
            label="Sắp tới hạn"
            value={stats.soon}
            valueTone={stats.soon ? "amber" : undefined}
            sub={`Hạn giao trong ${SOON_DAYS} ngày tới`}
          />
          <Stat icon={CheckCircle2} tone="green" label="Đã giao" value={`${doneCount}/${rows.length}`} sub={`Xong ${pct}% tổng số việc`} />
        </StatGrid>
      )}

      {vendorOrders.length > 0 ? (
        <div className="flex flex-col gap-4">
          <Tabs<View>
            label="Xử lý hình ảnh"
            value={view}
            onChange={setView}
            options={[
              { value: "work", label: "Việc xử lý", icon: Layers, count: stats.open },
              {
                value: "orders",
                label: (
                  <>
                    Đơn đặt ngoài
                    {lateOrders ? (
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--rd)" }} title={`${lateOrders} đơn quá hẹn`} />
                    ) : null}
                  </>
                ),
                icon: Truck,
                count: vendorOrders.length,
              },
            ]}
          />
          {view === "work" ? workList : <VendorOrdersPanel orders={vendorOrders} today={today} jobOf={jobOf} />}
        </div>
      ) : (
        workList
      )}

      <ProductPeek
        r={peek}
        today={today}
        staff={staff}
        nameOf={nameOf}
        orders={peek?.contract ? vendorOrders.filter((o) => o.contractId === peek.contract!.id) : []}
        onClose={() => setPeekId(null)}
        onStatus={setStatus}
        onAssign={setAssignee}
      />
    </Stack>
  );
}

/* ── Ô dùng chung giữa bảng và thẻ ─────────────────────────────────────── */
type Group = { key: GroupKey; label: string; dot: string; rows: ProductRow[] };
type ListProps = {
  groups: Group[];
  today: string;
  nameOf: (id: string | null) => string;
  onPeek: (id: string) => void;
  onStep: (id: string, s: ProductStatus) => void;
  menu: (r: ProductRow) => MenuItem[];
};

function KindTile({ name, size = 38 }: { name: string; size?: number }) {
  const Icon = KIND_ICON[kindOf(name)];
  return (
    <span
      className="flex flex-none items-center justify-center rounded-[11px]"
      style={{ width: size, height: size, background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd2)" }}
      title={KIND_LABEL[kindOf(name)]}
    >
      <Icon size={size * 0.45} />
    </span>
  );
}

/** Tiến độ 3 bước: đã đặt → đang làm → đã giao. */
function StageSteps({ status }: { status: ProductStatus }) {
  const at = PRODUCT_ORDER.indexOf(status);
  const tone = STAGE_TONE[status];
  return (
    <div className="flex flex-col gap-1.5" title={`Bước ${at + 1}/3 · ${PRODUCT_STATUS_LABEL[status]}`}>
      <div className="flex gap-1" aria-hidden>
        {PRODUCT_ORDER.map((s, i) => (
          <span
            key={s}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: i <= at ? toneFg(tone) : "var(--bd2)" }}
          />
        ))}
      </div>
      <span className="text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>
        {PRODUCT_STATUS_LABEL[status]}
      </span>
    </div>
  );
}

/** Bản thu nhỏ cho thẻ điện thoại: 3 vạch, không chữ (chữ nằm trong title). */
function MiniSteps({ status }: { status: ProductStatus }) {
  const at = PRODUCT_ORDER.indexOf(status);
  return (
    <span className="flex w-9 flex-none gap-[3px]" title={PRODUCT_STATUS_LABEL[status]} aria-label={`Tiến độ: ${PRODUCT_STATUS_LABEL[status]}`}>
      {PRODUCT_ORDER.map((s, i) => (
        <span key={s} className="h-1.5 flex-1 rounded-full" style={{ background: i <= at ? toneFg(STAGE_TONE[status]) : "var(--bd2)" }} />
      ))}
    </span>
  );
}

function Assignee({ id, nameOf, size = 26 }: { id: string | null; nameOf: (id: string | null) => string; size?: number }) {
  const n = nameOf(id);
  if (!id || !n)
    return (
      <Badge tone="amber" icon={UserPlus}>
        Chưa giao
      </Badge>
    );
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={n} size={size} />
      <span className="truncate text-[13px] font-medium">{n}</span>
    </span>
  );
}

function GroupHead({ g }: { g: Group }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: g.dot }} />
      <GroupLabel count={`${g.rows.length} việc`}>{g.label}</GroupLabel>
    </div>
  );
}

function StepButton({ r, onStep, className = "" }: { r: ProductRow; onStep: ListProps["onStep"]; className?: string }) {
  const step = nextStep(r.status);
  if (!step) return null;
  const Icon = step.icon;
  return (
    <button type="button" className={btn("soft", "sm", className)} onClick={() => onStep(r.id, step.to)} title={step.long}>
      <Icon size={14} /> {step.short}
    </button>
  );
}

const subLine = (r: ProductRow) =>
  [r.contract?.client_name, r.contract?.title].filter(Boolean).join(" · ") || "Không gắn hợp đồng";

/* ── Bảng (máy tính) ────────────────────────────────────────────────────── */
function WorkTable({ groups, today, nameOf, onPeek, onStep, menu }: ListProps) {
  return (
    <div className="v2-table-wrap hidden lg:block">
      <table className="v2-table" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th>Việc · hợp đồng</th>
            <th style={{ width: 150 }}>Hạn giao khách</th>
            <th style={{ width: 176 }}>Người làm</th>
            <th style={{ width: 132 }}>Tiến độ</th>
            <th style={{ width: 160 }} aria-label="Thao tác" />
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key}>
            <tr>
              <td colSpan={5} style={{ background: "var(--sf2)", padding: "8px 16px" }}>
                <GroupHead g={g} />
              </td>
            </tr>
            {g.rows.map((r) => {
              const due = dueBadge(r, today);
              const d = dueOf(r);
              return (
                <tr key={r.id} className="cursor-pointer" onClick={() => onPeek(r.id)}>
                  <td>
                    <div className="flex min-w-0 items-center gap-3">
                      <KindTile name={r.name} />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold" title={r.name}>
                          {r.name}
                          {r.qty > 1 ? <span style={{ color: "var(--tx3)", fontWeight: 500 }}> ×{r.qty}</span> : null}
                        </p>
                        <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }} title={subLine(r)}>
                          {subLine(r)}
                          {r.note ? ` · ${r.note}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={due.tone} dot={due.tone !== "gray"}>
                        {due.text}
                      </Badge>
                      {d ? (
                        <span className="v2-num whitespace-nowrap pl-0.5 text-[12px]" style={{ color: "var(--tx3)" }}>
                          {fmtDow(d)} · {fmtDate(d)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <Assignee id={r.assigned_to} nameOf={nameOf} />
                  </td>
                  <td>
                    <StageSteps status={r.status} />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <StepButton r={r} onStep={onStep} />
                      <Menu items={menu(r)} label={`Thao tác cho ${r.name}`} />
                    </div>
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
function WorkCards({ groups, today, nameOf, onPeek, onStep, menu }: ListProps) {
  return (
    <div className="lg:hidden">
      {groups.map((g) => (
        <ul key={g.key}>
          <li className="px-4 py-2" style={{ background: "var(--sf2)", borderBottom: "1px solid var(--bd2)" }}>
            <GroupHead g={g} />
          </li>
          {g.rows.map((r) => {
            const due = dueBadge(r, today);
            return (
              <li key={r.id} className="relative px-4 py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                {/* Lớp bấm phủ cả thẻ → mở chi tiết; nút bước và ⋯ nằm trên lớp này. */}
                <button type="button" className="absolute inset-0" aria-label={`Xem chi tiết ${r.name}`} onClick={() => onPeek(r.id)} />
                <div className="flex gap-3">
                  <KindTile name={r.name} size={40} />
                  <div className="pointer-events-none min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold">
                      {r.name}
                      {r.qty > 1 ? <span style={{ color: "var(--tx3)", fontWeight: 500 }}> ×{r.qty}</span> : null}
                    </p>
                    <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                      {subLine(r)}
                    </p>
                  </div>
                  <div className="relative -mr-1.5 -mt-1 flex-none self-start">
                    <Menu items={menu(r)} label={`Thao tác cho ${r.name}`} />
                  </div>
                </div>
                {/* Hàng dưới trải hết bề ngang thẻ: hạn · tiến độ · người làm — nút bước bên phải. */}
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="pointer-events-none flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <Badge tone={due.tone} dot={due.tone !== "gray"}>
                      {due.text}
                    </Badge>
                    <MiniSteps status={r.status} />
                    <span className="flex min-w-0 max-w-[140px]">
                      <Assignee id={r.assigned_to} nameOf={nameOf} size={22} />
                    </span>
                  </div>
                  <div className="relative flex-none">
                    {r.status === "done" ? (
                      <Badge tone="green" icon={Check}>
                        Đã giao
                      </Badge>
                    ) : (
                      <StepButton r={r} onStep={onStep} />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}

/* ── Tab đơn đặt ngoài ─────────────────────────────────────────────────── */
function VendorOrdersPanel({
  orders,
  today,
  jobOf,
}: {
  orders: VendorOrder[];
  today: string;
  jobOf: (o: VendorOrder) => ProductRow["contract"];
}) {
  const color = (o: VendorOrder) => {
    const l = lateness(o, today).level;
    return l === "late" ? "var(--rd)" : l === "soon" ? "var(--am)" : "var(--tx3)";
  };
  return (
    <section className="v2-card overflow-hidden">
      <header className="v2-section-head">
        <span className="v2-section-icon">
          <Truck size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="v2-section-title">Đơn đặt ngoài đang chạy</h3>
          <p className="v2-section-desc">In album, makeup thuê ngoài, xe hoa… chưa giao khách. Trễ hẹn xếp lên đầu.</p>
        </div>
        <Link href="/dashboard/studio/vendors" className={btn("secondary", "sm")}>
          Mở sổ đơn <ArrowRight size={15} />
        </Link>
      </header>
      <ul>
        {orders.map((o) => {
          const job = jobOf(o);
          return (
            <li key={o.id}>
              <Link href="/dashboard/studio/vendors" className="v2-row v2-row-link">
                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px]" style={{ background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd2)" }}>
                  <Truck size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="v2-row-title">{o.title}</p>
                  <p className="v2-row-sub">{[o.vendorName, job?.client_name || job?.title].filter(Boolean).join(" · ") || "Chưa chọn nhà cung cấp"}</p>
                </div>
                <div className="flex flex-none flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <span className="v2-num whitespace-nowrap text-[12.5px] font-semibold" style={{ color: color(o) }}>
                    {dueLabel(o, today)}
                  </span>
                  <Badge tone={ORDER_STATUS_TONE[o.status]} dot>
                    {ORDER_STATUS_LABEL[o.status]}
                  </Badge>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── Ngăn chi tiết một việc ────────────────────────────────────────────── */
function ProductPeek({
  r,
  today,
  staff,
  nameOf,
  orders,
  onClose,
  onStatus,
  onAssign,
}: {
  r: ProductRow | null;
  today: string;
  staff: ProductionViewProps["staff"];
  nameOf: (id: string | null) => string;
  orders: VendorOrder[];
  onClose: () => void;
  onStatus: (id: string, s: ProductStatus) => void;
  onAssign: (id: string, who: string | null) => void;
}) {
  if (!r)
    return (
      <Drawer open={false} onClose={onClose} title="">
        {null}
      </Drawer>
    );
  const due = dueBadge(r, today);
  const d = dueOf(r);
  const step = nextStep(r.status);
  const late = r.status !== "done" && (daysToDue(d, today) ?? 0) < 0;
  const kind = kindOf(r.name);
  return (
    <Drawer
      open
      onClose={onClose}
      title={`${r.name}${r.qty > 1 ? ` ×${r.qty}` : ""}`}
      desc={[KIND_LABEL[kind], r.contract?.client_name || "Không gắn hợp đồng"].join(" · ")}
      width={460}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {r.contract ? (
            <Link href={contractHref(r.contract.id)} className={btn("secondary")}>
              <FileText size={16} /> Mở hợp đồng
            </Link>
          ) : null}
          {step ? (
            <button type="button" className={btn("primary", "md", "ml-auto")} onClick={() => onStatus(r.id, step.to)}>
              <step.icon size={16} /> {step.long}
            </button>
          ) : (
            <button type="button" className={btn("ghost", "md", "ml-auto")} onClick={() => onStatus(r.id, "in_progress")}>
              <RotateCcw size={16} /> Mở lại việc này
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <KindTile name={r.name} size={46} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={STAGE_TONE[r.status]} dot>
                {PRODUCT_STATUS_LABEL[r.status]}
              </Badge>
              {late ? null : <Badge tone={due.tone}>{due.text}</Badge>}
            </div>
            <p className="mt-1.5 truncate text-[13px]" style={{ color: "var(--tx3)" }}>
              {r.contract?.title || "Hạng mục không gắn hợp đồng"}
            </p>
          </div>
        </div>

        {late ? (
          <Callout tone="red" icon={AlertTriangle} title={due.text}>
            Hạn giao khách là {fmtDate(d)}. Hoàn tất sớm hoặc báo khách hẹn lại.
          </Callout>
        ) : null}

        <Field label="Tiến độ">
          <Segmented<ProductStatus>
            label="Tiến độ"
            value={r.status}
            onChange={(s) => onStatus(r.id, s)}
            options={PRODUCT_ORDER.map((s) => ({ value: s, label: PRODUCT_STATUS_LABEL[s] }))}
          />
        </Field>

        <Field label="Người làm" htmlFor="pv-who" hint={staff.length ? undefined : "Studio chưa có nhân viên nào để giao."}>
          <div className="flex items-center gap-2.5">
            {r.assigned_to && nameOf(r.assigned_to) ? <Avatar name={nameOf(r.assigned_to)} size={34} /> : null}
            <select id="pv-who" className={inputCls} value={r.assigned_to ?? ""} onChange={(e) => onAssign(r.id, e.target.value || null)}>
              <option value="">— Chưa giao —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.email}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <InfoList
          items={[
            {
              label: "Hợp đồng",
              value: r.contract ? (
                <Link href={contractHref(r.contract.id)} className="font-semibold hover:underline" style={{ color: "var(--ac)" }}>
                  {r.contract.title}
                </Link>
              ) : (
                "Không gắn hợp đồng"
              ),
            },
            { label: "Khách", value: r.contract?.client_name || "—" },
            { label: "Hạn giao khách", value: d ? `${fmtDow(d)} · ${fmtDate(d)}` : "Chưa có hạn" },
            { label: "Số lượng", value: r.qty },
            ...(r.cost > 0 ? [{ label: "Chi phí", value: <span className="v2-num">{vnd(r.cost)}</span> }] : []),
            ...(r.note ? [{ label: "Ghi chú", value: r.note }] : []),
          ]}
        />

        {orders.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold">
              <Truck size={16} style={{ color: "var(--tx3)" }} /> Đơn đặt ngoài của hợp đồng này
            </p>
            <ul className="flex flex-col">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center gap-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{o.title}</p>
                    <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>
                      {[o.vendorName, dueLabel(o, today)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Drawer>
  );
}
