"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, CalendarHeart, Check, Clock, FileSpreadsheet, Heart, LayoutDashboard, ListChecks, Loader2, Lock, Palette, Store, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import DateInput from "@/components/DateInput";
import { CustomerHeaderV2, CustomerMainV2, CustomerRootV2 } from "@/components/v2/customer";
import { Callout, Card, Field, Progress, Stack, btn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, type MenuItem } from "@/components/v2/kit-client";
import { fmtDateLunar } from "@/lib/date";
import { useTheme } from "@/lib/theme";
import { daysUntil, taskStats, type PlanOp, type WeddingPlanData } from "@/lib/wedding-plan";
import type { StudioBrandInfo } from "@/lib/studio-brand";
import { PORTAL_TAB_DEF, PORTAL_TAB_HASH, PortalTabBarV2 } from "../PortalShellV2";
import type { Ctx, PlannerTab, SaveState } from "./ui";
import type { PlannerPayload } from "./types";
import { usePlanExport, usePlannerReplies } from "./usePlanner";
import OverviewTabV2 from "./tabs/OverviewV2";
import TasksTabV2 from "./tabs/TasksV2";
import BudgetTabV2 from "./tabs/BudgetV2";
import GuestsTabV2 from "./tabs/GuestsV2";
import VendorsTabV2 from "./tabs/VendorsV2";
import DayTabV2 from "./tabs/DayV2";
import StyleTabV2 from "./tabs/StyleV2";

/* ═══════════════════════════════════════════════════════════════════════════
   KẾ HOẠCH CƯỚI — giao diện mới. Cùng props và cùng thao tác (`onOp`) với
   PlannerView (bản cũ); trang thật (WeddingPlannerV2) lo lưu, /uipreview dựng
   thẳng bằng dữ liệu giả.

   Bố cục: đầu trang thương hiệu (trạng thái lưu + menu ⋯: xuất Excel, đổi
   ngày cưới) → thẻ đếm ngược + tiến độ → thanh tab dính (7 phần, Quà cưới thêm
   "Thiệp cưới") → nội dung tab. Điện thoại: thanh tab đáy chung với cổng khách
   (Tổng quan · Thanh toán · Ảnh & video · Kế hoạch) để hai trang là một app.
   ═══════════════════════════════════════════════════════════════════════════ */

const TABS: [PlannerTab, string, LucideIcon, boolean][] = [
  // [khoá, nhãn, icon, cần cột `extra`]
  ["overview", "Tổng quan", LayoutDashboard, false],
  ["tasks", "Việc cần làm", ListChecks, false],
  ["budget", "Ngân sách", Wallet, false],
  ["guests", "Khách mời", Users, true],
  ["vendors", "Nhà cung cấp", Store, true],
  ["day", "Ngày cưới", Clock, false],
  ["style", "Phong cách & ảnh", Palette, true],
];

export default function PlannerViewV2({
  data, plan, today, backHref, onOp, saving = "idle", initialTab = "overview", guestView, onTab, onOpenInvite, brand,
}: {
  data: PlannerPayload;
  /** Kế hoạch đang hiện — có thể đã gồm thao tác chưa lưu xong. */
  plan: WeddingPlanData;
  today: string;
  /** Cổng khách (/portal/<token>) — đích của nút quay lại và thanh tab đáy. */
  backHref: string;
  onOp: (op: PlanOp) => void;
  saving?: SaveState;
  initialTab?: PlannerTab;
  guestView?: "list" | "tables";
  onTab?: (tab: PlannerTab) => void;
  onOpenInvite?: () => void;
  brand: StudioBrandInfo;
}) {
  const { theme } = useTheme();
  const [tab, setTabState] = useState<PlannerTab>(initialTab);
  const [editDate, setEditDate] = useState(false);
  const readOnly = data.plan_locked;
  const left = daysUntil(plan.wedding_date, today);
  const tabs = TABS.filter(([, , , ext]) => !ext || data.ext);
  const tabBar = useRef<HTMLDivElement>(null);
  const { replies, unmatched } = usePlannerReplies(data, plan);
  const xlsx = usePlanExport({ data, plan, today, replies });
  const stats = taskStats(plan.tasks, data.auto, plan.wedding_date, today);

  const setTab = (t: PlannerTab) => {
    setTabState(t);
    onTab?.(t);
    // Đang cuộn sâu thì đưa nội dung tab mới lên ngay dưới thanh tab.
    requestAnimationFrame(() => {
      const top = tabBar.current?.getBoundingClientRect().top ?? 0;
      if (top <= 61) window.scrollTo({ top: window.scrollY + top - 60 });
    });
  };

  // Tab đang mở luôn nằm trong tầm nhìn của thanh tab cuộn ngang (điện thoại).
  useEffect(() => {
    tabBar.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  const ctx: Ctx = { data, plan, today, readOnly, onOp, replies, unmatched, go: setTab, guestView, openInvite: onOpenInvite };
  const b: StudioBrandInfo = { name: data.studio_name || brand.name, logoUrl: brand.logoUrl };

  const menu: MenuItem[] = [
    { label: xlsx.busy ? "Đang tạo file…" : "Xuất Excel", icon: FileSpreadsheet, onClick: xlsx.run, disabled: xlsx.busy, hint: "Tải cả kế hoạch về máy" },
    ...(!readOnly && plan.wedding_date ? [{ label: "Đổi ngày cưới", icon: CalendarHeart, onClick: () => setEditDate(true) }] : []),
    "divider",
    { label: "Trang hợp đồng của bạn", icon: ArrowLeft, href: backHref },
  ];

  const countdown = left === null ? "" : left > 0 ? `Còn ${left} ngày` : left === 0 ? "Hôm nay là ngày cưới" : `Đã cưới ${-left} ngày`;

  return (
    <CustomerRootV2 theme={theme}>
      <CustomerHeaderV2
        brand={b}
        sub={data.combo ? `Quà cưới từ ${data.studio_name}` : "Kế hoạch cưới"}
        right={
          <>
            <SaveBadgeV2 state={saving} />
            <Menu items={menu} width={240} />
          </>
        }
      />

      <CustomerMainV2>
        <Stack>
          {/* ── Đếm ngược + tiến độ ──────────────────────────────────────── */}
          <Card>
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium" style={{ color: "var(--tx3)" }}>{data.combo ? `Quà cưới từ ${data.studio_name}` : "Kế hoạch cưới"}</p>
                <h1 className="mt-0.5 text-[22px] font-bold leading-tight sm:text-[26px]" style={{ letterSpacing: "-.5px", textWrap: "balance" }}>
                  {data.contract.client_name || data.contract.title}
                </h1>
                {plan.wedding_date && (
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="tnum text-[18px] font-bold" style={{ letterSpacing: "-.4px", color: "var(--ac)" }}>{countdown}</span>
                    <span className="tnum text-[13px]" style={{ color: "var(--tx2)" }}>{fmtDateLunar(plan.wedding_date)}</span>
                    {!readOnly && (
                      <button type="button" onClick={() => setEditDate(true)} className="text-[13px] font-semibold" style={{ color: "var(--ac)" }}>
                        Đổi ngày
                      </button>
                    )}
                  </p>
                )}
              </div>
              <span className="hidden h-12 w-12 flex-none items-center justify-center rounded-[14px] sm:flex" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                <CalendarHeart size={22} />
              </span>
            </div>
            <div className="mt-4 border-t pt-3.5" style={{ borderColor: "var(--bd2)" }}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span style={{ color: "var(--tx3)" }}>Việc đã xong</span>
                <span className="tnum font-semibold">{stats.done}/{stats.total} · {stats.pct}%</span>
              </div>
              <div className="mt-2"><Progress value={stats.pct} /></div>
            </div>
          </Card>

          {readOnly && (
            <Callout tone="amber" icon={Lock} title="Trang đang ở chế độ xem">
              Gói dịch vụ của {data.studio_name} đã hết hạn. Liên hệ studio để tiếp tục chỉnh sửa.
            </Callout>
          )}

          {!plan.wedding_date && !readOnly && <WeddingDateCard value={null} onSave={(d) => onOp({ op: "set_date", date: d })} />}

          {/* ── Thanh tab dính ───────────────────────────────────────────── */}
          <div ref={tabBar} className="sticky top-[60px] z-20 -mx-4 px-4" style={{ background: "var(--bg)" }}>
            <div className="v2-tabs" role="tablist" aria-label="Kế hoạch cưới">
              {tabs.map(([key, label, Icon]) => {
                const on = tab === key;
                return (
                  <span key={key} className="contents">
                    <button type="button" role="tab" aria-selected={on} onClick={() => setTab(key)} className={`v2-tab ${on ? "is-on" : ""}`}>
                      <Icon size={16} /> {label}
                    </button>
                    {/* Quà cưới: phần thứ hai của trang — đặt ngay cạnh Tổng quan cho dễ thấy. */}
                    {key === "overview" && onOpenInvite && (
                      <button type="button" onClick={onOpenInvite} className="v2-tab">
                        <Heart size={16} /> Thiệp cưới
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="min-w-0">
            {tab === "overview" && <OverviewTabV2 ctx={ctx} />}
            {tab === "tasks" && <TasksTabV2 ctx={ctx} />}
            {tab === "budget" && <BudgetTabV2 ctx={ctx} />}
            {tab === "guests" && data.ext && <GuestsTabV2 ctx={ctx} />}
            {tab === "vendors" && data.ext && <VendorsTabV2 ctx={ctx} />}
            {tab === "day" && <DayTabV2 ctx={ctx} />}
            {tab === "style" && data.ext && <StyleTabV2 ctx={ctx} />}
          </div>
        </Stack>
      </CustomerMainV2>

      <PortalTabBarV2
        items={[
          { key: "home", label: PORTAL_TAB_DEF.home.short, icon: PORTAL_TAB_DEF.home.icon, active: false, href: backHref },
          { key: "pay", label: PORTAL_TAB_DEF.pay.short, icon: PORTAL_TAB_DEF.pay.icon, active: false, href: backHref + PORTAL_TAB_HASH.pay },
          { key: "media", label: PORTAL_TAB_DEF.media.short, icon: PORTAL_TAB_DEF.media.icon, active: false, href: backHref + PORTAL_TAB_HASH.media },
          { key: "plan", label: data.combo ? "Quà cưới" : PORTAL_TAB_DEF.plan.short, icon: PORTAL_TAB_DEF.plan.icon, active: true, onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
        ]}
      />

      {editDate && plan.wedding_date && (
        <DateDrawer
          value={plan.wedding_date}
          onClose={() => setEditDate(false)}
          onSave={(d) => {
            onOp({ op: "set_date", date: d });
            setEditDate(false);
          }}
        />
      )}
    </CustomerRootV2>
  );
}

function SaveBadgeV2({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const m = {
    saving: { text: "Đang lưu…", color: "var(--tx3)" },
    saved: { text: "Đã lưu", color: "var(--gn)" },
    error: { text: "Chưa lưu được", color: "var(--rd)" },
  }[state];
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold" style={{ color: m.color }}>
      {state === "saving" ? <Loader2 size={14} className="animate-spin" /> : state === "saved" ? <Check size={14} /> : null}
      {m.text}
    </span>
  );
}

/** Khách chưa chọn ngày cưới: hỏi ngay đầu trang — mọi mốc việc tính theo ngày này. */
function WeddingDateCard({ value, onSave }: { value: string | null; onSave: (d: string) => void }) {
  const [d, setD] = useState(value ?? "");
  return (
    <Card style={{ borderColor: "var(--acM)" }}>
      <div className="flex items-start gap-3">
        <span className="v2-section-icon" style={{ width: 40, height: 40 }}><CalendarHeart size={19} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Ngày cưới của bạn là ngày nào?</p>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
            Việc cần làm được xếp theo mốc trước ngày cưới — đổi ngày là cả danh sách tự dời theo.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-start gap-2">
        <div className="w-[230px] max-w-full">
          <DateInput value={d} onChange={setD} allowPast className={inputCls} />
        </div>
        <button type="button" disabled={!d || d === value} onClick={() => onSave(d)} className={btn("primary")}>
          Lưu ngày cưới
        </button>
      </div>
    </Card>
  );
}

function DateDrawer({ value, onClose, onSave }: { value: string; onClose: () => void; onSave: (d: string) => void }) {
  const [d, setD] = useState(value);
  return (
    <Drawer
      open
      onClose={onClose}
      title="Đổi ngày cưới"
      desc="Việc cần làm được xếp theo mốc trước ngày cưới — đổi ngày là cả danh sách tự dời theo."
      width={440}
      footer={
        <>
          <button type="button" onClick={onClose} className={btn("ghost")}>Huỷ</button>
          <button type="button" disabled={!d || d === value} onClick={() => onSave(d)} className={btn("primary")}>Lưu ngày cưới</button>
        </>
      }
    >
      <Field label="Ngày cưới">
        <DateInput value={d} onChange={setD} allowPast className={inputCls} />
      </Field>
    </Drawer>
  );
}
