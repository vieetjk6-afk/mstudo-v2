import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron-auth";
import { ensureBucket, sweepExpired } from "@/lib/quick-share";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Lưới an toàn hằng ngày cho "Gửi file nhanh": xoá file quá 30 phút còn sót
 * (bình thường đã bị dọn tiện đường mỗi khi có người tạo link mới).
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  await ensureBucket(db);
  const removed = await sweepExpired(db, true);
  return NextResponse.json({ ok: true, removed });
}
