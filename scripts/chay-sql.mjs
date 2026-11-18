#!/usr/bin/env node
/**
 * Tự chạy `supabase/cap-nhat.sql` lên database THẬT lúc deploy.
 *
 * Vì sao cần. Mỗi tính năng mới đi kèm SQL mà trước đây phải có người mở
 * Supabase → SQL Editor rồi dán `cap-nhat.sql` bằng tay. Quên bước đó là hỏng âm
 * thầm: code mới chạy trên database cũ, tính năng mất một nửa mà không dòng lỗi
 * nào nói vì sao — nên khắp repo mới phải có các đường lùi "database chưa có cột
 * này". Script này làm ĐÚNG việc dán tay ấy, tự động, trước khi bản mới lên.
 *
 * Nó cố ý KHÔNG sáng tạo gì thêm:
 *   · Chạy đúng MỘT file `cap-nhat.sql` — gói do supabase/build-setup-all.mjs
 *     sinh, đã xếp đúng thứ tự (bảng → vá → quyền) và được kiểm thử chạy thật +
 *     chạy LẠI trên Postgres (npm run test:sql-chay-that). Không chạy lẻ từng
 *     migration: file trước mà chạy lại không kèm các file siết quyền đứng sau
 *     là nới lỏng policy.
 *   · Trong MỘT transaction (như SQL Editor): hỏng một câu là rollback hết,
 *     database y nguyên, và bước deploy dừng — bản cũ vẫn chạy trên database cũ.
 *   · Chỉ chạy khi NỘI DUNG file đổi so với lần chạy thành công gần nhất (so
 *     sha256, ghi ở bảng system_runs) — deploy không có SQL mới thì không đụng
 *     database.
 *
 * Dùng:
 *   SUPABASE_DB_URL=postgresql://… node scripts/chay-sql.mjs            # chạy
 *   SUPABASE_DB_URL=…            node scripts/chay-sql.mjs --kiem-tra   # chỉ xem có gì mới
 *   node scripts/chay-sql.mjs --file duong/dan/cap-nhat.sql             # file khác (kiểm thử)
 *
 * SUPABASE_DB_URL: chuỗi kết nối Postgres của project (Supabase → Connect →
 * "Session pooler", cổng 5432 — máy chạy GitHub Actions không có IPv6 nên
 * KHÔNG dùng được "Direct connection"). Thiếu biến này thì script báo bỏ qua và
 * thoát 0. Xem docs/trien-khai-tu-dong.md.
 *
 * Cần `psql` trên máy (máy chạy GitHub Actions có sẵn).
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tachUrl } from "./pg-url.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const chiKiemTra = args.includes("--kiem-tra");
const iFile = args.indexOf("--file");
const FILE = iFile >= 0 && args[iFile + 1] ? args[iFile + 1] : join(ROOT, "supabase", "cap-nhat.sql");
const NAME = basename(FILE).replace(/[^a-zA-Z0-9._-]/g, "_");

/** Chờ khoá tối đa bấy lâu rồi bỏ cuộc — thà hỏng lượt deploy còn hơn treo cả hệ thống sau một câu ALTER. */
const LOCK_TIMEOUT = "10s";
/** Tính cho TỪNG câu trong file. */
const STATEMENT_TIMEOUT = "5min";

const noi = (s) => console.log(s);
function tomTat(md) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
    } catch {
      /* không ghi được tóm tắt thì thôi */
    }
  }
}

const RAW = (process.env.SUPABASE_DB_URL || "").trim();
if (!RAW) {
  noi("⏭  Chưa có SUPABASE_DB_URL — bỏ qua bước tự chạy SQL (xem docs/trien-khai-tu-dong.md).");
  tomTat("### SQL tự chạy\n- Bỏ qua: chưa khai secret `SUPABASE_DB_URL`.");
  process.exit(0);
}

const ket = tachUrl(RAW);
if (!ket) {
  console.error(
    "✗ SUPABASE_DB_URL không đúng dạng postgresql://USER:MAT_KHAU@MAY_CHU:CONG/postgres.\n" +
      "  Chép lại ở Supabase → Connect → Session pooler và thay [YOUR-PASSWORD] bằng mật khẩu database.",
  );
  process.exit(1);
}
const env = {
  ...process.env,
  PGHOST: ket.host,
  PGPORT: ket.port,
  PGUSER: ket.user,
  PGDATABASE: ket.database,
  PGPASSWORD: ket.password,
  PGCONNECT_TIMEOUT: "20",
  PGAPPNAME: "mstudo-chay-sql",
  PGCLIENTENCODING: "UTF8",
  ...(ket.sslmode ? { PGSSLMODE: ket.sslmode } : {}),
};
/** Xoá mật khẩu khỏi mọi thứ sắp in ra (psql có thể nhắc lại chuỗi kết nối trong câu lỗi). */
const che = (s) => (ket.password ? String(s).split(ket.password).join("***") : String(s));

function psql(extra, { timeoutMs = 60_000 } = {}) {
  const r = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", ...extra], {
    env,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error && r.error.code === "ENOENT") {
    console.error("✗ Không tìm thấy lệnh `psql` trên máy này.");
    process.exit(1);
  }
  return { ok: r.status === 0, out: che(r.stdout || ""), err: che(r.stderr || "") + (r.error ? `\n${che(r.error.message)}` : "") };
}
const hoi = (sql) => psql(["-tA", "-c", sql]);

if (!existsSync(FILE)) {
  console.error(`✗ Không thấy file SQL: ${FILE}`);
  process.exit(1);
}
const noiDung = readFileSync(FILE);
const sha = createHash("sha256").update(noiDung).digest("hex");
const gitSha = (process.env.GITHUB_SHA || "").replace(/[^0-9a-f]/gi, "").slice(0, 40);

/* ── 1. Lần chạy thành công gần nhất là bản nào ───────────────────────────── */
const coBang = hoi("select (to_regclass('public.system_runs') is not null)::text");
if (!coBang.ok) {
  console.error(`✗ Không kết nối được database:\n${coBang.err.trim().split("\n").slice(-4).join("\n")}`);
  tomTat("### SQL tự chạy\n- ❌ Không kết nối được database (kiểm tra secret `SUPABASE_DB_URL`).");
  process.exit(1);
}
const bangSan = coBang.out.trim() === "true";
let shaCu = "";
if (bangSan) {
  const r = hoi(
    `select coalesce((select detail->>'sha256' from public.system_runs where kind = 'sql' and name = '${NAME}' and ok order by started_at desc, id desc limit 1), '')`,
  );
  if (r.ok) shaCu = r.out.trim();
}

if (shaCu === sha) {
  noi(`✓ ${NAME}: không có SQL mới (bản ${sha.slice(0, 12)} đã chạy).`);
  tomTat(`### SQL tự chạy\n- Không có SQL mới (\`${NAME}\` bản \`${sha.slice(0, 12)}\` đã chạy).`);
  process.exit(0);
}
if (chiKiemTra) {
  noi(`• ${NAME}: CÓ SQL mới cần chạy (bản ${sha.slice(0, 12)}; đã chạy: ${shaCu ? shaCu.slice(0, 12) : "chưa lần nào"}).`);
  process.exit(0);
}

/* ── 2. Chạy cả file trong MỘT transaction, gửi đi trong MỘT lượt ─────────────
   psql -f gửi TỪNG câu một và chờ trả lời: ~800 câu × ~0,2 giây đường truyền
   (máy GitHub ở Mỹ ↔ database ở Singapore) là vài phút, mà suốt thời gian ấy các
   bảng đã bị ALTER / đổi policy vẫn bị khoá độc quyền — tức là cả hệ thống đứng
   hình. Nên cả file (kèm begin … ghi dấu … commit) được gửi như MỘT câu lệnh
   nhiều phần — đúng cách SQL Editor của Supabase làm: máy chủ tự chạy hết trong
   một hai giây, khoá chỉ giữ chừng ấy. Mẹo: `select $the$…$the$ \gexec` — psql
   gửi nguyên văn nội dung ô kết quả thành một lệnh. Phần mở đầu nằm CÙNG DÒNG
   đầu tiên nên "LINE n" trong câu lỗi trùng số dòng của file. */
const vanBan = noiDung.toString("utf8");
let the = "";
do {
  the = `$mstudo_${randomBytes(6).toString("hex")}$`;
} while (vanBan.includes(the));
const moDau = `begin; set local lock_timeout = '${LOCK_TIMEOUT}'; set local statement_timeout = '${STATEMENT_TIMEOUT}'; set local client_min_messages = warning; `;
const ghiDau = `
;
do $ghi_dau_chay_sql$
begin
  if to_regclass('public.system_runs') is not null then
    insert into public.system_runs (kind, name, ok, detail, duration_ms)
    values ('sql', '${NAME}', true,
            jsonb_build_object('sha256', '${sha}', 'git_sha', '${gitSha}'),
            (extract(epoch from clock_timestamp() - transaction_timestamp()) * 1000)::int);
  end if;
end $ghi_dau_chay_sql$;
commit;`;
const tam = mkdtempSync(join(tmpdir(), "mstudo-sql-"));
const goi = join(tam, "goi.sql");
writeFileSync(goi, `select ${the}${moDau}${vanBan}${ghiDau}${the} \\gexec\n`);

noi(`▶ Chạy ${NAME} (bản ${sha.slice(0, 12)}; trước đó: ${shaCu ? shaCu.slice(0, 12) : "chưa lần nào"}) trong một transaction…`);
const t0 = Date.now();
const chay = psql(["-f", goi], { timeoutMs: 20 * 60_000 });
const giay = ((Date.now() - t0) / 1000).toFixed(1);
rmSync(tam, { recursive: true, force: true });

if (chay.ok) {
  const daGhi = hoi(
    `select case when to_regclass('public.system_runs') is null then 'thieu-bang' else 'co' end`,
  ).out.trim();
  noi(`✓ Đã chạy xong ${NAME} trong ${giay} giây.`);
  if (daGhi !== "co") {
    noi("  (Database chưa có bảng system_runs nên chưa ghi được dấu — lần deploy sau sẽ chạy lại file này, vô hại.)");
  }
  tomTat(`### SQL tự chạy\n- ✅ Đã chạy \`${NAME}\` bản \`${sha.slice(0, 12)}\` trong ${giay} giây.`);
  process.exit(0);
}

/* ── 3. Hỏng: transaction đã rollback. Ghi lại để trang Sức khoẻ hệ thống thấy. ── */
const duoi = chay.err.trim().split("\n").filter(Boolean).slice(-12).join("\n");
console.error(`✗ ${NAME} HỎNG sau ${giay} giây — đã rollback, database không đổi gì:\n${duoi}`);
if (bangSan) {
  const loi = duoi.slice(-1500).replace(/'/g, "''");
  hoi(
    `insert into public.system_runs (kind, name, ok, detail, duration_ms) values ('sql', '${NAME}', false, ` +
      `jsonb_build_object('sha256', '${sha}', 'git_sha', '${gitSha}', 'error', '${loi}'), ${Math.round(Number(giay) * 1000)})`,
  );
}
tomTat(
  `### SQL tự chạy\n- ❌ \`${NAME}\` hỏng — đã rollback, database không đổi, KHÔNG deploy.\n\n\`\`\`\n${duoi.slice(-1500)}\n\`\`\``,
);
process.exit(1);
