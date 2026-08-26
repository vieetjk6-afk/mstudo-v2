import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { listConversations, staffNames } from "@/lib/inbox/view";

export const dynamic = "force-dynamic";

/**
 * Danh sách hội thoại của studio. Giao diện tải một lần khi mở màn, sau đó
 * realtime lo phần cập nhật — route này chỉ để tải lại khi mất kết nối.
 */
export async function GET() {
  const profile = await requireStudio("booking");
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (profile.actingRole === "accountant") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = createClient();
  const [conversations, staff] = await Promise.all([
    listConversations(db, profile.id as string),
    staffNames(profile.id as string),
  ]);
  return NextResponse.json({ conversations, staff });
}
