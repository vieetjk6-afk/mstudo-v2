import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadGuestFile } from "@/lib/story-drive";
import { sendPushToOwner } from "@/lib/push";
import { limitByIp } from "@/lib/rate-limit";
import type { StoryConfig } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 60 * 1024 * 1024; // 60MB (allows short videos)

/**
 * Public guest contribution: a wedding guest uploads a photo/video which is
 * written to the COUPLE's own Google Drive (their connected account) and shown
 * in the story feed once approved.
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  // H5: chặn lạm dụng upload (làm đầy Drive cặp đôi / spam) — giới hạn theo IP.
  const limited = limitByIp(req, "story-contribute", 12, 60_000);
  if (limited) return limited;

  const db = createAdminClient();
  const { data: story } = await db
    .from("story_pages")
    .select("id, owner_id, published, config, drive_refresh_token, drive_upload_folder")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!story || !story.published) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((story.config as StoryConfig)?.guest_upload !== true) return NextResponse.json({ error: "disabled" }, { status: 403 });
  if (!story.drive_refresh_token) return NextResponse.json({ error: "drive_not_connected" }, { status: 409 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const guestName = String(form?.get("guest_name") ?? "").trim().slice(0, 120);
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too_large", hint: "Tối đa 60MB." }, { status: 413 });
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return NextResponse.json({ error: "bad_type" }, { status: 415 });

  let up: { id: string; isVideo: boolean } | null = null;
  try {
    up = await uploadGuestFile(story, file, guestName ? `${guestName} — ${file.name}` : file.name);
  } catch {
    return NextResponse.json({ error: "upload_failed" }, { status: 502 });
  }
  if (!up) return NextResponse.json({ error: "drive_not_connected" }, { status: 409 });

  // Auto-approve; the couple can remove any upload from the editor.
  const { error } = await db.from("story_uploads").insert({
    story_id: story.id, drive_file_id: up.id, name: file.name, is_video: up.isVideo, guest_name: guestName, approved: true,
  });
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });

  await sendPushToOwner(story.owner_id, { title: "Love Story", body: `${guestName || "Một vị khách"} vừa đăng story`, url: "/dashboard/studio/story", tag: `story-up-${story.id}` }).catch(() => {});
  return NextResponse.json({ ok: true });
}
