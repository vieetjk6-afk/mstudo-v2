import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 404 CỦA MÁY MEDIA Ở NHÀ.
 *
 * Bản dựng máy media (BUILD_STANDALONE=1 + MEDIA_ONLY=1, xem next.config.mjs)
 * rewrite mọi /api/* KHÔNG nằm trong danh sách cho phép về đây — để máy ở nhà
 * không trả lời API của bảng điều khiển ra Internet. Một route nhỏ, không chạm
 * DB, thay vì để Next dựng cả trang not-found (layout gốc, font…) cho mỗi lượt.
 *
 * Trên Vercel không có rewrite nào trỏ tới đây; gọi thẳng cũng chỉ nhận 404.
 */
function chan() {
  return NextResponse.json(
    { error: "not_found", note: "Máy media chỉ phục vụ /api/img, /api/file, /api/version, /api/cron/*." },
    { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
  );
}

export const GET = chan;
export const HEAD = chan;
export const POST = chan;
export const PUT = chan;
export const PATCH = chan;
export const DELETE = chan;
