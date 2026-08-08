import { NextResponse, type NextRequest } from "next/server";
import { connectStudioDrive, ownerFromState } from "@/lib/studio-drive";

export const dynamic = "force-dynamic";

/** Google OAuth callback cho luồng kết nối Drive của studio. state = ký(ownerId). */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const ownerId = ownerFromState(state);
  // Quay về ĐÚNG trang có thẻ kết nối Drive (trang này đọc ?drive=… để hiện
  // thông báo). Trước đây trả về /dashboard/studio/desktop — trang đó không đọc
  // tham số nên kết nối xong không thấy báo gì.
  const back = (q: string) => NextResponse.redirect(new URL(`/dashboard/studio/drive-sync?${q}`, req.url));

  if (error || !code || !ownerId) return back("drive=error");
  try {
    await connectStudioDrive(ownerId, code);
    return back("drive=connected");
  } catch {
    return back("drive=error");
  }
}
