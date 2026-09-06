import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlan, studioTier, STUDIO_TIER_RANK } from "@/lib/plans";

/**
 * Đọc hồ sơ theo id KHÔNG qua RLS (service-role). Dùng cho tra cứu hồ sơ CHỦ
 * STUDIO khi user đang đăng nhập là nhân viên — vì policy SELECT của bảng
 * profiles chỉ cho đọc dòng của chính mình (id = auth.uid()), nên nhân viên
 * không đọc được dòng của chủ studio bằng client thường → tra cứu bị null →
 * bị hiểu nhầm là "chưa có gói studio". Đây là tra cứu phía server tin cậy.
 */
const getProfileByIdAdmin = cache(async (id: string) => {
  const { data } = await createAdminClient().from("profiles").select("*").eq("id", id).maybeSingle();
  return data;
});

/**
 * Per-request cached auth lookups. React `cache()` dedupes by arguments within
 * a single server render pass, so middleware → layout → requireStudio() share
 * ONE `getUser()` round-trip and ONE `profiles` read per id, instead of the
 * 3× getUser + 2–3× profile queries we used to run on every navigation.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfileById = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", id).single();
  return data;
});

/** Returns the current admin profile, or null if the caller is not an admin. */
export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return null;

  const profile = await getProfileById(user.id);
  if (!profile || profile.role !== "admin" || !profile.is_active) return null;
  return profile;
}

/**
 * Returns the studio context for the current user, or null if they may not use
 * the requested level of the studio module. For a STAFF login the returned
 * profile is the OWNER's profile (so every page scopes to the studio's data),
 * with extra fields:
 *   actingRole  : 'owner' | 'admin' | 'manager' | 'staff' | 'accountant'
 *   actingUserId: the logged-in user's own id
 *   actingBranchId: chi nhánh của chính người đang đăng nhập (null = toàn studio)
 *   isStaff     : true when logged in as a staff sub-account
 *   studioTier  : 'booking' | 'full' (the owner's effective access level)
 *
 * `minTier` is the access level a page requires:
 *   "booking" — đặt lịch / bảng giá / lịch chụp / khách hàng (Photographer + Studio)
 *   "full"    — hợp đồng / tài chính / đội ngũ (Studio only). Default.
 */
export async function requireStudio(minTier: "booking" | "plus" | "full" = "full") {
  const user = await getSessionUser();
  if (!user) return null;

  const me = await getProfileById(user.id);
  if (!me || !me.is_active) return null;

  // Staff sub-account: act on the owner's studio (inherits the owner's tier).
  if (me.studio_owner_id) {
    // Đọc hồ sơ chủ studio bằng service-role (RLS chặn nhân viên đọc dòng của chủ).
    const owner = await getProfileByIdAdmin(me.studio_owner_id);
    if (!owner || !owner.is_active) return null;
    const tier = studioTier(effectivePlan(owner.plan, owner.plan_expires_at), owner.role === "admin");
    if (STUDIO_TIER_RANK[tier] < STUDIO_TIER_RANK[minTier]) return null;
    return {
      ...owner,
      actingRole: me.studio_role || "staff",
      actingUserId: me.id,
      // Chi nhánh của CHÍNH người đang đăng nhập. Phải trả riêng vì `...owner`
      // mang studio_branch_id của CHỦ studio (thường null) — dùng nó làm phạm vi
      // mặc định thì nhân viên của Quận 1 mở app ra lại thấy toàn studio, trong
      // khi ô chọn trên topbar vẫn ghi "Quận 1".
      actingBranchId: (me.studio_branch_id as string | null) ?? null,
      isStaff: true,
      studioTier: tier,
    };
  }

  // Studio owner, photographer or admin.
  const tier = studioTier(effectivePlan(me.plan, me.plan_expires_at), me.role === "admin");
  if (STUDIO_TIER_RANK[tier] < STUDIO_TIER_RANK[minTier]) return null;
  return {
    ...me,
    actingRole: me.role === "admin" ? "admin" : "owner",
    actingUserId: me.id,
    actingBranchId: (me.studio_branch_id as string | null) ?? null,
    isStaff: false,
    studioTier: tier,
  };
}
