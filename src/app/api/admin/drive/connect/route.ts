import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { adminDriveAuthUrl, adminDriveConfigured } from "@/lib/mstudo-drive";

export const dynamic = "force-dynamic";

/** Admin → Google để cấp quyền Drive lưu nội dung người dùng. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!adminDriveConfigured()) {
    return NextResponse.json(
      { error: "not_configured", hint: "Chưa cấu hình OAuth: cần NEXT_PUBLIC_GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_ADMIN_DRIVE_REDIRECT_URI." },
      { status: 200 },
    );
  }
  return NextResponse.redirect(adminDriveAuthUrl(admin.id as string));
}
