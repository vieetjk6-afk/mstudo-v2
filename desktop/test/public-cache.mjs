/* Kiểm thử lớp NHỚ GIỮA CÁC REQUEST của trang công khai (album khách, website).
 *
 * Vì sao. Nhớ sai còn tệ hơn không nhớ: một lượt đọc lỗi thoáng qua mà bị nhớ
 * thì cả trăm khách mở album thấy album thiếu ảnh suốt mấy phút. Bài này giữ:
 *   · khoá nhớ của album có "phiên bản" (số ảnh + mốc gom khuôn mặt) — thêm /
 *     xoá ảnh, quét xong khuôn mặt là khoá đổi;
 *   · bảng / cột chưa có thì phiên bản là "?" chứ không nổ;
 *   · đọc ảnh lỗi trong hàm được nhớ → NÉM (không nhớ), trang lùi về đọc thẳng;
 *   · mục nhớ gắn đúng thẻ để route máy chủ bỏ nhớ được;
 *   · gói không có tìm khuôn mặt thì không tốn câu nào.
 *
 * Chạy: node --experimental-strip-types desktop/test/public-cache.mjs
 */
import { registerHooks } from "node:module";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `\n    ${note}`}`);
};

/* ── Supabase giả ─────────────────────────────────────────────────────────── */
const state = { photos: [], photoError: null, counts: { a1: 3 }, countsMissing: false, faces: { a1: "2026-11-01T00:00:00Z" }, queries: [] };
function from(table) {
  const st = { table, filters: {}, range: null };
  const q = {
    select() { return q; },
    eq(k, v) { st.filters[k] = v; return q; },
    order() { return q; },
    range(a, b) { st.range = [a, b]; return q; },
    maybeSingle() { st.single = true; return q; },
    then(res, rej) {
      state.queries.push(table);
      let out;
      if (table === "album_photo_counts") {
        out = state.countsMissing
          ? { data: null, error: { code: "PGRST205", message: "Could not find the table" } }
          : { data: { photo_count: state.counts[st.filters.album_id] ?? 0 }, error: null };
      } else if (table === "albums") {
        out = { data: { faces_clustered_at: state.faces[st.filters.id] ?? null }, error: null };
      } else if (table === "photos") {
        if (state.photoError) out = { data: null, error: state.photoError, count: null };
        else {
          const [a, b] = st.range ?? [0, 999];
          out = { data: state.photos.slice(a, b + 1), error: null, count: state.photos.length };
        }
      } else out = { data: [], error: null };
      return Promise.resolve(out).then(res, rej);
    },
  };
  return q;
}
globalThis.__db = { from };

/* ── next/cache giả: ghi lại khoá + thẻ, gọi thẳng hàm ────────────────────── */
const cacheCalls = [];
globalThis.__cacheCalls = cacheCalls;
const STUBS = {
  "server-only": "export {};",
  "next/cache": `
    export const unstable_cache = (fn, keys, opts) => (...a) => { globalThis.__cacheCalls.push({ keys, opts }); return fn(...a); };
    export const revalidateTag = () => {};`,
  "@/lib/supabase/admin": "export const createAdminClient = () => globalThis.__db;",
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier in STUBS) return { url: `data:text/javascript,${encodeURIComponent(STUBS[specifier])}`, shortCircuit: true };
    if (specifier.startsWith("@/")) specifier = new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href;
    return next(specifier, context);
  },
});

const { albumDataVersion, loadAlbumPhotos, loadAlbumPeopleCached, albumCacheTag } = await import("../../src/lib/album-data-cache.ts");
const { fetchAllPhotos } = await import("../../src/lib/photos.ts");

/* 1. Phiên bản */
ok("phiên bản = số ảnh | mốc gom khuôn mặt", (await albumDataVersion("a1")) === "3|2026-11-01T00:00:00Z");
state.counts.a1 = 4;
ok("thêm ảnh → phiên bản đổi (khoá nhớ cũ bị bỏ qua)", (await albumDataVersion("a1")) === "4|2026-11-01T00:00:00Z");
state.countsMissing = true;
ok("chưa có bảng đếm → phần số ảnh là '?', không nổ", (await albumDataVersion("a1")).startsWith("?|"));
state.countsMissing = false;

/* 2. Ảnh: nhớ đúng khoá / thẻ */
state.photos = Array.from({ length: 1500 }, (_, i) => ({ id: `p${i}` }));
cacheCalls.length = 0;
const p1 = await loadAlbumPhotos("a1", "id, drive_file_id", "4|x");
ok("đọc đủ ảnh qua nhiều trang", p1.length === 1500);
const c = cacheCalls[0];
ok("khoá nhớ gồm album + bộ cột + phiên bản", c && c.keys.includes("a1") && c.keys.includes("id, drive_file_id") && c.keys.includes("4|x"));
ok("mục nhớ gắn thẻ của album (route máy chủ bỏ nhớ được)", c?.opts?.tags?.includes(albumCacheTag("a1")) && c?.opts?.revalidate === 300);

/* 3. Đọc lỗi → không nhớ, trang vẫn chạy */
state.photoError = { message: "statement timeout" };
let threw = false;
try { await fetchAllPhotos(globalThis.__db, "a1", "id", { strict: true }); } catch { threw = true; }
ok("fetchAllPhotos strict: trang lỗi thì NÉM (để không bị nhớ)", threw);
ok("fetchAllPhotos thường: vẫn trả về như cũ (không ném)", Array.isArray(await fetchAllPhotos(globalThis.__db, "a1", "id")));
const p2 = await loadAlbumPhotos("a1", "id", "4|x");
ok("loadAlbumPhotos: lỗi trong hàm nhớ → lùi về đọc thẳng, không nổ trang", Array.isArray(p2));
state.photoError = null;

/* 4. Khuôn mặt: gói không có tính năng → không tốn câu nào */
state.queries.length = 0;
const none = await loadAlbumPeopleCached("a1", false, "4|x");
ok("gói không có tìm khuôn mặt → không đọc gì", none.people.length === 0 && state.queries.length === 0);

console.log(fail ? `\n${fail} kiểm tra hỏng` : "\nTất cả kiểm tra đều qua");
process.exit(fail ? 1 : 0);
