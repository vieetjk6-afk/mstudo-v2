import { NextRequest } from "next/server";
import { resolveVieetjkOwner } from "@/lib/vieetjk/data";
import { websiteStaffMessages } from "@/lib/inbox/website";
import { limitByIpDurable } from "@/lib/rate-limit";

/**
 * Widget chat trên website hỏi: nhân viên có nhắn gì cho phiên này chưa?
 *
 * Cách đơn giản nhất mà vẫn đúng: widget hỏi lại vài giây một lần trong lúc
 * khung chat đang mở. Không dùng realtime của Supabase ở đây vì khách là người
 * LẠ (chưa đăng nhập), mở kênh realtime cho họ nghĩa là mở thêm một cửa vào DB
 * cho mọi khách vãng lai — trong khi việc cần làm chỉ là đọc vài dòng tin.
 *
 * `sessionId` là UUID ngẫu nhiên do trình duyệt khách sinh, đóng vai trò mã
 * phiên: biết mã thì đọc được hội thoại của phiên đó, đúng như khách đang mở
 * khung chat. Vẫn giới hạn tần suất để không ai dùng nó mà dò phiên người khác.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = await limitByIpDurable(req, "vjk-chat-updates", 120, 60_000);
  if (limited) return limited;

  const sessionId = (req.nextUrl.searchParams.get("sessionId") || "").slice(0, 64);
  const after = req.nextUrl.searchParams.get("after");
  if (!sessionId) return Response.json({ messages: [], takenOver: false });

  try {
    const { ownerId } = await resolveVieetjkOwner();
    if (!ownerId) return Response.json({ messages: [], takenOver: false });
    const res = await websiteStaffMessages(ownerId, sessionId, after);
    return Response.json(res, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ messages: [], takenOver: false });
  }
}
