import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import StudioDenied from "@/components/StudioDenied";
import AuditView, { type AuditRow } from "./AuditView";

/* ═══════════════════════════════════════════════════════════════════════════
   NHẬT KÝ THAO TÁC — /dashboard/studio/audit

   Ai ghi/xoá khoản thu, ai sửa giá, ai đổi trạng thái hợp đồng, lúc nào. Chỉ
   chủ studio và kế toán xem được (cùng luật với policy dưới DB).

   Đọc bằng service role SAU KHI đã kiểm vai trò, vì cần ghép tên người thao tác
   từ bảng profiles — nhân viên không đọc được profile của nhau qua RLS.
   ═══════════════════════════════════════════════════════════════════════════ */

const AUDIT_ROLES = ["owner", "admin", "accountant"];

export default async function AuditPage(props: { searchParams: Promise<{ contract?: string }> }) {
  const profile = await requireStudio("plus");
  if (!profile) return <StudioDenied title="Cần gói Studio" message="Nhật ký thao tác dành cho tài khoản gói Studio." />;
  if (!AUDIT_ROLES.includes(profile.actingRole as string)) {
    return <StudioDenied message="Nhật ký thao tác chỉ dành cho chủ studio và kế toán." />;
  }
  const { contract } = await props.searchParams;
  const contractId = contract && /^[0-9a-f-]{36}$/i.test(contract) ? contract : null;

  const db = createAdminClient();
  let q = db
    .from("studio_audit_log")
    .select("id, actor_id, action, entity, entity_id, contract_id, summary, before, after, created_at")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (contractId) q = q.eq("contract_id", contractId);
  const { data, error } = await q;
  const migrated = !error;
  const rows = (data ?? []) as Omit<AuditRow, "actor_name" | "contract_label">[];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const contractIds = [...new Set(rows.map((r) => r.contract_id).filter(Boolean))] as string[];
  const [{ data: actors }, { data: contracts }] = await Promise.all([
    actorIds.length ? db.from("profiles").select("id, full_name, email").in("id", actorIds) : Promise.resolve({ data: [] }),
    contractIds.length
      ? db.from("studio_contracts").select("id, code, title, client_name").eq("owner_id", profile.id).in("id", contractIds)
      : Promise.resolve({ data: [] }),
  ]);
  const actorName = new Map(((actors ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((a) => [a.id, a.full_name || a.email || "Không rõ"]));
  const contractLabel = new Map(
    ((contracts ?? []) as { id: string; code: string | null; title: string; client_name: string | null }[]).map((c) => [
      c.id,
      [c.code, c.client_name || c.title].filter(Boolean).join(" · "),
    ])
  );

  return (
    <AuditView
      migrated={migrated}
      filteredContract={contractId ? contractLabel.get(contractId) ?? "hợp đồng đã xoá" : null}
      rows={rows.map((r) => ({
        ...r,
        actor_name: r.actor_id ? actorName.get(r.actor_id) ?? "Tài khoản đã xoá" : null,
        contract_label: r.contract_id ? contractLabel.get(r.contract_id) ?? null : null,
      }))}
    />
  );
}
