import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-guards";
import { limitByIp } from "@/lib/rate-limit";
import { isShortMapLink, mapEmbedSrc } from "@/lib/site-map";
import { resolveShortMapUrl } from "@/lib/map-resolve";

export const dynamic = "force-dynamic";

/* Link "Chia sẻ" của Google Maps trên điện thoại luôn ở dạng rút gọn
   (maps.app.goo.gl/…) và KHÔNG nhúng được vào iframe. Trình tạo website gọi
   route này để server mở link ra URL đầy đủ (xem lib/map-resolve.ts). */

const ERR: Record<string, [string, number]> = {
  invalid: ["Link không được hỗ trợ.", 400],
  fetch_failed: ["Không mở được link. Thử dán link đầy đủ từ máy tính.", 502],
  not_found: ["Chưa lấy được vị trí từ link này. Mở Google Maps trên máy tính rồi copy link trên thanh địa chỉ.", 422],
};

export async function POST(req: Request) {
  const limited = limitByIp(req, "maps-resolve", 30, 60_000);
  if (limited) return limited;

  // Chỉ người đã đăng nhập (studio đang soạn website) mới dùng được.
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const input = (url ?? "").trim();
  if (!input || !isShortMapLink(input)) {
    return NextResponse.json({ error: "Không phải link Google Maps rút gọn." }, { status: 400 });
  }

  const r = await resolveShortMapUrl(input);
  const embed = "url" in r ? mapEmbedSrc(r.url) : null;
  if (!("url" in r) || !embed) {
    const [msg, status] = ERR["error" in r ? r.error : "not_found"];
    return NextResponse.json({ error: msg }, { status });
  }
  return NextResponse.json({ url: r.url, embed });
}
