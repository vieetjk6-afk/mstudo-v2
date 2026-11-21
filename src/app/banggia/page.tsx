import { createAdminClient } from "@/lib/supabase/admin";
import { buildPublicLists } from "@/lib/pricelist-label";
import { resolveStudioOwner } from "@/lib/studio-owner";
import PricelistPoster from "@/components/PricelistPoster";
import PricelistV2 from "@/app/gia/PricelistV2";
import { customerUiV2 } from "@/lib/ui-server";
import type { PricelistItem } from "@/lib/types";

// Bảng giá công khai hiếm khi đổi: cho phép ISR + CDN cache 5 phút thay vì SSR
// no-store mọi lượt truy cập ẩn danh (giảm tải origin + tăng tốc trang).
export const revalidate = 300;

// Public price list for the main studio (admin account) at a clean URL.
export default async function BangGiaPage(props: { searchParams?: Promise<{ list?: string }> }) {
  const searchParams = await props.searchParams;
  const db = createAdminClient();
  const owner = await resolveStudioOwner();

  if (!owner) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Chưa có bảng giá</h1>
        </div>
      </div>
    );
  }

  // Hai truy vấn độc lập → chạy song song để bớt một vòng round-trip nối tiếp.
  const [{ data }, { data: th }, { data: svcs }] = await Promise.all([
    db
      .from("studio_pricelist")
      .select("*")
      .eq("owner_id", owner.id)
      .eq("active", true)
      .order("position"),
    db
      .from("profiles")
      .select("pl_bg, pl_text, pl_accent, pl_logo_url, pl_hidden_lists, pl_list_labels")
      .eq("id", owner.id)
      .maybeSingle(),
    // Bảng giá riêng của một dịch vụ có list_key = id dịch vụ → cần tên dịch vụ.
    db.from("studio_services").select("id, name").eq("owner_id", owner.id),
  ]);
  const allItems = (data ?? []) as PricelistItem[];
  const hidden = ((th?.pl_hidden_lists as string[] | null) ?? []);

  const labels = ((th?.pl_list_labels as Record<string, string> | null) ?? {});
  const lists = buildPublicLists(allItems, hidden, labels, (svcs ?? []) as { id: string; name: string }[]);
  const selected = (searchParams?.list && lists.find((l) => l.key === searchParams.list)?.key) || lists[0].key;
  const items = allItems.filter((i) => (i.list_key || "cuoi") === selected);
  const token = (owner as { booking_token: string | null }).booking_token || "";

  let theme: { bg?: string | null; text?: string | null; accent?: string | null; logo?: string | null } | undefined;
  if (th) theme = { bg: th.pl_bg, text: th.pl_text, accent: th.pl_accent, logo: th.pl_logo_url };

  // Giao diện mới đi theo studio sở hữu bảng giá; màu pl_* vẫn áp dụng ở cả hai bản.
  const Poster = (await customerUiV2(owner.id)) ? PricelistV2 : PricelistPoster;

  return (
    <Poster
      contact={owner as never}
      items={items}
      lists={lists}
      selected={selected}
      tabBase="/banggia"
      bookHref={token ? `/book/${token}` : "#"}
      theme={theme}
    />
  );
}
