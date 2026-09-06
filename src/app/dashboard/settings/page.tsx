import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SettingsPanel, { type Feedback } from "./SettingsPanel";
import type { SiteSettings } from "@/lib/types";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const db = createAdminClient();
  // feedbacks table may not exist yet — catch the error so the page still loads.
  // Yêu cầu nâng cấp & mã giảm giá đã dọn sang tab "Người dùng & studio".
  const [{ data: settings }, feedbackResult] = await Promise.all([
    db.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("feedbacks").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  return (
    <SettingsPanel
      settings={settings as SiteSettings | null}
      feedbacks={(feedbackResult.data ?? []) as Feedback[]}
    />
  );
}
