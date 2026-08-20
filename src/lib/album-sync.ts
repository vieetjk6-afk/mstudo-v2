import "server-only";
import { resolveSource, listSubFolders } from "@/lib/drive-server";
import { planSubFolderSources } from "@/lib/album-subfolders";
import { thumbnailUrl } from "@/lib/drive";
import { fetchAllPhotos, chunk } from "@/lib/photos";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Đồng bộ danh sách ảnh của MỘT album từ các thư mục Drive nguồn — phiên bản
 * dùng ở phía server với client BẤT KỲ (thường là admin/service-role, cho luồng
 * MStudo Desktop không có phiên đăng nhập web).
 *
 * Khác với route `/api/albums/[id]/sync` (dựa RLS theo phiên người dùng): hàm
 * này nhận sẵn `client` + `albumId`, KHÔNG tự kiểm tra quyền — caller phải bảo
 * đảm album thuộc đúng chủ sở hữu trước khi gọi.
 */
export async function syncAlbumPhotos(
  client: any,
  albumId: string
): Promise<{ total: number; added: number; errors: string[] }> {
  const errors: string[] = [];
  if (!process.env.GOOGLE_API_KEY) {
    return { total: 0, added: 0, errors: ["GOOGLE_API_KEY missing"] };
  }

  const { data: album } = await client.from("albums").select("cover_url").eq("id", albumId).maybeSingle();

  // Tách THƯ MỤC CON thành nguồn riêng — cùng luật với route đồng bộ của web
  // (src/lib/album-subfolders.ts). Thiếu bước này thì một thư mục chỉ chứa thư
  // mục con đồng bộ từ MStudo Desktop sẽ ra album trống trơn.
  {
    const { data: existing } = await client
      .from("album_sources")
      .select("*")
      .eq("album_id", albumId)
      .order("position");
    const { rows, fixKindIds } = await planSubFolderSources(albumId, (existing ?? []) as any[], listSubFolders);
    if (fixKindIds.length > 0) {
      await client.from("album_sources").update({ kind: "folder" }).in("id", fixKindIds);
    }
    if (rows.length > 0) {
      const { error: insErr } = await client.from("album_sources").insert(rows);
      if (insErr) errors.push(`Không tạo được tab thư mục con: ${insErr.message}`);
    }
  }

  const { data: sources, error: srcErr } = await client
    .from("album_sources")
    .select("*")
    .eq("album_id", albumId)
    .order("position");
  if (srcErr) return { total: 0, added: 0, errors: [srcErr.message] };

  // Ảnh hiện có (qua mốc 1000 dòng), gom theo source để xóa ảnh không còn trên Drive.
  const existing = await fetchAllPhotos(client, albumId, "id, drive_file_id, source_id");
  const bySource = new Map<string, Map<string, string>>();
  for (const p of existing) {
    const sid = (p.source_id as string) ?? "none";
    if (!bySource.has(sid)) bySource.set(sid, new Map());
    bySource.get(sid)!.set(p.drive_file_id, p.id);
  }

  let total = 0;
  let added = 0;

  for (const source of (sources ?? []) as any[]) {
    let files: { id: string; name: string; mimeType?: string }[];
    let folderName: string | null = null;
    try {
      const resolved = await resolveSource(source.drive_url, source.kind);
      files = resolved.files;
      folderName = resolved.folderName;
    } catch (e) {
      errors.push(`${source.name}: ${e instanceof Error ? e.message : "unknown"}`);
      continue;
    }

    if (folderName && /^(Folder|Nhóm|Untitled|File)\b/i.test(source.name)) {
      await client.from("album_sources").update({ name: folderName }).eq("id", source.id);
    }

    const fileIds = new Set(files.map((f) => f.id));
    total += files.length;

    const prev = bySource.get(source.id);
    if (prev) {
      const stale: string[] = [];
      for (const [driveId, id] of prev) if (!fileIds.has(driveId)) stale.push(id);
      for (const ids of chunk(stale, 200)) await client.from("photos").delete().in("id", ids);
    }

    const rows = files.map((f, i) => ({
      album_id: albumId,
      source_id: source.id,
      drive_file_id: f.id,
      name: f.name,
      position: source.position * 100000 + i,
      is_video: (f.mimeType ?? "").startsWith("video/"),
    }));
    for (const part of chunk(rows, 500)) {
      const { error: upErr, count } = await client
        .from("photos")
        .upsert(part, { onConflict: "album_id,drive_file_id", count: "exact" });
      if (upErr) errors.push(`${source.name}: ${upErr.message}`);
      else added += count ?? 0;
    }
  }

  // Đặt ảnh bìa = ảnh đầu nếu chưa có / bìa cũ đã biến mất.
  const all = await fetchAllPhotos(client, albumId, "drive_file_id");
  if (all.length > 0) {
    const ids = new Set(all.map((p) => p.drive_file_id));
    const coverId = album?.cover_url?.match(/id=([a-zA-Z0-9_-]+)/)?.[1];
    if (!album?.cover_url || (coverId && !ids.has(coverId))) {
      await client.from("albums").update({ cover_url: thumbnailUrl(all[0].drive_file_id, 800) }).eq("id", albumId);
    }
  }

  return { total, added, errors };
}
