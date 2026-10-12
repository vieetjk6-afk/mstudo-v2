import { NextResponse } from "next/server";
import { getBrandForHost } from "@/lib/host-brand";
import { getSiteMeta } from "@/lib/site-meta";

export const runtime = "nodejs";

/**
 * Favicon theo HOST: trên tên miền/subdomain riêng của studio → logo studio
 * (white-label, không bao giờ hiện dấu mstudo); trên host của mstudo → favicon
 * admin đặt trong Cài đặt, hoặc mặc định.
 *
 * Vì sao là route riêng thay vì đọc headers() trong generateMetadata của layout
 * gốc: headers() ở layout gốc biến MỌI trang thành dynamic — tắt luôn ISR của
 * showcase / gia / banggia, mỗi lượt xem đều chạy hàm và tính vào Fast Origin
 * Transfer. Layout gốc giờ chỉ trỏ favicon về đây; trang tĩnh lại cache được.
 *
 * Trả 302 rỗng + cache CDN 1 giờ. Khoá cache của CDN Vercel gồm cả host, nên
 * mỗi tên miền studio có bản riêng. `?apple=1` → icon màn hình chính iOS.
 */
const CACHE = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(req: Request) {
  const apple = new URL(req.url).searchParams.get("apple") === "1";
  let target: string;
  const brand = await getBrandForHost(req.headers.get("host"));
  if (brand) {
    target = brand.logoUrl || "/favicon.svg";
  } else {
    const { favicon } = await getSiteMeta();
    target = favicon || (apple ? "/logo-mark.svg" : "/favicon.svg");
  }
  let location: URL;
  try {
    location = new URL(target, req.url);
  } catch {
    location = new URL("/favicon.svg", req.url);
  }
  return NextResponse.redirect(location, { status: 302, headers: { "Cache-Control": CACHE } });
}
