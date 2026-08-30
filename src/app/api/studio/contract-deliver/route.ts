import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverContractIfReady } from "@/lib/contract-delivery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * "Giao khách ngay" — tạo album giao khách cho hợp đồng KHÔNG đợi ảnh trên Drive.
 *
 * Bình thường album giao khách chỉ sinh ra khi thư mục ảnh chỉnh sửa đã có ảnh
 * (hợp đồng hoàn thành = thu đủ tiền, chưa chắc hậu kỳ xong). Nút này là lối
 * thoát cho studio tự biết mình đã xong: gửi ảnh nơi khác, ảnh vừa lên chưa kịp
 * chờ cron, hoặc thư mục Drive không phải nguồn thật.
 *
 * POST { contractId } → { ok, album, created, waiting }
 */
export async function POST(req: Request) {
  const profile = await requireStudio();
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { contractId } = (await req.json().catch(() => ({}))) as { contractId?: string };
  if (!contractId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const db = createAdminClient();
  const { data: c } = await db
    .from("studio_contracts")
    .select("id, owner_id, gallery_album_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!c || c.owner_id !== profile.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const r = await deliverContractIfReady(profile.id, contractId, { force: true, notifyExisting: true });
  if (!r.album) {
    return NextResponse.json(
      { error: "Chưa tạo được album giao khách — hợp đồng chưa có thư mục Drive (vào Đồng bộ Drive để kết nối/tạo)." },
      { status: 400 },
    );
  }

  const { data: fresh } = await db
    .from("studio_contracts")
    .select("gallery_album_id")
    .eq("id", contractId)
    .maybeSingle();
  return NextResponse.json({ ok: true, ...r, galleryAlbumId: fresh?.gallery_album_id ?? null });
}
