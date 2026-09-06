import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Any unknown / broken URL: logged-in users go to their studio workspace,
// everyone else lands on the marketing home page.
export default async function NotFound() {
  let signedIn = false;
  try {
    const { data: { user } } = await (await createClient()).auth.getUser();
    signedIn = !!user;
  } catch {
    signedIn = false;
  }
  redirect(signedIn ? "/dashboard/studio" : "/");
}
