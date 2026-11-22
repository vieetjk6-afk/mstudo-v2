/**
 * Hạn mặc định cho đợt CỌC của hợp đồng mới: hôm nay + 3 ngày, nhưng không
 * muộn hơn NGÀY TRƯỚC buổi chụp (và không sớm hơn hôm nay). Chuỗi 'YYYY-MM-DD'.
 *
 * Thuần, không import alias — test Node nạp thẳng được.
 */
export function defaultDepositDue(today: string, eventDate?: string | null, days = 3): string {
  const add = (iso: string, n: number) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return "";
  let due = add(today, days);
  if (eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    const dayBefore = add(eventDate, -1);
    if (dayBefore < due) due = dayBefore;
  }
  return due < today ? today : due;
}
