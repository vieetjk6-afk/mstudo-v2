import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { isPlatform } from "@/lib/inbox/platforms";
import {
  disconnectChannel,
  linkZaloChannels,
  listChannels,
  setChannelAiMode,
  toPublic,
  upsertChannel,
} from "@/lib/inbox/channels";
import { packMetaSecret } from "@/lib/inbox/adapters/meta";

export const dynamic = "force-dynamic";

/**
 * Nối / ngắt các kênh mạng xã hội của hộp thư.
 *
 * Chỉ chủ studio và quản lý được đụng vào: đây là nơi dán Page Access Token,
 * tức là chìa khoá nhắn tin thay mặt thương hiệu. Nhân viên trực chat vẫn trả
 * lời khách bình thường mà không cần thấy màn này.
 */
function canManage(role: string): boolean {
  return role === "owner" || role === "admin" || role === "manager";
}

export async function GET() {
  const profile = await requireStudio("booking");
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listChannels(profile.id as string);
  return NextResponse.json({ channels: rows.map(toPublic) });
}

export async function POST(req: Request) {
  const profile = await requireStudio("booking");
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManage(profile.actingRole as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "connect";
  const ownerId = profile.id as string;

  // Nối Zalo dựa trên cấu hình studio đã cấp quyền sẵn ở màn "Kết nối".
  if (action === "link-zalo") {
    const res = await linkZaloChannels(ownerId);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true, linked: res.linked });
  }

  if (action === "ai-mode") {
    const channelId = typeof body.channelId === "string" ? body.channelId : "";
    const aiMode = body.aiMode === "off" ? "off" : "auto";
    if (!channelId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const ok = await setChannelAiMode(ownerId, channelId, aiMode);
    return ok ? NextResponse.json({ ok: true, aiMode }) : NextResponse.json({ error: "failed" }, { status: 400 });
  }

  if (action === "disconnect") {
    const channelId = typeof body.channelId === "string" ? body.channelId : "";
    if (!channelId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const ok = await disconnectChannel(ownerId, channelId);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "failed" }, { status: 400 });
  }

  // connect — Facebook / Instagram: cần page id + page access token.
  const platform = body.platform;
  if (!isPlatform(platform)) return NextResponse.json({ error: "bad_platform" }, { status: 400 });
  if (platform !== "facebook" && platform !== "instagram") {
    // Zalo đi đường "link-zalo", website tự sinh khi có khách nhắn.
    return NextResponse.json({ error: "platform_not_manual" }, { status: 400 });
  }

  const externalId = typeof body.externalId === "string" ? body.externalId.trim() : "";
  const token = typeof body.pageAccessToken === "string" ? body.pageAccessToken.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!externalId || !token) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const res = await upsertChannel({
    ownerId,
    platform,
    externalId,
    name: name || null,
    secret: packMetaSecret(token),
  });
  if (!res.ok) {
    // "taken" = page này studio khác đã nối. Nói rõ ra, vì người dùng sẽ ngồi
    // dán lại token mãi mà không hiểu vì sao không được.
    const message =
      res.error === "taken"
        ? "Trang này đã được một tài khoản khác nối. Ngắt ở bên đó trước rồi nối lại."
        : res.error;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, channel: toPublic(res.channel) });
}
