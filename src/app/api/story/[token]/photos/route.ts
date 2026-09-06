import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSource } from "@/lib/drive-server";
import { isFolderLink } from "@/lib/drive";
import type { StoryConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Token-gated: list photos from the couple's own Drive folder (the one they set
 * on the story). Returns proxied image URLs so the editor can preview them.
 */
export async function GET(_req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const db = createAdminClient();
  const { data: story } = await db.from("story_pages").select("config").eq("edit_token", params.token).maybeSingle();
  if (!story) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const folder = (story.config as StoryConfig)?.drive_folder?.trim();
  if (!folder) return NextResponse.json({ photos: [] });
  if (!process.env.GOOGLE_API_KEY) return NextResponse.json({ photos: [], error: "no_api_key" });

  try {
    const { files } = await resolveSource(folder, isFolderLink(folder) ? "folder" : "file");
    return NextResponse.json({
      photos: files.map((f) => ({ id: f.id, name: f.name, url: `/api/img?id=${f.id}&w=1080`, thumb: `/api/img?id=${f.id}&w=400` })),
    });
  } catch (e) {
    return NextResponse.json({ photos: [], error: e instanceof Error ? e.message : "drive_error" });
  }
}
