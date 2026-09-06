import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** GET — commission history + totals for the calling user */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data: commissions } = await db
    .from("affiliate_commissions")
    .select("id, referred_email, plan, cycle, sale_amount, commission_pct, commission_amount, status, created_at, paid_at")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false });

  const rows = commissions ?? [];
  const totalEarned = rows.reduce((s, r) => s + (r.commission_amount ?? 0), 0);
  const totalPaid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + (r.commission_amount ?? 0), 0);
  const totalPending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + (r.commission_amount ?? 0), 0);

  return NextResponse.json({ commissions: rows, totalEarned, totalPaid, totalPending });
}
