// Mốc tự động nhắn Zalo — phần THUẦN, dùng được ở cả máy chủ lẫn trình duyệt.

export type EventCfg = { client?: boolean; crew?: boolean; templateId?: string };

/**
 * Mốc thêm vào SAU khi studio đã kết nối Zalo thì mặc định BẬT khi studio chưa
 * từng chạm tới nó (khoá chưa có trong `auto_events`).
 *
 * `DEFAULT_AUTO_EVENTS` chỉ mồi cho lần kết nối đầu, nên studio đang dùng sẽ
 * không bao giờ thấy mốc mới bật — mà "đã nhận đủ tiền" là tin khách chờ nghe,
 * không phải tin đòi tiền. Studio tắt một lần là lưu `{ client: false }`, và từ
 * đó mặc định này không còn tác dụng.
 */
export const LATE_DEFAULT_EVENTS: Record<string, EventCfg> = {
  payment_done: { client: true },
};

/** Cấu hình thật của một mốc: studio đã chỉnh thì theo studio, chưa thì theo mặc định muộn. */
export function eventCfg(events: Record<string, EventCfg> | null | undefined, key: string): EventCfg {
  return events?.[key] ?? LATE_DEFAULT_EVENTS[key] ?? {};
}

/** Đã thu ĐỦ: hợp đồng có giá trị và tổng các lần thu không thấp hơn giá trị đó. */
export function isFullyPaid(total: number, collected: number): boolean {
  return total > 0 && Math.round(collected) >= Math.round(total);
}
