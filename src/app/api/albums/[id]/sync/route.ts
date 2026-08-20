import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSource, listSubFolders } from "@/lib/drive-server";
import { thumbnailUrl } from "@/lib/drive";
import { planSubFolderSources } from "@/lib/album-subfolders";
import { fetchAllPhotos, chunk } from "@/lib/photos";
import type { AlbumSource } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Re-resolve every Drive source of an album and update the photo list.
 * RLS ensures only the album owner / admin can run this.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const albumId = params.id;

  // Surface the most common misconfiguration explicitly.
  if (!process.env.GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_API_KEY chưa được cấu hình trên server (Vercel).", total: 0, added: 0, errors: ["GOOGLE_API_KEY missing"] },
      { status: 200 }
    );
  }

  const errors: string[] = [];

  const { data: album } = await supabase
    .from("albums")
    .select("cover_url")
    .eq("id", albumId)
    .maybeSingle();

  // ── Auto-expand: mỗi THƯ MỤC CON thành một nguồn (tab) riêng, để studio chỉ
  // phải dán một link cha. Luật tách nằm ở src/lib/album-subfolders.ts (có
  // kiểm thử riêng) — gồm cả thư mục con của thư mục con, và cả những link
  // thư mục bị lưu nhầm `kind: "file"`. ────────────────────────────────────
  {
    const { data: existing } = await supabase
      .from("album_sources")
      .select("*")
      .eq("album_id", albumId)
      .order("position");

    const { rows: newRows, fixKindIds } = await planSubFolderSources(
      albumId,
      (existing ?? []) as AlbumSource[],
      listSubFolders
    );

    // Link thư mục bị lưu nhầm là "file" → sửa lại, nếu không mọi lần đồng bộ
    // sau vẫn coi nó là file lẻ.
    if (fixKindIds.length > 0) {
      await supabase.from("album_sources").update({ kind: "folder" }).in("id", fixKindIds);
    }
    if (newRows.length > 0) {
      // KHÔNG nuốt lỗi: chèn hỏng (thiếu cột stage, RLS…) mà im lặng thì studio
      // chỉ thấy album trống trơn và không có cách nào đoán ra vì sao.
      const { error: insErr } = await supabase.from("album_sources").insert(newRows);
      if (insErr) errors.push(`Không tạo được tab thư mục con: ${insErr.message}`);
    }
  }

  const { data: sources, error: srcErr } = await supabase
    .from("album_sources")
    .select("*")
    .eq("album_id", albumId)
    .order("position");

  if (srcErr) {
    return NextResponse.json({ error: srcErr.message }, { status: 403 });
  }

  let total = 0;
  let added = 0;

  // Existing photos (all of them, past the 1000-row cap), grouped per source.
  const existingPhotos = await fetchAllPhotos(supabase, albumId, "id, drive_file_id, source_id");
  const existingBySource = new Map<string, Map<string, string>>();
  for (const p of existingPhotos) {
    const sid = (p.source_id as string) ?? "none";
    if (!existingBySource.has(sid)) existingBySource.set(sid, new Map());
    existingBySource.get(sid)!.set(p.drive_file_id, p.id);
  }

  for (const source of (sources ?? []) as AlbumSource[]) {
    let files;
    let folderName: string | null = null;
    try {
      const resolved = await resolveSource(source.drive_url, source.kind);
      files = resolved.files;
      folderName = resolved.folderName;
    } catch (e) {
      errors.push(
        `${source.name}: ${e instanceof Error ? e.message : "unknown error"}`
      );
      continue;
    }

    // Name the source after the Drive folder (unless renamed to something custom).
    if (folderName && /^(Folder|Nhóm|Untitled|File)\b/i.test(source.name)) {
      await supabase.from("album_sources").update({ name: folderName }).eq("id", source.id);
    }

    const fileIdSet = new Set(files.map((f) => f.id));
    total += files.length;

    // Remove photos from this source that are no longer on Drive (delete by id,
    // chunked — avoids a giant URL when an album has thousands of photos).
    const prev = existingBySource.get(source.id);
    if (prev) {
      const stale: string[] = [];
      for (const [driveId, id] of prev) if (!fileIdSet.has(driveId)) stale.push(id);
      for (const ids of chunk(stale, 200)) {
        await supabase.from("photos").delete().in("id", ids);
      }
    }

    // Upsert current files in chunks (handles thousands per source).
    const rows = files.map((f, i) => ({
      album_id: albumId,
      source_id: source.id,
      drive_file_id: f.id,
      name: f.name,
      position: source.position * 100000 + i,
      is_video: (f.mimeType ?? "").startsWith("video/"),
    }));
    for (const part of chunk(rows, 500)) {
      const { error: upErr, count } = await supabase
        .from("photos")
        .upsert(part, { onConflict: "album_id,drive_file_id", count: "exact" });
      if (upErr) errors.push(`${source.name}: ${upErr.message}`);
      else added += count ?? 0;
    }
  }

  // Set the album cover to the first photo if there's no cover yet, or if the
  // current cover points to a file that is no longer in the album.
  const allPhotos = await fetchAllPhotos(supabase, albumId, "drive_file_id");

  if (allPhotos && allPhotos.length > 0) {
    const ids = new Set(allPhotos.map((p) => p.drive_file_id));
    const coverId = album?.cover_url?.match(/id=([a-zA-Z0-9_-]+)/)?.[1];
    const coverValid = coverId ? ids.has(coverId) : false;
    if (!album?.cover_url || !coverValid) {
      await supabase
        .from("albums")
        .update({ cover_url: thumbnailUrl(allPhotos[0].drive_file_id, 800) })
        .eq("id", albumId);
    }
  }

  return NextResponse.json({ total, added, errors });
}
