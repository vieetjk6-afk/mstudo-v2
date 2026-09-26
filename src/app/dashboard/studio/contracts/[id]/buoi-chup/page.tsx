import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { getStudioHost } from "@/lib/studio-site";
import { ensureIntakeToken } from "@/lib/contract-intake";
import { brandFrom } from "@/lib/studio-brand";
import { isBranchScopedRole } from "@/lib/studio-roles";
import { studioUrl } from "@/lib/hosts";
import StudioDenied from "@/components/StudioDenied";
import type { ContractCrew, ContractIntake } from "@/lib/types";
import SessionInfoView from "./SessionInfoView";

/**
 * "Thông tin buổi chụp" — màn riêng xem dữ liệu khách điền ở form (/form/[token])
 * và gửi TỪNG PHẦN (nhà gái / nhà trai / tiệc) cho từng thợ.
 *
 * Bấm thông báo "Khách đã điền thông tin buổi chụp" mở thẳng màn này thay vì
 * màn hợp đồng (nơi khối thông tin nằm lẫn trong tab "Ký & thực hiện").
 * Chốt quyền giống hệt màn hợp đồng.
 */
export default async function SessionInfoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const profile = await requireStudio("plus");
  if (profile?.actingRole === "accountant") return <StudioDenied message="Kế toán chỉ truy cập mục Thu chi & Bảng lương." />;
  if (!profile) notFound();

  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("studio_contracts")
    .select("id, owner_id, title, client_name, event_date, event_time, location, intake, intake_token, intake_submitted_at, assigned_to, branch_id")
    .eq("id", params.id)
    .eq("owner_id", profile.id)
    .maybeSingle();
  if (!contract) notFound();
  if (profile.actingRole === "staff" && contract.assigned_to !== profile.actingUserId) notFound();
  if (isBranchScopedRole(profile.actingRole as string)) {
    const mine = (profile.actingBranchId as string | null) ?? null;
    if (!mine || contract.branch_id !== mine) notFound();
  }

  let token = contract.intake_token as string | null;
  if (!token) {
    try {
      token = await ensureIntakeToken(supabase, contract.id, token);
    } catch {
      /* không có link form thì chỉ ẩn nút "Mở form" */
    }
  }

  const { data: crew } = await supabase
    .from("contract_crew")
    .select("id, name, phone, role, side, event_id")
    .eq("contract_id", params.id)
    .order("position");

  const studioHost = await getStudioHost(supabase, profile.id);

  return (
    <SessionInfoView
      contract={{
        id: contract.id,
        title: contract.title ?? "",
        clientName: contract.client_name ?? "",
        eventDate: contract.event_date ?? null,
        eventTime: contract.event_time ?? null,
        location: contract.location ?? null,
        intake: (contract.intake ?? null) as ContractIntake | null,
        submittedAt: contract.intake_submitted_at ?? null,
      }}
      formUrl={token ? studioUrl(studioHost, `/form/${token}`) : null}
      crew={(crew ?? []) as Pick<ContractCrew, "id" | "name" | "phone" | "role" | "side" | "event_id">[]}
      studioName={brandFrom(profile).name}
    />
  );
}
