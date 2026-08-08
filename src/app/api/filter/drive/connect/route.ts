import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, getProfileById } from "@/lib/auth-guards";
import { filterDriveAuthUrl, filterDriveConfigured } from "@/lib/filter-drive";

export const dynamic = "force-dynamic";

/**
 * Đưa người dùng sang Google để kết nối Drive toàn quyền cho công cụ Lọc ảnh.
 *
 * Quyền: MỌI tài khoản đang đăng nhập (kể cả nhân viên) — đúng bằng quyền dùng
 * công cụ Lọc ảnh, vì /api/filter/drive/status và /api/filter/copy-to-drive đều
 * làm việc theo id của chính người đăng nhập. Trước đây chỗ này đòi gói Studio
 * (requireStudio("full")) và lưu token theo id CHỦ studio → mọi tài khoản khác
 * bấm "Kết nối Google Drive" chỉ thấy trang trắng {"error":"forbidden"}.
 *
 * Link này được mở bằng thẻ <a> (điều hướng cả trang), nên mọi lỗi phải QUAY LẠI
 * trang Lọc ảnh kèm mã lỗi để hiện thông báo tiếng Việt — không trả JSON thô.
 */
export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/dashboard/filter?${q}`, req.url));

  const user = await getSessionUser();
  if (!user) return back("driveconn=unauthorized");

  const profile = await getProfileById(user.id);
  if (!profile || !profile.is_active) return back("driveconn=unauthorized");

  if (!filterDriveConfigured()) return back("driveconn=notconfigured");

  return NextResponse.redirect(filterDriveAuthUrl(user.id));
}
