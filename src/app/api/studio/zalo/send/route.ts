import { NextResponse, type NextRequest } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { sendZalo } from "@/lib/zalo/send";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Gửi một tin Zalo ngay (dùng cho nút "Gửi thử" và "Gửi Zalo" trên trang mẫu
 * tin). Tự chọn kênh theo cấu hình studio đã kết nối.
 */
export async function POST(req: NextRequest) {
  const profile = await requireStudio("full");
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const toPhone = typeof b.toPhone === "string" ? b.toPhone.trim() : "";
  const body = typeof b.body === "string" ? b.body : "";
  const templateId = typeof b.templateId === "string" ? b.templateId.trim() : undefined;

  if (!toPhone && !b.toUid) return NextResponse.json({ error: "missing_recipient" }, { status: 400 });
  if (!body && !templateId) return NextResponse.json({ error: "missing_content" }, { status: 400 });

  const res = await sendZalo({
    ownerId: profile.id,
    toPhone: toPhone || null,
    toUid: typeof b.toUid === "string" ? b.toUid : null,
    toName: typeof b.toName === "string" ? b.toName : null,
    body,
    templateId,
    templateData: b.templateData && typeof b.templateData === "object" ? b.templateData : undefined,
    imageUrl: typeof b.imageUrl === "string" ? b.imageUrl : null,
    kind: typeof b.kind === "string" ? b.kind : "manual",
    audience: b.audience === "crew" ? "crew" : b.audience === "client" ? "client" : undefined,
    contractId: typeof b.contractId === "string" ? b.contractId : null,
  });

  return NextResponse.json(res);
}
