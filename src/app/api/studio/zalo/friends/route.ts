import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { loadZalo, readPersonalSession } from "@/lib/zalo/config";
import { listFriends } from "@/lib/zalo/personal";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Danh sách bạn bè Zalo của studio (để chọn tay người nhận). Kênh cá nhân. */
export async function GET() {
  const profile = await requireStudio("full");
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const row = await loadZalo(profile.id);
  if (!row || row.status !== "connected") return NextResponse.json({ error: "not_connected" }, { status: 200 });
  if (row.channel !== "personal") return NextResponse.json({ error: "not_personal" }, { status: 200 });

  const session = readPersonalSession(row);
  if (!session) return NextResponse.json({ error: "no_personal_session" }, { status: 200 });

  try {
    const friends = await listFriends(session);
    // Sắp theo tên cho dễ tìm.
    friends.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    return NextResponse.json({ ok: true, friends });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return NextResponse.json({ error: msg || "list_failed" }, { status: 200 });
  }
}
