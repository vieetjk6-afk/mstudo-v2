import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Kiểm tra sức khoẻ tiến trình. Dùng bởi:
 *   - deploy/activate.sh — chờ bản mới sẵn sàng trước khi cắt bản cũ; không
 *     "ok" trong 60 giây thì tự động quay về bản trước (rollback).
 *   - giám sát bên ngoài (UptimeRobot…) — báo khi trang chết.
 *
 * KHÔNG chạm cơ sở dữ liệu: mục đích là trả lời "tiến trình Node có nhận
 * request không". Trộn thêm phép thử DB vào đây sẽ khiến deploy thất bại và
 * rollback oan mỗi khi Supabase chớp một nhịp, dù bản build hoàn toàn tốt.
 *
 * Không trả về thông tin nội bộ (phiên bản gói, đường dẫn, biến môi trường) vì
 * endpoint này công khai.
 */
export function GET() {
  return NextResponse.json(
    { ok: true, uptime: Math.round(process.uptime()) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
