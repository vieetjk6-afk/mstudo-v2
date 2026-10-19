import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rate-limit";
import { testProviderInput } from "@/lib/vieetjk/provider-store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Nút "Thử" ở trang Chatbox: gửi một câu chào thật tới nguồn studio đang nhập. */
export async function POST(req: Request) {
  const p = await requireStudio("booking");
  if (!p || p.isStaff || (p.actingRole !== "owner" && p.actingRole !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!rateLimit(`ai-test:${p.id}`, 15, 60_000)) {
    return NextResponse.json({ ok: false, error: "Bấm hơi nhanh — đợi một chút rồi thử lại." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  return NextResponse.json(await testProviderInput({ kind: "studio", ownerId: p.id }, body?.provider));
}
