import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guards";
import { disconnectGoogleCalendar } from "@/lib/gcal";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await disconnectGoogleCalendar(user.id);
  return NextResponse.json({ ok: true });
}
