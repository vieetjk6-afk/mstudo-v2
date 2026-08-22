/** Khung xương dùng chung cho cả ba tab của màn Lịch làm việc. Lưới 7 cột đọc
 *  được cho cả lịch tháng (tab Buổi chụp, tab Đội ngũ) lẫn lưới tuần (tab Lịch
 *  studio), nên không cần ba khung xương khác nhau. */
export default function CalendarLoading() {
  return (
    <div>
      {/* Dải tab */}
      <div className="skeleton mb-4 h-[38px] w-[290px] rounded-[11px]" />

      {/* Header + view toggles */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="skeleton h-7 w-32" />
        <div className="flex gap-2">
          <div className="skeleton h-8 w-20 rounded-full" />
          <div className="skeleton h-8 w-20 rounded-full" />
        </div>
      </div>

      {/* Month nav */}
      <div className="mb-4 flex items-center justify-between">
        <div className="skeleton h-8 w-8 rounded-lg" />
        <div className="skeleton h-6 w-40" />
        <div className="skeleton h-8 w-8 rounded-lg" />
      </div>

      {/* Day-of-week headers */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {["T2","T3","T4","T5","T6","T7","CN"].map((d) => (
          <div key={d} className="skeleton h-5 rounded" />
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="card aspect-[1/1.1] min-h-[60px] p-1.5 sm:min-h-[80px]">
            <div className="skeleton mb-1 h-3 w-6" />
            {i % 5 === 0 && <div className="skeleton mt-1 h-4 w-full rounded" />}
            {i % 7 === 2 && <div className="skeleton mt-1 h-4 w-3/4 rounded" />}
          </div>
        ))}
      </div>
    </div>
  );
}
