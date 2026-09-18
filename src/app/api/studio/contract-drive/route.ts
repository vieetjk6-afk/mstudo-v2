import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureContractDriveTree } from "@/lib/studio-drive";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const TIME_BUDGET_MS = 260_000;

const COLS =
  "id, code, title, client_name, client_phone, event_date, shoot_type, service_id, status, drive_folder_id, drive_tree, drive_make_photo, drive_make_video, selection_album_id, gallery_album_id";

/** Hợp đồng ở trạng thái nào thì đáng tạo thư mục. Nháp thì chưa. */
const READY = ["approved", "in_progress", "post_production", "completed"];

const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

/**
 * Tạo cây thư mục Drive cho hợp đồng — TỪ WEB.
 *
 * Trước đây chỉ app desktop gọi được (/api/desktop/drive/prepare), nên studio
 * không chạy desktop thì không hợp đồng nào có thư mục và cũng không có chỗ nào
 * báo điều đó.
 *
 *   POST { contractId }  → tạo cho một hợp đồng
 *   POST { all: true }   → tạo cho mọi hợp đồng đã chốt còn thiếu thư mục
 *
 * ensureContractDriveTree idempotent: hợp đồng đã có thư mục thì trả lại đúng
 * thư mục cũ, không tạo trùng.
 */
export async function POST(req: Request) {
  const profile = await requireStudio();
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { contractId?: string; all?: boolean } | null;
  const db = createAdminClient();

  // ── Một hợp đồng ────────────────────────────────────────────────────
  if (body?.contractId) {
    const { data: ct } = await db
      .from("studio_contracts")
      .select(`${COLS}, owner_id`)
      .eq("id", body.contractId)
      .maybeSingle();
    if (!ct || (ct as { owner_id: string }).owner_id !== profile.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const res = await ensureContractDriveTree(profile.id, ct as never);
    if ("error" in res) {
      return NextResponse.json(
        {
          error:
            res.error === "not_connected"
              ? "Chưa kết nối Google Drive của studio — vào Đồng bộ Drive để kết nối."
              : res.error,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, folderId: res.folderId, url: folderUrl(res.folderId), path: res.pathSegments.join(" / ") });
  }

  // ── Hàng loạt ───────────────────────────────────────────────────────
  if (!body?.all) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: cts } = await db
    .from("studio_contracts")
    .select(COLS)
    .eq("owner_id", profile.id)
    .in("status", READY)
    .is("drive_folder_id", null)
    .order("event_date", { ascending: false });

  const startedAt = Date.now();
  let created = 0;
  let failed = 0;
  let done = true;
  let firstError: string | null = null;

  for (const ct of cts ?? []) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) { done = false; break; }
    const res = await ensureContractDriveTree(profile.id, ct as never);
    if ("error" in res) {
      // Chưa kết nối Drive thì hợp đồng nào cũng hỏng như nhau — dừng ngay,
      // đừng nện Google hàng trăm lần rồi báo cùng một lỗi.
      if (res.error === "not_connected") {
        return NextResponse.json({ error: "Chưa kết nối Google Drive của studio — vào Đồng bộ Drive để kết nối." }, { status: 400 });
      }
      failed++;
      firstError ??= res.error;
      continue;
    }
    created++;
  }

  return NextResponse.json({ ok: true, created, failed, done, firstError, pending: (cts ?? []).length });
}
