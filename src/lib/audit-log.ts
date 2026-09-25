import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Ghi MỘT dòng nhật ký thao tác từ route máy chủ.
 *
 * Route chạy bằng service role nên trigger nhật ký dưới DB không biết ai đang
 * thao tác (auth.uid() là null → trigger bỏ qua). Route đã xác minh người dùng,
 * nên chính nó ghi, kèm người thật. Xem supabase/migrations/studio_audit_log.sql.
 *
 * Không bao giờ ném lỗi: studio chưa chạy migration hay DB trục trặc thì thao
 * tác chính vẫn phải xong — nhật ký là phần phụ.
 */
export async function logAction(
  db: Db,
  e: {
    ownerId: string;
    actorId: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    contractId?: string | null;
    summary: string;
    before?: unknown;
    after?: unknown;
  }
): Promise<void> {
  try {
    await db.from("studio_audit_log").insert({
      owner_id: e.ownerId,
      actor_id: e.actorId,
      action: e.action,
      entity: e.entity,
      entity_id: e.entityId ?? null,
      contract_id: e.contractId ?? (e.entity === "contract" ? e.entityId ?? null : null),
      summary: e.summary.slice(0, 500),
      before: e.before ?? null,
      after: e.after ?? null,
    });
  } catch {
    /* nhật ký là phần phụ — không chặn thao tác chính */
  }
}
