import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIp } from "@/lib/rate-limit";
import { driveImageUrlOrNull, driveFileUrlOrNull } from "@/lib/mstudo-drive";
import { sniffImageType } from "@/lib/upload-guard";

export const dynamic = "force-dynamic";

// Hard server caps (the client compresses images to WebP ≤~2MB; audio for the
// background music is allowed a bit more). The upload is token-gated.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * Token-gated image upload for the wedding-invitation editor. The client sends
 * an already-compressed image as multipart form-data; we store it in the public
 * `wedding-photos` bucket via the service role and return its public URL.
 */
export async function POST(req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  // Chặn lạm dụng nếu edit_token bị lộ (spam làm đầy bucket ảnh cưới).
  const limited = limitByIp(req, "thiep-upload", 40, 60_000);
  if (limited) return limited;

  const db = createAdminClient();
  const { data: inv } = await db
    .from("wedding_invitations")
    .select("id, owner_id")
    .eq("edit_token", params.token)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });

  // Suy ra kiểu tệp: ưu tiên MIME trình duyệt gửi lên; nhưng một số file .mp3
  // (và .m4a…) bị báo type RỖNG → đoán theo phần mở rộng tên tệp để không chặn nhầm.
  const nameExt = (file.name.split(".").pop() || "").toLowerCase();
  const AUDIO_EXT: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", flac: "audio/flac", weba: "audio/webm" };
  const IMAGE_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", heif: "image/heif" };
  const mime = file.type || "";
  // MIME "chung chung" (rỗng hoặc octet-stream) hay xảy ra với .mp3/.m4a → đoán
  // theo phần mở rộng để không chặn nhầm audio.
  const generic = !mime || mime === "application/octet-stream";
  const isAudio = mime.startsWith("audio/") || (generic && nameExt in AUDIO_EXT);
  const isImage = mime.startsWith("image/") || (generic && nameExt in IMAGE_EXT);
  if (!isImage && !isAudio) return NextResponse.json({ error: "bad_type" }, { status: 415 });
  if (file.size > (isAudio ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  // Kiểu nội dung thật để lưu (điền lại khi MIME chung chung) — dùng cho contentType + đuôi.
  const contentType = generic ? (isAudio ? (AUDIO_EXT[nameExt] || "audio/mpeg") : (IMAGE_EXT[nameExt] || "image/jpeg")) : mime;
  const ext = contentType === "image/webp" ? "webp" : (nameExt || contentType.split("/")[1] || (isAudio ? "mp3" : "jpg"));

  // Ảnh và nhạc đều ưu tiên Drive admin, chỉ fallback Supabase khi Drive hỏng.
  const buf = Buffer.from(await file.arrayBuffer());
  // Với ảnh: xác thực magic-byte thay vì tin MIME/đuôi client gửi (chống nhồi
  // tệp không-phải-ảnh vào bucket công khai). Audio giữ nguyên (không phải vector
  // XSS và nhận diện theo header dễ chặn nhầm các định dạng nhạc hợp lệ).
  const realImage = isImage ? sniffImageType(buf) : null;
  if (isImage && !realImage) return NextResponse.json({ error: "bad_type" }, { status: 415 });
  const storeType = realImage || contentType;
  const driveUrl = isImage
    ? await driveImageUrlOrNull(buf, `thiep-${inv.id}-${Date.now()}.${ext}`, storeType, false)
    // Nhạc đi qua route này (file nhỏ, lọt trần body) cũng vào Drive luôn —
    // /api/file phục vụ được, không cần ở lại Supabase.
    : await driveFileUrlOrNull(buf, `thiep-${inv.id}-${Date.now()}.${ext}`, storeType);
  if (driveUrl) return NextResponse.json({ url: driveUrl });

  const path = `${inv.owner_id}/${inv.id}/${crypto.randomUUID?.() ?? Date.now()}.${ext}`;
  const { error } = await db.storage
    .from("wedding-photos")
    .upload(path, buf, { upsert: false, contentType: storeType });
  if (error) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  const url = db.storage.from("wedding-photos").getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ url });
}
