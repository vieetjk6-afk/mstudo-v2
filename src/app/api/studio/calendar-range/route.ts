import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { loadShootRange } from "@/app/dashboard/studio/calendar/shoot-data";

export const dynamic = "force-dynamic";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lịch buổi chụp + mốc ghi chú trong một khoảng ngày — màn Lịch gọi khi người
 * dùng lật ra ngoài khoảng ±6 tháng đã tải sẵn (xem shoot-data.ts).
 *   GET ?from=YYYY-MM-DD&to=YYYY-MM-DD   (tối đa ~13 tháng mỗi lượt)
 */
export async function GET(req: Request) {
  const profile = await requireStudio("booking");
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const p = new URL(req.url).searchParams;
  const from = p.get("from") || "";
  const to = p.get("to") || "";
  if (!YMD.test(from) || !YMD.test(to) || from > to) {
    return NextResponse.json({ error: "bad_range" }, { status: 400 });
  }
  // Chặn xin cả chục năm một lượt (đúng thứ vừa tránh ở trang).
  if (Date.parse(to) - Date.parse(from) > 400 * 86_400_000) {
    return NextResponse.json({ error: "range_too_large" }, { status: 400 });
  }
  const data = await loadShootRange(profile, from, to);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
