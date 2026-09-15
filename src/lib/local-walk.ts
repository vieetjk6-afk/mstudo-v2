/**
 * Luật QUÉT ẢNH trong thư mục TRÊN MÁY của công cụ Lọc ảnh — tách riêng, KHÔNG
 * nhập gì để chạy test bằng Node được (cùng quy ước với drive-walk.ts,
 * face-people.ts, photo-ai.ts).
 *
 * Song song với drive-walk.ts: cùng một nhu cầu "chọn thư mục gốc thì phải thấy
 * ảnh trong thư mục con", chỉ khác chỗ đọc — bên kia gọi Drive API, bên này đọc
 * File System Access API của trình duyệt.
 */

/** Đủ phần API của FileSystemHandle mà phần quét cần — để test thay bằng cây giả. */
export interface LocalHandle {
  kind: "file" | "directory";
  name: string;
  values?: () => AsyncIterable<LocalHandle>;
}

export interface LocalPhoto {
  /** Đường dẫn tính từ thư mục gốc — làm khoá, vì tên file có thể trùng nhau. */
  key: string;
  name: string;
  /** Thư mục con chứa file ("" = ngay thư mục gốc). */
  dir: string;
  handle: LocalHandle;
}

export interface LocalWalk {
  files: LocalPhoto[];
  subfolders: number;
  truncated: boolean;
}

/** Trần quét — giữ cho cây thư mục lạ (hoặc khổng lồ) không treo trình duyệt. */
export const MAX_LOCAL_DEPTH = 8;
export const MAX_LOCAL_FILES = 20000;

/**
 * Quét ảnh trong thư mục đã chọn, CHUI VÀO CẢ THƯ MỤC CON — ảnh buổi chụp hay
 * xếp sẵn theo JPG / RAW / ngày nên chọn thư mục gốc mà chỉ quét một tầng thì
 * ra rỗng. Duyệt theo chiều rộng để ảnh ngay thư mục gốc lên trước.
 */
export async function walkLocalDir(
  root: LocalHandle,
  isPhoto: (name: string) => boolean,
  opts: { maxDepth?: number; maxFiles?: number } = {}
): Promise<LocalWalk> {
  const maxDepth = Math.max(1, opts.maxDepth ?? MAX_LOCAL_DEPTH);
  const maxFiles = opts.maxFiles ?? MAX_LOCAL_FILES;
  const files: LocalPhoto[] = [];
  let subfolders = 0;
  let truncated = false;
  let level: { handle: LocalHandle; path: string }[] = [{ handle: root, path: "" }];

  for (let depth = 0; depth < maxDepth && level.length > 0 && !truncated; depth++) {
    const next: { handle: LocalHandle; path: string }[] = [];
    for (const node of level) {
      if (!node.handle.values) continue;
      for await (const entry of node.handle.values()) {
        const rel = node.path ? `${node.path}/${entry.name}` : entry.name;
        if (entry.kind === "directory") {
          subfolders++;
          next.push({ handle: entry, path: rel });
          continue;
        }
        if (!isPhoto(entry.name)) continue;
        files.push({ key: rel, name: entry.name, dir: node.path, handle: entry });
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

/**
 * Tách `webkitRelativePath` ("Buổi chụp/RAW/IMG_001.CR2") thành tên thư mục gốc
 * và thư mục con tính từ đó. Nhánh <input webkitdirectory> dùng cho trình duyệt
 * không có File System Access API.
 */
export function splitWebkitPath(relativePath: string): { root: string; dir: string } {
  const parts = (relativePath || "").split("/").filter(Boolean);
  if (parts.length < 2) return { root: "", dir: "" };
  return { root: parts[0], dir: parts.slice(1, -1).join("/") };
}

/**
 * Cấp thư mục con so với thư mục gốc — dùng để áp CÙNG trần độ sâu cho nhánh
 * <input webkitdirectory> (trình duyệt trả về sẵn cả cây, không hỏi mình).
 */
export function dirDepth(dir: string): number {
  return dir ? dir.split("/").filter(Boolean).length : 0;
}
