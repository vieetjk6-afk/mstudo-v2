import { requireStudio } from "@/lib/auth-guards";
import { createClient } from "@/lib/supabase/server";
import { brandFrom } from "@/lib/studio-brand";
import { getStudioHost } from "@/lib/studio-site";
import StudioDenied from "@/components/StudioDenied";
import VouchersView from "./VouchersView";
import { VOUCHER_COLS, VOUCHER_COLS_BASE, type Voucher } from "@/lib/vouchers";
import { readProgram, type VoucherProgram } from "@/lib/voucher-program";

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
  const q = (cols: string) =>
    supabase.from("studio_vouchers").select(cols).eq("owner_id", profile.id).order("created_at", { ascending: false }).limit(1000);
  // Chưa chạy studio_vouchers_loyalty.sql thì đọc bộ cột cũ — thẻ quà vẫn hiện.
  let { data, error } = await q(VOUCHER_COLS);
  if (error) ({ data, error } = await q(VOUCHER_COLS_BASE));

  const studioHost = await getStudioHost(supabase, profile.id);
  const pq = (cols: string) => supabase.from("studio_voucher_program").select(cols).eq("owner_id", profile.id).maybeSingle();
  let prog = await pq("enabled, percent, max_discount, valid_months, title, wedding_only");
  if (prog.error) prog = await pq("enabled, percent, max_discount, valid_months, title");

  return (
    <VouchersView
      studioHost={studioHost}
      program={readProgram(prog.data as unknown as Partial<VoucherProgram> | null)}
      programMigrated={!prog.error}
      initial={(data ?? []) as unknown as Voucher[]}
      migrated={!error}
      studioName={brandFrom(profile).name}
      studioPhone={(profile.pl_phone as string | null) ?? null}
    />
  );
}
