import "server-only";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import { effectivePlan, studioTier } from "@/lib/plans";

/** Số máy hoạt động tối đa cho mỗi tài khoản studio. */
export const DEVICE_LIMIT = 2;

/** Ghi lại `desktop_devices.last_sync_at` nhiều nhất mỗi ngần này. */
const GHI_MOC_SAU_MS = 10 * 60_000;

export const hashDeviceToken = (t: string) => createHash("sha256").update(t).digest("hex");

export type DesktopAuth =
  | { ok: true; ownerId: string; via: "session" | "device"; deviceId?: string }
  | { ok: false; status: number; error: string };

/**
 * Xác thực cho các API MStudo Desktop. Chấp nhận:
 *  - Token thiết bị (Authorization: Bearer msd_xxx) — client Windows đã đăng ký;
 *  - Phiên đăng nhập web của CHỦ studio (owner/admin, không phải nhân viên).
 * Gói Studio hết hạn → từ chối với "plan_expired" (hợp đồng & đồng bộ bị khóa).
 */
export async function requireDesktopOwner(req: Request): Promise<DesktopAuth> {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(msd_[A-Za-z0-9]+)$/);
  if (m) {
    const db = createAdminClient();
    const { data: dev } = await db
      .from("desktop_devices")
      .select("id, owner_id, revoked_at, last_sync_at")
      .eq("token_hash", hashDeviceToken(m[1]))
      .maybeSingle();
    if (!dev || dev.revoked_at) return { ok: false, status: 401, error: "device_revoked" };
    const { data: owner } = await db
      .from("profiles")
      .select("plan, plan_expires_at, role, is_active")
      .eq("id", dev.owner_id)
      .maybeSingle();
    if (!owner?.is_active) return { ok: false, status: 403, error: "inactive" };
    const tier = studioTier(effectivePlan(owner.plan, owner.plan_expires_at), owner.role === "admin");
    if (tier !== "full") return { ok: false, status: 402, error: "plan_expired" };
    // Desktop gọi ~100 lượt/giờ; ghi mốc mỗi lượt là ~2.400 lần UPDATE mỗi ngày
    // mỗi máy chỉ để màn "Thiết bị" hiện "đồng bộ lúc…". 10 phút là đủ chính xác.
    const lan = dev.last_sync_at ? Date.parse(dev.last_sync_at as string) : 0;
    if (!(Date.now() - lan < GHI_MOC_SAU_MS)) {
      await db.from("desktop_devices").update({ last_sync_at: new Date().toISOString() }).eq("id", dev.id);
    }
    return { ok: true, ownerId: dev.owner_id as string, via: "device", deviceId: dev.id as string };
  }
  const ctx = await requireStudio("full");
  if (!ctx) return { ok: false, status: 403, error: "forbidden" };
  if (ctx.isStaff || (ctx.actingRole !== "owner" && ctx.actingRole !== "admin")) {
    return { ok: false, status: 403, error: "owner_only" };
  }
  return { ok: true, ownerId: ctx.id as string, via: "session" };
}
