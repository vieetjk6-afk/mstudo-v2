/* Postgres TẠM cho các bài kiểm thử chạy SQL thật — phần dùng chung.
 *
 * Vì sao có file này. `sql-chay-that.mjs` và `rls-luu-nguoi.mjs` mỗi bài tự dựng
 * một máy chủ Postgres tạm (initdb → pg_ctl → shim Supabase). Tính năng mới nào
 * có migration cũng cần đúng bộ đó để chứng minh SQL của mình CHẠY ĐƯỢC và ràng
 * buộc / RLS đúng như mô tả — chép 150 dòng dựng máy chủ sang từng bài là cách
 * chắc chắn để các bản chép trôi khỏi nhau. Bài mới dùng file này.
 *
 *   import { dungPostgres } from "./pg-tam.mjs";
 *   const pg = dungPostgres({ port: "5461" });          // mỗi bài MỘT cổng riêng
 *   if (!pg.ok) { console.log(`⏭  BỎ QUA: ${pg.lyDo}`); process.exit(0); }
 *   pg.newDb("thu");                                     // tạo DB + nạp shim
 *   pg.runFile("thu", pg.supa("setup-all.sql"));         // ném lỗi nếu SQL hỏng
 *   pg.q("thu", "select count(*) from public.albums");   // → "0"
 *   pg.sql("thu", "insert …; select …;");                // → { ok, out } (không ném)
 *   pg.asUser("thu", uid, "select …;");                  // role authenticated + auth.uid() = uid
 *   pg.url("thu");                                       // chuỗi kết nối cho công cụ ngoài (psql)
 *
 * Shim là bản CÓ quyền (grant + auth.uid() đọc từ biến phiên `mstudo.uid`) của
 * rls-luu-nguoi.mjs — dùng được cho cả bài kiểm RLS lẫn bài chỉ kiểm cú pháp.
 * Nó KHÔNG mô phỏng Supabase, chỉ dựng chỗ đứng tối thiểu cho các migration.
 *
 * Không có initdb / psql, hoặc chạy dưới root mà máy không có user `postgres`
 * → trả { ok: false, lyDo } để bài gọi BỎ QUA (không có Postgres trên máy không
 * phải lỗi của code). Máy chủ tự tắt và thư mục tạm tự xoá khi tiến trình thoát.
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUPA = join(HERE, "..", "..", "supabase");

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
create or replace function auth.uid() returns uuid language sql stable as
  $q$ select nullif(current_setting('mstudo.uid', true), '')::uuid $q$;
create or replace function auth.role() returns text language sql stable as $q$ select 'authenticated'::text $q$;
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
-- Quyền bảng Supabase cấp sẵn cho mọi project (xem ghi chú ở rls-luu-nguoi.mjs):
-- phải đứng TRƯỚC setup-all.sql vì alter default privileges chỉ áp cho bảng tạo sau.
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
grant usage on schema storage, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

/**
 * Dựng một máy chủ Postgres tạm. `port`: MỖI bài một cổng riêng (bộ chạy kiểm
 * thử chạy nhiều bài song song) — 5441 / 5442 đã thuộc sql-chay-that / rls-luu-nguoi.
 */
export function dungPostgres({ port }) {
  const PORT = String(port);
  let PGBIN = "";
  let found = false;
  for (const c of ["", "/usr/lib/postgresql/17/bin", "/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/15/bin", "/usr/lib/postgresql/14/bin"]) {
    try {
      execSync(`${c ? join(c, "initdb") : "initdb"} --version`, { stdio: "ignore" });
      PGBIN = c;
      found = true;
      break;
    } catch {
      /* thử chỗ tiếp theo */
    }
  }
  if (!found) return { ok: false, lyDo: "không có initdb/psql trên máy này." };

  // Postgres không chạy dưới root. Có user `postgres` thì mượn, không thì bỏ qua.
  let AS = null;
  if (process.getuid?.() === 0) {
    try {
      execSync("id postgres", { stdio: "ignore" });
      AS = "postgres";
    } catch {
      return { ok: false, lyDo: "đang chạy dưới root mà máy không có user `postgres`." };
    }
  }

  // Thư mục làm việc phải nằm ngoài repo và user postgres đọc được.
  const DIR = mkdtempSync(join(AS ? "/var/tmp" : tmpdir(), "mstudo-pg-"));
  const sh = (cmd) => {
    const full = `export PATH=${PGBIN ? PGBIN + ":" : ""}$PATH; ${cmd}`;
    return AS
      ? execFileSync("su", [AS, "-s", "/bin/bash", "-c", full], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      : execSync(full, { encoding: "utf8", shell: "/bin/bash", stdio: ["ignore", "pipe", "pipe"] });
  };
  const own = (f) => {
    if (AS) execSync(`chown ${AS}:${AS} ${JSON.stringify(f)}`);
  };
  if (AS) execSync(`chown -R ${AS}:${AS} ${DIR}`);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      sh(`pg_ctl -D ${DIR}/data -m immediate stop`);
    } catch {
      /* đã tắt rồi */
    }
    rmSync(DIR, { recursive: true, force: true });
  };
  process.on("exit", stop);

  try {
    sh(`initdb -D ${DIR}/data -U postgres -A trust`);
    sh(`pg_ctl -D ${DIR}/data -o "-p ${PORT} -k ${DIR} -c listen_addresses=" -l ${DIR}/log start`);
  } catch (e) {
    stop();
    return { ok: false, lyDo: `không dựng được Postgres tạm: ${String(e.stderr || e).slice(0, 160)}` };
  }
  let up = false;
  for (let i = 0; i < 30 && !up; i++) {
    try {
      sh(`psql -h ${DIR} -p ${PORT} -U postgres -tAc "select 1"`);
      up = true;
    } catch {
      execSync("sleep 0.5", { shell: "/bin/bash" });
    }
  }
  if (!up) {
    stop();
    return { ok: false, lyDo: "Postgres tạm không lên được." };
  }

  writeFileSync(join(DIR, "shim.sql"), SHIM);
  own(join(DIR, "shim.sql"));

  let seq = 0;
  /** Chạy một file .sql; NÉM lỗi (kèm stderr của psql) nếu có câu hỏng. */
  const runFile = (db, file) => {
    const dest = join(DIR, `run-${db}-${seq++}.sql`);
    execSync(`cp ${JSON.stringify(file)} ${JSON.stringify(dest)}`);
    own(dest);
    try {
      sh(`PGOPTIONS='-c client_min_messages=warning' psql -h ${DIR} -p ${PORT} -U postgres -d ${db} -q -v ON_ERROR_STOP=1 -f ${dest}`);
    } catch (e) {
      throw new Error(String(e.stderr || e.stdout || e).slice(0, 1200));
    }
  };
  /** Chạy SQL bất kỳ (nhiều câu); trả { ok, out } — KHÔNG ném, để kiểm cả lệnh phải bị chối. */
  const sql = (db, text) => {
    const f = join(DIR, `q-${seq++}.sql`);
    writeFileSync(f, text);
    own(f);
    try {
      const out = sh(`PGOPTIONS='-c client_min_messages=warning' psql -h ${DIR} -p ${PORT} -U postgres -d ${db} -q -tA -v ON_ERROR_STOP=1 -f ${f} 2>&1`);
      return { ok: true, out: out.trim() };
    } catch (e) {
      return { ok: false, out: (String(e.stdout || "") + String(e.stderr || "")).trim() };
    }
  };

  return {
    ok: true,
    dir: DIR,
    port: PORT,
    /** Đường dẫn tới một file trong thư mục supabase/ của repo. */
    supa: (rel) => join(SUPA, rel),
    /** Tạo database mới và nạp shim Supabase tối thiểu. */
    newDb: (db) => {
      sh(`psql -h ${DIR} -p ${PORT} -U postgres -q -c "create database ${db}"`);
      runFile(db, join(DIR, "shim.sql"));
    },
    runFile,
    sql,
    /** Một câu, trả về chuỗi kết quả đã cắt gọn (ném lỗi nếu hỏng). */
    q: (db, text) => {
      const r = sql(db, text);
      if (!r.ok) throw new Error(r.out.slice(0, 800));
      return r.out;
    },
    /** Chạy như một tài khoản đã đăng nhập: role authenticated + auth.uid() = uid. */
    asUser: (db, uid, body) => sql(db, `set role authenticated;\nset mstudo.uid = '${uid}';\n${body}`),
    /** Chạy như service-role (máy chủ của app): bỏ qua RLS nhưng vẫn chịu grant của hàm. */
    asService: (db, body) => sql(db, `set role service_role;\n${body}`),
    /**
     * Chuỗi kết nối (qua unix socket) cho công cụ ngoài, vd scripts/chay-sql.mjs.
     * Có tên máy `localhost` cho đúng dạng URL; `?host=` (thư mục socket) mới là
     * chỗ thật sự nối tới — libpq lấy tham số ở chuỗi truy vấn đè lên phần trước.
     */
    url: (db) => `postgresql://postgres@localhost/${db}?host=${encodeURIComponent(DIR)}&port=${PORT}`,
    /** Chạy một lệnh shell dưới đúng user đang giữ máy chủ (root thì mượn `postgres`). */
    as: AS,
    stop,
  };
}
