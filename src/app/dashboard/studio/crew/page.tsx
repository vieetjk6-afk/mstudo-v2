import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { mainUrl } from "@/lib/hosts";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBranches } from "@/lib/branches";
import type { StudioCrew } from "@/lib/types";
import CrewManager from "./CrewManager";


export default async function CrewPage() {
  const profile = await requireStudio();
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
  // Link đăng ký riêng của studio: /crew/<crew_token>. Mã NGẮN vì thợ hay phải
  // gõ tay hoặc đọc qua điện thoại — 8 ký tự là ~2,8 nghìn tỷ tổ hợp, thừa an
  // toàn cho một link chỉ dẫn tới form đăng ký (không lộ dữ liệu gì).
  // Bỏ chữ dễ đọc nhầm: 0/O, 1/l/I.
  const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
  const shortCode = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((n) => ALPHABET[n % ALPHABET.length])
      .join("");

  let crewToken = (profile.crew_token as string | null) ?? null;
  // Token dài kiểu UUID cấp ở bản trước cũng rút gọn luôn.
  let tokenError: string | null = null;
  if (profile.actingRole !== "staff" && (!crewToken || crewToken.length > 12)) {
    for (let i = 0; i < 5; i++) {
      const candidate = shortCode();
      // Cột là unique — đụng mã thì thử lại, gần như không bao giờ xảy ra.
      // Service role chứ KHÔNG phải client của user: c1_profiles_column_grants.sql
      // đã thu hồi UPDATE toàn bảng profiles và chỉ cấp lại một số cột an toàn —
      // crew_token không nằm trong đó, nên ghi bằng client user sẽ bị chặn ở mức
      // quyền CỘT. Giữ nguyên như vậy (chặt hơn) và ghi ở server.
      const { error } = await createAdminClient()
        .from("profiles")
        .update({ crew_token: candidate })
        .eq("id", profile.id);
      if (!error) { crewToken = candidate; tokenError = null; break; }
      tokenError = error.message;
    }
  }

  const [{ data }, { data: assignments }] = await Promise.all([
    supabase.from("studio_crew").select("*").eq("owner_id", profile.id).order("name"),
    supabase
      .from("contract_crew")
      .select("phone, status, contract:studio_contracts!inner(owner_id)")
      .eq("contract.owner_id", profile.id)
      .not("phone", "is", null),
  ]);

  // Reliability stats per phone (across all of this studio's contracts).
  const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
  const stats: Record<string, { total: number; accepted: number; declined: number }> = {};
  for (const a of (assignments ?? []) as Array<{ phone: string | null; status: string }>) {
    const p = digits(a.phone);
    if (!p) continue;
    if (!stats[p]) stats[p] = { total: 0, accepted: 0, declined: 0 };
    stats[p].total += 1;
    if (a.status === "accepted") stats[p].accepted += 1;
    else if (a.status === "declined") stats[p].declined += 1;
  }

  return (
    <CrewManager
      ownerId={profile.id}
      initial={(data ?? []) as StudioCrew[]}
      stats={stats}
      registerUrl={crewToken ? mainUrl(`/crew/${crewToken}`) : ""}
      registerError={crewToken ? null : tokenError}
      branches={(await getActiveBranches(profile.id)).map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
