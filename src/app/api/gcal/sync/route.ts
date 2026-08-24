/**
 * Đồng bộ MỘT bản ghi lên Google Lịch theo yêu cầu của trình duyệt.
 *
 * POST body:
 *   { kind: "event" | "contract", id: string, action: "upsert" | "delete" }
 *
 * Route này chỉ còn là lớp vỏ KIỂM QUYỀN quanh `@/lib/gcal-sync`: nó xác minh
 * phiên đăng nhập rồi gọi đúng hàm ở đó. Toàn bộ logic "trạng thái nào thì lên
 * lịch, ghi ngược id vào đâu" nằm một chỗ duy nhất, vì các luồng KHÔNG có phiên
 * đăng nhập (khách ký ở /c/[token], cron, app máy tính) cũng gọi cùng những hàm
 * ấy — hai bản sao trôi dạt khỏi nhau đúng là kiểu lỗi đã tốn của dự án này cả
 * buổi.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  syncContractToGCal,
  removeContractFromGCal,
  syncStudioEventToGCal,
  removeStudioEventFromGCal,
} from "@/lib/gcal-sync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    // Lỗi từ Google (token bị thu hồi, quota, sai redirect URI) trước đây bay
    // thẳng thành 500 không nội dung, mà mọi nơi gọi lại bỏ qua phản hồi — nên
    // đồng bộ hỏng hàng tuần cũng không ai biết.
    return NextResponse.json({ ok: false, reason: (e as Error)?.message || String(e) }, { status: 500 });
  }
}

async function handle(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { kind, id, action } = await req.json().catch(() => ({})) as {
    kind?: "event" | "contract";
    id?: string;
    action?: "upsert" | "delete";
  };
  if (!kind || !id || !action) return NextResponse.json({ error: "missing params" }, { status: 400 });

  if (kind === "event") {
    if (action === "delete") {
      await removeStudioEventFromGCal(user.id, id);
      return NextResponse.json({ ok: true });
    }
    const r = await syncStudioEventToGCal(user.id, id);
    if (!r.synced && r.reason === "không tìm thấy mốc lịch") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, synced: r.synced, reason: r.reason, gcal_event_id: r.gcalEventId });
  }

  if (kind === "contract") {
    if (action === "delete") {
      await removeContractFromGCal(user.id, id);
      return NextResponse.json({ ok: true });
    }
    const r = await syncContractToGCal(user.id, id);
    if (!r.synced && r.reason === "không tìm thấy hợp đồng") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, synced: r.synced, reason: r.reason, gcal_event_id: r.gcalEventId });
  }

  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
