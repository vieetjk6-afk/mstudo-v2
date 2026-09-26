import { requireStudio } from "@/lib/auth-guards";
import { createClient } from "@/lib/supabase/server";
import { brandFrom } from "@/lib/studio-brand";
import StudioDenied from "@/components/StudioDenied";
import VouchersView from "./VouchersView";
import type { Voucher } from "@/lib/vouchers";

/* ═══════════════════════════════════════════════════════════════════════════
   VOUCHER & THẺ QUÀ — /dashboard/studio/vouchers

   Bán thẻ quà mùa lễ, theo dõi thẻ nào đã thu tiền / đã dùng / hết hạn, và in
   thẻ đưa khách. Khách dùng thẻ ở tab Thanh toán của hợp đồng.
   Hạch toán: xem supabase/migrations/studio_vouchers.sql.
   ═══════════════════════════════════════════════════════════════════════════ */

const ROLES = ["owner", "admin", "manager", "branch_manager", "accountant"];

export default async function VouchersPage() {
  const profile = await requireStudio("plus");
  if (!profile) return <StudioDenied title="Cần gói Studio" message="Voucher & thẻ quà dành cho tài khoản gói Studio." />;
  if (!ROLES.includes(profile.actingRole as string)) return <StudioDenied />;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("studio_vouchers")
    .select("id, code, title, amount, price, buyer_name, buyer_phone, recipient_name, paid, paid_method, paid_at, expires_on, status, redeemed_contract_id, redeemed_at, note, created_at")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1000);

  return (
    <VouchersView
      initial={(data ?? []) as Voucher[]}
      migrated={!error}
      studioName={brandFrom(profile).name}
      studioPhone={(profile.pl_phone as string | null) ?? null}
    />
  );
}
