import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WeddingConfig, WeddingInvitation } from "@/lib/types";
import GuestListView from "./GuestListView";

export const dynamic = "force-dynamic";

export const metadata = { title: "Danh sách khách · Thiệp cưới", robots: { index: false } };

/**
 * Trang xem riêng cho gia đình: chỉ hiện DANH SÁCH KHÁCH + LỜI CHÚC sau khi nhập
 * đúng mật khẩu. Trang này KHÔNG kèm sẵn dữ liệu hay mật khẩu — mọi thứ lấy qua
 * API sau khi xác thực (xem /api/thiep/guests/[slug]).
 */
export default async function GuestListPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const db = createAdminClient();
  const { data } = await db
    .from("wedding_invitations")
    .select("id, slug, config")
    .eq("slug", params.slug.toLowerCase())
    .maybeSingle();
  if (!data) notFound();

  const inv = data as Pick<WeddingInvitation, "id" | "slug" | "config">;
  const cfg = (inv.config ?? {}) as WeddingConfig;
  const enabled = !!(cfg.guests_password && cfg.guests_password.trim());
  const couple = [cfg.groom_name, cfg.bride_name].filter(Boolean).join(" & ") || "Thiệp cưới";

  return <GuestListView slug={inv.slug} couple={couple} enabled={enabled} />;
}
