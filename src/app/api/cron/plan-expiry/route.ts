import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Cron HẠ GÓI HẾT HẠN (vercel.json, mỗi ngày): mọi tài khoản có gói trả phí /
 * dùng thử đã quá `plan_expires_at` → về gói free, kèm các cột quyền cũ
 * (monthly_album_limit, can_zip, can_notes, can_galleries…).
 *
 * Vì sao cần: trước đây việc hạ gói chỉ chạy trong dashboard/layout.tsx, nên
 * tài khoản không mở dashboard (chỉ dùng app desktop, hoặc chỉ để khách xem
 * album) giữ nguyên quyền của gói cũ mãi mãi — trigger hạn mức album và trang
 * album khách đọc thẳng các cột quyền đó. Xem
 * supabase/migrations/dung_thu_va_het_han.sql.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await createAdminClient().rpc("downgrade_expired_plans");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, downgraded: data ?? 0 });
}
