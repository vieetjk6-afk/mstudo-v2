import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guards";
import { getAuthUrl } from "@/lib/gcal";
import { signOAuthState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // H4: state được KÝ (HMAC + hết hạn) để callback không thể bị giả mạo userId.
  const url = getAuthUrl(signOAuthState(user.id));
  return NextResponse.redirect(url);
}
