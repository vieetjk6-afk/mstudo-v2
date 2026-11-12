import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIpDurable } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Public gallery search by album name OR client phone (phone is matched
 * server-side and never returned to the client).
 */
export async function GET(req: Request) {
  // Trang công khai, không đăng nhập: chặn dò hàng loạt số điện thoại.
  const limited = await limitByIpDurable(req, "album-search", 20, 60_000);
  if (limited) return limited;
  const raw = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  // H3: loại ký tự cấu trúc của bộ lọc PostgREST (`% , ( )`) trước khi nội suy
  // vào `.or(...)`. Nếu không, `q` chứa `),status.eq.published` có thể phá điều
  // kiện gallery_pinned và liệt kê mọi album đã publish (kể cả gallery riêng tư).
  const q = raw.replace(/[%,()]/g, " ").trim();
  if (!q) return NextResponse.json({ galleries: [] });

  const db = createAdminClient();
  const like = `%${q}%`;

  // H-3: Search by title only for public endpoint — phone/name search leaks PII.
  // Phone-based lookup is done server-side to find matching slugs, then results
  // only return safe fields (slug, title, cover_url, category).
  // A client may find their own (possibly private) gallery by exact phone.
  // Chống liệt kê gallery riêng tư: chỉ tra theo SĐT khi khách nhập gần đủ số
  // (≥8 chữ số). Chuỗi ngắn kiểu "090" khớp hàng loạt album private của mọi studio.
  //
  // KHỚP ĐỦ SỐ, không khớp chuỗi con: trước đây 8 chữ số bất kỳ (ilike %q%) đã
  // trả về album riêng tư / có khoá — mà mật khẩu album mặc định LÀ số điện
  // thoại khách, nên biết 8 số là còn ~100 khả năng đoán. Nay phải nhập đủ số
  // (9 số cuối trùng khớp, chấp nhận 0xxx / +84xxx / có dấu cách) mới ra album.
  const digits = q.replace(/\D/g, "");
  let phoneMatchSlugs: string[] = [];
  if (digits.length >= 9 && digits.length <= 12) {
    const key = digits.slice(-9);
    const { data: byPhone } = await db
      .from("albums")
      .select("slug, client_phone")
      .or("is_gallery.eq.true,phase.eq.delivery")
      .eq("status", "published")
      .ilike("client_phone", `%${key.slice(-3)}%`)
      .limit(500);
    phoneMatchSlugs = (byPhone ?? [])
      .filter((r) => String(r.client_phone ?? "").replace(/\D/g, "").endsWith(key))
      .map((r) => r.slug);
  }

  // Title search only surfaces albums pinned to the homepage; phone matches are
  // allowed through so a client can reach their private gallery.
  const titleClause = `and(gallery_pinned.eq.true,title.ilike.${like})`;
  const { data } = await db
    .from("albums")
    .select("slug, title, category, category_label, cover_url, gallery_pinned")
    .eq("status", "published")
    .or(
      phoneMatchSlugs.length > 0
        ? `${titleClause},slug.in.(${phoneMatchSlugs.map((s) => `"${s}"`).join(",")})`
        : titleClause
    )
    .order("created_at", { ascending: false })
    .limit(60);

  return NextResponse.json({ galleries: data ?? [] });
}
