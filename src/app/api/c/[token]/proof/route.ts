import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { driveImageUrlOrNull } from "@/lib/mstudo-drive";
import { limitByIpDurable } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  // Cổng công khai có UPLOAD FILE → giới hạn theo IP, giống hệt lý do ở route
  // cọc giữ ngày: ai cầm link + SĐT (cả hai đều nằm trong tay khách) vẫn có thể
  // bơm đầy bucket ảnh bằng một vòng lặp.
  const limited = await limitByIpDurable(req, "contract-proof", 10, 60_000);
  if (limited) return limited;

  const db = createAdminClient();

  // Validate token
  const { data: contract } = await db
    .from("studio_contracts")
    .select("id, owner_id, client_phone")
    .eq("client_token", params.token)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "invalid_token" }, { status: 403 });

  const form = await req.formData();

  // M1: cùng cổng SĐT như route hợp đồng chính (fail-closed) — chỉ khách đã xác
  // thực SĐT mới upload được, tránh ai cầm link token cũng spam bucket/notification.
  const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
  const phone = form.get("phone") as string | null;
  if (!contract.client_phone || digits(phone) !== digits(contract.client_phone)) {
    return NextResponse.json({ error: "wrong_phone" }, { status: 401 });
  }

  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "no_file" }, { status: 400 });

  // Validate image
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "not_image" }, { status: 400 });
  // Backstop: the client compresses before upload, so anything this large is abuse.
  if (file.size > 3 * 1024 * 1024) return NextResponse.json({ error: "too_large" }, { status: 400 });

  // H-2: Derive extension from validated MIME type, not client-supplied filename
  const EXT_MAP: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic" };
  const ext = EXT_MAP[file.type] ?? "jpg";

  // Lưu ưu tiên vào Drive admin; nếu chưa kết nối thì fallback Supabase.
  let publicUrl: string;
  const buf = Buffer.from(await file.arrayBuffer());
  const driveUrl = await driveImageUrlOrNull(buf, `proof-${contract.id}-${Date.now()}.${ext}`, file.type, true);
  if (driveUrl) {
    publicUrl = driveUrl;
  } else {
    const path = `client/${contract.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage
      .from("payment-proofs")
      .upload(path, buf, { contentType: file.type, upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    publicUrl = db.storage.from("payment-proofs").getPublicUrl(path).data.publicUrl;
  }

  const note = (form.get("note") as string | null) || null;
  let planId = (form.get("plan_id") as string | null) || null;
  // Chỉ chấp nhận plan_id thuộc đúng hợp đồng này (chống gắn plan_id tùy ý).
  if (planId) {
    const { data: plan } = await db
      .from("contract_payment_plan")
      .select("id")
      .eq("id", planId)
      .eq("contract_id", contract.id)
      .maybeSingle();
    if (!plan) planId = null;
  }
  await db.from("contract_client_proofs").insert({
    contract_id: contract.id,
    url: publicUrl,
    note,
    plan_id: planId,
  });

  // Notify owner
  await db.from("studio_notifications").insert({
    owner_id: contract.owner_id,
    contract_id: contract.id,
    kind: "payment",
    message: "Khách hàng đã gửi ảnh chuyển khoản.",
  });

  return NextResponse.json({ url: publicUrl });
}
