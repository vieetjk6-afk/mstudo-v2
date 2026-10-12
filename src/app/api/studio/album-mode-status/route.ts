import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { albumModeReadiness, ensureStudioRootFolder } from "@/lib/studio-drive";
import { defaultAlbumMode, isDesktopReady, readinessHints } from "@/lib/album-mode";

export const dynamic = "force-dynamic";

/**
 * Studio đã dùng được "Album mặc định — tự đồng bộ từ mstudo desktop" chưa.
 *
 *   GET  → { desktopConnected, driveConfigured, driveConnected, rootFolderReady,
 *            planAllowsDesktop, ready, defaultMode, hints[], lastDesktopSyncAt }
 *   POST { action: "create_root" } → tạo thư mục gốc mặc định trên Drive ngay
 *        (chỉ chủ studio / admin), trả lại trạng thái mới.
 *
 * Dùng ở màn tạo hợp đồng và tab Sản phẩm của hợp đồng. Nhân viên cũng đọc được
 * (họ tạo hợp đồng), nhưng chỉ chủ studio mới tạo thư mục trên Drive.
 */
async function state(ownerId: string, tier: string | undefined) {
  const r = await albumModeReadiness(ownerId, tier === "full");
  return {
    ...r,
    ready: isDesktopReady(r),
    defaultMode: defaultAlbumMode(r),
    hints: readinessHints(r),
  };
}

export async function GET() {
  const p = await requireStudio("plus");
  if (!p) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await state(p.id as string, p.studioTier as string | undefined));
}

export async function POST(req: Request) {
  const p = await requireStudio("full");
  if (!p) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (p.isStaff || (p.actingRole !== "owner" && p.actingRole !== "admin")) {
    return NextResponse.json({ error: "Chỉ chủ studio tạo được thư mục trên Google Drive." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "create_root") return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const r = await ensureStudioRootFolder(p.id as string);
  if ("error" in r) {
    const msg =
      r.error === "not_connected"
        ? "Chưa kết nối Google Drive của studio — vào Đồng bộ Drive để kết nối trước."
        : `Không tạo được thư mục trên Drive: ${r.error}`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json(await state(p.id as string, p.studioTier as string | undefined));
}
