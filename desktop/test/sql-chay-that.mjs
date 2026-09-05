/* Chạy THẬT hai file SQL sinh ra, trên một Postgres trắng.
 *
 * Vì sao cần: `npm run test:setup-all` chỉ đối chiếu văn bản — nó chứng minh
 * file khớp với các migration trong repo, KHÔNG chứng minh chuỗi ấy chạy được.
 * Một lỗi cú pháp, một cột tham chiếu tới bảng chưa tạo, một thứ tự sai — tất cả
 * đều lọt qua bài đối chiếu văn bản và chỉ lộ ra khi chủ studio dán vào SQL
 * Editor, giữa chừng, sau khi đã ghi được một nửa.
 *
 * Bài này dựng đúng hai tình huống thật:
 *
 *   1. PROJECT MỚI TINH → `setup-all.sql` phải chạy sạch từ database trắng.
 *   2. PROJECT ĐANG CHẠY → dựng trạng thái CŨ (ORDER trừ MOI), rồi
 *      `cap-nhat.sql` phải chạy sạch, và chạy LẠI lần nữa vẫn vô hại.
 *
 * Cần `initdb`/`pg_ctl`/`psql` (Postgres ≥ 14) và một user không phải root —
 * Postgres từ chối chạy dưới root. Thiếu thứ nào thì BỎ QUA chứ không báo hỏng:
 * không có Postgres trên máy không phải lỗi của code.
 *
 * Supabase cấp sẵn vài thứ mà Postgres trắng không có (auth.uid(), các role
 * anon/authenticated/service_role, schema storage…). Shim dưới đây dựng đúng
 * phần tối thiểu để các migration chạy được — nó KHÔNG mô phỏng Supabase, chỉ
 * dựng chỗ đứng cho chúng.
 *
 * Cố ý KHÔNG dựng phần cấp quyền (grant / default privileges): bài này chạy dưới
 * superuser nên quyền không ảnh hưởng gì, và thêm vào chỉ làm shim trông như đã
 * kiểm quyền trong khi không. Bài kiểm quyền thật là desktop/test/rls-luu-nguoi.mjs
 * — nó chạy dưới role `authenticated` và shim của nó dựng đủ cả grant lẫn quyền
 * dùng schema auth. Đừng chép shim này sang đó.
 */
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUPA = join(HERE, "..", "..", "supabase");
const PORT = process.env.PGTEST_PORT || "5441";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};
const skip = (why) => {
  console.log(`⏭  BỎ QUA: ${why}`);
  process.exit(0);
};

/* ── Tìm Postgres ─────────────────────────────────────────────────────────── */
let PGBIN = "";
for (const c of ["", "/usr/lib/postgresql/17/bin", "/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/15/bin"]) {
  try {
    execSync(`${c ? join(c, "initdb") : "initdb"} --version`, { stdio: "ignore" });
    PGBIN = c;
    break;
  } catch {
    /* thử chỗ tiếp theo */
  }
}
if (!PGBIN && !existsSync("/usr/bin/initdb")) skip("không có initdb/psql trên máy này.");

// Postgres không chạy dưới root. Có user `postgres` thì mượn, không thì bỏ qua.
const isRoot = process.getuid?.() === 0;
let AS = null;
if (isRoot) {
  try {
    execSync("id postgres", { stdio: "ignore" });
    AS = "postgres";
  } catch {
    skip("đang chạy dưới root mà máy không có user `postgres`.");
  }
}

// Thư mục làm việc phải nằm ngoài repo và user postgres đọc được.
const DIR = mkdtempSync(join(AS ? "/var/tmp" : tmpdir(), "mstudo-pg-"));
const sh = (cmd) => {
  const full = `export PATH=${PGBIN ? PGBIN + ":" : ""}$PATH; ${cmd}`;
  return AS
    ? execFileSync("su", [AS, "-s", "/bin/bash", "-c", full], { encoding: "utf8" })
    : execSync(full, { encoding: "utf8", shell: "/bin/bash" });
};
if (AS) execSync(`chown -R ${AS}:${AS} ${DIR}`);

const stop = () => {
  try {
    sh(`pg_ctl -D ${DIR}/data -m immediate stop`);
  } catch {
    /* đã tắt rồi */
  }
  rmSync(DIR, { recursive: true, force: true });
};
process.on("exit", stop);

/* ── Dựng máy chủ ─────────────────────────────────────────────────────────── */
try {
  sh(`initdb -D ${DIR}/data -U postgres -A trust`);
  sh(`pg_ctl -D ${DIR}/data -o "-p ${PORT} -k ${DIR} -c listen_addresses=" -l ${DIR}/log start`);
} catch (e) {
  skip(`không dựng được Postgres tạm: ${String(e).slice(0, 160)}`);
}
// Đợi máy chủ nhận kết nối.
let up = false;
for (let i = 0; i < 20; i++) {
  try {
    sh(`psql -h ${DIR} -p ${PORT} -U postgres -tAc "select 1"`);
    up = true;
    break;
  } catch {
    execSync("sleep 0.5", { shell: "/bin/bash" });
  }
}
if (!up) skip("Postgres tạm không lên được.");
ok("dựng được Postgres trắng để chạy thử", true);

const SHIM = `
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator noinherit login; end if;
end $$;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $q$ select null::uuid $q$;
create or replace function auth.role() returns text language sql stable as $q$ select 'anon'::text $q$;
create or replace function auth.jwt() returns jsonb language sql stable as $q$ select '{}'::jsonb $q$;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now(), metadata jsonb
);
do $$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
`;
writeFileSync(join(DIR, "shim.sql"), SHIM);
if (AS) execSync(`chown ${AS}:${AS} ${join(DIR, "shim.sql")}`);

const newDb = (db) => sh(`psql -h ${DIR} -p ${PORT} -U postgres -q -c "create database ${db}"`);
const runFile = (db, file) => {
  const dest = join(DIR, `run-${db}.sql`);
  execSync(`cp ${JSON.stringify(file)} ${dest}`);
  if (AS) execSync(`chown ${AS}:${AS} ${dest}`);
  // Tắt NOTICE: lượt chạy lại (kiểm idempotent) sinh ra hàng chục dòng
  // "already exists, skipping" — đó chính là BẰNG CHỨNG nó idempotent, nhưng in
  // ra thì lấp mất kết quả thật. Lỗi vẫn hiện, vì ON_ERROR_STOP giữ nguyên.
  sh(
    `PGOPTIONS='-c client_min_messages=warning' ` +
      `psql -h ${DIR} -p ${PORT} -U postgres -d ${db} -q -v ON_ERROR_STOP=1 -f ${dest}`
  );
};
const q = (db, sql) =>
  sh(`psql -h ${DIR} -p ${PORT} -U postgres -d ${db} -tAc ${JSON.stringify(sql)}`).trim();
const tries = (name, fn) => {
  try {
    fn();
    ok(name, true);
    return true;
  } catch (e) {
    ok(name, false, String(e.stderr || e).slice(0, 400));
    return false;
  }
};

/* ── 1. Project MỚI TINH ──────────────────────────────────────────────────── */
console.log("\n— Project mới tinh: setup-all.sql —");
newDb("moi");
runFile("moi", join(DIR, "shim.sql"));
tries("setup-all.sql chạy sạch từ database trắng", () =>
  runFile("moi", join(SUPA, "setup-all.sql"))
);
ok(
  "…dựng ra một schema có thật (trên 50 bảng)",
  Number(q("moi", "select count(*) from information_schema.tables where table_schema='public'")) > 50,
  `đếm được ${q("moi", "select count(*) from information_schema.tables where table_schema='public'")}`
);

/* ── 2. Project ĐANG CHẠY ─────────────────────────────────────────────────── */
console.log("\n— Project đang chạy: cap-nhat.sql —");
// Trạng thái CŨ = ORDER trừ MOI. Dựng bằng chính bộ sinh, không chép tay.
const gen = join(SUPA, ".tmp-truoc-test.mjs");
const src = execSync(`cat ${join(SUPA, "build-setup-all.mjs")}`, { encoding: "utf8" });
const cut = src.indexOf("// ── Bản cập nhật cho project ĐANG CHẠY");
writeFileSync(
  gen,
  src
    .slice(0, cut)
    .replace(
      'emit("setup-all.sql", ORDER, header);',
      'emit(".tmp-truoc-test.sql", ORDER.filter(([rel]) => !MOI.includes(rel)), header);'
    )
);
execSync(`node ${gen}`, { stdio: "ignore" });
rmSync(gen);
const TRUOC = join(SUPA, ".tmp-truoc-test.sql");

newDb("cu");
runFile("cu", join(DIR, "shim.sql"));
tries("dựng được trạng thái TRƯỚC cập nhật (ORDER trừ MOI)", () => runFile("cu", TRUOC));
rmSync(TRUOC, { force: true });

ok(
  "…và ở trạng thái đó, các bảng mới CHƯA tồn tại",
  q("cu", "select count(*) from information_schema.tables where table_schema='public' and table_name in ('album_people','album_photo_people','studio_vendors','studio_automations')") === "0"
);

const first = tries("cap-nhat.sql chạy sạch trên database đang chạy", () =>
  runFile("cu", join(SUPA, "cap-nhat.sql"))
);
tries("…chạy LẠI lần nữa vẫn vô hại (idempotent)", () =>
  runFile("cu", join(SUPA, "cap-nhat.sql"))
);

if (first) {
  // Không chỉ "chạy không lỗi" — phải kiểm đúng thứ mỗi migration hứa tạo ra.
  const has = (sql) => Number(q("cu", sql));
  ok("album_people + album_photo_people đã có", has(
    "select count(*) from information_schema.tables where table_schema='public' and table_name in ('album_people','album_photo_people')"
  ) === 2);
  ok("chỉ mục chặn hai người trùng tên trong một album", has(
    "select count(*) from pg_indexes where indexname='album_people_name_uk'"
  ) === 1);
  ok("ràng buộc vector phải đúng 128 chiều", has(
    "select count(*) from pg_constraint where conrelid='public.album_people'::regclass and contype='c'"
  ) >= 1);
  ok("policy RLS của album_photo_people", has(
    "select count(*) from pg_policies where tablename='album_photo_people'"
  ) === 1);
  ok("trigger khoá sổ kế toán", has("select count(*) from pg_trigger where tgname like '%books_closed%'") >= 1);
  ok("bảng nhà cung cấp & chấm công", has(
    "select count(*) from information_schema.tables where table_schema='public' and table_name in ('studio_vendors','crew_timesheet')"
  ) === 2);
  ok("cột trả lời đánh giá khách", has(
    "select count(*) from information_schema.columns where table_name='feedback' and column_name in ('reply','replied_at','moderated_at')"
  ) === 3);
  ok("cột nguồn khách", has(
    "select count(*) from information_schema.columns where table_schema='public' and column_name in ('source','channel','utm','landing_path')"
  ) >= 4);
  ok("cột toạ độ điểm chụp (thời tiết)", has(
    "select count(*) from information_schema.columns where table_schema='public' and column_name in ('lat','lng','studio_lat','studio_lng')"
  ) >= 4);
}

console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
