import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import { getStudioHost } from "@/lib/studio-site";
import { getFeatureFlags, storyComingSoon } from "@/lib/feature-flags";
import { ensureIntakeToken } from "@/lib/contract-intake";
import { brandFrom } from "@/lib/studio-brand";
import type {
  StudioContract,
  ContractItem,
  ContractCrew,
  ContractEditRequest,
  ContractPayment,
  ContractTask,
  ContractPaymentPlan,
  ContractProduct,
  ContractQuoteOption,
  StudioCrew,
  StudioEvent,
  StudioExpense,
  StudioAppointment,
} from "@/lib/types";
import { crewPortalUrl as buildCrewPortalUrl } from "@/lib/crew-show";
import ContractEditor from "./ContractEditor";
import StudioDenied from "@/components/StudioDenied";


export default async function ContractPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { tab?: string };
}) {
  const profile = await requireStudio("plus");
  if (profile?.actingRole === "accountant") return <StudioDenied message="Kế toán chỉ truy cập mục Thu chi & Bảng lương." />;
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Tính năng này chỉ dành cho tài khoản gói Studio.
          </p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }

  const supabase = createClient();
  const { data: contract } = await supabase
    .from("studio_contracts")
    .select("*")
    .eq("id", params.id)
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (!contract) notFound();

  // Staff role: may only open contracts assigned to them.
  if (profile.actingRole === "staff" && contract.assigned_to !== profile.actingUserId) notFound();

  // Bảo đảm có link form điền thông tin (tạo token nếu chưa có) để studio gửi khách.
  if (!contract.intake_token) {
    try {
      contract.intake_token = await ensureIntakeToken(supabase, contract.id, contract.intake_token);
    } catch {
      /* không chặn mở hợp đồng nếu tạo token lỗi */
    }
  }
  const canAssign = profile.actingRole !== "staff";

  // Everything below depends only on the contract id / owner (not on the
  // contract row's contents, except the event_date used by the two scheduling
  // queries — which we already have). Run them ALL in one parallel batch instead
  // of 8 sequential waves, so the page loads in ~2 round-trips.
  const ed = contract.event_date;
  const empty = Promise.resolve({ data: [] as never[] });

  const [
    { data: staffList },
    { data: items },
    { data: crew },
    { data: requests },
    { data: payments },
    { data: roster },
    { data: galleries },
    { data: selectionAlbums },
    { data: milestones },
    { data: tasks },
    { data: expenses },
    { data: plan },
    { data: products },
    { data: quoteOptions },
    { data: services },
    { data: pricelistRows },
    { data: clientProofs },
    { data: conflictBookings },
    { data: conflictUnavail },
    { data: sameDay },
    { data: appointments },
  ] = await Promise.all([
    canAssign ? createAdminClient().from("profiles").select("id, full_name, email").eq("studio_owner_id", profile.id).order("full_name") : empty,
    supabase.from("contract_items").select("*").eq("contract_id", params.id).order("position"),
    supabase.from("contract_crew").select("*").eq("contract_id", params.id).order("position"),
    supabase.from("contract_edit_requests").select("*").eq("contract_id", params.id).order("created_at", { ascending: false }),
    supabase.from("contract_payments").select("*").eq("contract_id", params.id).order("paid_at", { ascending: false }),
    supabase.from("studio_crew").select("*").eq("owner_id", profile.id).order("name"),
    supabase.from("albums").select("id, title, slug").eq("owner_id", profile.id).eq("is_gallery", true).order("created_at", { ascending: false }),
    supabase.from("albums").select("id, title, slug").eq("owner_id", profile.id).eq("is_gallery", false).order("created_at", { ascending: false }),
    supabase.from("studio_events").select("*").eq("contract_id", params.id).order("event_date"),
    supabase.from("contract_tasks").select("*").eq("contract_id", params.id).order("position"),
    supabase.from("studio_expenses").select("*").eq("contract_id", params.id).order("spent_at", { ascending: false }),
    supabase.from("contract_payment_plan").select("*").eq("contract_id", params.id).order("due_date", { nullsFirst: false }),
    supabase.from("contract_products").select("*").eq("contract_id", params.id).order("position"),
    supabase.from("contract_quote_options").select("*").eq("contract_id", params.id).order("position"),
    supabase.from("studio_services").select("id, name, clauses").eq("owner_id", profile.id).eq("active", true).order("position", { ascending: true }),
    supabase.from("studio_pricelist").select("name, price, unit").eq("owner_id", profile.id).eq("active", true).gt("price", 0).order("position"),
    supabase.from("contract_client_proofs").select("id, url, note, uploaded_at, plan_id").eq("contract_id", params.id).order("uploaded_at", { ascending: false }),
    ed ? supabase.from("contract_crew").select("phone, contract:studio_contracts!inner(id, owner_id, event_date, title)").eq("contract.owner_id", profile.id).eq("contract.event_date", ed).not("phone", "is", null) : empty,
    // Chỉ mốc thuộc studio này — xem ghi chú cách ly ở team/page.tsx.
    ed ? supabase.from("crew_unavailable").select("*").eq("date", ed).eq("owner_id", profile.id) : empty,
    ed ? supabase.from("studio_contracts").select("id, title, client_name").eq("owner_id", profile.id).eq("event_date", ed).neq("id", params.id).neq("status", "cancelled") : empty,
    // Lịch hẹn dịch vụ của hợp đồng (trang điểm / thử đồ / tư vấn). Studio chưa
    // chạy migration studio_appointments thì `data` là null → khối lịch hẹn chỉ
    // rỗng, phần còn lại của màn hợp đồng không bị ảnh hưởng.
    supabase.from("studio_appointments").select("*").eq("contract_id", params.id).order("appt_date"),
  ]);

  // Scheduling conflicts: crew booked on another contract that day, or busy.
  const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
  const conflictByPhone: Record<string, string> = {};
  for (const r of (conflictBookings ?? []) as unknown as Array<{ phone: string | null; contract: { id: string; title: string } | null }>) {
    if (r.contract?.id === params.id) continue;
    const p = digits(r.phone);
    if (p) conflictByPhone[p] = `Trùng lịch: ${r.contract?.title || "HĐ khác"}`;
  }
  // Kèm KHUNG GIỜ nếu thợ có báo — "bận 08:00–12:00" khác hẳn "bận cả ngày" khi
  // studio cân nhắc có gán chồng hay không.
  type Unavail = { phone: string; note: string | null; title?: string | null; start_time?: string | null; end_time?: string | null };
  for (const r of (conflictUnavail ?? []) as unknown as Unavail[]) {
    const p = digits(r.phone);
    if (!p || conflictByPhone[p]) continue;
    const when = r.start_time && r.end_time ? `${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}` : "cả ngày";
    const what = r.title || r.note;
    conflictByPhone[p] = `Đã có lịch ${when}${what ? `: ${what}` : ""}`;
  }
  const sameDayContracts = (sameDay ?? []) as { id: string; title: string; client_name: string | null }[];
  // Link cổng thợ riêng của studio — đính vào mọi tin Zalo gửi cho thợ.
  const crewPortalUrl = buildCrewPortalUrl(profile.crew_token as string | null);

  // Tên + logo khách nhìn thấy (studio_brand_name/studio_logo_url, lùi về
  // full_name/pl_logo_url) — bản PDF hợp đồng in đúng thương hiệu này.
  const brand = brandFrom(profile);
  const studioHost = await getStudioHost(supabase, profile.id);
  const storyLocked = storyComingSoon(await getFeatureFlags()) && profile.actingRole !== "admin";

  return (
    <ContractEditor
      contract={contract as StudioContract}
      studioHost={studioHost}
      storyComingSoon={storyLocked}
      bank={{
        bin: (profile.pl_bank_bin as string | null) ?? null,
        account: (profile.pl_bank_account as string | null) ?? null,
        holder: (profile.pl_bank_holder as string | null) ?? null,
        name: (profile.pl_bank_name as string | null) ?? null,
      }}
      sameDayContracts={sameDayContracts}
      services={(services ?? []) as { id: string; name: string; clauses: string }[]}
      pricelist={(pricelistRows ?? []) as { name: string; price: number; unit: string | null }[]}
      initialItems={(items ?? []) as ContractItem[]}
      initialCrew={(crew ?? []) as ContractCrew[]}
      crewPortalUrl={crewPortalUrl}
      initialRequests={(requests ?? []) as ContractEditRequest[]}
      initialPayments={(payments ?? []) as ContractPayment[]}
      roster={(roster ?? []) as StudioCrew[]}
      galleries={(galleries ?? []) as { id: string; title: string; slug: string }[]}
      selectionAlbums={(selectionAlbums ?? []) as { id: string; title: string; slug: string }[]}
      initialMilestones={(milestones ?? []) as StudioEvent[]}
      initialAppointments={(appointments ?? []) as StudioAppointment[]}
      ownerId={profile.id as string}
      studioName={brand.name}
      studioLogo={brand.logoUrl}
      studioPhone={(profile.pl_phone as string | null) ?? null}
      studioEmail={(profile.email as string | null) ?? null}
      conflictByPhone={conflictByPhone}
      initialTasks={(tasks ?? []) as ContractTask[]}
      initialExpenses={(expenses ?? []) as StudioExpense[]}
      initialPlan={(plan ?? []) as ContractPaymentPlan[]}
      initialProducts={(products ?? []) as ContractProduct[]}
      initialQuoteOptions={(quoteOptions ?? []) as ContractQuoteOption[]}
      staffList={(staffList ?? []) as { id: string; full_name: string | null; email: string }[]}
      canAssign={canAssign}
      initialClientProofs={(clientProofs ?? []) as { id: string; url: string; note: string | null; uploaded_at: string; plan_id: string | null }[]}
      initialTab={searchParams?.tab}
    />
  );
}
