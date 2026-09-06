import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = createAdminClient();
  // M-4: Check both role AND is_active to block deactivated admins
  const { data: profile } = await db.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  return profile?.role === "admin" && profile?.is_active !== false ? db : null;
}

/** GET — all commissions with referrer info */
export async function GET() {
  const db = await assertAdmin();
  if (!db) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: commissions } = await db
    .from("affiliate_commissions")
    .select("id, referrer_id, referred_email, plan, cycle, sale_amount, commission_pct, commission_amount, status, created_at, paid_at, note, referrer:profiles!referrer_id(full_name, email)")
    .order("created_at", { ascending: false });

  const { data: settings } = await db
    .from("site_settings")
    .select("affiliate_commission_basic, affiliate_commission_photographer, affiliate_commission_photographer_plus, affiliate_commission_studio")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json({ commissions: commissions ?? [], settings });
}

/** PATCH — mark commission as paid or cancelled */
export async function PATCH(req: Request) {
  const db = await assertAdmin();
  if (!db) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, status, note } = await req.json().catch(() => ({}));
  if (!id || !["paid", "cancelled", "pending"].includes(status)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  await db
    .from("affiliate_commissions")
    .update({ status, note: note ?? null, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}

/** PUT — update commission rates in site_settings */
export async function PUT(req: Request) {
  const db = await assertAdmin();
  if (!db) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { basic, photographer, photographer_plus, studio } = await req.json().catch(() => ({}));
  await db.from("site_settings").update({
    affiliate_commission_basic: Math.min(100, Math.max(0, Number(basic) || 0)),
    affiliate_commission_photographer: Math.min(100, Math.max(0, Number(photographer) || 0)),
    affiliate_commission_photographer_plus: Math.min(100, Math.max(0, Number(photographer_plus) || 0)),
    affiliate_commission_studio: Math.min(100, Math.max(0, Number(studio) || 0)),
  }).eq("id", 1);

  return NextResponse.json({ ok: true });
}
