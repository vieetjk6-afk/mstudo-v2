import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitsFor, effectivePlan, type Plan } from "@/lib/plans";

export const dynamic = "force-dynamic";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function startOfMonthVN(): string {
  const vn = new Date(Date.now() + VN_OFFSET_MS);
  const startUtcMs = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1) - VN_OFFSET_MS;
  return new Date(startUtcMs).toISOString();
}

async function getStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, plan, plan_expires_at")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";
  const lim = limitsFor(effectivePlan(profile?.plan as Plan, profile?.plan_expires_at), isAdmin);

  const db = createAdminClient();
  const { count } = await db
    .from("filter_usages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", startOfMonthVN());

  return { userId: user.id, limit: lim.filterPerMonth, used: count ?? 0 };
}

function payload(limit: number | null, used: number) {
  const unlimited = limit === null;
  return {
    unlimited,
    limit,
    used,
    remaining: unlimited ? null : Math.max(0, (limit ?? 0) - used),
  };
}

/** Read the caller's monthly filter-tool quota. */
export async function GET() {
  const s = await getStatus();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...payload(s.limit, s.used) });
}

/** Consume one filter use for this month. */
export async function POST() {
  const s = await getStatus();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (s.limit !== null && s.used >= s.limit) {
    return NextResponse.json({ ok: false, ...payload(s.limit, s.used) }, { status: 429 });
  }

  const db = createAdminClient();
  await db.from("filter_usages").insert({ user_id: s.userId });
  return NextResponse.json({ ok: true, ...payload(s.limit, s.used + 1) });
}
