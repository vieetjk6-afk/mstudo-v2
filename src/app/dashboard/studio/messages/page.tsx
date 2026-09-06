import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import type { MessageTemplate } from "@/lib/types";
import MessagesManager from "./MessagesManager";
import ZaloPanel from "./ZaloPanel";


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

  return (
    <div className="space-y-6">
      <ZaloPanel />
      <MessagesManager ownerId={profile.id} initial={(data ?? []) as MessageTemplate[]} />
    </div>
  );
}
