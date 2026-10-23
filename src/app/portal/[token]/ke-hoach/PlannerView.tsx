"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CalendarHeart, Clock, FileSpreadsheet, Heart, LayoutDashboard, ListChecks, Loader2, Lock, Palette, Store, Users, Wallet,
} from "lucide-react";
import DateInput from "@/components/DateInput";
import { fmtDateLunar } from "@/lib/date";
import { matchGuestRsvps } from "@/lib/wedding-guests";
import { daysUntil, type GuestReply, type PlanOp, type WeddingPlanData } from "@/lib/wedding-plan";
import { SaveBadge, card, type Ctx, type PlannerTab, type SaveState } from "./ui";
import OverviewTab from "./tabs/Overview";
import TasksTab from "./tabs/Tasks";
import BudgetTab from "./tabs/Budget";
import GuestsTab from "./tabs/Guests";
import VendorsTab from "./tabs/Vendors";
import DayTab from "./tabs/Day";
import StyleTab from "./tabs/Style";
import type { PlannerPayload } from "./types";

export type { PlannerTab, SaveState } from "./ui";

/* ═══════════════════════════════════════════════════════════════════════════
   KẾ HOẠCH CƯỚI — khung trang: đầu trang (tên đôi, đếm ngược, ngày cưới) + bảy
   tab. Nhận dữ liệu qua props và báo thao tác qua `onOp`, không tự gọi mạng:
   trang thật (WeddingPlanner) lo lưu, /uipreview dựng thẳng bằng dữ liệu giả.

   Cùng bộ token `.client-doc` với cổng khách: chữ to hơn khu quản lý, không
   thuật ngữ nội bộ.

   Chế độ Quà cưới (`data.combo`): thêm nút "Thiệp cưới" ngay sau Tổng quan
   (mở trình sửa thiệp thay cả trang — `onOpenInvite`), và phản hồi qua thiệp
   đã nằm sẵn trong danh sách khách nên không phủ thêm lúc hiển thị.
   ═══════════════════════════════════════════════════════════════════════════ */

const TABS: [PlannerTab, string, typeof ListChecks, boolean][] = [
  // [khoá, nhãn, icon, cần cột `extra`]
  ["overview", "Tổng quan", LayoutDashboard, false],
  ["tasks", "Việc cần làm", ListChecks, false],
  ["budget", "Ngân sách", Wallet, false],
  ["guests", "Khách mời", Users, true],
  ["vendors", "Nhà cung cấp", Store, true],
  ["day", "Ngày cưới", Clock, false],
  ["style", "Phong cách & ảnh", Palette, true],
];

export default function PlannerView({
  data, plan, today, backHref, onOp, saving = "idle", initialTab = "overview", guestView, onTab, onOpenInvite,
}: {
  data: PlannerPayload;
  /** Kế hoạch đang hiện — có thể đã gồm thao tác chưa lưu xong. */
  plan: WeddingPlanData;
  today: string;
  backHref: string;
  onOp: (op: PlanOp) => void;
  saving?: SaveState;
  initialTab?: PlannerTab;
  guestView?: "list" | "tables";
  /** Báo tab đang mở (trang thật nhớ để quay về từ thiệp). */
  onTab?: (tab: PlannerTab) => void;
  /** Chế độ Quà cưới: mở trình sửa thiệp. */
  onOpenInvite?: () => void;
}) {
  const [tab, setTabState] = useState<PlannerTab>(initialTab);
  const setTab = (t: PlannerTab) => {
    setTabState(t);
    onTab?.(t);
  };
  const [editDate, setEditDate] = useState(false);
  const readOnly = data.plan_locked;
  const left = daysUntil(plan.wedding_date, today);
  const tabs = TABS.filter(([, , , ext]) => !ext || data.ext);
  const tabBar = useRef<HTMLDivElement>(null);

  // Phản hồi qua thiệp → khách trong danh sách, khớp theo tên (bỏ dấu, hoa /
  // thường). Tính lại mỗi lần danh sách đổi, để khách vừa thêm cũng khớp ngay.
  // Chế độ Quà cưới: máy chủ đã ghi phản hồi vào danh sách — không phủ thêm.
  const { replies, unmatched } = useMemo(() => {
    const r: Record<string, GuestReply> = {};
    if (data.combo || !data.invite?.replies.length) return { replies: r, unmatched: [] };
    const m = matchGuestRsvps(plan.guests.map((g) => g.name), data.invite.replies.map((x) => ({ ...x, wish: null })));
    for (const s of m.guests) if (s.rsvp) r[plan.guests[s.index].id] = { attending: s.rsvp.attending, num_guests: s.rsvp.num_guests };
    return { replies: r, unmatched: m.others };
  }, [plan.guests, data.invite, data.combo]);

  // Tab đang mở luôn nằm trong tầm nhìn của thanh tab cuộn ngang (điện thoại).
  useEffect(() => {
    tabBar.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  const ctx: Ctx = { data, plan, today, readOnly, onOp, replies, unmatched, go: setTab, guestView, openInvite: onOpenInvite };

  return (
    <main className="client-doc min-h-screen">
      <div className="mx-auto w-full max-w-[920px] px-[18px] pb-[70px] pt-[22px]">
        {/* ── Đầu trang ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={backHref} className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--tx3)" }}>
            <ArrowLeft size={15} /> Trang hợp đồng của bạn
          </Link>
          <span className="flex items-center gap-3">
            <ExportButton data={data} plan={plan} today={today} replies={replies} />
            <SaveBadge state={saving} />
          </span>
        </div>

        <p className="mt-3 text-[11px] font-bold uppercase" style={{ letterSpacing: "1.2px", color: "var(--tx3)" }}>
          {data.combo ? `Quà cưới từ ${data.studio_name}` : "Kế hoạch cưới"}
        </p>
        <h1 className="font-serif text-[26px] font-semibold leading-tight" style={{ textWrap: "balance" }}>
          {data.contract.client_name || data.contract.title}
        </h1>
        {plan.wedding_date && (
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="tnum text-[20px] font-bold" style={{ letterSpacing: "-.5px", color: "var(--ac)" }}>
              {left === null ? "" : left > 0 ? `Còn ${left} ngày` : left === 0 ? "Hôm nay là ngày cưới" : `Đã cưới ${-left} ngày`}
            </span>
            <span className="tnum text-[12.5px]" style={{ color: "var(--tx2)" }}>{fmtDateLunar(plan.wedding_date)}</span>
            {!readOnly && (
              <button onClick={() => setEditDate((v) => !v)} className="text-[12.5px] font-bold" style={{ color: "var(--ac)" }}>
                Đổi ngày
              </button>
            )}
          </p>
        )}

        {readOnly && (
          <p className="mt-3.5 flex items-center gap-2 rounded-[12px] px-3.5 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--amS)", color: "var(--am)" }}>
            <Lock size={15} style={{ flex: "none" }} />
            Trang đang ở chế độ xem — gói dịch vụ của {data.studio_name} đã hết hạn. Liên hệ studio để tiếp tục chỉnh sửa.
          </p>
        )}

        {(!plan.wedding_date || editDate) && !readOnly && (
          <WeddingDateCard
            value={plan.wedding_date}
            onSave={(d) => {
              onOp({ op: "set_date", date: d });
              setEditDate(false);
            }}
            onCancel={plan.wedding_date ? () => setEditDate(false) : undefined}
          />
        )}

        {/* ── Tab ───────────────────────────────────────────────────────── */}
        <div ref={tabBar} role="tablist" aria-label="Kế hoạch cưới" className="mt-3.5 flex gap-0.5 overflow-x-auto rounded-[14px] px-2" style={card}>
          {tabs.map(([key, label, Icon]) => {
            const on = tab === key;
            return (
              <Fragment key={key}>
                <button
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(key)}
                  className="flex flex-none items-center gap-1.5 whitespace-nowrap px-2.5 pb-2.5 pt-3 text-[13.5px]"
                  style={{ color: on ? "var(--ac)" : "var(--tx2)", fontWeight: on ? 700 : 550, borderBottom: `2px solid ${on ? "var(--ac)" : "transparent"}` }}
                >
                  <Icon size={15} className="max-[420px]:hidden" /> {label}
                </button>
                {/* Quà cưới: phần thứ hai của trang — đặt ngay cạnh Tổng quan cho dễ thấy. */}
                {key === "overview" && onOpenInvite && (
                  <button
                    type="button"
                    onClick={onOpenInvite}
                    className="flex flex-none items-center gap-1.5 whitespace-nowrap px-2.5 pb-2.5 pt-3 text-[13.5px]"
                    style={{ color: "var(--tx2)", fontWeight: 550, borderBottom: "2px solid transparent" }}
                  >
                    <Heart size={15} className="max-[420px]:hidden" /> Thiệp cưới
                  </button>
                )}
              </Fragment>
            );
          })}
        </div>

        <div className="mt-3.5">
          {tab === "overview" && <OverviewTab ctx={ctx} />}
          {tab === "tasks" && <TasksTab ctx={ctx} />}
          {tab === "budget" && <BudgetTab ctx={ctx} />}
          {tab === "guests" && data.ext && <GuestsTab ctx={ctx} />}
          {tab === "vendors" && data.ext && <VendorsTab ctx={ctx} />}
          {tab === "day" && <DayTab ctx={ctx} />}
          {tab === "style" && data.ext && <StyleTab ctx={ctx} />}
        </div>
      </div>
    </main>
  );
}

/**
 * Tải cả kế hoạch về một file Excel (mỗi phần một sheet) — khách giữ một bản,
 * in ra, gửi bố mẹ. Dựng ngay trong trình duyệt từ đúng dữ liệu đang hiện, kể
 * cả thao tác chưa lưu xong; bộ ghi Excel chỉ nạp lúc bấm.
 */
function ExportButton({
  data, plan, today, replies,
}: { data: PlannerPayload; plan: WeddingPlanData; today: string; replies: Record<string, GuestReply> }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const { downloadPlanXlsx } = await import("@/lib/wedding-plan-export");
      await downloadPlanXlsx({
        plan,
        couple: data.contract.client_name || data.contract.title,
        studio: { name: data.studio_name, phone: data.studio_phone },
        auto: data.auto,
        studioLine: data.studio_line,
        studioDay: data.studio_day,
        replies,
        today,
        ext: data.ext,
      });
    } catch {
      window.alert("Chưa tạo được file Excel — bạn thử lại sau giây lát nhé.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="flex items-center gap-1.5 text-[12.5px] font-bold disabled:opacity-60"
      style={{ color: "var(--ac)" }}
      title="Tải kế hoạch về máy dạng file Excel"
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Xuất Excel
    </button>
  );
}

function WeddingDateCard({ value, onSave, onCancel }: { value: string | null; onSave: (d: string) => void; onCancel?: () => void }) {
  const [d, setD] = useState(value ?? "");
  return (
    <section className="mt-3.5 rounded-[16px] px-5 py-[18px]" style={{ background: "var(--acS)", border: "1px solid var(--acM)" }}>
      <p className="flex items-center gap-1.5 text-[15px] font-bold" style={{ color: "var(--ac)" }}>
        <CalendarHeart size={17} /> {value ? "Đổi ngày cưới" : "Ngày cưới của bạn là ngày nào?"}
      </p>
      <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
        Việc cần làm được xếp theo mốc trước ngày cưới — đổi ngày là cả danh sách tự dời theo.
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <div className="w-[220px] max-w-full">
          <DateInput value={d} onChange={setD} allowPast />
        </div>
        <button
          disabled={!d || d === value}
          onClick={() => onSave(d)}
          className="rounded-[10px] px-4 py-2.5 text-[13px] font-bold disabled:opacity-50"
          style={{ background: "var(--ac)", color: "#fff" }}
        >
          Lưu ngày cưới
        </button>
        {onCancel && (
          <button onClick={onCancel} className="rounded-[10px] px-3 py-2.5 text-[13px] font-semibold" style={{ color: "var(--tx2)" }}>
            Huỷ
          </button>
        )}
      </div>
    </section>
  );
}
