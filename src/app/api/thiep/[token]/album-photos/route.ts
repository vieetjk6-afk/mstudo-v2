import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";

/**
 * Token-gated: list the photos from the client's own album (the delivery
 * gallery, falling back to the selection album) linked to this invitation's
 * contract — so the couple can pull their wedding photos into the invitation
 * without re-uploading. Returns proxied image URLs (/api/img).
 */
export async function GET(_req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const db = createAdminClient();
  const { data: inv } = await db
    .from("wedding_invitations")
    .select("id, contract_id")
    .eq("edit_token", params.token)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!inv.contract_id) return NextResponse.json({ photos: [] });

  const { data: contract } = await db
    .from("studio_contracts")
    .select("gallery_album_id, selection_album_id")
    .eq("id", inv.contract_id)
    .maybeSingle();
  const albumId = contract?.gallery_album_id || contract?.selection_album_id;
  if (!albumId) return NextResponse.json({ photos: [] });

  const rows = await fetchAllPhotos(db, albumId, "drive_file_id, name, position");
  const photos = rows.map((p: { drive_file_id: string; name: string }) => ({
    id: p.drive_file_id,
    name: p.name,
    url: `/api/img?id=${p.drive_file_id}&w=1600`,
    thumb: `/api/img?id=${p.drive_file_id}&w=400`,
  }));
  return NextResponse.json({ photos });
}
