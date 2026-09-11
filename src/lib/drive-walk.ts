/**
 * Luật DUYỆT ẢNH trong một thư mục Google Drive — tách riêng, KHÔNG nhập gì để
 * chạy test bằng Node được (cùng quy ước với face-people.ts, photo-ai.ts).
 *
 * Phần "đọc con của một thư mục" được truyền vào từ ngoài, nên dùng chung cho
 * cả hai đường gọi Drive: khoá API (chỉ thấy thư mục công khai) và OAuth của
 * studio (thấy cả thư mục riêng tư).
 */

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface DriveNode {
  id: string;
  name: string;
  mimeType?: string | null;
}

/**
 * Đuôi file được coi là ẢNH kể cả khi Drive trả mimeType rỗng hoặc
 * `application/octet-stream` — rất hay gặp với file RAW của máy ảnh (CR2/CR3,
 * NEF, ARW…). Lọc chỉ theo mimeType thì thư mục toàn RAW trả về 0 file, người
 * dùng bấm "Tải ảnh" mà như không có gì xảy ra.
 */
const PHOTO_EXT_RE =
  /\.(jpe?g|png|webp|gif|heic|heif|tiff?|bmp|avif|cr2|cr3|nef|nrw|arw|sr2|srf|raf|rw2|orf|dng|pef|srw|raw|3fr|fff|iiq|rwl|mrw|mef|mos|erf|kdc|dcr|x3f|mp4|mov|m4v|avi|mkv)$/i;

/** File này có phải ảnh/video (theo mimeType HOẶC theo đuôi tên) không? */
export function isPhotoFile(f: { name?: string | null; mimeType?: string | null }): boolean {
  const mt = f.mimeType ?? "";
  if (mt === FOLDER_MIME) return false;
  if (mt.startsWith("image/") || mt.startsWith("video/")) return true;
  return PHOTO_EXT_RE.test(f.name ?? "");
}

export interface PhotoWalk<T extends DriveNode = DriveNode> {
  files: T[];
  /** Số thư mục con gặp được — để nói rõ cho người dùng đã quét những gì. */
  subfolders: number;
  /** Đã chạm trần maxFiles → danh sách bị cắt bớt. */
  truncated: boolean;
}

export interface WalkOptions {
  /** Quét cả thư mục con (ảnh buổi chụp hay xếp theo JPG / RAW / ngày). */
  recursive?: boolean;
  /** Số tầng tối đa tính cả thư mục gốc (mặc định 4). */
  maxDepth?: number;
  /** Trần số ảnh, chống thư mục khổng lồ treo máy chủ (mặc định 20.000). */
  maxFiles?: number;
}

/**
 * Duyệt ảnh trong một thư mục Drive theo chiều rộng, tuỳ chọn chui vào cả thư
 * mục con. Thư mục cha chỉ chứa thư mục con là chuyện thường của studio, nên
 * quét một tầng là ra danh sách rỗng.
 */
export async function walkPhotos<T extends DriveNode>(
  rootId: string,
  listChildren: (id: string) => Promise<T[]>,
  opts: WalkOptions = {}
): Promise<PhotoWalk<T>> {
  const maxDepth = opts.recursive ? Math.max(1, opts.maxDepth ?? 4) : 1;
  const maxFiles = opts.maxFiles ?? 20000;
  const files: T[] = [];
  const seen = new Set<string>();
  const visited = new Set<string>([rootId]);
  let subfolders = 0;
  let truncated = false;
  let level = [rootId];

  for (let depth = 0; depth < maxDepth && level.length > 0 && !truncated; depth++) {
    const next: string[] = [];
    for (const id of level) {
      for (const c of await listChildren(id)) {
        if (c.mimeType === FOLDER_MIME) {
          subfolders++;
          // Drive cho phép một thư mục nằm trong nhiều thư mục cha → chặn lặp.
          if (!visited.has(c.id)) {
            visited.add(c.id);
            next.push(c.id);
          }
          continue;
        }
        if (!isPhotoFile(c) || seen.has(c.id)) continue;
        seen.add(c.id);
        files.push(c);
        if (files.length >= maxFiles) {
          truncated = true;
          break;
        }
      }
      if (truncated) break;
    }
    level = next;
  }

  return { files, subfolders, truncated };
}
