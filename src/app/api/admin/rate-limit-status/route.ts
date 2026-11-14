import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { rateLimitMode } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Bộ đếm nào đang canh các cửa dò mật khẩu album / SĐT hợp đồng:
 *   upstash  — Upstash Redis (tốt nhất)
 *   postgres — hàm rate_limit_hit trong Supabase (migrations/gioi_han_tan_suat.sql)
 *   memory   — chỉ trong bộ nhớ từng máy chủ: dò song song là lọt → phải sửa
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ mode: await rateLimitMode() });
}
