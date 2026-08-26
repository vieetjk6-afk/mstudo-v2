import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { getConversation, listMessages, markRead } from "@/lib/inbox/view";

export const dynamic = "force-dynamic";

/** Toàn bộ tin của một hội thoại. Mở ra là đánh dấu đã đọc. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const profile = await requireStudio("booking");
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (profile.actingRole === "accountant") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = createClient();
  // RLS lo phần "hội thoại này có thuộc studio mình không" — không thấy thì
  // getConversation trả null và ta trả 404, không lộ ra là nó có tồn tại.
  const conversation = await getConversation(db, params.id);
  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const messages = await listMessages(db, params.id);
  await markRead(db, params.id);

  return NextResponse.json({ conversation: { ...conversation, unread: 0 }, messages });
}

/**
 * Đổi trạng thái hội thoại: tiếp quản / trả lại cho AI, đóng / mở lại, nhận
 * phụ trách. Ba việc gộp một route vì cùng là "sửa một dòng hội thoại", và
 * giao diện thường làm hai việc cùng lúc (bấm tiếp quản = tắt AI + tự nhận).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const profile = await requireStudio("booking");
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (profile.actingRole === "accountant") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    aiEnabled?: unknown;
    status?: unknown;
    /** "me" = tự nhận, null = bỏ phụ trách. */
    assignee?: unknown;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.aiEnabled === "boolean") patch.ai_enabled = body.aiEnabled;
  if (body.status === "open" || body.status === "closed") patch.status = body.status;
  if (body.assignee === "me") patch.assignee_id = profile.actingUserId;
  else if (body.assignee === null) patch.assignee_id = null;

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const db = createClient();
  const { data, error } = await db
    .from("inbox_conversations")
    .update(patch)
    .eq("id", params.id)
    .select("id, ai_enabled, status, assignee_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    aiEnabled: (data as { ai_enabled: boolean }).ai_enabled,
    status: (data as { status: string }).status,
    assigneeId: (data as { assignee_id: string | null }).assignee_id,
  });
}
