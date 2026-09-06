import { NextResponse, type NextRequest } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { AUTO_EVENTS, loadZalo, saveZalo, type AutoEvents, type ZaloChannel } from "@/lib/zalo/config";

export const dynamic = "force-dynamic";

const VALID_KEYS = new Set(AUTO_EVENTS.map((e) => e.key));

/** Lưu kênh mặc định + bật/tắt tự động gửi theo từng mốc. */
export async function POST(req: NextRequest) {
  const profile = await requireStudio("full");
  if (!profile || profile.isStaff || (profile.actingRole !== "owner" && profile.actingRole !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: { channel?: ZaloChannel; auto_events?: AutoEvents } = {};

  if (body.channel === "oa" || body.channel === "personal") patch.channel = body.channel;

  if (body.autoEvents && typeof body.autoEvents === "object") {
    const clean: AutoEvents = {};
    // Hình dạng THẬT của một mục autoEvents do trình duyệt gửi lên. Khai rõ ở
    // đây thay vì `any`: mọi trường vẫn được kiểm lại từng cái ở dưới, nhưng
    // giờ trình biên dịch bắt luôn nếu ai đó đọc nhầm tên trường.
    type AutoEventInput = { client?: unknown; crew?: unknown; templateId?: unknown };
    for (const [k, v] of Object.entries(body.autoEvents as Record<string, AutoEventInput>)) {
      if (!VALID_KEYS.has(k) || !v || typeof v !== "object") continue;
      clean[k] = {
        client: !!v.client,
        crew: !!v.crew,
        templateId: typeof v.templateId === "string" && v.templateId.trim() ? v.templateId.trim() : undefined,
      };
    }
    patch.auto_events = clean;
  }

  if (!patch.channel && !patch.auto_events) return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });

  // Bảo đảm có row để upsert (kể cả khi chưa kết nối).
  const existing = await loadZalo(profile.id);
  if (!existing && !patch.channel) patch.channel = "personal";
  await saveZalo(profile.id, patch);

  return NextResponse.json({ ok: true });
}
