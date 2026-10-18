import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { getProviderSettings, saveProviderSettings } from "@/lib/vieetjk/provider-store";

export const dynamic = "force-dynamic";

/**
 * API key AI RIÊNG của studio — bot dùng trước key chung của hệ thống. Chỉ
 * chủ studio (hoặc admin) sửa được: đây là tài khoản trả tiền của studio,
 * nhân viên không được thay.
 */
async function ownerOnly() {
  const p = await requireStudio("booking");
  if (!p || p.isStaff || (p.actingRole !== "owner" && p.actingRole !== "admin")) return null;
  return p;
}

export async function GET() {
  const p = await ownerOnly();
  if (!p) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await getProviderSettings({ kind: "studio", ownerId: p.id }));
}

export async function POST(req: Request) {
  const p = await ownerOnly();
  if (!p) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const res = await saveProviderSettings({ kind: "studio", ownerId: p.id }, body?.providers);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ providers: res.providers });
}
