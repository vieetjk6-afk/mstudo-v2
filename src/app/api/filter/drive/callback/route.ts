import { NextResponse, type NextRequest } from "next/server";
import { connectFilterDrive, ownerFromFilterState } from "@/lib/filter-drive";

export const dynamic = "force-dynamic";

/** Google OAuth callback cho luồng kết nối Drive toàn quyền của công cụ Lọc ảnh. */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const ownerId = ownerFromFilterState(state);
  const back = (q: string) => NextResponse.redirect(new URL(`/dashboard/filter?${q}`, req.url));

  if (error || !code || !ownerId) return back("driveconn=error");
  try {
    await connectFilterDrive(ownerId, code);
    return back("driveconn=connected");
  } catch {
    return back("driveconn=error");
  }
}
