import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { driveImageUrlOrNull } from "@/lib/mstudo-drive";
import { sendPushToOwner } from "@/lib/push";
import { limitByIpDurable } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Khách báo đã chuyển cọc giữ ngày, kèm ảnh biên lai.
 *
 * Chỉ đổi trạng thái sang 'paid' = "khách BÁO đã chuyển", KHÔNG phải "đã nhận".
 * Studio vẫn phải đối chiếu sao kê rồi tự xác nhận — ảnh chụp màn hình chuyển
 * khoản làm giả được trong 30 giây, nên coi nó là bằng chứng là tự lừa mình.
 *
 * Xác thực bằng deposit_token nằm trong link: token dài, sinh ngẫu nhiên, chỉ
 * khách vừa đặt lịch mới có. Không dùng id vì id lộ ra là đoán được bản ghi khác.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  // Cổng công khai có ghi + upload file → giới hạn theo IP, nếu không một script
  // có thể bơm đầy bucket ảnh.
  const limited = await limitByIpDurable(req, "booking-deposit", 10, 60_000);
  if (limited) return limited;

  const db = createAdminClient();
  const { data: booking } = await db
    .from("studio_bookings")
    .select("id, owner_id, name, deposit_amount, deposit_status, deposit_code")
    .eq("deposit_token", params.token)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "invalid_token" }, { status: 404 });

  // Studio đã xác nhận rồi thì thôi — đừng để khách vô tình đẩy ngược trạng thái.
  if (booking.deposit_status === "confirmed") {
    return NextResponse.json({ error: "already_confirmed" }, { status: 409 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;

  let proofUrl: string | null = null;
  if (file) {
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "not_image" }, { status: 400 });
    if (file.size > 3 * 1024 * 1024) return NextResponse.json({ error: "too_large" }, { status: 400 });
    // Đuôi file suy từ MIME đã kiểm, KHÔNG lấy từ tên file khách gửi lên.
    const EXT: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic",
    };
    const ext = EXT[file.type] ?? "jpg";
    const buf = Buffer.from(await file.arrayBuffer());
    // Ưu tiên Drive của admin (không tốn dung lượng Supabase), hỏng thì fallback.
    const driveUrl = await driveImageUrlOrNull(buf, `coc-${booking.id}-${Date.now()}.${ext}`, file.type, true);
    if (driveUrl) {
      proofUrl = driveUrl;
    } else {
      const path = `booking/${booking.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await db.storage
        .from("payment-proofs")
        .upload(path, buf, { contentType: file.type, upsert: false });
      if (upErr) return NextResponse.json({ error: "upload_failed" }, { status: 500 });
      proofUrl = db.storage.from("payment-proofs").getPublicUrl(path).data.publicUrl;
    }
  }

  const { error } = await db
    .from("studio_bookings")
    .update({
      deposit_status: "paid",
      deposit_paid_at: new Date().toISOString(),
      ...(proofUrl ? { deposit_proof_url: proofUrl } : {}),
    })
    .eq("id", booking.id);
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const msg = `${booking.name || "Khách"} báo đã chuyển cọc${booking.deposit_code ? ` · ${booking.deposit_code}` : ""}`;
  await db.from("studio_notifications").insert({
    owner_id: booking.owner_id,
    contract_id: null,
    kind: "payment",
    message: msg,
  });
  await sendPushToOwner(booking.owner_id, {
    title: "Khách báo đã chuyển cọc",
    body: msg,
    url: "/dashboard/studio/bookings",
    tag: "deposit",
  });

  return NextResponse.json({ ok: true });
}
