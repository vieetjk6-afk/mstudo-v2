import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardCaptcha } from "@/lib/captcha-guard";
import { limitByIp } from "@/lib/rate-limit";
import { isDeliveryPhase } from "@/lib/album-phase";

export const dynamic = "force-dynamic";

/** Public: submit feedback for a gallery. */
export async function POST(req: Request) {
  const limited = limitByIp(req, "feedback", 10, 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    albumId?: string;
    clientName?: string;
    rating?: number;
    content?: string;
    captcha?: string;
  };

  const captcha = await guardCaptcha(req, "feedback", body.captcha);
  if (captcha) return captcha;
  const content = body.content?.trim();
  if (!body.albumId || !content) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const rating = body.rating && body.rating >= 1 && body.rating <= 5 ? body.rating : null;

  const db = createAdminClient();
  // Album phải ĐANG ở giai đoạn giao khách và đã xuất bản.
  //
  // Trước đây chỗ này đọc cờ CŨ `is_gallery`, trái với luật ở @/lib/album-phase
  // ("phase thắng is_gallery") nên sai cả hai chiều: album do studio tự tạo rồi
  // bấm "Giao khách" có phase='delivery' mà is_gallery=false thì khách gửi cảm
  // nhận bị chối; ngược lại album đã kéo NGƯỢC về giai đoạn chọn ảnh vẫn nhận
  // đánh giá dù trang đó không còn là trang giao khách nữa.
  const { data: album } = await db
    .from("albums")
    .select("id, is_gallery, phase, status")
    .eq("id", body.albumId)
    .single();
  if (!album || !isDeliveryPhase(album) || album.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // `approved` cố ý KHÔNG truyền: mặc định của cột là false, đánh giá chờ studio
  // duyệt ở /dashboard/studio/reviews rồi mới lên website.
  const { error } = await db.from("feedback").insert({
    album_id: body.albumId,
    client_name: body.clientName?.trim() || null,
    rating,
    content,
  });
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  // `pending: true` để trang khách nói đúng sự thật ("sẽ hiện sau khi studio
  // duyệt") thay vì chèn thẳng đánh giá vào danh sách công khai.
  return NextResponse.json({ ok: true, pending: true });
}
