import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guards";
import { filterDriveConfigured, filterDriveConnected } from "@/lib/filter-drive";

export const dynamic = "force-dynamic";

/** Trạng thái kết nối Drive toàn quyền của công cụ Lọc ảnh cho studio đang đăng nhập. */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ configured: filterDriveConfigured(), connected: false }, { status: 200 });
  return NextResponse.json({
    configured: filterDriveConfigured(),
    connected: await filterDriveConnected(user.id),
  });
}
