import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import NewQuoteForm from "./NewQuoteForm";
import type { NewQuoteFormProps } from "./useNewQuoteForm";
import StudioDenied from "@/components/StudioDenied";
import { getBranchScope } from "@/lib/branches";


export default async function NewQuotePage(props: { searchParams?: Promise<{ booking?: string }> }) {
  const searchParams = await props.searchParams;
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
  // pl_list_labels: nhãn studio tự đặt cho từng bảng giá. Không có nó thì tiêu đề
  // nhóm rơi về `list_key` thô — hiện ra UUID hoặc slug "dinh-hon" giữa màn hình.
  const listLabels = ((profile as { pl_list_labels?: Record<string, string> | null }).pl_list_labels ?? {}) as Record<string, string>;
  const [{ data: services }, { data: pricelist }] = await Promise.all([
    supabase
      .from("studio_services")
      .select("id, name")
      .eq("owner_id", profile.id)
      .eq("active", true)
      .order("position", { ascending: true }),
    supabase
      .from("studio_pricelist")
      .select("id, name, price, unit, description, category, list_key")
      .eq("owner_id", profile.id)
      .eq("active", true)
      .gt("price", 0)
      .order("list_key", { ascending: true })
      .order("position", { ascending: true }),
  ]);


  // Chi nhánh đang xem → báo giá mới thuộc luôn cơ sở đó. "Xem gộp" hoặc "chưa
  // gán" thì để trống, không đoán hộ.
  const sel = (await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string)).selected;
  const branchId = typeof sel === "string" && sel !== "none" ? sel : null;

  // Báo giá từ một yêu cầu đặt lịch (?booking=id): điền sẵn khách, ngày, gói,
  // khỏi gõ lại. RLS + owner_id bảo đảm chỉ đọc được yêu cầu của chính studio.
  let fromBooking: NewQuoteFormProps["fromBooking"] = null;
  if (searchParams?.booking && /^[0-9a-f-]{36}$/i.test(searchParams.booking)) {
    const { data: bk } = await supabase
      .from("studio_bookings")
      .select("id, name, phone, facebook, preferred_date, note, package_name, details")
      .eq("id", searchParams.booking)
      .eq("owner_id", profile.id)
      .maybeSingle();
    if (bk) {
      const d = (bk as { details?: { packages?: { name: string }[] } | null }).details;
      fromBooking = {
        id: bk.id as string,
        name: (bk.name as string) || "",
        phone: (bk.phone as string) || "",
        facebook: (bk.facebook as string | null) ?? "",
        eventDate: (bk.preferred_date as string | null) ?? "",
        packageNames: d?.packages?.length ? d.packages.map((x) => x.name) : bk.package_name ? [bk.package_name as string] : [],
      };
    }
  }

  return (
    <NewQuoteForm
      ownerId={profile.id}
      branchId={branchId}
      services={(services ?? []) as { id: string; name: string }[]}
      pricelist={(pricelist ?? []) as { id: string; name: string; price: number; unit: string | null; description: string | null; category: string | null; list_key: string | null }[]}
      listLabels={listLabels}
      fromBooking={fromBooking}
    />
  );
}
