import { NextResponse, type NextRequest } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { studioDriveAuthUrl, studioDriveConfigured } from "@/lib/studio-drive";

export const dynamic = "force-dynamic";

/**
 * Đưa CHỦ studio sang Google để kết nối Drive (đồng bộ ảnh/video hợp đồng).
 *
 * Link mở bằng thẻ <a> (điều hướng cả trang) nên lỗi phải QUAY LẠI trang Đồng bộ
 * Drive kèm mã lỗi để hiện thông báo tiếng Việt — không trả JSON thô
 * ({"error":"forbidden"}) ra giữa màn hình.
 */
export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/dashboard/studio/drive-sync?${q}`, req.url));

  const profile = await requireStudio("full");
  if (!profile || profile.isStaff || (profile.actingRole !== "owner" && profile.actingRole !== "admin")) {
    return back("drive=forbidden");
  }
  if (!studioDriveConfigured()) return back("drive=notconfigured");

  return NextResponse.redirect(studioDriveAuthUrl(profile.id));
}
