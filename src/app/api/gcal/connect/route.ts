import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/gcal";
import { signOAuthState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // H4: state được KÝ (HMAC + hết hạn) để callback không thể bị giả mạo userId.
  const url = getAuthUrl(signOAuthState(user.id));
  return NextResponse.redirect(url);
}
