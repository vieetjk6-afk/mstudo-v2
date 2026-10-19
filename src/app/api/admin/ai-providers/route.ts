import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { getProviderSettings, saveProviderSettings } from "@/lib/vieetjk/provider-store";

export const dynamic = "force-dynamic";

/**
 * API key AI DÙNG CHUNG cho mọi studio (chatbox, Hộp thư, hợp đồng nhanh).
 * Trả về bản đã che khoá — khoá đầy đủ không bao giờ rời máy chủ.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await getProviderSettings({ kind: "shared" }));
}

/** Lưu cả danh sách (thứ tự = thứ tự bot thử). Ô khoá trống = giữ khoá cũ. */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const res = await saveProviderSettings({ kind: "shared" }, body?.providers);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ providers: res.providers });
}
