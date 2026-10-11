import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIp } from "@/lib/rate-limit";
import { isShortMapLink, mapEmbedSrc, pickMapLink } from "@/lib/site-map";
import { resolveShortMapUrl } from "@/lib/map-resolve";

export const dynamic = "force-dynamic";

/* Link "Chia sẻ" của Google Maps trên điện thoại là link rút gọn
   (maps.app.goo.gl/…): trình duyệt không đọc được đích của nó nên thiệp không
   ghim được bản đồ. Trình chỉnh sửa thiệp gọi route này để server mở ra link
   đầy đủ (lib/map-resolve.ts) — giống /api/maps/resolve của trình tạo website,
   nhưng xác thực bằng mã sửa thiệp vì cặp đôi không đăng nhập. */

const ERR: Record<string, [string, number]> = {
  invalid: ["Link không được hỗ trợ.", 400],
  fetch_failed: ["Không mở được link. Thử dán link đầy đủ từ máy tính.", 502],
  not_found: ["Chưa lấy được vị trí từ link này. Mở Google Maps trên máy tính rồi copy link trên thanh địa chỉ.", 422],
};

export async function POST(req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const limited = limitByIp(req, "thiep-map", 30, 60_000);
  if (limited) return limited;

  const db = createAdminClient();
  const { data: inv } = await db.from("wedding_invitations").select("id").eq("edit_token", params.token).maybeSingle();
  if (!inv) return NextResponse.json({ error: "Phiên chỉnh sửa đã hết hạn, tải lại trang giúp mình nhé." }, { status: 404 });

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const input = pickMapLink(url ?? "");
  if (!input || !isShortMapLink(input)) {
    return NextResponse.json({ error: "Không phải link Google Maps rút gọn." }, { status: 400 });
  }

  const r = await resolveShortMapUrl(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  if (!("url" in r) || !mapEmbedSrc(r.url)) {
    const [msg, status] = ERR["error" in r ? r.error : "not_found"];
    return NextResponse.json({ error: msg }, { status });
  }
  return NextResponse.json({ url: r.url });
}
