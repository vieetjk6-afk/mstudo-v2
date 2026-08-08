import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import NewQuoteForm from "./NewQuoteForm";
import StudioDenied from "@/components/StudioDenied";


export default async function NewQuotePage() {
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

  const supabase = createClient();
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

  return (
    <NewQuoteForm
      ownerId={profile.id}
      services={(services ?? []) as { id: string; name: string }[]}
      pricelist={(pricelist ?? []) as { id: string; name: string; price: number; unit: string | null; description: string | null; category: string | null; list_key: string | null }[]}
    />
  );
}
