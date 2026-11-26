/* Storage giả cho các bài kiểm thử dùng kho khuôn mặt (src/lib/face-kho-server.ts).
 * Chỉ đủ các hàm kho dùng: upload / list / download / remove. `hong: true` mô
 * phỏng bucket chưa có (mọi lượt ghi đều lỗi). */
import { giaiMaManh, gopManh } from "../../src/lib/face-kho.ts";

export function khoGia({ hong = false } = {}) {
  const files = new Map();
  const bucket = {
    async upload(path, bytes) {
      if (hong) return { error: { message: "bucket not found" } };
      if (files.has(path)) return { error: { message: "exists" } };
      files.set(path, bytes.slice());
      return { error: null };
    },
    async list(prefix, { limit = 1000, offset = 0 } = {}) {
      const rows = [...files.keys()].filter((k) => k.startsWith(prefix + "/")).sort().map((k) => ({ name: k.slice(prefix.length + 1), metadata: { size: files.get(k).length } }));
      return { data: rows.slice(offset, offset + limit), error: null };
    },
    async download(path) {
      const b = files.get(path);
      return b ? { data: new Blob([b]), error: null } : { data: null, error: { message: "not found" } };
    },
    async remove(paths) {
      for (const p of paths) files.delete(p);
      return { error: null };
    },
  };
  /** Bản gộp kho của album (đọc thẳng file, không qua bộ đệm). */
  const kho = (albumId) => gopManh([...files.keys()].filter((k) => k.startsWith(albumId + "/")).sort().map((k) => giaiMaManh(files.get(k))));
  return { storage: { from: () => bucket }, files, kho };
}
