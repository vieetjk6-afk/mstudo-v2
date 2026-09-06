import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlan, studioTier } from "@/lib/plans";
import GoogleCalendarConnect from "./GoogleCalendarConnect";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage(
  props: {
    searchParams?: Promise<{ gcal?: string; msg?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("plan, plan_expires_at, role, google_refresh_token")
    .eq("id", user.id)
    .maybeSingle();

  const tier = studioTier(
    effectivePlan(profile?.plan, profile?.plan_expires_at),
    profile?.role === "admin",
  );
  if (tier === "none") redirect("/dashboard/upgrade");

  const connected = !!profile?.google_refresh_token;
  const gcalStatus = searchParams?.gcal ?? null;
  const gcalMsg    = searchParams?.msg  ?? null;

  return (
    <GoogleCalendarConnect
      connected={connected}
      gcalStatus={gcalStatus}
      gcalMsg={gcalMsg}
    />
  );
}
