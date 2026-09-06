import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { getStudioHost } from "@/lib/studio-site";
import QuoteEditor from "./QuoteEditor";
import StudioDenied from "@/components/StudioDenied";
import type { StudioQuote, QuoteItem, QuoteAdjustment } from "@/lib/types";
import { isBranchScopedRole } from "@/lib/studio-roles";


export default async function QuoteDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const profile = await requireStudio("plus");
  if (profile?.actingRole === "accountant") return <StudioDenied message="Kế toán chỉ truy cập mục Thu chi & Bảng lương." />;
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Photographer hoặc Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Báo giá dành cho tài khoản gói <b>Photographer</b> trở lên.</p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Nâng cấp gói</a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: quote } = await supabase.from("studio_quotes").select("*").eq("id", params.id).eq("owner_id", profile.id).maybeSingle();
  if (!quote) notFound();

  // "Toàn quyền chi nhánh": chỉ mở được báo giá của chính chi nhánh mình. Lọc ở
  // danh sách là hiển thị; đây mới là chốt (xem ghi chú cùng loại ở contracts/[id]).
  if (isBranchScopedRole(profile.actingRole as string)) {
    const mine = (profile.actingBranchId as string | null) ?? null;
    if (!mine || quote.branch_id !== mine) notFound();
  }

  const [{ data: items }, { data: adjustments }, studioHost] = await Promise.all([
    supabase.from("quote_items").select("*").eq("quote_id", params.id).order("position"),
    supabase.from("quote_adjustments").select("*").eq("quote_id", params.id).order("created_at", { ascending: false }),
    getStudioHost(supabase, profile.id),
  ]);

  return (
    <QuoteEditor
      quote={quote as StudioQuote}
      initialItems={(items ?? []) as QuoteItem[]}
      initialAdjustments={(adjustments ?? []) as QuoteAdjustment[]}
      canConvert={profile.studioTier === "full"}
      studioHost={studioHost}
      // ?? chứ không phải ||: studio đặt 0 ngày nghĩa là CỐ Ý không đặt hạn.
      quoteValidDays={(profile as { quote_valid_days?: number }).quote_valid_days ?? 15}
    />
  );
}
