import "server-only";
import { timingSafeEqual } from "crypto";

/**
 * Kiểm header `Authorization: Bearer <CRON_SECRET>` của các route cron.
 *
 * Vì sao không so `!==` thường: phép so chuỗi dừng ở ký tự sai đầu tiên, nên
 * thời gian phản hồi lộ dần từng ký tự của secret cho kẻ đo đủ nhiều lần.
 * timingSafeEqual chạy hết độ dài bất kể khớp tới đâu.
 *
 * Fail-closed: thiếu CRON_SECRET thì KHOÁ, không mở — nếu không ai cũng gọi
 * được các cron gửi Zalo/email hàng loạt hay xoá dữ liệu.
 */
export function isCronAuthorized(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const given = Buffer.from(authorization, "utf8");
  // timingSafeEqual ném lỗi nếu khác độ dài; độ dài secret không phải bí mật
  // cần giữ (cố định theo cấu hình), nên trả false sớm ở đây là an toàn.
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}
