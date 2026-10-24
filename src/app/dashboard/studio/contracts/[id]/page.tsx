import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import { tierAllowsRental } from "@/lib/plans";
import { getStudioHost } from "@/lib/studio-site";
import { getFeatureFlags, plannerComingSoon, storyComingSoon } from "@/lib/feature-flags";
import { weddingGiftCombo } from "@/lib/wedding-plan";
import { ensureIntakeToken } from "@/lib/contract-intake";
import { brandFrom } from "@/lib/studio-brand";
import { getActiveBranches } from "@/lib/branches";
import { isBranchScopedRole } from "@/lib/studio-roles";
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
import { loadCrewRoles } from "@/lib/crew-roles";
import ContractEditor from "./ContractEditor";
import { isDeliveryPhase } from "@/lib/album-phase";
import { resolveDeliveredAlbum, type ContractAlbumOption } from "@/lib/contract-album";
import type { ContractAddendum } from "@/lib/contract-addenda";
import StudioDenied from "@/components/StudioDenied";


export default async function ContractPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ tab?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
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

  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("studio_contracts")
    .select("*")
    .eq("id", params.id)
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (!contract) notFound();

  // Staff role: may only open contracts assigned to them.
  if (profile.actingRole === "staff" && contract.assigned_to !== profile.actingUserId) notFound();

  // "Toàn quyền chi nhánh": chỉ mở được hợp đồng của CHÍNH chi nhánh mình.
  // Bộ lọc chi nhánh ở danh sách chỉ là hiển thị — không có chốt này thì gõ tay
  // URL /contracts/<id> là xem được hợp đồng của cơ sở khác, và hàng rào quyền
  // có lỗ thì không còn là hàng rào.
  if (isBranchScopedRole(profile.actingRole as string)) {
    const mine = (profile.actingBranchId as string | null) ?? null;
    if (!mine || contract.branch_id !== mine) notFound();
  }

  // Bảo đảm có link form điền thông tin (tạo token nếu chưa có) để studio gửi khách.
  if (!contract.intake_token) {
    try {
      contract.intake_token = await ensureIntakeToken(supabase, contract.id, contract.intake_token);
    } catch {
      /* không chặn mở hợp đồng nếu tạo token lỗi */
    }
  }
  const canAssign = profile.actingRole !== "staff";
  // Mục "Thuê đồ" chỉ gói Studio — hợp đồng mở từ gói Photographer Plus, mà kho
  // đồ thì không. Xem planAllowsRental trong lib/plans.
  const canRental = tierAllowsRental(profile.studioTier);

  // Everything below depends only on the contract id / owner (not on the
  // contract row's contents, except the event_date used by the two scheduling
  // queries — which we already have). Run them ALL in one parallel batch instead
  // of 8 sequential waves, so the page loads in ~2 round-trips.
  const ed = contract.event_date;
  const empty = Promise.resolve({ data: [] as never[] });
  // Vai trò thợ tự đặt — chạy song song với lượt dưới, không ném lỗi (thiếu bảng → []).
  const crewRolesP = loadCrewRoles(supabase, profile.id as string);
  const selId = contract.selection_album_id as string | null;
  const galId = contract.gallery_album_id as string | null;
  // Phần "đuôi" trước đây chạy TUẦN TỰ sau lượt lớn (đếm ảnh, tên miền, chữ ký,
  // cờ tính năng, chi nhánh) — mỗi cái một vòng chờ DB. Không cái nào cần kết
  // quả lượt lớn, nên khởi động ngay cùng lúc và chỉ chờ ở dưới.
  const tailP = Promise.all([
    // Số ảnh của album đang gắn (tối đa 2 lượt đếm head-only — rẻ).
    Promise.all(
      [selId, galId].filter((x): x is string => !!x).map(async (id) => {
        const { count } = await supabase.from("photos").select("id", { count: "exact", head: true }).eq("album_id", id);
        return [id, count] as const;
      }),
    ),
    getStudioHost(supabase, profile.id),
    // Chữ ký Bên A đã lưu — chưa chạy migration thì đơn giản là chưa có.
    // Hai bước vẫn nối nhau (bước sau chỉ chạy khi bước trước trống) nhưng cả
    // chuỗi chạy song song với phần còn lại.
    (async () => {
      const { data: savedSig } = await supabase
        .from("studio_saved_signature")
        .select("signer_name, signature")
        .eq("owner_id", profile.id)
        .maybeSingle();
      // Chưa lưu chữ ký (hoặc lưu lỗi) → dùng chữ ký Bên A ở hợp đồng ký gần nhất,
      // để lần sau vẫn ký một chạm và không phải gõ lại tên.
      const { data: lastSigned } = savedSig
        ? { data: null }
        : await supabase
            .from("studio_contracts")
            .select("studio_signed_name, studio_signature")
            .eq("owner_id", profile.id)
            .not("studio_signed_name", "is", null)
            .not("studio_signature", "is", null)
            .order("studio_signed_at", { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();
      return { savedSig, lastSigned };
    })(),
    getFeatureFlags(),
    getActiveBranches(profile.id),
  ]);

  const [
    { data: staffList },
    { data: items },
    { data: crew },
    { data: requests },
    { data: payments },
    { data: roster },
    { data: ownerAlbums },
    { data: otherAlbumLinks },
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
    { data: addenda },
  ] = await Promise.all([
    canAssign ? createAdminClient().from("profiles").select("id, full_name, email").eq("studio_owner_id", profile.id).order("full_name") : empty,
    supabase.from("contract_items").select("*").eq("contract_id", params.id).order("position"),
    supabase.from("contract_crew").select("*").eq("contract_id", params.id).order("position"),
    supabase.from("contract_edit_requests").select("*").eq("contract_id", params.id).order("created_at", { ascending: false }),
    supabase.from("contract_payments").select("*").eq("contract_id", params.id).order("paid_at", { ascending: false }),
    supabase.from("studio_crew").select("*").eq("owner_id", profile.id).order("name"),
    // MỘT lượt cho cả hai ô chọn album, chia theo GIAI ĐOẠN (isDeliveryPhase) chứ
    // không theo cờ cũ is_gallery: album giao khách tạo từ "Tạo album" mang
    // phase='delivery' mà is_gallery = false nên trước đây không bao giờ hiện
    // trong ô "Album giao riêng".
    supabase.from("albums").select("id, title, slug, phase, is_gallery, status").eq("owner_id", profile.id).order("created_at", { ascending: false }),
    // Album đang gắn ở hợp đồng KHÁC — đánh dấu trong ô chọn để studio khỏi gắn trùng.
    supabase
      .from("studio_contracts")
      .select("id, selection_album_id, gallery_album_id")
      .eq("owner_id", profile.id)
      .neq("id", params.id)
      .or("selection_album_id.not.is.null,gallery_album_id.not.is.null"),
    supabase.from("studio_events").select("*").eq("contract_id", params.id).order("event_date"),
    supabase.from("contract_tasks").select("*").eq("contract_id", params.id).order("position"),
    supabase.from("studio_expenses").select("*").eq("contract_id", params.id).order("spent_at", { ascending: false }),
    supabase.from("contract_payment_plan").select("*").eq("contract_id", params.id).order("due_date", { nullsFirst: false }),
    supabase.from("contract_products").select("*").eq("contract_id", params.id).order("position"),
    supabase.from("contract_quote_options").select("*").eq("contract_id", params.id).order("position"),
    supabase.from("studio_services").select("id, name, clauses").eq("owner_id", profile.id).eq("active", true).order("position", { ascending: true }),
    supabase.from("studio_pricelist").select("name, price, unit, description").eq("owner_id", profile.id).eq("active", true).gt("price", 0).order("position"),
    supabase.from("contract_client_proofs").select("id, url, note, uploaded_at, plan_id").eq("contract_id", params.id).order("uploaded_at", { ascending: false }),
    ed ? supabase.from("contract_crew").select("phone, contract:studio_contracts!inner(id, owner_id, event_date, title)").eq("contract.owner_id", profile.id).eq("contract.event_date", ed).not("phone", "is", null) : empty,
    // Chỉ mốc thuộc studio này — xem ghi chú cách ly ở team/page.tsx.
    ed ? supabase.from("crew_unavailable").select("*").eq("date", ed).eq("owner_id", profile.id) : empty,
    ed ? supabase.from("studio_contracts").select("id, title, client_name").eq("owner_id", profile.id).eq("event_date", ed).neq("id", params.id).neq("status", "cancelled") : empty,
    // Lịch hẹn dịch vụ của hợp đồng (trang điểm / thử đồ / tư vấn). Studio chưa
    // chạy migration studio_appointments thì `data` là null → khối lịch hẹn chỉ
    // rỗng, phần còn lại của màn hợp đồng không bị ảnh hưởng.
    supabase.from("studio_appointments").select("*").eq("contract_id", params.id).order("appt_date"),
    // Phụ lục — chưa chạy migration contract_addenda.sql thì null, thẻ phụ lục rỗng.
    supabase.from("contract_addenda").select("id, contract_id, no, title, note, lines, signed_at, signed_by, signed_name, created_at").eq("contract_id", params.id).order("no"),
  ]);

  // ── Album của hợp đồng ────────────────────────────────────────────────────
  type AlbumRow = { id: string; title: string; slug: string; phase: string | null; is_gallery: boolean | null; status: string | null };
  const albumRows = (ownerAlbums ?? []) as AlbumRow[];
  const usedElsewhere = new Set<string>();
  for (const r of (otherAlbumLinks ?? []) as { selection_album_id: string | null; gallery_album_id: string | null }[]) {
    if (r.selection_album_id) usedElsewhere.add(r.selection_album_id);
    if (r.gallery_album_id) usedElsewhere.add(r.gallery_album_id);
  }
  const toAlbumOption = (a: AlbumRow): ContractAlbumOption => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    phase: isDeliveryPhase(a) ? "delivery" : "selection",
    published: a.status === "published",
    linkedElsewhere: usedElsewhere.has(a.id),
  });
  // Album đang gắn LUÔN có mặt trong ô của nó, kể cả khi giai đoạn đã đổi (album
  // của hợp đồng vừa sang giao khách vẫn phải hiện ở ô "Album của hợp đồng").
  const selectionAlbums = albumRows.filter((a) => !isDeliveryPhase(a) || a.id === selId).map(toAlbumOption);
  const galleries = albumRows.filter((a) => isDeliveryPhase(a) || a.id === galId).map(toAlbumOption);
  const selRow = selId ? albumRows.find((a) => a.id === selId) ?? null : null;
  const galRow = galId ? albumRows.find((a) => a.id === galId) ?? null : null;
  // Album của hợp đồng đã ở giai đoạn giao khách (dự án hợp nhất) — màn hợp đồng
  // dùng để ẩn "Giao khách ngay" và tính bước "Đã giao" của vòng đời.
  const linkedAlbumDelivered = !!resolveDeliveredAlbum({ gallery: galRow, selection: selRow });
  const [photoCounts, studioHost, { savedSig, lastSigned }, flags, activeBranches] = await tailP;
  const albumPhotoCounts: Record<string, number> = {};
  for (const [id, count] of photoCounts) {
    if (typeof count === "number") albumPhotoCounts[id] = count;
  }

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
  const last = lastSigned as { studio_signed_name: string | null; studio_signature: string | null } | null;
  const reusableSig = savedSig
    ? { name: savedSig.signer_name as string, signature: savedSig.signature as string }
    : last?.studio_signed_name && last.studio_signature
      ? { name: last.studio_signed_name, signature: last.studio_signature }
      : null;
  const defaultSignName = reusableSig?.name || ((profile.full_name as string | null) ?? "").trim();
  const storyLocked = storyComingSoon(flags) && profile.actingRole !== "admin";
  // Kế hoạch cưới: cùng luật với cổng khách — còn "Sắp ra mắt" thì chỉ hợp đồng
  // của tài khoản admin chạy thật (xem plannerComingSoon).
  const plannerLocked = plannerComingSoon(flags) && profile.role !== "admin";

  return (
    <ContractEditor
      contract={contract as StudioContract}
      studioHost={studioHost}
      defaultSignName={defaultSignName}
      savedSignature={reusableSig}
      storyComingSoon={storyLocked}
      plannerComingSoon={plannerLocked}
      giftCombo={weddingGiftCombo(profile.role as string | null)}
      bank={{
        bin: (profile.pl_bank_bin as string | null) ?? null,
        account: (profile.pl_bank_account as string | null) ?? null,
        holder: (profile.pl_bank_holder as string | null) ?? null,
        name: (profile.pl_bank_name as string | null) ?? null,
      }}
      sameDayContracts={sameDayContracts}
      services={(services ?? []) as { id: string; name: string; clauses: string }[]}
      pricelist={(pricelistRows ?? []) as { name: string; price: number; unit: string | null; description: string | null }[]}
      initialItems={(items ?? []) as ContractItem[]}
      initialAddenda={(addenda ?? []) as ContractAddendum[]}
      canEditAddenda={profile.actingRole !== "staff" && profile.actingRole !== "accountant"}
      canSeeAudit={["owner", "admin", "accountant"].includes(profile.actingRole as string)}
      initialCrew={(crew ?? []) as ContractCrew[]}
      crewPortalUrl={crewPortalUrl}
      initialRequests={(requests ?? []) as ContractEditRequest[]}
      initialPayments={(payments ?? []) as ContractPayment[]}
      roster={(roster ?? []) as StudioCrew[]}
      crewRoles={await crewRolesP}
      galleries={galleries}
      selectionAlbums={selectionAlbums}
      linkedAlbumDelivered={linkedAlbumDelivered}
      albumPhotoCounts={albumPhotoCounts}
      initialMilestones={(milestones ?? []) as StudioEvent[]}
      initialAppointments={(appointments ?? []) as StudioAppointment[]}
      ownerId={profile.id as string}
      branches={activeBranches.map((b) => ({ id: b.id, name: b.name }))}
      branchLocked={isBranchScopedRole(profile.actingRole as string)}
      studioName={brand.name}
      depositPercent={(profile as { contract_deposit_percent?: number }).contract_deposit_percent ?? 25}
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
      canRental={canRental}
      initialClientProofs={(clientProofs ?? []) as { id: string; url: string; note: string | null; uploaded_at: string; plan_id: string | null }[]}
      initialTab={searchParams?.tab}
    />
  );
}
