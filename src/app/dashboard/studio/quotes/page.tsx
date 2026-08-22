import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { getStudioHost } from "@/lib/studio-site";
import QuotesListView, { type QuoteRow } from "./QuotesListView";
import StudioDenied from "@/components/StudioDenied";
import { applyBranch, getBranchScope } from "@/lib/branches";


export default async function QuotesList() {
  const profile = await requireStudio("plus");
  if (profile?.actingRole === "accountant") return <StudioDenied message="Kế toán chỉ truy cập mục Thu chi & Bảng lương." />;
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Photographer hoặc Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Báo giá dành cho tài khoản gói <b>Photographer</b> trở lên.
          </p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Nâng cấp gói</a>
        </div>
      </div>
    );
  }

  const supabase = createClient();
  // Báo giá là thông tin thương mại: người phụ trách cơ sở A không được đọc giá
  // chào của cơ sở B.
  const { data } = await applyBranch(
    supabase
      .from("studio_quotes")
      .select("id, code, title, client_name, client_phone, client_token, status, branch_id, quote_items(qty, unit_price, selected, is_optional, is_discount), quote_adjustments(id, resolved)")
      .eq("owner_id", profile.id),
    (await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string)).selected
  ).order("created_at", { ascending: false });

  const studioHost = await getStudioHost(supabase, profile.id);
  return <QuotesListView list={(data ?? []) as unknown as QuoteRow[]} studioHost={studioHost} />;
}
