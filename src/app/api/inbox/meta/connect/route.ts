import { NextResponse, type NextRequest } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { metaAuthUrl, metaOAuthConfigured } from "@/lib/inbox/adapters/meta-oauth";

export const dynamic = "force-dynamic";

/**
 * Đưa chủ studio sang Facebook để chọn Trang và cấp quyền nhắn tin.
 *
 * Chỉ chủ studio và quản lý: nối Trang là trao cho MStudo quyền nhắn tin thay
 * mặt thương hiệu — không phải việc của nhân viên trực chat.
 */
export async function GET(req: NextRequest) {
  const profile = await requireStudio("booking");
  const role = (profile?.actingRole as string) ?? "";
  if (!profile || !["owner", "admin", "manager"].includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!metaOAuthConfigured()) {
    // Quay LẠI màn Kênh kèm lý do, không trả JSON: người dùng vừa bấm một nút
    // trên trang, đẩy họ tới một cục JSON là bỏ mặc giữa đường.
    return NextResponse.redirect(new URL("/dashboard/studio/inbox/ket-noi?meta=not_configured", req.url));
  }
  return NextResponse.redirect(metaAuthUrl(profile.id as string));
}
