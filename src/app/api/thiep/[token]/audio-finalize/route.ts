import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIp } from "@/lib/rate-limit";
import { driveFileUrlOrNull } from "@/lib/mstudo-drive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Chuyển file nhạc vừa tải lên từ Supabase Storage sang Drive admin.
 *
 * Vì sao phải qua hai bước: nhạc nền tới 10MB, vượt trần body ~4.5MB của
 * serverless trên Vercel, nên client buộc phải tải THẲNG lên Storage bằng URL
 * ký sẵn (xem audio-upload-url). Trước đây file dừng luôn ở đó và chiếm dung
 * lượng Supabase vĩnh viễn. Giờ server đọc lại file, đẩy sang Drive rồi XOÁ bản
 * trên Supabase — tốn một lần egress ~5MB để khỏi tốn storage mãi mãi.
 *
 * Hỏng ở bất kỳ bước nào cũng không sao: file vẫn nằm nguyên trên Supabase và
 * client giữ URL cũ.
 */
export async function POST(req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const limited = limitByIp(req, "thiep-audio-finalize", 30, 60_000);
  if (limited) return limited;

  const db = createAdminClient();
  const { data: inv } = await db
    .from("wedding_invitations")
    .select("id, owner_id")
    .eq("edit_token", params.token)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { path?: string } | null;
  const path = (body?.path || "").trim();
  // Chốt path phải nằm trong thư mục của ĐÚNG thiệp này — nếu không, ai cầm một
  // edit_token bất kỳ cũng chuyển/xoá được file của thiệp khác.
  const prefix = `${inv.owner_id}/${inv.id}/`;
  if (!path.startsWith(prefix) || path.includes("..")) {
    return NextResponse.json({ error: "bad_path" }, { status: 400 });
  }

  const { data: blob, error: dlErr } = await db.storage.from("wedding-photos").download(path);
  if (dlErr || !blob) return NextResponse.json({ url: null, reason: "download_failed" });

  const buf = Buffer.from(await blob.arrayBuffer());
  const name = path.split("/").pop() || "nhac.mp3";
  const url = await driveFileUrlOrNull(buf, `thiep-${inv.id}-${name}`, blob.type || "audio/mpeg");
  if (!url) return NextResponse.json({ url: null, reason: "drive_unavailable" });

  // Đã sang Drive an toàn → thu hồi chỗ trên Supabase.
  await db.storage.from("wedding-photos").remove([path]);
  return NextResponse.json({ url });
}
