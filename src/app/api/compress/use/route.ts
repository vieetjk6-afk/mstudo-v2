import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitsFor, effectivePlan, type Plan } from "@/lib/plans";

export const dynamic = "force-dynamic";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Vietnam is UTC+7 (no DST)

/** ISO timestamp for the start of the current month in Vietnam time. */
function startOfMonthVN(): string {
  const vn = new Date(Date.now() + VN_OFFSET_MS);
  const startUtcMs = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1) - VN_OFFSET_MS;
  return new Date(startUtcMs).toISOString();
}

type Kind = "basic" | "picker";

interface Status {
  userId: string;
  isAdmin: boolean;
  pro: boolean;
  basicLimit: number | null;
  basicUsed: number; // this month
  pickerLimit: number | null;
  pickerUsed: number; // this month or lifetime depending on plan
  pickerWindow: "lifetime" | "month";
}

async function getStatus(): Promise<Status | null> {
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
  const plan = effectivePlan(profile?.plan as Plan, profile?.plan_expires_at);
  const lim = limitsFor(plan, isAdmin);

  const db = createAdminClient();
  const monthStart = startOfMonthVN();

  const { count: basicUsed } = await db
    .from("compress_usages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("kind", "basic")
    .gte("created_at", monthStart);

  let pickerQuery = db
    .from("compress_usages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("kind", "picker");
  if (lim.pickerWindow === "month") pickerQuery = pickerQuery.gte("created_at", monthStart);
  const { count: pickerUsed } = await pickerQuery;

  return {
    userId: user.id,
    isAdmin,
    pro: lim.watermarkPro,
    basicLimit: lim.compressPerMonth,
    basicUsed: basicUsed ?? 0,
    pickerLimit: lim.pickerLimit,
    pickerUsed: pickerUsed ?? 0,
    pickerWindow: lim.pickerWindow,
  };
}

function quota(limit: number | null, used: number) {
  const unlimited = limit === null;
  return {
    unlimited,
    limit,
    used,
    remaining: unlimited ? null : Math.max(0, (limit ?? 0) - used),
  };
}

function body(s: Status) {
  return {
    pro: s.pro,
    basic: quota(s.basicLimit, s.basicUsed),
    picker: { ...quota(s.pickerLimit, s.pickerUsed), window: s.pickerWindow },
  };
}

/** Read the caller's compress quota status (basic + picker). */
export async function GET() {
  const s = await getStatus();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...body(s) });
}

/** Consume one compress use of the given kind (call right before compressing). */
export async function POST(req: Request) {
  const s = await getStatus();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { kind } = (await req.json().catch(() => ({}))) as { kind?: Kind };
  const k: Kind = kind === "picker" ? "picker" : "basic";

  const limit = k === "picker" ? s.pickerLimit : s.basicLimit;
  const used = k === "picker" ? s.pickerUsed : s.basicUsed;

  if (limit !== null && used >= limit) {
    return NextResponse.json({ ok: false, kind: k, ...body(s) }, { status: 429 });
  }

  const db = createAdminClient();
  await db.from("compress_usages").insert({ user_id: s.userId, kind: k });

  if (k === "picker") s.pickerUsed += 1;
  else s.basicUsed += 1;
  return NextResponse.json({ ok: true, kind: k, ...body(s) });
}
