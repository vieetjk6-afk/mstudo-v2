import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import type { MessageTemplate } from "@/lib/types";
import MessagesManager from "./MessagesManager";
import ZaloPanel from "./ZaloPanel";
import MessagesV2 from "./MessagesV2";
import { isUiV2 } from "@/lib/ui-server";


export default async function MessagesPage() {
  const profile = await requireStudio();
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("message_templates")
    .select("*")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  // Giao diện mới: mẫu tin và Zalo tự động thành hai tab của cùng một màn.
  if (await isUiV2()) return <MessagesV2 ownerId={profile.id} initial={(data ?? []) as MessageTemplate[]} />;

  return (
    <div className="space-y-6">
      <ZaloPanel />
      <MessagesManager ownerId={profile.id} initial={(data ?? []) as MessageTemplate[]} />
    </div>
  );
}
