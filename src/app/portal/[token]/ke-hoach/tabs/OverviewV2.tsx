"use client";

import Link from "next/link";
import { CalendarClock, Camera, Compass, CircleDollarSign, ExternalLink, Heart, ListChecks, Luggage, Sparkles, Store, Users, Wallet } from "lucide-react";
import { Empty, Section, Stack, type Tone } from "@/components/v2/kit";
import { vndShort } from "@/lib/types";
import { BUDGET_CATS, budgetSummary, guestSummary, taskStats, upcoming, type AgendaItem } from "@/lib/wedding-plan";
import type { Ctx } from "../ui";
import { DateChip, IconBox, NavRow, StatTile } from "../uiV2";

const KIND_ICON = { task: ListChecks, pay: CircleDollarSign, appt: CalendarClock } as const;

/**
 * TỔNG QUAN (giao diện mới) — bốn con số bấm được, "Sắp tới" gộp việc, khoản
 * phải trả và lịch hẹn studio thành một dòng thời gian, rồi các lối tắt. Cùng
 * phép tính với bản cũ (tabs/Overview.tsx); không có gì sửa được ở đây.
 */
export default function OverviewTabV2({ ctx }: { ctx: Ctx }) {
  const { data, plan, today, go } = ctx;
  const t = taskStats(plan.tasks, data.auto, plan.wedding_date, today);
  const money = budgetSummary(plan.budget, data.studio_line, plan.budget_total);
  const g = guestSummary(plan.guests, ctx.replies);
  const agenda = upcoming(plan, data.auto, { today, studioAppts: data.studio_appts, studioLine: data.studio_line });

  // Gói studio luôn là một hạng mục đã chốt (khách đã book chính studio này).
  const cats = new Set(plan.vendors.map((v) => v.cat));
  const booked = new Set(plan.vendors.filter((v) => v.status === "booked").map((v) => v.cat));
  cats.add("photo");
  booked.add("photo");

  const guestsValue = plan.guests.length ? String(g.people) : plan.settings.guests_expected ? `~${plan.settings.guests_expected}` : "—";
  const packed = plan.packing.filter((p) => p.packed).length;
  const hasBudget = plan.budget_total > 0;

  return (
    <Stack>
      <div className={`v2-statgrid ${data.ext ? "v2-statgrid-4" : ""}`}>
        <StatTile
          icon={ListChecks}
          label="Việc đã xong"
          value={`${t.done}/${t.total}`}
          bar={t.pct}
          hint={t.overdue ? `${t.overdue} việc quá hạn` : "Không có việc quá hạn"}
          hintTone={t.overdue ? "red" : undefined}
          onClick={() => go("tasks")}
        />
        <StatTile
          icon={Wallet}
          label={hasBudget ? (money.over ? "Vượt ngân sách" : "Ngân sách còn lại") : "Dự kiến chi"}
          value={hasBudget ? vndShort(Math.abs(money.left ?? 0)) : vndShort(money.cost)}
          valueTone={hasBudget && money.over ? "red" : undefined}
          bar={hasBudget ? money.pct : undefined}
          barTone={money.over ? "red" : "brand"}
          hint={money.owed > 0 ? `Còn phải trả ${vndShort(money.owed)}` : "Chưa có khoản nợ"}
          hintTone={money.over ? "red" : undefined}
          onClick={() => go("budget")}
        />
        {data.ext && (
          <StatTile
            icon={Users}
            label="Khách sẽ đến"
            value={guestsValue}
            // Tỉ lệ người đã phản hồi (sẽ dự hoặc không dự) trên tổng số được mời.
            bar={plan.guests.length ? (g.yes + g.no + g.pending ? ((g.yes + g.no) / (g.yes + g.no + g.pending)) * 100 : 0) : undefined}
            barTone="green"
            hint={plan.guests.length ? `${g.yes} đã xác nhận · ${g.pending} chưa` : "Chưa lập danh sách"}
            onClick={() => go("guests")}
          />
        )}
        {data.ext && (
          <StatTile
            icon={Store}
            label="Nhà cung cấp"
            value={`${booked.size}/${cats.size}`}
            bar={(booked.size / cats.size) * 100}
            barTone="green"
            hint="Hạng mục đã chốt"
            onClick={() => go("vendors")}
          />
        )}
      </div>

      <Section title="Sắp tới" desc="Việc cần làm, khoản phải trả và lịch hẹn với studio trong 45 ngày tới." icon={CalendarClock} flush>
        {agenda.length === 0 ? (
          <Empty compact icon={Sparkles} title="Không có gì phải lo trong 45 ngày tới" hint="Việc mới, khoản phải trả và lịch hẹn studio sẽ hiện ở đây khi tới gần." />
        ) : (
          agenda.map((a) => <AgendaRow key={a.key} a={a} onClick={() => go(a.kind === "task" ? "tasks" : a.kind === "pay" ? "budget" : "day")} />)
        )}
      </Section>

      {data.ext && (
        <Section title="Lối tắt" icon={Compass} flush>
          <NavRow leading={<IconBox icon={Luggage} />} title="Đồ cần mang" sub={plan.packing.length ? `${packed}/${plan.packing.length} đã xếp` : "Chưa có danh sách"} onClick={() => go("day")} />
          <NavRow
            leading={<IconBox icon={Camera} />}
            title="Ảnh cần chụp"
            sub={plan.shots.length ? `${plan.shots.length} tấm · ${data.studio_name} xem được` : "Chưa có danh sách"}
            onClick={() => go("style")}
          />
          {data.invite && ctx.openInvite ? (
            // Quà cưới: thiệp sửa ngay trong trang này.
            <NavRow
              leading={<IconBox icon={Heart} />}
              title="Thiệp cưới online"
              sub={data.invite.published ? `Đang hiển thị · ${data.invite.replies.length} phản hồi` : "Bản nháp — mở để sửa & xuất bản"}
              subTone={data.invite.published ? undefined : "amber"}
              onClick={ctx.openInvite}
            />
          ) : data.invite ? (
            <Link href={data.invite.href} className="v2-row v2-row-link">
              <IconBox icon={Heart} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">Thiệp cưới online</span>
                <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  {data.invite.published ? `Đã xuất bản · ${data.invite.replies.length} phản hồi` : "Studio tặng — mở để sửa"}
                </span>
              </span>
              <ExternalLink size={16} style={{ flex: "none", color: "var(--tx3)" }} />
            </Link>
          ) : (
            <NavRow
              leading={<IconBox icon={Store} />}
              title="Hạng mục chưa chốt"
              sub={BUDGET_CATS.filter((c) => cats.has(c.key) && !booked.has(c.key)).map((c) => c.label).join(", ") || "Không có"}
              onClick={() => go("vendors")}
            />
          )}
        </Section>
      )}
    </Stack>
  );
}

function AgendaRow({ a, onClick }: { a: AgendaItem; onClick: () => void }) {
  const Icon = KIND_ICON[a.kind];
  const tone: Tone = a.overdue ? "red" : a.kind === "appt" ? "blue" : a.kind === "pay" ? "amber" : "brand";
  return (
    <NavRow
      leading={<DateChip date={a.date} tone={tone} />}
      title={a.title}
      sub={
        <span className="flex items-center gap-1">
          <Icon size={13} className="flex-none" />
          <span className="min-w-0">
            {a.overdue ? "Quá hạn" : a.kind === "appt" ? "Lịch hẹn studio" : a.kind === "pay" ? "Thanh toán" : "Việc cần làm"}
            {a.sub ? ` · ${a.sub}` : ""}
          </span>
        </span>
      }
      subTone={a.overdue ? "red" : undefined}
      onClick={onClick}
    />
  );
}
