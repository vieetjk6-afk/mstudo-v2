import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import type { StudioEquipment } from "@/lib/types";
import EquipmentManager from "./EquipmentManager";
import { applyBranch, getBranchScope } from "@/lib/branches";


export default async function EquipmentPage() {
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
  const { data } = await applyBranch(
    supabase.from("studio_equipment").select("*").eq("owner_id", profile.id),
    (await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string)).selected
  ).order("name");

  return <EquipmentManager ownerId={profile.id} initial={(data ?? []) as StudioEquipment[]} />;
}
