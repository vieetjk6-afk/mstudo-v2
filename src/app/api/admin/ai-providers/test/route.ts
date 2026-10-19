import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rate-limit";
import { testProviderInput } from "@/lib/vieetjk/provider-store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Nút "Thử" của trang quản trị: gửi một câu chào thật tới nguồn đang nhập. */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // Mỗi lần thử là một lượt AI tính tiền.
  if (!rateLimit(`ai-test:${admin.id}`, 15, 60_000)) {
    return NextResponse.json({ ok: false, error: "Bấm hơi nhanh — đợi một chút rồi thử lại." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  return NextResponse.json(await testProviderInput({ kind: "shared" }, body?.provider));
}
