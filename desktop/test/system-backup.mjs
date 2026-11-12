/* Kiểm thử SAO LƯU TOÀN HỆ THỐNG (src/lib/admin/backup-tables.ts + system-backup.ts).
 *
 * Vì sao. Danh sách bảng sao lưu đứng yên ở 52 bảng trong khi hệ thống lớn lên
 * thành 104 — lịch hẹn, phụ lục, voucher, chi nhánh, chấm công, sao kê ngân
 * hàng… KHÔNG nằm trong file sao lưu, và không ai biết cho tới ngày cần khôi
 * phục. Bài này đọc thẳng supabase/setup-all.sql và đỏ khi:
 *   · có bảng chưa được xếp vào BACKUP_TABLES hoặc BACKUP_EXCLUDED;
 *   · bảng con đứng trước bảng cha (khôi phục sẽ vấp khoá ngoại);
 *   · cột sinh tự động / bảng identity chưa được gạt khi khôi phục;
 *   · có cột trông như bí mật (token, secret, session…) mà chưa ai quyết định
 *     giữ hay gạt khỏi file sao lưu.
 * Phần sau chạy CHÍNH bộ xuất (stream + gzip) trên một Supabase giả trong bộ nhớ.
 *
 * Chạy: node --experimental-strip-types desktop/test/system-backup.mjs
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { registerHooks } from "node:module";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `\n    ${note}`}`);
};

/* ── Đọc lược đồ từ setup-all.sql ───────────────────────────────────────── */
const sql = readFileSync(new URL("../../supabase/setup-all.sql", import.meta.url), "utf8").replace(/--[^\n]*/g, "");
const tables = {};
const T = (n) => (tables[n] ??= { cols: new Set(), pk: null, refs: new Set(), generated: new Set(), identityAlways: false });
const reCreate = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?\s*\(/gi;
for (let m; (m = reCreate.exec(sql)); ) {
  const t = T(m[1].toLowerCase());
  let i = reCreate.lastIndex, d = 1;
  while (d > 0 && i < sql.length) { if (sql[i] === "(") d++; else if (sql[i] === ")") d--; i++; }
  const body = sql.slice(reCreate.lastIndex, i - 1);
  const parts = []; let cur = "", dd = 0;
  for (const ch of body) { if (ch === "(") dd++; if (ch === ")") dd--; if (ch === "," && dd === 0) { parts.push(cur); cur = ""; } else cur += ch; }
  parts.push(cur);
  for (let p of parts) {
    p = p.trim();
    const pk = p.match(/^(?:constraint\s+\S+\s+)?primary\s+key\s*\(([^)]+)\)/i);
    if (pk) { t.pk = pk[1].replace(/\s/g, ""); continue; }
    const col = p.match(/^"?([a-z_0-9]+)"?\s+\S+/i);
    if (col && !/^(constraint|unique|check|foreign|exclude)$/i.test(col[1])) {
      t.cols.add(col[1]);
      if (/primary\s+key/i.test(p)) t.pk = col[1];
      if (/generated\s+always\s+as\s+identity/i.test(p)) t.identityAlways = true;
      else if (/generated\s+always\s+as\s*\(/i.test(p)) t.generated.add(col[1]);
    }
    for (const r of p.matchAll(/references\s+(?:public\.)?"?([a-z_0-9]+)"?/gi)) t.refs.add(r[1].toLowerCase());
  }
}
const reAlter = /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?([a-z_0-9]+)"?([^;]*);/gi;
for (let m; (m = reAlter.exec(sql)); ) {
  const name = m[1].toLowerCase();
  if (!tables[name]) continue;
  for (const r of m[2].matchAll(/references\s+(?:public\.)?"?([a-z_0-9]+)"?/gi)) tables[name].refs.add(r[1].toLowerCase());
  for (const c of m[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_0-9]+)"?\s+[^,]*?(generated\s+always\s+as\s*\()?/gi)) {
    tables[name].cols.add(c[1]);
  }
  for (const g of m[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_0-9]+)"?\s+\w+\s+generated\s+always\s+as\s*\(/gi)) {
    tables[name].generated.add(g[1]);
  }
}

const {
  BACKUP_TABLES, BACKUP_EXCLUDED, BACKUP_OMIT_COLUMNS, RESTORE_SKIP_TABLES, GENERATED_COLUMNS,
  orderKeysFor, rowForBackup, rowForRestore, chunkRows, isRestorableTable, backupFileName,
} = await import("../../src/lib/admin/backup-tables.ts");

/* ── 1. Mọi bảng đều đã được xếp chỗ ──────────────────────────────────── */
const all = Object.keys(tables);
const inBackup = new Set(BACKUP_TABLES);
const unplaced = all.filter((t) => !inBackup.has(t) && !(t in BACKUP_EXCLUDED));
ok(`mọi bảng trong setup-all.sql (${all.length}) đều nằm trong BACKUP_TABLES hoặc BACKUP_EXCLUDED`, unplaced.length === 0,
  `chưa xếp: ${unplaced.join(", ")} — thêm vào BACKUP_TABLES (đúng thứ tự khoá ngoại) hoặc BACKUP_EXCLUDED kèm lý do`);
const both = BACKUP_TABLES.filter((t) => t in BACKUP_EXCLUDED);
ok("không bảng nào vừa sao lưu vừa bị loại", both.length === 0, both.join(", "));
const ghost = BACKUP_TABLES.filter((t) => !tables[t]);
ok("BACKUP_TABLES không có bảng ma (không tồn tại trong setup-all.sql)", ghost.length === 0, ghost.join(", "));
ok("BACKUP_TABLES không trùng lặp", new Set(BACKUP_TABLES).size === BACKUP_TABLES.length);

/* ── 2. Bảng cha trước bảng con ───────────────────────────────────────── */
const pos = new Map(BACKUP_TABLES.map((t, i) => [t, i]));
const CYCLE_OK = new Set(["profiles>studio_branches"]); // profiles.branch_id ↔ studio_branches.owner_id
const wrong = [];
for (const t of BACKUP_TABLES) {
  for (const r of tables[t]?.refs ?? []) {
    if (r === t || !pos.has(r) || CYCLE_OK.has(`${t}>${r}`)) continue;
    if (pos.get(r) > pos.get(t)) wrong.push(`${t} → ${r}`);
  }
}
ok("bảng được tham chiếu luôn đứng trước (khôi phục không vấp khoá ngoại)", wrong.length === 0, wrong.join("; "));

/* ── 3. Khoá phân trang đúng là cột có thật, và là khoá chính ─────────── */
const badKeys = [];
for (const t of BACKUP_TABLES) {
  const keys = orderKeysFor(t);
  const pk = tables[t]?.pk?.split(",") ?? ["id"];
  if (keys.join(",") !== pk.join(",")) badKeys.push(`${t}: dùng (${keys}) nhưng khoá chính là (${pk})`);
}
ok("khoá phân trang = khoá chính của từng bảng", badKeys.length === 0, badKeys.join("; "));

/* ── 4. Cột sinh tự động / bảng identity được gạt khi khôi phục ───────── */
const genMissing = [];
for (const t of BACKUP_TABLES) {
  for (const c of tables[t]?.generated ?? []) if (!(GENERATED_COLUMNS[t] ?? []).includes(c)) genMissing.push(`${t}.${c}`);
}
ok("mọi cột `generated always as (…) stored` đều nằm trong GENERATED_COLUMNS", genMissing.length === 0, genMissing.join(", "));
const idMissing = BACKUP_TABLES.filter((t) => tables[t]?.identityAlways && !RESTORE_SKIP_TABLES.has(t));
ok("bảng `generated always as identity` không được khôi phục (Postgres cấm ghi id)", idMissing.length === 0, idMissing.join(", "));

/* ── 5. Cột trông như bí mật phải có quyết định ───────────────────────── */
// Token "đường dẫn" phải GIỮ — khách đang cầm link hợp đồng / báo giá / thiệp,
// mất token là link chết sau khi khôi phục. Hash thì giữ được (không dùng ngược được).
const KEEP = new Set([
  "profiles.booking_token", "profiles.calendar_token", "profiles.crew_token",
  "albums.password_hash", "album_shares.token", "studio_contracts.client_token", "studio_contracts.intake_token",
  "studio_bookings.deposit_token", "studio_quotes.client_token", "wedding_invitations.edit_token",
  "story_pages.edit_token", "desktop_devices.token_hash", "crew_account.calendar_token", "studio_vouchers.public_token",
  "studio_pricelist.list_key", "studio_crew_roles.key", "studio_automation_log.dedupe_key",
]);
const undecided = [];
for (const t of BACKUP_TABLES) {
  for (const c of tables[t]?.cols ?? []) {
    // session_id của khách xem album / total_sessions của gói KHÔNG phải bí mật — chỉ bắt đuôi "_session".
    if (!/token|secret|password|refresh|api_?key|cookie|credential|(^|_)session$|(^|_)key$/i.test(c)) continue;
    const id = `${t}.${c}`;
    if (!KEEP.has(id) && !(BACKUP_OMIT_COLUMNS[t] ?? []).includes(c)) undecided.push(id);
  }
}
ok("mọi cột kiểu token/secret/session đều đã quyết: GIỮ (KEEP) hoặc GẠT (BACKUP_OMIT_COLUMNS)", undecided.length === 0, undecided.join(", "));

/* ── 6. Hàm lọc dòng ───────────────────────────────────────────────────── */
const prof = { id: "u1", full_name: "A", role: "admin", plan: "studio", google_refresh_token: "1//secret", studio_owner_id: "x" };
ok("rowForBackup gạt google_refresh_token", !("google_refresh_token" in rowForBackup("profiles", prof)) && rowForBackup("profiles", prof).role === "admin");
const rp = rowForRestore("profiles", prof);
ok("rowForRestore gạt cột đặc quyền + bí mật của profiles", rp.full_name === "A" && !("role" in rp) && !("plan" in rp) && !("studio_owner_id" in rp) && !("google_refresh_token" in rp));
ok("rowForRestore gạt cột sinh tự động phone_digits", !("phone_digits" in rowForRestore("studio_crew", { id: 1, phone: "0901", phone_digits: "0901" })));
ok("rowForRestore giữ nguyên bảng thường", JSON.stringify(rowForRestore("albums", { id: 1, title: "x" })) === '{"id":1,"title":"x"}');
ok("isRestorableTable: bảng lạ / nhật ký identity → không", !isRestorableTable("auth.users") && !isRestorableTable("studio_audit_log") && isRestorableTable("albums"));
const big = Array.from({ length: 1201 }, (_, i) => ({ i, s: "x".repeat(100) }));
const lots = chunkRows(big, 500, 1_000_000);
ok("chunkRows ≤ 500 dòng / lô, không rơi dòng nào", lots.length === 3 && lots.every((l) => l.length <= 500) && lots.flat().length === 1201);
const fat = chunkRows(Array.from({ length: 10 }, () => ({ s: "y".repeat(400_000) })), 500, 1_000_000);
ok("chunkRows tách theo dung lượng (thân request phải dưới 4,5 MB)", fat.every((l) => JSON.stringify(l).length <= 1_250_000) && fat.flat().length === 10);
ok("tên file theo giờ VN", backupFileName(new Date("2026-11-11T20:15:00Z")) === "mstudo-backup-2026-11-12_03h15.json.gz");

/* ── 7. Chạy THẬT bộ xuất trên Supabase giả ───────────────────────────── */
const PAGE_CAP = 700; // giả lập project đặt max_rows < 1000: bộ xuất KHÔNG được dừng sớm
const fakeDb = {
  profiles: [{ id: "u1", full_name: "Lan", google_refresh_token: "1//secret", role: "admin" }],
  photos: Array.from({ length: 2345 }, (_, i) => ({ id: `p${String(i).padStart(5, "0")}`, album_id: "a1" })),
  site_views: Array.from({ length: 1500 }, (_, i) => ({ site_id: "s1", day: `d${String(i).padStart(4, "0")}`, views: i })),
  studio_drive: [{ owner_id: "u1", refresh_token: "1//drive", root_folder_id: "f" }],
};
const missingTable = "wedding_plans";
const brokenTable = "studio_vouchers";
globalThis.__stubDb = {
  from(table) {
    const st = { order: [], gt: null, limit: null, range: null };
    const q = {
      select() { return q; },
      order(k) { st.order.push(k); return q; },
      gt(k, v) { st.gt = [k, v]; return q; },
      limit(n) { st.limit = n; return q; },
      range(a, b) { st.range = [a, b]; return q; },
      then(res, rej) {
        if (table === missingTable) return Promise.resolve({ data: null, error: { code: "PGRST205", message: "Could not find the table" } }).then(res, rej);
        if (table === brokenTable) return Promise.resolve({ data: null, error: { code: "57014", message: "statement timeout" } }).then(res, rej);
        let rows = [...(fakeDb[table] ?? [])];
        const cmp = (a, b) => { for (const k of st.order) { if (a[k] < b[k]) return -1; if (a[k] > b[k]) return 1; } return 0; };
        rows.sort(cmp);
        if (st.gt) rows = rows.filter((r) => r[st.gt[0]] > st.gt[1]);
        if (st.range) rows = rows.slice(st.range[0], st.range[1] + 1);
        if (st.limit != null) rows = rows.slice(0, st.limit);
        return Promise.resolve({ data: rows.slice(0, PAGE_CAP), error: null }).then(res, rej);
      },
    };
    return q;
  },
};
const uploads = [];
let pruned = null;
globalThis.__stubDrive = {
  configured: true, connected: true, files: [],
  upload: async (buf, name, desc) => { uploads.push({ buf, name, desc }); return { id: "f1", name, size: buf.length, createdTime: new Date().toISOString(), webViewLink: null }; },
  prune: async (keep) => { pruned = keep; return 0; },
};
const notes = [];
globalThis.__stubNotify = (kind, msg) => notes.push(msg);

const STUBS = {
  "server-only": "export {};",
  "@/lib/supabase/admin": "export const createAdminClient = () => globalThis.__stubDb;",
  "@/lib/notify-admin": "export const notifyAdmins = async (k, m) => globalThis.__stubNotify(k, m);",
  "@/lib/mstudo-drive": `
    const d = () => globalThis.__stubDrive;
    export const adminDriveConfigured = () => d().configured;
    export const adminDriveConnected = async () => d().connected;
    export const listAdminDriveBackups = async () => d().files;
    export const uploadAdminDriveBackup = (b, n, s) => d().upload(b, n, s);
    export const pruneAdminDriveBackups = (k) => d().prune(k);`,
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier in STUBS) return { url: `data:text/javascript,${encodeURIComponent(STUBS[specifier])}`, shortCircuit: true };
    if (specifier.startsWith("@/")) specifier = new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href;
    else if (specifier.startsWith("./") && !/\.[cm]?[jt]sx?$/.test(specifier)) specifier = new URL(`${specifier}.ts`, context.parentURL).href;
    return next(specifier, context);
  },
});

const { backupGzipStream, runAutoBackup, reportAutoBackup } = await import("../../src/lib/admin/system-backup.ts");

const { stream, summary } = backupGzipStream("test@mstudo");
const gz = Buffer.from(await new Response(stream).arrayBuffer());
let doc = null;
try { doc = JSON.parse(gunzipSync(gz).toString("utf8")); } catch (e) { ok("file sao lưu là JSON hợp lệ sau khi giải nén", false, String(e)); }
if (doc) {
  ok("file sao lưu là JSON hợp lệ sau khi giải nén", doc.kind === "mstudo-full-backup" && doc.version === 2);
  ok("đọc đủ bảng lớn qua nhiều trang dù API cắt 700 dòng/trang (khoá đơn)", doc.data.photos.length === 2345 && new Set(doc.data.photos.map((r) => r.id)).size === 2345);
  ok("đọc đủ bảng khoá kép (OFFSET có ORDER BY)", doc.data.site_views.length === 1500);
  ok("token bí mật không có trong file", !gunzipSync(gz).toString("utf8").includes("1//secret") && !gunzipSync(gz).toString("utf8").includes("1//drive"));
  ok("cột thường vẫn còn", doc.data.studio_drive[0].root_folder_id === "f" && doc.data.profiles[0].role === "admin");
  ok("bảng chưa có ở DB này → ghi vào missing, không phải lỗi", doc.missing.includes(missingTable) && !(missingTable in doc.errors));
  ok("bảng đọc lỗi → ghi vào errors (không im lặng)", doc.errors[brokenTable] === "statement timeout");
  ok("counts khớp số dòng", doc.counts.photos === 2345 && summary.totalRows === 1 + 2345 + 1500 + 1);
  ok("mọi bảng BACKUP_TABLES đều có khoá trong data", BACKUP_TABLES.every((t) => Array.isArray(doc.data[t])));
}

/* ── 8. Lượt sao lưu tự động ──────────────────────────────────────────── */
globalThis.__stubDrive.files = [{ id: "old", name: "x", size: 1, createdTime: new Date(Date.now() - 3600e3).toISOString(), webViewLink: null }];
const skip = await runAutoBackup({ force: false, by: "cron" });
ok("cron bỏ qua khi đã có bản < 1 ngày tuổi", skip.ok && skip.skipped && uploads.length === 0);
const forced = await runAutoBackup({ force: true, by: "admin" });
ok("bấm tay (force) vẫn chạy, đẩy lên Drive rồi dọn bản cũ", forced.ok && !forced.skipped && uploads.length === 1 && pruned === 14);
ok("mô tả file trên Drive nêu bảng lỗi", uploads[0]?.desc.includes(brokenTable));
await reportAutoBackup(forced);
ok("báo admin khi có bảng đọc lỗi", notes.some((n) => n.includes(brokenTable)));
globalThis.__stubDrive.connected = false;
const off = await runAutoBackup({ force: false, by: "cron" });
await reportAutoBackup(off);
ok("Drive chưa kết nối → báo lỗi rõ ràng, có thông báo admin", !off.ok && notes.some((n) => n.includes("KHÔNG chạy được")));

console.log(fail ? `\n${fail} kiểm tra hỏng` : "\nTất cả kiểm tra đều qua");
process.exit(fail ? 1 : 0);
