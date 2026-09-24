import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDeliveryPhase } from "@/lib/album-phase";

export const runtime = "nodejs";

// Danh sách ảnh của một gallery giao khách CÔNG KHAI (không mật khẩu), phân
// trang. Tách khỏi HTML SSR để trang chỉ gửi ~lô ảnh đầu; phần còn lại nạp qua
// đây. s-maxage cho CDN phục vụ lượt xem lặp (giảm Fast Origin Transfer), nhưng
// GIỮ NGẮN (60s): nếu chủ studio khoá mật khẩu / gỡ xuất bản album, bản public
// đã cache chỉ còn phục vụ tối đa ~60s trước khi CDN xác thực lại (handler khi
// đó trả 403/404). Đủ để hấp thụ lưu lượng dồn, đủ ngắn để hạn chế lộ.
const CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=60";

export async function GET(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 500, 1), 2000);

  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("id, status, is_gallery, phase, password_hash, gallery_pinned")
    .eq("slug", params.slug)
    .single();

  const isDelivery = isDeliveryPhase(album);
  if (!album || !isDelivery || album.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Album có mật khẩu → chỉ trả ảnh qua POST /access sau khi xác thực, KHÔNG lộ ở đây.
  const hasPassword = !album.gallery_pinned && !!album.password_hash;
  if (hasPassword) {
    return NextResponse.json({ error: "password_required" }, { status: 403 });
  }

  // Phân trang PHÍA DB thay vì đọc cả bảng rồi cắt trong JS: một album 3.000 ảnh
  // trước đây mỗi lượt gọi (kể cả xin ảnh 300–2300) đều nạp trọn 3.000 dòng. Nay
  // chỉ đọc đúng một trang + đếm tổng trong CÙNG một truy vấn ({ count: "exact" }).
  const { data: sources } = await admin
    .from("album_sources")
    .select("id, stage")
    .eq("album_id", album.id);
  const deliveryIds = (sources ?? []).filter((s) => s.stage === "delivery").map((s) => s.id as string);

  let query = admin
    .from("photos")
    .select("id, drive_file_id, name, source_id, position, is_video", { count: "exact" })
    .eq("album_id", album.id);
  // Tương đương filterDeliveryPhotos: có source giai đoạn "delivery" thì chỉ lấy
  // ảnh của các source đó (hoặc ảnh chưa gắn source); không có thì lấy tất cả.
  if (deliveryIds.length > 0) {
    query = query.or(`source_id.is.null,source_id.in.(${deliveryIds.join(",")})`);
  }
  const { data: photos, count } = await query
    .order("position")
    .order("id")
    .range(offset, offset + limit - 1);

  return NextResponse.json(
    { photos: photos ?? [], total: count ?? 0 },
    { headers: { "Cache-Control": CACHE } }
  );
}
