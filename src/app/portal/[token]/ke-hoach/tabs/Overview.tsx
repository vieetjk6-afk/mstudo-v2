"use client";

import Link from "next/link";
import { CalendarClock, Camera, CircleDollarSign, ExternalLink, Heart, ListChecks, Luggage, Store, Users, Wallet } from "lucide-react";
import { vndShort } from "@/lib/types";
import {
  BUDGET_CATS, budgetSummary, guestSummary, taskStats, upcoming,
  type AgendaItem,
} from "@/lib/wedding-plan";
import { Section, Stat, card, type Ctx } from "../ui";

const MONTH_SHORT = ["THG 1", "THG 2", "THG 3", "THG 4", "THG 5", "THG 6", "THG 7", "THG 8", "THG 9", "THG 10", "THG 11", "THG 12"];
const KIND_ICON = { task: ListChecks, pay: CircleDollarSign, appt: CalendarClock } as const;

/**
 * TỔNG QUAN — bốn con số và "Sắp tới". Không chứa thứ gì sửa được: bấm vào đâu
 * là sang đúng tab đó. "Sắp tới" gom việc, khoản phải trả và lịch hẹn studio về
 * một dòng thời gian, vì khách hỏi "tuần này phải lo gì" chứ không hỏi theo bảng.
 */
export default function OverviewTab({ ctx }: { ctx: Ctx }) {
  const { data, plan, today, go } = ctx;
  const t = taskStats(plan.tasks, data.auto, plan.wedding_date, today);
  const money = budgetSummary(plan.budget, data.studio_line, plan.budget_total);
  const g = guestSummary(plan.guests, ctx.replies);
  const agenda = upcoming(plan, data.auto, { today, studioAppts: data.studio_appts, studioLine: data.studio_line });

  // Nhà cung cấp: hạng mục đã chốt / hạng mục đang tìm. Gói studio luôn là một
  // hạng mục đã chốt (khách đã book chính studio này).
  const cats = new Set(plan.vendors.map((v) => v.cat));
  const booked = new Set(plan.vendors.filter((v) => v.status === "booked").map((v) => v.cat));
  cats.add("photo");
  booked.add("photo");

  const guestsValue = plan.guests.length ? String(g.people) : plan.settings.guests_expected ? `~${plan.settings.guests_expected}` : "—";
  const packed = plan.packing.filter((p) => p.packed).length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-2 min-[600px]:grid-cols-4 min-[600px]:gap-3">
        <Stat icon={ListChecks} label="Việc đã xong" value={`${t.done}/${t.total}`} bar={t.pct} hint={t.overdue ? `${t.overdue} việc quá hạn` : "Không có việc quá hạn"} hintColor={t.overdue ? "var(--rd)" : undefined} onClick={() => go("tasks")} />
        <Stat
          icon={Wallet}
          label={plan.budget_total > 0 ? (money.over ? "Vượt ngân sách" : "Ngân sách còn lại") : "Dự kiến chi"}
          value={plan.budget_total > 0 ? vndShort(Math.abs(money.left ?? 0)) : vndShort(money.cost)}
          bar={plan.budget_total > 0 ? money.pct : undefined}
          barColor={money.over ? "var(--rd)" : undefined}
          hint={money.owed > 0 ? `Còn phải trả ${vndShort(money.owed)}` : "Chưa có khoản nợ"}
          hintColor={money.over ? "var(--rd)" : undefined}
          onClick={() => go("budget")}
        />
        {data.ext && (
          <Stat icon={Users} label="Khách sẽ đến" value={guestsValue} hint={plan.guests.length ? `${g.yes} đã xác nhận · ${g.pending} chưa` : "Chưa lập danh sách"} onClick={() => go("guests")} />
        )}
        {data.ext && (
          <Stat icon={Store} label="Nhà cung cấp" value={`${booked.size}/${cats.size}`} hint="Hạng mục đã chốt" onClick={() => go("vendors")} />
        )}
      </div>

      <Section title="Sắp tới" sub="Việc cần làm, khoản phải trả và lịch hẹn với studio trong 45 ngày tới.">
        {agenda.length === 0 ? (
          <p className="py-4 text-[13px]" style={{ color: "var(--tx3)" }}>Không có gì phải lo trong 45 ngày tới.</p>
        ) : (
          <ul className="mt-2">
            {agenda.map((a, i) => <AgendaRow key={a.key} a={a} first={i === 0} onClick={() => go(a.kind === "task" ? "tasks" : a.kind === "pay" ? "budget" : "day")} />)}
          </ul>
        )}
      </Section>

      {data.ext && (
        <div className="grid grid-cols-1 gap-3 min-[600px]:grid-cols-3">
          <MiniCard icon={Luggage} title="Đồ cần mang" value={plan.packing.length ? `${packed}/${plan.packing.length} đã xếp` : "Chưa có danh sách"} onClick={() => go("day")} />
          <MiniCard icon={Camera} title="Ảnh cần chụp" value={plan.shots.length ? `${plan.shots.length} tấm · ${data.studio_name} xem được` : "Chưa có danh sách"} onClick={() => go("style")} />
          {data.invite && ctx.openInvite ? (
            // Quà cưới: thiệp sửa ngay trong trang này.
            <button onClick={ctx.openInvite} className="flex items-center gap-3 rounded-[14px] px-4 py-3 text-left" style={card}>
              <Heart size={18} style={{ color: "var(--ac)", flex: "none" }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold">Thiệp cưới online</span>
                <span className="block truncate text-[12px]" style={{ color: data.invite.published ? "var(--tx3)" : "var(--am)" }}>
                  {data.invite.published ? `Đang hiển thị · ${data.invite.replies.length} phản hồi` : "Bản nháp — mở để sửa & xuất bản"}
                </span>
              </span>
            </button>
          ) : data.invite ? (
            <Link href={data.invite.href} className="flex items-center gap-3 rounded-[14px] px-4 py-3" style={card}>
              <Heart size={18} style={{ color: "var(--ac)", flex: "none" }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold">Thiệp cưới online</span>
                <span className="block truncate text-[12px]" style={{ color: "var(--tx3)" }}>{data.invite.published ? `Đã xuất bản · ${data.invite.replies.length} phản hồi` : "Studio tặng — mở để sửa"}</span>
              </span>
              <ExternalLink size={15} style={{ color: "var(--tx3)", flex: "none" }} />
            </Link>
          ) : (
            <MiniCard icon={Store} title="Hạng mục chưa chốt" value={BUDGET_CATS.filter((c) => cats.has(c.key) && !booked.has(c.key)).map((c) => c.label).join(", ") || "Không có"} onClick={() => go("vendors")} />
          )}
        </div>
      )}
    </div>
  );
}

function AgendaRow({ a, first, onClick }: { a: AgendaItem; first: boolean; onClick: () => void }) {
  const d = new Date(a.date + "T00:00:00");
  const Icon = KIND_ICON[a.kind];
  const col = a.overdue ? "var(--rd)" : a.kind === "appt" ? "var(--bl)" : a.kind === "pay" ? "var(--am)" : "var(--ac)";
  return (
    <li style={first ? undefined : { borderTop: "1px solid var(--bd2)" }}>
      <button onClick={onClick} className="flex w-full items-center gap-3 py-2.5 text-left">
        <span className="flex w-[46px] flex-none flex-col items-center rounded-[10px] py-1" style={{ background: a.overdue ? "var(--rdS)" : "var(--sf2)" }}>
          <span className="tnum text-[17px] font-bold leading-tight" style={{ color: col }}>{String(d.getDate()).padStart(2, "0")}</span>
          <span className="text-[9.5px] font-bold" style={{ color: "var(--tx3)" }}>{MONTH_SHORT[d.getMonth()]}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold" style={{ textWrap: "pretty" }}>{a.title}</span>
          <span className="flex items-center gap-1 text-[12px]" style={{ color: a.overdue ? "var(--rd)" : "var(--tx3)" }}>
            <Icon size={12} className="flex-none" />
            {a.overdue ? "Quá hạn" : a.kind === "appt" ? "Lịch hẹn studio" : a.kind === "pay" ? "Thanh toán" : "Việc cần làm"}
            {a.sub ? ` · ${a.sub}` : ""}
          </span>
        </span>
      </button>
    </li>
  );
}

function MiniCard({ icon: Icon, title, value, onClick }: { icon: typeof Luggage; title: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-[14px] px-4 py-3 text-left" style={card}>
      <Icon size={18} style={{ color: "var(--ac)", flex: "none" }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold">{title}</span>
        <span className="block truncate text-[12px]" style={{ color: "var(--tx3)" }}>{value}</span>
      </span>
    </button>
  );
}

