import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSource } from "@/lib/drive-server";
import { isFolderLink } from "@/lib/drive";
import type { StoryConfig, StoryPage } from "@/lib/types";
import StoryRenderer, { type StoryPhoto, type StoryWish } from "./StoryRenderer";

export const dynamic = "force-dynamic";

async function load(slug: string): Promise<StoryPage | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("story_pages")
    .select("id, owner_id, contract_id, slug, edit_token, config, published, created_at, updated_at")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (!data || !data.published) return null;
  return data as StoryPage;
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const s = await load(params.slug);
  if (!s) return { title: "Không tìm thấy trang" };
  const c = s.config as StoryConfig;
  const couple = [c.groom_name, c.bride_name].filter(Boolean).join(" ❤ ") || "Love Story";
  return { title: `Love Story · ${couple}`, description: c.tagline || `Câu chuyện của ${couple}.`, openGraph: { images: c.cover_url ? [c.cover_url] : undefined } };
}

export default async function StoryPageView(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const story = await load(params.slug);
  if (!story) notFound();
  const c = story.config as StoryConfig;
  const db = createAdminClient();

  // Media comes from the couple's own Drive folder (read-only).
  let photos: StoryPhoto[] = [];
  const folder = c.drive_folder?.trim();
  if (folder && process.env.GOOGLE_API_KEY) {
    try {
      const { files } = await resolveSource(folder, isFolderLink(folder) ? "folder" : "file");
      photos = files.map((f) => ({ id: f.id, url: `/api/img?id=${f.id}&w=1080`, thumb: `/api/img?id=${f.id}&w=400` }));
    } catch { photos = []; }
  }

  const [{ data: wishRows }, { data: upRows }] = await Promise.all([
    db.from("story_wishes").select("guest_name, wish, created_at").eq("story_id", story.id).order("created_at", { ascending: false }).limit(200),
    db.from("story_uploads").select("drive_file_id, guest_name, is_video, created_at").eq("story_id", story.id).eq("approved", true).order("created_at", { ascending: false }).limit(300),
  ]);

  // Guest-contributed media (written to the couple's own Drive) shown alongside the curated feed.
  const guestPhotos: StoryPhoto[] = (upRows ?? []).map((u) => ({
    id: u.drive_file_id,
    url: `/api/img?id=${u.drive_file_id}&w=1080`,
    thumb: `/api/img?id=${u.drive_file_id}&w=400`,
    isVideo: !!u.is_video,
    guestName: u.guest_name || undefined,
  }));

  return (
    <StoryRenderer
      story={story}
      photos={photos}
      guestPhotos={guestPhotos}
      wishes={(wishRows ?? []) as StoryWish[]}
      guestUploadEnabled={c.guest_upload === true}
    />
  );
}
