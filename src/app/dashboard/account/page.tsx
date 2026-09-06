import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountPanel from "./AccountPanel";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, plan, plan_expires_at, plan_cycle, created_at, role, studio_brand_name, studio_logo_url")
    .eq("id", user.id)
    .single();

  // Provider tells us if this account was created via OAuth or email/password
  const providers = user.identities?.map((i) => i.provider) ?? [];

  return (
    <AccountPanel
      userId={user.id}
      email={user.email ?? ""}
      fullName={profile?.full_name ?? null}
      plan={profile?.plan ?? "free"}
      planExpiresAt={profile?.plan_expires_at ?? null}
      planCycle={profile?.plan_cycle ?? null}
      createdAt={profile?.created_at ?? user.created_at}
      providers={providers}
      hasPassword={providers.includes("email")}
      role={profile?.role ?? "user"}
      studioBrandName={profile?.studio_brand_name ?? null}
      studioLogo={profile?.studio_logo_url ?? null}
    />
  );
}
