import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIpDurable } from "@/lib/rate-limit";
import type { StoryConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Token-gated Love Story editor endpoint (no login — edit_token is the key).
 *   GET                       -> the story + its guest wishes
 *   POST { config, published } -> save the couple's edits
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  // edit_token là CHÌA KHOÁ duy nhất của trang này (không đăng nhập). Token là
  // UUID nên dò mù gần như bất khả thi, nhưng vẫn phải có trần: không có nó thì
  // một script cứ nã thoải mái, và mỗi lượt trượt vẫn là một truy vấn CSDL.
  const limited = await limitByIpDurable(req, "story-token", 60, 60_000);
  if (limited) return limited;

  const db = createAdminClient();
  const { data: story } = await db
    .from("story_pages")
    .select("id, owner_id, slug, config, published, updated_at, drive_refresh_token")
    .eq("edit_token", params.token)
    .maybeSingle();
  if (!story) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [{ data: wishes }, { data: uploads }] = await Promise.all([
    db.from("story_wishes").select("id, guest_name, wish, created_at").eq("story_id", story.id).order("created_at", { ascending: false }).limit(500),
    db.from("story_uploads").select("id, drive_file_id, guest_name, is_video, approved, created_at").eq("story_id", story.id).order("created_at", { ascending: false }).limit(300),
  ]);

  const driveConnected = !!story.drive_refresh_token;
  return NextResponse.json({
    story: { id: story.id, slug: story.slug, config: story.config, published: story.published },
    wishes: wishes ?? [],
    uploads: uploads ?? [],
    drive_connected: driveConnected,
  });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const limited = await limitByIpDurable(req, "story-token", 60, 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { config?: StoryConfig; published?: boolean; action?: string; uploadId?: string };
  if (JSON.stringify(body.config ?? {}).length > 256_000) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  const db = createAdminClient();
  const { data: story } = await db.from("story_pages").select("id").eq("edit_token", params.token).maybeSingle();
  if (!story) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (body.action === "disconnect_drive") {
    await db.from("story_pages").update({ drive_refresh_token: null }).eq("id", story.id);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "delete_upload" && body.uploadId) {
    await db.from("story_uploads").delete().eq("id", body.uploadId).eq("story_id", story.id);
    return NextResponse.json({ ok: true });
  }

  const patch: Record<string, unknown> = {};
  if (body.config && typeof body.config === "object") patch.config = body.config;
  if (typeof body.published === "boolean") patch.published = body.published;
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const { error } = await db.from("story_pages").update(patch).eq("id", story.id);
  // Không trả nguyên văn lỗi Postgres ra client — nó lộ tên bảng/cột và ràng buộc.
  if (error) {
    console.error("[api/story] update lỗi", error.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
