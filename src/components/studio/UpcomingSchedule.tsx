import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Panel, PanelHead, EmptyState } from "@/components/studio/ui";
import { avatarStyle, initials } from "@/lib/avatar";
import { fmtDayMonth } from "@/lib/date";
import { CONTRACT_STATUS_TONE, type ContractStatus } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   LỊCH HÔM NAY & SẮP TỚI — khối đầu tiên của màn Tổng quan.

   Đứng ngay sau bốn thẻ KPI vì đây là thứ người ta mở Tổng quan để xem đầu
   tiên: hôm nay chụp gì, mai chụp gì. Trước đây nó nằm dưới biểu đồ doanh thu,
   phải cuộn qua ba khối mới thấy — mà biểu đồ thì mỗi tháng xem một lần, còn
   lịch thì mỗi sáng.

   Để riêng thành component (thay vì viết thẳng trong page.tsx) để dựng được
   trong trình duyệt với dữ liệu mẫu mà kiểm tra bố cục — xem
   desktop/test/upcoming-schedule.mjs.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ScheduleItem = {
  id: string;
  title: string;
  client_name: string | null;
  event_date: string | null;
  event_time: string | null;
  status: ContractStatus;
};

/** Số dòng vẽ ra. 8 = vừa hết một tuần bận mà chưa phải cuộn; phần dư đếm lại. */
export const SCHEDULE_ROWS = 8;

export default function UpcomingSchedule({
  rows,
  today,
  maxRows = SCHEDULE_ROWS,
}: {
  /** Đã sắp sẵn: buổi hôm nay trước, rồi tới các buổi sau theo ngày và giờ. */
  rows: ScheduleItem[];
  today: string;
  maxRows?: number;
}) {
  const todayCount = rows.filter((c) => c.event_date === today).length;
  const laterCount = rows.length - todayCount;

  return (
    /* `min-w-0` KHÔNG thừa: khối này là con TRỰC TIẾP của `flex flex-col` ở
       page.tsx, mà item của flex mặc định `min-width: auto` ⇒ không co được
       xuống dưới min-content. Trước đây nó nằm trong một lưới `minmax(0,1fr)`
       nên tự có chặn trên; giờ phải tự khai. */
    <Panel className="min-w-0 overflow-hidden">
      <PanelHead
        icon={CalendarDays}
        tone="brand"
        title="Lịch hôm nay & sắp tới"
        count={`${todayCount} hôm nay · ${laterCount} sắp tới`}
        note="Xếp theo buổi gần nhất"
      />
      {rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Chưa có buổi chụp nào sắp tới" hint="Tạo hợp đồng hoặc nhận đặt lịch để lấp lịch tuần này." />
      ) : (
        <>
          {/*
            BA LỚP CHẶN cho tên hợp đồng dài — đừng gỡ lớp nào, mỗi lớp bịt một
            đường khác nhau mà chữ có thể chạy ra ngoài thẻ:

              1. `min-w-0` trên <Panel>  — khối là item của flex column, mặc
                 định `min-width:auto` nên không co được dưới min-content.
              2. `grid-cols-1` ở đây     — lưới không khai cột thì cột ngầm là
                 `auto`; tiện ích grid-cols-* của Tailwind sinh
                 `minmax(0, 1fr)`, đúng cái chặn trên còn thiếu.
              3. `min-w-0` trên mỗi <Link> — dòng là item của lưới, cũng dính
                 `min-width:auto` y như vậy.

            Thiếu bất kỳ lớp nào thì `truncate` bên trong mất chỗ dựa: nó vẫn
            đặt `white-space:nowrap` nhưng không có bề ngang để cắt, nên chữ
            chạy thẳng ra ngoài mà KHÔNG có dấu "…".
          */}
          <div className="grid grid-cols-1 px-2 py-2 min-[900px]:grid-cols-2">
            {rows.slice(0, maxRows).map((c) => {
              const isToday = c.event_date === today;
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/studio/contracts/${c.id}`}
                  className="nav-item flex w-full min-w-0 items-center gap-2.5 rounded-[10px] px-2 py-[9px] text-left"
                >
                  {/* Cột ngày/giờ cố định bề ngang để mọi dòng thẳng hàng: buổi
                      hôm nay chỉ cần giờ, buổi sau cần ngày. */}
                  <span className="tnum w-[58px] flex-none text-[11.5px] font-bold" style={{ color: isToday ? "var(--ac)" : "var(--tx3)" }}>
                    {isToday ? c.event_time || "Hôm nay" : fmtDayMonth(c.event_date)}
                  </span>
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10.5px] font-bold" style={avatarStyle(c.client_name)}>
                    {initials(c.client_name || c.title)}
                  </span>
                  <span className="block min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold">{c.title}</span>
                    <span className="block truncate text-[11px]" style={{ color: "var(--tx3)" }}>
                      {c.client_name || "Chưa có tên khách"}
                      {!isToday && c.event_time ? ` · ${c.event_time}` : ""}
                    </span>
                  </span>
                  <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: CONTRACT_STATUS_TONE[c.status].fg }} />
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-3 px-4 pb-3 pt-1">
            {rows.length > maxRows && (
              <span className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
                và {rows.length - maxRows} buổi nữa
              </span>
            )}
            <Link href="/dashboard/studio/calendar" className="ml-auto whitespace-nowrap text-[12px] font-semibold" style={{ color: "var(--ac)" }}>
              Xem lịch làm việc →
            </Link>
          </div>
        </>
      )}
    </Panel>
  );
}
