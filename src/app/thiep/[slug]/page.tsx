import { cache } from "react";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { studioLink } from "@/lib/studio-site";
import { thiepExtrasTag } from "@/lib/public-cache";
import type { PublicWeddingInvitation, WeddingConfig } from "@/lib/types";
import WeddingRenderer, { type Wish } from "./WeddingRenderer";

export const dynamic = "force-dynamic";

/* NHỚ GIỮA CÁC REQUEST — link thiệp gửi cho vài trăm khách mời, mỗi lượt mở
   trước đây kéo lại cột `config` (JSON khá nặng) và 100 lời chúc từ Supabase.
   • Nội dung thiệp nhớ theo `updated_at` (trigger tự đổi mỗi lần sửa, dù sửa
     ở trang sửa thiệp hay ở dashboard): mỗi lượt chỉ đọc MỘT dòng nhỏ
     (id, updated_at) — sửa xong là khoá đổi, khách thấy bản mới ngay.
   • Lời chúc + link Love Story nhớ 60 giây; gửi lời chúc (/api/thiep/rsvp)
     thì bỏ nhớ ngay. */

const COLS = "id, owner_id, contract_id, slug, template, config, published, created_at, updated_at";

/** Đọc dòng thiệp. strict (đang được nhớ): lỗi thì ném, không nhớ "không có thiệp". */
async function readInvitation(slug: string, strict: boolean): Promise<PublicWeddingInvitation | null> {
  const { data, error } = await createAdminClient().from("wedding_invitations").select(COLS).eq("slug", slug).maybeSingle();
  if (error && strict) throw new Error(error.message);
  return (data as PublicWeddingInvitation | null) ?? null;
}

/**
 * KHÔNG chọn `edit_token`: kết quả này đi thẳng xuống component client, mà ai
 * cầm token đó là sửa được thiệp qua /thiep/sua/<token>.
 *
 * Bọc React `cache()`: generateMetadata và page cùng gọi load() trong một
 * request.
 */
const load = cache(async (rawSlug: string): Promise<PublicWeddingInvitation | null> => {
  const slug = rawSlug.toLowerCase();
  const { data: head, error } = await createAdminClient()
    .from("wedding_invitations")
    .select("updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return readInvitation(slug, false);
  if (!head) return null;
  try {
    return await unstable_cache(() => readInvitation(slug, true), ["thiep-v1", slug, String(head.updated_at)], {
      revalidate: 86_400,
    })();
  } catch {
    return readInvitation(slug, false);
  }
});

type Extras = { wishes: Wish[]; storySlug: string | null };

/** Lời chúc + slug Love Story của hợp đồng. strict: lỗi thì ném (không nhớ danh sách rỗng). */
async function readExtras(invId: string, contractId: string | null, needStory: boolean, strict: boolean): Promise<Extras> {
  const db = createAdminClient();
  const [w, sps] = await Promise.all([
    db
      .from("wedding_rsvps")
      .select("guest_name, wish, created_at")
      .eq("invitation_id", invId)
      .not("wish", "is", null)
      .order("created_at", { ascending: false })
      .limit(100),
    // Link Love Story: ưu tiên link nhập tay; nếu trống thì tự lấy theo hợp đồng.
    // limit(1) thay vì maybeSingle: hợp đồng có thể gắn >1 story (tránh lỗi).
    needStory && contractId
      ? db
          .from("story_pages")
          .select("slug")
          .eq("contract_id", contractId)
          .eq("published", true)
          .order("updated_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (strict && (w.error || sps.error)) throw new Error((w.error ?? sps.error)?.message);
  return {
    wishes: ((w.data ?? []) as Wish[]).filter((x) => x.wish && x.guest_name),
    storySlug: ((sps.data as { slug: string }[] | null)?.[0]?.slug as string | undefined) ?? null,
  };
}

async function loadExtras(invId: string, contractId: string | null, needStory: boolean): Promise<Extras> {
  try {
    return await unstable_cache(() => readExtras(invId, contractId, needStory, true), ["thiep-extras-v1", invId, String(contractId), String(needStory)], {
      revalidate: 60,
      tags: [thiepExtrasTag(invId)],
    })();
  } catch {
    return readExtras(invId, contractId, needStory, false).catch(() => ({ wishes: [], storySlug: null }));
  }
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

  // Guestbook = well-wishes left through the RSVP form (nhớ 60 giây, xem loadExtras).
  const db = createAdminClient();
  const cfg = inv.config as WeddingConfig;
  let storyUrl = cfg.story_url?.trim() || "";
  const extras = await loadExtras(inv.id, inv.contract_id ?? null, !storyUrl);
  let wishes = extras.wishes;
  // Khi cặp đôi đặt mật khẩu "trang xem riêng" → ẩn lời chúc khỏi thiệp công khai
  // (danh sách + lời chúc chỉ xem được qua /khach có mật khẩu). Khách vẫn gửi
  // RSVP/lời chúc bình thường; chỉ phần HIỂN THỊ danh sách lời chúc bị ẩn.
  if (((inv.config as WeddingConfig).guests_password ?? "").trim()) wishes = [];

  const storySlug = extras.storySlug;
  if (!storyUrl && storySlug) storyUrl = `/story/${storySlug}`;
  // Thiệp ở host thiệp riêng nên đường dẫn tương đối sẽ sai host → chuyển sang
  // URL tuyệt đối trên domain của studio (domain riêng / tên miền phụ, chưa có
  // mới về host chính).
  if (storyUrl.startsWith("/")) storyUrl = await studioLink(db, inv.owner_id, storyUrl);

  // KHÔNG để mật khẩu "trang xem riêng" lọt xuống thiệp công khai (config được
  // truyền vào component client) — lọc bỏ trước khi render.
  const { guests_password: _pw, ...safeCfg } = inv.config as WeddingConfig;
  const safeInv = { ...inv, config: safeCfg } as PublicWeddingInvitation;

  return <WeddingRenderer inv={safeInv} wishes={wishes} guest={guest} storyUrl={storyUrl} />;
}
