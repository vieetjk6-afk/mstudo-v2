/** Nguồn ảnh đã có của album — chỉ những cột cần cho việc tách thư mục con. */
export type ExpandSource = {
  id: string;
  drive_url: string | null;
  kind: string | null;
  stage: string | null;
  position: number;
};

/** Dòng nguồn mới sẽ chèn cho mỗi thư mục con tìm được. */
export type NewSourceRow = {
  album_id: string;
  name: string;
  drive_url: string;
  kind: string;
  stage: string;
  position: number;
};

/** Liệt kê thư mục con trực tiếp của một thư mục Drive. */
export type ListSubFolders = (folderId: string) => Promise<{ id: string; name: string }[]>;

/** Link Drive trỏ tới MỘT FILE lẻ — không bao giờ có thư mục con để tách. */
function isSingleFileLink(url: string): boolean {
  return /\/file\/d\//.test(url);
}

/**
 * Id thư mục để thử tách, hoặc null nếu link chắc chắn là file lẻ.
 *
 * KHÔNG dựa vào cột `kind`: `kind` do isFolderLink() đoán từ dạng URL lúc lưu
 * và chỉ khớp ".../folders/…". Studio dán link chia sẻ dạng khác
 * ("open?id=…", link từ app Drive trên điện thoại) là nguồn bị lưu thành
 * "file" — trong khi nó vẫn là thư mục thật. Trước đây bước tách thư mục con
 * bỏ qua đúng những nguồn này, nên một thư mục CHỈ CHỨA THƯ MỤC CON không ra
 * được ảnh nào mà cũng không đẻ ra tab thư mục con: album trống trơn.
 *
 * Thử liệt kê thư mục con trên một id file lẻ là vô hại — Drive trả về danh
 * sách rỗng vì không có gì nằm "in parents" của một file.
 */
export function folderIdForExpand(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || isSingleFileLink(trimmed)) return null;
  // Cùng luật với extractFolderId() ở src/lib/drive.ts. Viết lại tại chỗ để
  // module này không phụ thuộc gì cả (chạy được ở cả server, trình duyệt và
  // bộ kiểm thử node); album-subfolders.mjs có một phép so KHỚP TỪNG DẠNG LINK
  // với extractFolderId thật để hai bên không lệch nhau về sau.
  const folder = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folder) return folder[1];
  const byId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (byId) return byId[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Dựng danh sách nguồn cần thêm cho MỌI thư mục con (kể cả thư mục con của
 * thư mục con) của các nguồn hiện có.
 *
 * Đi theo TỪNG TẦNG chứ không chỉ một tầng: thư mục giao khách hay có dạng
 * "File ChinhSua / Ngày 1 / Sáng". Bản cũ chỉ tách một tầng mỗi lần đồng bộ,
 * nên studio phải bấm "Lưu & đồng bộ" nhiều lần mới thấy đủ — mà không có gì
 * nói cho họ biết điều đó.
 *
 * Trả thêm `fixKindIds`: nguồn đang lưu `kind` khác "folder" nhưng Drive cho
 * thấy đúng là thư mục — sửa lại để phần còn lại của app hiểu đúng.
 */
export async function planSubFolderSources(
  albumId: string,
  existing: ExpandSource[],
  listSubs: ListSubFolders,
  opts: { maxDepth?: number; maxNew?: number } = {}
): Promise<{ rows: NewSourceRow[]; fixKindIds: string[] }> {
  const maxDepth = opts.maxDepth ?? 3;
  const maxNew = opts.maxNew ?? 200;

  const seenUrls = new Set<string>();
  for (const s of existing) if (s.drive_url) seenUrls.add(s.drive_url);
  // Không quét lại cùng một thư mục hai lần (hai nguồn có thể trỏ chung một chỗ).
  const scanned = new Set<string>();

  let maxPos = Math.max(0, ...existing.map((s) => s.position || 0));
  const rows: NewSourceRow[] = [];
  const fixKindIds: string[] = [];

  // Tầng đầu: các nguồn đang có. Tầng sau: chính những thư mục con vừa tìm ra.
  let level: { folderId: string; stage: string }[] = [];
  for (const src of existing) {
    const folderId = folderIdForExpand(src.drive_url);
    if (!folderId || scanned.has(folderId)) continue;
    scanned.add(folderId);
    level.push({ folderId, stage: src.stage ?? "selection" });
  }
  // Nhớ nguồn nào ứng với thư mục nào để sửa `kind` khi Drive xác nhận là thư mục.
  const srcByFolder = new Map<string, ExpandSource>();
  for (const src of existing) {
    const fid = folderIdForExpand(src.drive_url);
    if (fid && !srcByFolder.has(fid)) srcByFolder.set(fid, src);
  }

  for (let depth = 0; depth < maxDepth && level.length > 0; depth++) {
    const next: { folderId: string; stage: string }[] = [];
    for (const cur of level) {
      let subs: { id: string; name: string }[] = [];
      try {
        subs = await listSubs(cur.folderId);
      } catch {
        subs = [];
      }
      if (subs.length === 0) continue;

      // Có thư mục con ⇒ đây chắc chắn là thư mục, dù `kind` đang lưu là gì.
      const owner = srcByFolder.get(cur.folderId);
      if (owner && owner.kind !== "folder") fixKindIds.push(owner.id);

      for (const sub of subs) {
        if (rows.length >= maxNew) return { rows, fixKindIds };
        const url = `https://drive.google.com/drive/folders/${sub.id}`;
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        maxPos += 1;
        rows.push({
          album_id: albumId,
          name: sub.name,
          drive_url: url,
          kind: "folder",
          stage: cur.stage,
          position: maxPos,
        });
        if (!scanned.has(sub.id)) {
          scanned.add(sub.id);
          next.push({ folderId: sub.id, stage: cur.stage });
        }
      }
    }
    level = next;
  }

  return { rows, fixKindIds };
}
