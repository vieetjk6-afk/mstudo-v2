import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import { getStudioHost } from "@/lib/studio-site";
import { applyBranch, getBranchScope } from "@/lib/branches";
import type { StudioBooking } from "@/lib/types";
import BookingsView from "./BookingsView";


export default async function BookingsPage() {
  const profile = await requireStudio("booking");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Photographer trở lên</h1>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Nâng cấp gói</a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // Ensure the studio has a public booking token. Write + read it back with the
  // service-role client (same client the public /book page uses) so the link we
  // show is guaranteed to resolve — avoids RLS edge cases silently dropping the
  // write and producing a "Link không hợp lệ" 404 for the customer.
  let token = profile.booking_token as string | null;
  let tokenSaved = true;
  if (!token) {
    const admin = createAdminClient();
    token = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "");
    const { error } = await admin.from("profiles").update({ booking_token: token }).eq("id", profile.id);
    if (error) tokenSaved = false;
    // Read back to confirm it persisted (and to pick up any pre-existing token).
    const { data: row } = await admin.from("profiles").select("booking_token").eq("id", profile.id).maybeSingle();
    if (row?.booking_token) token = row.booking_token as string;
    else tokenSaved = false;
  }

  // Phạm vi chi nhánh đang chọn trên thanh trên cùng.
  const scope = await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string);
  const { data } = await applyBranch(
    supabase.from("studio_bookings").select("*").eq("owner_id", profile.id).neq("status", "archived"),
    scope.selected
  ).order("created_at", { ascending: false });

  const studioHost = await getStudioHost(supabase, profile.id);
  return <BookingsView ownerId={profile.id} token={token} tokenSaved={tokenSaved} initial={(data ?? []) as StudioBooking[]} studioHost={studioHost} />;
}
