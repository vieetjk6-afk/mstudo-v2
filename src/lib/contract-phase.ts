/**
 * Luật NGÀY để quyết định hợp đồng đã chuyển sang "Đang hậu kỳ" hay chưa.
 *
 * Tách khỏi contract-status.ts vì file đó `import "server-only"` và kéo theo
 * Drive + Google Lịch — không nạp được vào Node để kiểm thử. Ở đây chỉ có phép
 * so chuỗi ngày, không chạm database.
 */

/**
 * Ngày chụp CUỐI CÙNG của hợp đồng = muộn nhất trong (ngày chụp chính, mọi mốc
 * `studio_events`). Không có ngày nào thì trả null.
 *
 * Phải lấy MUỘN NHẤT chứ không phải sớm nhất: đám cưới hay có nhiều buổi (ngày
 * đãi trước, ngày cưới chính, chụp thêm hôm sau). Lấy sớm nhất thì hợp đồng
 * nhảy sang hậu kỳ trong khi vẫn còn buổi chưa chụp — và vì bước chuyển này tự
 * động, không ai bấm nút nào để phát hiện ra.
 */
export function latestShootDate(eventDate: string | null, milestones: (string | null)[]): string | null {
  const ds = [eventDate, ...milestones].filter((d): d is string => !!d);
  return ds.length ? ds.reduce((a, b) => (a > b ? a : b)) : null;
}

/**
 * Tới lúc chuyển sang "Đang hậu kỳ" chưa?
 *
 * So `<` chứ KHÔNG `<=`: ngày chụp vẫn là ngày đang chụp, sang hôm sau mới là
 * hậu kỳ. Dùng `<=` thì hợp đồng đổi trạng thái ngay giữa buổi chụp.
 *
 * Hợp đồng không có ngày nào → không biết đã chụp xong chưa → để nguyên.
 */
export function dueForPostProduction(
  eventDate: string | null,
  milestones: (string | null)[],
  today: string
): boolean {
  const latest = latestShootDate(eventDate, milestones);
  return !!latest && latest < today;
}
