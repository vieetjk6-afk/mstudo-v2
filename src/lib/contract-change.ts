import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";

/**
 * Phần dùng chung của hai thao tác lớn trên một hợp đồng: HUỶ và DỜI LỊCH. Cả
 * hai đều kéo theo lịch thợ, lịch hẹn, hạn thu và Google Lịch, nên chạy ở máy
 * chủ bằng service-role, sau khi đã xác minh hợp đồng thuộc studio đang thao tác.
 */

type Db = ReturnType<typeof createAdminClient>;

export type ChangeContract = {
  id: string;
  owner_id: string;
  code: string | null;
  title: string;
  client_name: string | null;
  client_phone: string | null;
  client_token: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  status: string;
};

/** Studio đang đăng nhập + quyền cho thao tác này. `roles` là các vai trò nhân viên được phép ngoài chủ studio. */
export async function studioFor(roles: readonly string[]) {
  const profile = await requireStudio("booking");
  if (!profile) return null;
  const role = profile.actingRole as string | undefined;
  if (role && role !== "owner" && role !== "admin" && !roles.includes(role)) return null;
  return profile;
}

export async function loadContract(db: Db, id: string, ownerId: string): Promise<ChangeContract | null> {
  const { data } = await db
    .from("studio_contracts")
    .select("id, owner_id, code, title, client_name, client_phone, client_token, event_date, event_time, location, status")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.owner_id !== ownerId) return null;
  return data as ChangeContract;
}

/** Thợ đang gán vào hợp đồng (id phân công, tên, SĐT). */
export async function contractCrew(db: Db, contractId: string) {
  const { data } = await db.from("contract_crew").select("id, name, phone").eq("contract_id", contractId);
  return (data ?? []) as { id: string; name: string | null; phone: string | null }[];
}

/** Một dòng ở chuông studio + tab Thông báo của cổng nhân viên. Lỗi ghi thì bỏ qua. */
export async function notifyContractChanged(db: Db, ownerId: string, contractId: string, message: string) {
  await db
    .from("studio_notifications")
    .insert({ owner_id: ownerId, contract_id: contractId, kind: "contract_changed", message })
    .then(undefined, () => undefined);
}

/** Tổng THỰC đã thu của hợp đồng (đã trừ các lần hoàn). */
export async function netCollected(db: Db, contractId: string): Promise<number> {
  const { data } = await db.from("contract_payments").select("amount").eq("contract_id", contractId);
  return ((data ?? []) as { amount: number }[]).reduce((s, p) => s + (Number(p.amount) || 0), 0);
}
