import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import type { StudioPackage } from "@/lib/types";
import PackagesManager from "./PackagesManager";


export default async function PackagesPage() {
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
    .from("studio_packages")
    .select("*")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  return <PackagesManager ownerId={profile.id} initial={(data ?? []) as StudioPackage[]} />;
}
