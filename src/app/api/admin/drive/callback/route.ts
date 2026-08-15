import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { connectAdminDrive, verifyAdminDriveState } from "@/lib/mstudo-drive";

export const dynamic = "force-dynamic";

/** Google OAuth callback cho luồng kết nối Drive của admin. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  const back = (q: string) => NextResponse.redirect(new URL(`/dashboard/admin/system?${q}`, req.url));
  if (!admin) return back("drive=forbidden");

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  if (error || !code) return back("drive=error");

  // State phải do chính máy chủ ký VÀ trỏ đúng admin đang đăng nhập — nếu không,
  // một `code` do kẻ tấn công lấy sẵn có thể gắn Drive của họ vào ô lưu trữ dùng
  // chung khi admin lỡ mở link callback (account-linking CSRF).
  if (verifyAdminDriveState(searchParams.get("state")) !== admin.id) {
    return back("drive=invalid_state");
  }
  try {
    await connectAdminDrive(code);
    return back("drive=connected");
  } catch {
    return back("drive=error");
  }
}
