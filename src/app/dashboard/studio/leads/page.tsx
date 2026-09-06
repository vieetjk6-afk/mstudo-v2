import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import LeadsView, { type Lead } from "./LeadsView";

/**
 * Lead từ chatbox tư vấn trên website (vieetjk.com). Chủ studio xem hội thoại,
 * gọi lại khách, đánh dấu đã liên hệ. Dữ liệu lưu ở website_leads (RLS: chủ đọc).
 */
export default async function LeadsPage() {
  const profile = await requireStudio("booking");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Photographer trở lên</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Tính năng này dành cho tài khoản có trang web &amp; chatbox tư vấn.
          </p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Nâng cấp gói</a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("website_leads")
    .select("id, name, phone, interest, transcript, status, created_at")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(300);

  return <LeadsView leads={(data ?? []) as Lead[]} />;
}
