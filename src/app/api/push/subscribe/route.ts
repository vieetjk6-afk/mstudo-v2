import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Save (or refresh) the current user's push subscription.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }
  // Chỉ nhận endpoint của các dịch vụ push chính thống — chặn lưu URL nội bộ để
  // biến máy chủ thành công cụ gửi request tùy ý (SSRF) khi web-push POST tới đó.
  const PUSH_HOSTS = /(^|\.)(googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com|web\.push\.apple\.com)$/i;
  try {
    const u = new URL(sub.endpoint);
    if (u.protocol !== "https:" || !PUSH_HOSTS.test(u.hostname)) {
      return NextResponse.json({ error: "invalid endpoint" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid endpoint" }, { status: 400 });
  }

  // Notifications belong to the studio owner. Staff sub-accounts subscribe under
  // the owner so they receive the studio's notifications too.
  const { data: me } = await supabase
    .from("profiles")
    .select("id, studio_owner_id")
    .eq("id", user.id)
    .maybeSingle();
  const ownerId = me?.studio_owner_id || user.id;

  const db = createAdminClient();
  await db.from("push_subscriptions").upsert(
    {
      owner_id: ownerId,
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  return NextResponse.json({ ok: true });
}

// Remove a subscription (when the user turns notifications off).
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (!endpoint) return NextResponse.json({ error: "missing endpoint" }, { status: 400 });

  const db = createAdminClient();
  // C-2: Scope delete to the authenticated user's subscription to prevent IDOR
  await db.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
