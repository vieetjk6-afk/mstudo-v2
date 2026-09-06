import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import { deliver } from "@/lib/inbox/send";
import { limitByIpDurable } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_LEN = 4000;

/**
 * Nhân viên gửi một tin cho khách.
 *
 * NHẮN LÀ TIẾP QUẢN: gửi tin xong thì AI của hội thoại đó tự tắt và người gửi
 * tự nhận phụ trách (nếu chưa ai nhận). Đây là hành vi cố ý — không ai muốn
 * vừa gõ xong một câu tư vấn thì bot chen vào nói ngược lại. Muốn cho bot chạy
 * tiếp thì bật lại công tắc "AI tự trả lời" trong khung chat.
 */
export async function POST(req: Request) {
  const profile = await requireStudio("booking");
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (profile.actingRole === "accountant") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Chặn kịch bản gửi hàng loạt qua tài khoản nhân viên bị chiếm.
  const limited = await limitByIpDurable(req, "inbox-send", 60, 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { conversationId?: unknown; text?: unknown };
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_LEN) : "";
  if (!conversationId || !text) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // Kiểm quyền bằng client THEO PHIÊN (RLS): đọc được dòng này nghĩa là hội
  // thoại thuộc studio của người đang đăng nhập. Việc gửi phía sau đi bằng
  // service-role, nên cửa kiểm quyền duy nhất là ở đây.
  const db = await createClient();
  const { data: conv } = await db
    .from("inbox_conversations")
    .select("id, ai_enabled, assignee_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Tên người gửi lưu THẲNG vào dòng tin, không chỉ lưu id: nhân viên nghỉ việc
  // rồi thì lịch sử vẫn phải đọc được "ai đã hứa gì với khách". `profile` ở đây
  // là hồ sơ CHỦ studio (requireStudio đổi sang chủ khi người đăng nhập là nhân
  // viên), nên phải tra riêng theo actingUserId.
  const admin = createAdminClient();
  const { data: actor } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", profile.actingUserId as string)
    .maybeSingle();
  const senderName = ((actor as { full_name?: string | null } | null)?.full_name || "").trim() || null;

  const res = await deliver({
    conversationId,
    text,
    sender: "staff",
    senderId: profile.actingUserId as string,
    senderName,
  });

  // Tiếp quản: tắt AI và nhận phụ trách. Làm SAU khi gửi để tin hỏng cũng vẫn
  // tính là đã có người vào — người đó phải xử lý tiếp, không phải bot.
  const row = conv as { ai_enabled: boolean; assignee_id: string | null };
  const patch: Record<string, unknown> = {};
  if (row.ai_enabled) patch.ai_enabled = false;
  if (!row.assignee_id) patch.assignee_id = profile.actingUserId;
  if (Object.keys(patch).length) {
    patch.updated_at = new Date().toISOString();
    await admin.from("inbox_conversations").update(patch).eq("id", conversationId);
  }

  if (!res.ok) return NextResponse.json({ error: res.error || "send_failed" }, { status: 502 });
  return NextResponse.json({ ok: true, messageId: res.messageId });
}
