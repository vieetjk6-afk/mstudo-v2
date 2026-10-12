import type { SupabaseClient } from "@supabase/supabase-js";
import { effectivePlan, planProfilePatch, type Plan } from "@/lib/plans";

/** Dữ liệu dòng "Gói … · Đã tạo N album tháng này" (<PlanUsage/>). */
export interface PlanUsageData {
  used: number;
  limit: number | null; // null = không giới hạn
  pro: boolean;
  plan: Plan;
  expiresAt: string | null;
}

type ProfileLike = {
  role?: string | null;
  plan?: string | null;
  plan_expires_at?: string | null;
  monthly_album_limit?: number | null;
} | null | undefined;

/**
 * Mốc đầu tháng theo giờ Việt Nam (UTC+7), dạng ISO. Trước đây <PlanUsage/> tính
 * ở trình duyệt theo giờ máy khách — mà khách của app này ở VN. Tính trên máy
 * chủ (UTC) thì phải ghim múi giờ, không là 7 tiếng đầu tháng bị đếm lệch.
 */
export function vnMonthStartIso(now = new Date()): string {
  const VN = 7 * 3600 * 1000;
  const vn = new Date(now.getTime() + VN);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1) - VN).toISOString();
}

/**
 * Tính PlanUsageData trên MÁY CHỦ, từ hồ sơ đã đọc sẵn (getProfileById — dùng
 * chung với layout) + MỘT câu đếm album_creations. Trước đây trình duyệt tự
 * chạy nối đuôi getUser → profiles → album_creations sau khi trang đã vẽ, nên
 * dòng này luôn hiện khung xương rồi mới ra số.
 */
export async function getPlanUsage(
  supabase: SupabaseClient,
  userId: string,
  /** Hồ sơ, hoặc lời hứa đọc hồ sơ — chạy SONG SONG với câu đếm. */
  profile: ProfileLike | Promise<ProfileLike>
): Promise<PlanUsageData> {
  const [{ count }, prof] = await Promise.all([
    supabase
      .from("album_creations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", vnMonthStartIso()),
    profile,
  ]);
  return planUsageFrom(prof, count ?? 0);
}

/** Cùng luật với nhánh trình duyệt của <PlanUsage/>. */
export function planUsageFrom(profile: ProfileLike, used: number): PlanUsageData {
  const isAdmin = profile?.role === "admin";
  const plan: Plan = isAdmin ? "studio" : effectivePlan(profile?.plan as Plan, profile?.plan_expires_at);
  // Layout vừa tự hạ gói hết hạn về free trong CÙNG lượt dựng trang, nhưng hồ sơ
  // trong cache vẫn mang hạn mức của gói cũ — lấy hạn mức của gói free cho khớp.
  const expired = !isAdmin && plan === "free" && (profile?.plan ?? "free") !== "free";
  const limit = isAdmin
    ? null
    : expired
      ? planProfilePatch("free").monthly_album_limit ?? null
      : profile?.monthly_album_limit ?? null;
  return {
    used,
    limit,
    pro: plan !== "free",
    plan,
    expiresAt: plan === "free" ? null : profile?.plan_expires_at ?? null,
  };
}
