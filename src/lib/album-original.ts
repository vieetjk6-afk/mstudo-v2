import type { SupabaseClient } from "@supabase/supabase-js";

type SourceRow = {
  name: string | null;
  drive_url: string | null;
  kind: string | null;
  stage: string | null;
};

export type DriveFolderLink = { name: string; url: string };

/**
 * Chọn link Drive để dựng nút "File gốc (ảnh chọn)".
 *
 * Nguồn ĐÃ gắn stage='selection' thì nhận MỌI link Drive: `kind` chỉ do
 * isFolderLink() phỏng đoán từ dạng URL lúc lưu (chỉ khớp ".../folders/…"), nên
 * studio dán link chia sẻ dạng khác là nguồn thành "file" và nút biến mất dù
 * link vẫn mở đúng thư mục. Nguồn CHƯA gắn giai đoạn (stage == null) thì vẫn đòi
 * kind === "folder", nếu không một album ghép từ nhiều link file lẻ sẽ đẻ ra cả
 * danh sách nút vô nghĩa. Cùng quy tắc với nút "Tải file chỉnh sửa" ở
 * src/app/album/[slug]/page.tsx.
 */
export function pickOriginalLinks(sources: readonly SourceRow[]): DriveFolderLink[] {
  return sources
    .filter((x) => !!x.drive_url && (x.stage === "selection" || x.kind === "folder"))
    .map((x) => ({ name: x.name || "File gốc", url: x.drive_url as string }));
}

/**
 * Link Drive trỏ tới MỘT FILE lẻ. Drive chỉ có đúng một dạng cho việc chia sẻ
 * một file (".../file/d/<id>/..."), nên đây là dấu hiệu chắc chắn; mọi dạng còn
 * lại ("/drive/folders/…", "open?id=…") studio dán vào album đều là thư mục.
 */
function laFileLe(url: string): boolean {
  return /\/file\/d\//.test(url);
}

/**
 * Nguồn là THƯ MỤC Drive — dùng cho nút "Tải ảnh gốc" ở album chọn ảnh của khách.
 *
 * Khác `pickOriginalLinks` ở chỗ loại link file lẻ: `stage` mặc định là
 * 'selection' cho mọi nguồn, nên nếu nhận cả link file thì một album ghép từ 30
 * ảnh lẻ sẽ đẻ ra menu 30 dòng — trong khi lời hứa của nút là "mở thư mục, lưu
 * cả loạt".
 *
 * KHÔNG dựa mỗi vào `kind`: cờ đó do isFolderLink() ĐOÁN từ dạng URL lúc lưu và
 * chỉ khớp ".../folders/…". Studio dán link chia sẻ dạng "open?id=…" — vẫn là
 * thư mục thật — thì nguồn bị ghi là "file" và nút tải biến mất, dù link mở ra
 * đúng thư mục ảnh. Đây chính là lỗi đã từng làm mất nút ở album giao khách
 * (xem desktop/test/album-buttons.mjs). Nên quy tắc là: nhận mọi link TRỪ link
 * file lẻ.
 */
export function pickFolderLinks(sources: readonly SourceRow[]): DriveFolderLink[] {
  return sources
    .filter((x) => !!x.drive_url && (x.kind === "folder" || !laFileLe(x.drive_url)))
    .map((x) => ({ name: x.name || "Thư mục ảnh", url: x.drive_url as string }));
}

/**
 * Link Drive "file gốc" của giai đoạn chọn ảnh (JPG Goc), hiển thị bên trong
 * album giai đoạn hoàn thiện (giao khách) để khách có thể lấy file gốc.
 *
 * Hai trường hợp:
 *  - Dự án hợp nhất (1 album, đổi phase): folder nguồn stage='selection' nằm
 *    ngay trên album hoàn thiện này.
 *  - Đồng bộ Drive (2 album riêng): tìm hợp đồng có gallery_album_id = album này,
 *    rồi lấy folder nguồn giai đoạn chọn ảnh của selection_album_id.
 */
export async function getOriginalFolders(
  admin: SupabaseClient,
  galleryAlbumId: string,
  ownSources: SourceRow[]
): Promise<DriveFolderLink[]> {
  // (A) folder giai đoạn chọn ảnh nằm ngay trên album này.
  const own = pickOriginalLinks(ownSources.filter((x) => x.stage === "selection"));
  if (own.length > 0) return own;

  // (B) album chọn ảnh riêng, liên kết qua hợp đồng.
  const { data: contract } = await admin
    .from("studio_contracts")
    .select("selection_album_id")
    .eq("gallery_album_id", galleryAlbumId)
    .maybeSingle();
  const selectionAlbumId = (contract as { selection_album_id?: string | null } | null)?.selection_album_id;
  if (!selectionAlbumId) return [];

  const { data: selSources } = await admin
    .from("album_sources")
    .select("name, drive_url, kind, stage")
    .eq("album_id", selectionAlbumId)
    .order("position");
  return pickOriginalLinks(
    ((selSources ?? []) as SourceRow[]).filter((x) => x.stage === "selection" || x.stage == null)
  );
}
