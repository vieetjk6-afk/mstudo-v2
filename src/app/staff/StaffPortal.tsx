"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Wand2, Bell, LayoutDashboard } from "lucide-react";
import { useToast } from "@/components/studio/Toast";
import { avatarStyle, initials } from "@/lib/avatar";
import { fmtDate, fmtDow } from "@/lib/date";
import type { ProductStatus, StudioAppointment, StudioNotification } from "@/lib/types";
import TodayView from "./TodayView";
import TaskQueue from "./TaskQueue";
import StaffNotifications from "./StaffNotifications";
import { useStaffScope } from "./useStaffPortal";

/* ═══════════════════════════════════════════════════════════════════════════
   CỔNG NHÂN VIÊN — khung 3 tab
   Hôm nay · Ảnh cần sửa · Thông báo
   ═══════════════════════════════════════════════════════════════════════════ */

export type TaskRow = {
  id: string;
  name: string;
  qty: number;
  cost: number;
  status: ProductStatus;
  note: string | null;
  assigned_to: string | null;
  contract: {
    id: string;
    code: string | null;
    title: string;
    client_name: string | null;
    delivery_due: string | null;
    assigned_to: string | null;
  } | null;
};

export type ChecklistRow = {
  id: string;
  label: string;
  done: boolean;
  position: number;
  contract_id: string;
  contract_code: string | null;
  contract_title: string;
};

type Tab = "today" | "tasks" | "notif";

export type StaffPortalProps = {
  me: string;
  meName: string;
  actingRole: string;
  studioName: string;
  today: string;
  appointments: StudioAppointment[];
  monthApptCount: number;
  myMonthApptCount: number;
  tasks: TaskRow[];
  notifications: StudioNotification[];
  checklist: ChecklistRow[];
  contractCount: number;
};

export default function StaffPortal({
  me, meName, actingRole, studioName, today,
  appointments, monthApptCount, myMonthApptCount, tasks, notifications, checklist, contractCount,
}: StaffPortalProps) {
  const { toast, toastNode } = useToast();
  const [tab, setTab] = useState<Tab>("today");

  // "Việc của tôi" hay "Cả studio" + các danh sách lọc theo phạm vi — logic
  // chung với giao diện mới, xem ./useStaffPortal.
  const { scope, setScope, canSeeAll, myAppts, myTasks, todayAppts, openTasks } = useStaffScope({
    me, actingRole, appointments, tasks, today,
  });
  const unread = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const TABS: { key: Tab; label: string; icon: typeof CalendarDays; badge: number }[] = [
    { key: "today", label: "Hôm nay", icon: CalendarDays, badge: todayAppts.length },
    { key: "tasks", label: "Ảnh cần sửa", icon: Wand2, badge: openTasks.length },
    { key: "notif", label: "Thông báo", icon: Bell, badge: unread },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      {/* ── Đầu trang ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <span
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[15px] font-bold"
          style={avatarStyle(meName)}
        >
          {initials(meName)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-bold" style={{ letterSpacing: "-.4px" }}>Chào {meName}</h1>
          <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{studioName}</p>
        </div>
        <div
          className="flex flex-none items-center gap-1.5 rounded-[10px] px-[13px] py-2 text-[12.5px] font-semibold"
          style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
        >
          <CalendarDays size={17} style={{ color: "var(--ac)" }} />
          {fmtDow(today)} · {fmtDate(today)}
        </div>
        <Link
          href="/dashboard/studio"
          className="flex flex-none items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold"
          style={{ border: "1px solid var(--bd)", background: "var(--sf)", color: "var(--tx2)" }}
        >
          <LayoutDashboard size={15} /> Khu quản lý
        </Link>
      </div>

      {/* ── Tab + phạm vi ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex flex-none items-center gap-1.5 rounded-[11px] px-[15px] py-[9px] text-[13px]"
              style={
                on
                  ? { background: "var(--acS)", border: "1px solid var(--acM)", color: "var(--ac)", fontWeight: 700 }
                  : { background: "var(--sf)", border: "1px solid var(--bd)", color: "var(--tx2)", fontWeight: 550 }
              }
              aria-pressed={on}
            >
              <t.icon size={16} />
              {t.label}
              {t.badge > 0 && (
                <span
                  className="tnum min-w-[19px] rounded-[20px] px-1.5 text-center text-[11px] font-bold"
                  style={on ? { background: "var(--ac)", color: "#fff" } : { background: "var(--bd2)", color: "var(--tx2)" }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}

        {canSeeAll && (
          <div className="ml-auto flex flex-none items-center gap-1 rounded-[11px] p-1" style={{ background: "var(--sf2)" }}>
            {(["mine", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className="rounded-[8px] px-2.5 py-1.5 text-[11.5px]"
                style={
                  scope === s
                    ? { background: "var(--sf)", color: "var(--tx)", fontWeight: 700, border: "1px solid var(--bd)" }
                    : { color: "var(--tx3)", fontWeight: 550 }
                }
              >
                {s === "mine" ? "Việc của tôi" : "Cả studio"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Nội dung tab ────────────────────────────────────────────────── */}
      <div key={tab} className="animate-[vkFade_.3s_ease_both]">
        {tab === "today" && (
          <TodayView
            today={today}
            todayAppts={todayAppts}
            upcoming={myAppts.filter((a) => a.appt_date > today).slice(0, 6)}
            openTaskCount={openTasks.length}
            overdueTaskCount={openTasks.filter((t) => !!t.contract?.delivery_due && t.contract.delivery_due < today).length}
            monthCount={scope === "mine" ? myMonthApptCount : monthApptCount}
            contractCount={contractCount}
            checklist={checklist}
            toast={toast}
          />
        )}
        {tab === "tasks" && <TaskQueue rows={myTasks} today={today} toast={toast} />}
        {tab === "notif" && <StaffNotifications initial={notifications} toast={toast} />}
      </div>

      {toastNode}
    </div>
  );
}
