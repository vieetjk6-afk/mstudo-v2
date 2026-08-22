/** Khung xương lịch studio — cùng hình khối với SchedulePage để lúc nạp xong
 *  nội dung không nhảy: đầu trang, dải chip lọc, lưới 7 cột, rail 300px. */
export default function ScheduleLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="skeleton h-6 w-36" />
          <div className="skeleton mt-2 h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-10 w-32 rounded-[10px]" />
          <div className="skeleton h-10 w-28 rounded-[10px]" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-28 rounded-[20px]" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3.5 min-[1180px]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card overflow-hidden rounded-[14px]">
          <div className="grid grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5 p-2" style={{ borderLeft: i === 0 ? "none" : "1px solid var(--bd2)" }}>
                <div className="skeleton h-12 w-full rounded-[8px]" />
                {Array.from({ length: (i % 3) + 1 }).map((_, j) => (
                  <div key={j} className="skeleton h-16 w-full rounded-[10px]" />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="skeleton h-52 rounded-[14px]" />
          <div className="skeleton h-40 rounded-[14px]" />
        </div>
      </div>
    </div>
  );
}
