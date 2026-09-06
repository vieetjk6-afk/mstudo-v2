import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { filterDriveConfigured, filterDriveConnected } from "@/lib/filter-drive";

export const dynamic = "force-dynamic";

/** Trạng thái kết nối Drive toàn quyền của công cụ Lọc ảnh cho studio đang đăng nhập. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ configured: filterDriveConfigured(), connected: false }, { status: 200 });
  return NextResponse.json({
    configured: filterDriveConfigured(),
    connected: await filterDriveConnected(user.id),
  });
}
