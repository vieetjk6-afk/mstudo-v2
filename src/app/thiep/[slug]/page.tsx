import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { mainUrl } from "@/lib/hosts";
import type { WeddingConfig, WeddingInvitation } from "@/lib/types";
import WeddingRenderer, { type Wish } from "./WeddingRenderer";

export const dynamic = "force-dynamic";

async function load(slug: string): Promise<WeddingInvitation | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("wedding_invitations")
    .select("id, owner_id, contract_id, slug, edit_token, template, config, published, created_at, updated_at")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (!data) return null;
  return data as WeddingInvitation;
}

/** Tên khách mời từ query (?guest=…) — cắt gọn, chống rỗng. */
function readGuest(sp?: { [k: string]: string | string[] | undefined }): string {
  const raw = sp?.guest ?? sp?.g;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v ?? "").toString().trim().slice(0, 80);
}

export async function generateMetadata(
  props: { params: Promise<{ slug: string }>; searchParams?: Promise<{ [k: string]: string | string[] | undefined }> }
): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const inv = await load(params.slug);
  if (!inv) return { title: "Không tìm thấy thiệp cưới" };
  const c = inv.config as WeddingConfig;
  const couple = [c.groom_name, c.bride_name].filter(Boolean).join(" ❤ ") || "Thiệp cưới";
  const guest = readGuest(searchParams);
  const title = `Thiệp cưới · ${couple}`;
  const description = guest
    ? `Trân trọng kính mời ${guest} đến chung vui cùng ${couple}.`
    : c.cover_quote || `Trân trọng kính mời bạn đến chung vui cùng ${couple}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: c.cover_url ? [c.cover_url] : undefined },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function WeddingInvitationPage(
  props: { params: Promise<{ slug: string }>; searchParams?: Promise<{ [k: string]: string | string[] | undefined }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const inv = await load(params.slug);
  if (!inv) notFound();
  const guest = readGuest(searchParams);

  // Draft (not published yet): show a clear notice instead of bouncing home, so
  // the studio/couple immediately knows they just need to hit "Xuất bản".
  if (!inv.published) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center" style={{ background: "#fbf7f2", color: "#3a3530", fontFamily: "var(--font-cormorant)" }}>
        <div className="max-w-md">
          <h1 className="font-serif text-3xl" style={{ color: "#b08968" }}>Thiệp chưa được xuất bản</h1>
          <p className="mx-auto mt-4 text-base" style={{ color: "rgba(58,53,48,0.62)" }}>
            Thiệp này đang ở chế độ nháp. Hãy mở trình chỉnh sửa và bấm <b>“Xuất bản thiệp”</b> để khách có thể xem.
          </p>
        </div>
      </main>
    );
  }

  // Guestbook = well-wishes left through the RSVP form.
  const db = createAdminClient();
  const { data: wishRows } = await db
    .from("wedding_rsvps")
    .select("guest_name, wish, created_at")
    .eq("invitation_id", inv.id)
    .not("wish", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  let wishes = ((wishRows ?? []) as Wish[]).filter((w) => w.wish && w.guest_name);
  // Khi cặp đôi đặt mật khẩu "trang xem riêng" → ẩn lời chúc khỏi thiệp công khai
  // (danh sách + lời chúc chỉ xem được qua /khach có mật khẩu). Khách vẫn gửi
  // RSVP/lời chúc bình thường; chỉ phần HIỂN THỊ danh sách lời chúc bị ẩn.
  if (((inv.config as WeddingConfig).guests_password ?? "").trim()) wishes = [];

  // Link Love Story: ưu tiên link nhập tay; nếu trống thì tự lấy theo hợp đồng.
  const cfg = inv.config as WeddingConfig;
  let storyUrl = cfg.story_url?.trim() || "";
  if (!storyUrl && inv.contract_id) {
    // limit(1) thay vì maybeSingle: hợp đồng có thể gắn >1 story (tránh lỗi).
    const { data: sps } = await db
      .from("story_pages")
      .select("slug")
      .eq("contract_id", inv.contract_id)
      .eq("published", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    const slug = sps?.[0]?.slug;
    if (slug) storyUrl = `/story/${slug}`;
  }
  // Trang story phục vụ ở HOST CHÍNH; thiệp có thể ở subdomain khác nên đường
  // dẫn tương đối sẽ sai host → chuyển sang URL tuyệt đối trên host chính.
  if (storyUrl.startsWith("/")) storyUrl = mainUrl(storyUrl);

  // KHÔNG để mật khẩu "trang xem riêng" lọt xuống thiệp công khai (config được
  // truyền vào component client) — lọc bỏ trước khi render.
  const { guests_password: _pw, ...safeCfg } = inv.config as WeddingConfig;
  const safeInv = { ...inv, config: safeCfg } as WeddingInvitation;

  return <WeddingRenderer inv={safeInv} wishes={wishes} guest={guest} storyUrl={storyUrl} />;
}
