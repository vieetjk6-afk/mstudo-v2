import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Site, SiteBlock } from "@/lib/types";

export type SiteData = {
  site: Site;
  blocks: SiteBlock[];
  owner: { full_name: string | null; pl_phone: string | null; pl_facebook: string | null; booking_token: string | null } | null;
  albums: { id: string; slug: string; title: string; cover_url: string | null }[];
  pricelist: { id: string; name: string; price: number; unit: string | null; category: string | null; description: string | null; list_key: string | null }[];
  /** Tên hiển thị của từng loại bảng giá (studio tự đặt ở trang Bảng giá). */
  priceLabels: Record<string, string>;
  feedback: { id: string; client_name: string | null; rating: number | null; content: string; reply: string | null }[];
};

/**
 * Load everything a tenant site needs to render: owner contact, ordered blocks,
 * and the reused data (published albums, active price list, approved feedback).
 * Pass onlyVisible=false for the owner's live preview (shows hidden blocks too).
 */
export async function loadSiteBundle(db: SupabaseClient, site: Site, onlyVisible = true): Promise<SiteData> {
  const ownerId = site.owner_id;
  let blocksQ = db.from("site_blocks").select("*").eq("site_id", site.id);
  if (onlyVisible) blocksQ = blocksQ.eq("visible", true);

  const [{ data: owner }, { data: blocks }, { data: albums }, { data: pricelist }] = await Promise.all([
    db.from("profiles").select("full_name, pl_phone, pl_facebook, booking_token, pl_list_labels").eq("id", ownerId).maybeSingle(),
    blocksQ.order("position"),
    // Chỉ hiện album đã ở giai đoạn GIAO KHÁCH (phase='delivery') và được tích
    // "Hiện ở trang chủ" (gallery_pinned) ra trang công khai của studio.
    db.from("albums").select("id, slug, title, cover_url").eq("owner_id", ownerId).eq("status", "published").eq("phase", "delivery").eq("gallery_pinned", true).order("created_at", { ascending: false }).limit(24),
    // Lấy cả dòng giá 0đ ("Phát sinh thêm", "Lưu ý"…) — khối bảng giá xếp chúng
    // xuống phần ghi chú thay vì bỏ hẳn như trước.
    db.from("studio_pricelist").select("id, name, price, unit, category, description, list_key").eq("owner_id", ownerId).eq("active", true).order("position"),
  ]);

  const albumList = (albums ?? []) as SiteData["albums"];
  let feedback: SiteData["feedback"] = [];
  if (albumList.length) {
    const ids = albumList.map((a) => a.id);
    const q = (cols: string) =>
      db
        .from("feedback")
        .select(cols)
        .in("album_id", ids)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(12);
    // `reply` (lời studio trả lời) đến từ migration `danh_gia_khach.sql`. Project
    // chưa chạy migration thì Postgres từ chối CẢ câu select và khối "Khách hàng
    // nói gì" trên website studio biến mất sạch — mất hẳn một khối bán hàng chỉ
    // vì một cột phụ. Hỏng thì đọc lại đúng các cột chắc chắn có.
    const full = await q("id, client_name, rating, content, reply");
    const rows = full.error ? (await q("id, client_name, rating, content")).data : full.data;
    feedback = ((rows ?? []) as unknown as SiteData["feedback"]).map((f) => ({ ...f, reply: f.reply ?? null }));
  }

  return {
    site,
    blocks: (blocks ?? []) as SiteBlock[],
    owner: (owner ?? null) as SiteData["owner"],
    albums: albumList,
    pricelist: (pricelist ?? []) as SiteData["pricelist"],
    priceLabels: ((owner as { pl_list_labels?: Record<string, string> | null } | null)?.pl_list_labels ?? {}) as Record<string, string>,
    feedback,
  };
}
