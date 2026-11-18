import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron-auth";
import { withCronLog } from "@/lib/system-runs";
import { donKhuonMatAlbumCu, donSauNgay } from "@/lib/face-don";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron hằng đêm (vercel.json): xoá vector khuôn mặt (album_faces) của album đã
 * giao khách quá FACE_PRUNE_AFTER_DAYS ngày (mặc định 15). Tìm theo khuôn mặt
 * của khách vẫn chạy — nó dùng danh sách người đã gom, không dùng vector từng
 * khuôn mặt. Chi tiết và cái giá: src/lib/face-don.ts.
 *
 * Không có cổng gói (desktop/test/face-cong-goi.mjs): đây là việc DỌN dữ liệu,
 * không mở tính năng nào — album của gói nào cũng phải được dọn.
 *
 * Hết giờ giữa chừng thì dừng; đêm sau làm tiếp (album đã dọn chỉ tốn một câu xoá).
 */
async function run(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const kq = await donKhuonMatAlbumCu(createAdminClient(), { nganSachMs: 240_000 });
  return NextResponse.json({ ...kq, sauNgay: donSauNgay() }, { status: kq.ok ? 200 : 500 });
}

export const GET = withCronLog("cleanup-faces", run);
