/* Kiểm HÀNG RÀO RLS của "người trong album", trên PostgreSQL thật.
 *
 * Vì sao phải có bài này: studio ghi THẲNG bằng anon key, không qua API route —
 * nghĩa là policy RLS chính là toàn bộ phần kiểm soát. Policy sai theo hai chiều
 * đều tệ, và cả hai đều KHÔNG lộ ra ở bất kỳ bài kiểm thử nào khác:
 *
 *   • Quá CHẶT → studio bấm Lưu và nhận "new row violates row-level security
 *     policy". Không kiểm thử đơn vị nào bắt được, vì luật RLS không nằm trong
 *     JavaScript. Chỉ studio thật, lúc lưu thật, mới gặp.
 *   • Quá LỎNG → studio A ghi được vào album của studio B.
 *
 * Và policy của album_photo_people còn gánh thêm việc mà khoá ngoại không làm
 * được: NGƯỜI và ẢNH phải cùng thuộc đúng album_id đã ghi. Không có nó, một lỗi
 * lập trình trộn hai album vẫn ghi được, rồi khách album A thấy ảnh album B.
 *
 * Cách chạy: npm run test:rls-luu-nguoi (cần PostgreSQL, xem sql-chay-that.mjs).
 */
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUPA = join(HERE, "..", "..", "supabase");
const PORT = process.env.PGTEST_PORT || "5442";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};
const skip = (why) => {
  console.log(`⏭  BỎ QUA: ${why}`);
  process.exit(0);
};

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

let AS = null;
if (process.getuid?.() === 0) {
  try {
    execSync("id postgres", { stdio: "ignore" });
    AS = "postgres";
  } catch {
    skip("đang chạy dưới root mà máy không có user `postgres`.");
  }
}

const DIR = mkdtempSync(join(AS ? "/var/tmp" : tmpdir(), "mstudo-rls-"));
const sh = (cmd) => {
  const full = `export PATH=${PGBIN ? PGBIN + ":" : ""}$PATH; ${cmd}`;
  return AS
    ? execFileSync("su", [AS, "-s", "/bin/bash", "-c", full], { encoding: "utf8" })
    : execSync(full, { encoding: "utf8", shell: "/bin/bash" });
};
if (AS) execSync(`chown -R ${AS}:${AS} ${DIR}`);
process.on("exit", () => {
  try {
    sh(`pg_ctl -D ${DIR}/data -m immediate stop`);
  } catch {
    /* đã tắt */
  }
  rmSync(DIR, { recursive: true, force: true });
});

try {
  sh(`initdb -D ${DIR}/data -U postgres -A trust`);
  sh(`pg_ctl -D ${DIR}/data -o "-p ${PORT} -k ${DIR} -c listen_addresses=" -l ${DIR}/log start`);
} catch (e) {
  skip(`không dựng được PostgreSQL tạm: ${String(e).slice(0, 160)}`);
}
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
if (!up) skip("PostgreSQL tạm không lên được.");

/*
 * Shim: giống sql-chay-that.mjs nhưng auth.uid() đọc từ một biến phiên. Đó chính
 * là cách Supabase làm (uid lấy từ JWT của request), nên đổi biến = đổi người
 * đang đăng nhập, và policy thật được thử đúng như lúc chạy thật.
 */
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

-- Quyền BẢNG mà Supabase cấp sẵn cho mọi project, và mọi migration trong repo
-- đều dựa vào (không file nào tự grant bảng của mình — album_dislikes cũng vậy).
-- Thiếu dòng này thì RLS đúng đến mấy cũng ra "permission denied for table":
-- policy quyết định ĐƯỢC ĐỌC/GHI DÒNG NÀO, grant quyết định có được chạm vào
-- BẢNG hay không, và hai thứ đó độc lập. Chính chỗ này đã đánh lừa tôi một lần.
-- Lệnh alter default privileges chỉ áp cho bảng tạo SAU nó, nên phải đứng
-- trước setup-all.sql.
grant usage on schema public to anon, authenticated, service_role;
-- Và quyền dùng schema auth: policy nào cũng gọi auth.uid(), nên thiếu dòng này
-- thì mọi lệnh ghi chết bằng "permission denied for schema auth" — trong khi
-- is_admin() vẫn chạy được vì nó là security definer. Hai triệu chứng khác nhau
-- của cùng một thiếu sót, và đó là lý do phải dựng shim cho đúng chứ không vá
-- theo từng lỗi hiện ra.
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
grant usage on schema storage, extensions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
`;
writeFileSync(join(DIR, "shim.sql"), SHIM);
if (AS) execSync(`chown ${AS}:${AS} ${join(DIR, "shim.sql")}`);

const runFile = (file, tag) => {
  const dest = join(DIR, `f-${tag}.sql`);
  execSync(`cp ${JSON.stringify(file)} ${dest}`);
  if (AS) execSync(`chown ${AS}:${AS} ${dest}`);
  sh(
    `PGOPTIONS='-c client_min_messages=warning' ` +
      `psql -h ${DIR} -p ${PORT} -U postgres -d rls -q -v ON_ERROR_STOP=1 -f ${dest}`
  );
};
/** Chạy SQL bất kỳ; trả {ok, err}. Không ném — bài này CẦN các lệnh bị chối. */
const sql = (text) => {
  const f = join(DIR, "q.sql");
  writeFileSync(f, text);
  if (AS) execSync(`chown ${AS}:${AS} ${f}`);
  try {
    const out = sh(
      `PGOPTIONS='-c client_min_messages=warning' ` +
        `psql -h ${DIR} -p ${PORT} -U postgres -d rls -tA -v ON_ERROR_STOP=1 -f ${f} 2>&1`
    );
    return { ok: true, out: out.trim() };
  } catch (e) {
    return { ok: false, out: String(e.stdout || "") + String(e.stderr || "") };
  }
};

sh(`psql -h ${DIR} -p ${PORT} -U postgres -q -c "create database rls"`);
runFile(join(DIR, "shim.sql"), "shim");
runFile(join(SUPA, "setup-all.sql"), "setup");
ok("dựng được schema đầy đủ trên PostgreSQL thật", true);

/* ── Dữ liệu: hai studio, mỗi bên một album ──────────────────────────────── */
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const seed = sql(`
-- schema.sql có trigger handle_new_user() tự tạo profiles khi thêm auth.users,
-- nên KHÔNG insert profiles nữa — chỉ đặt tên. Insert thẳng sẽ vỡ vì trùng khoá,
-- và (đã xảy ra thật) làm cả seed dừng giữa chừng, để lại một database không có
-- album nào — rồi mọi phép RLS phía sau "trượt" vì lý do hoàn toàn khác.
insert into auth.users (id, email) values ('${A}','a@x.vn'), ('${B}','b@x.vn');
update public.profiles set full_name = 'Studio A' where id = '${A}';
update public.profiles set full_name = 'Studio B' where id = '${B}';
insert into public.albums (id, owner_id, slug, title, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001','${A}','album-a','Album A','published'),
  ('bbbbbbbb-0000-0000-0000-000000000001','${B}','album-b','Album B','published');
insert into public.photos (id, album_id, drive_file_id, name, position) values
  ('a0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','dA1','IMG_001.jpg',0),
  ('a0000000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','dA2','IMG_002.jpg',1),
  ('b0000000-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','dB1','IMG_900.jpg',0);
`);
ok("gieo được dữ liệu hai studio", seed.ok, seed.out.slice(0, 300));
{
  const n = sql("select (select count(*) from public.profiles) || '/' || (select count(*) from public.albums) || '/' || (select count(*) from public.photos);").out.trim();
  ok("…và dữ liệu CÓ THẬT (2 studio / 2 album / 3 ảnh)", n === "2/2/3", `đếm được ${n}`);
}

/** Chạy một lệnh ĐÚNG NHƯ studio chạy: role authenticated + uid của họ. */
const asStudio = (uid, body) =>
  sql(`set role authenticated;
set mstudo.uid = '${uid}';
${body}`);

const P1 = "cccccccc-0000-0000-0000-000000000001";
const ALB_A = "aaaaaaaa-0000-0000-0000-000000000001";
const ALB_B = "bbbbbbbb-0000-0000-0000-000000000001";
const PH_A1 = "a0000000-0000-0000-0000-000000000001";
const PH_A2 = "a0000000-0000-0000-0000-000000000002";
const PH_B1 = "b0000000-0000-0000-0000-000000000001";
const VEC = `array[${Array.from({ length: 128 }, (_, i) => (i / 1000).toFixed(3)).join(",")}]::real[]`;

/* ── 1. Studio ghi vào album CỦA MÌNH → phải được ───────────────────────── */
console.log("\n— Studio lưu vào album của chính mình —");
let r = asStudio(A, `
insert into public.album_people (id, album_id, name, face_count, cover_photo_id, cover_at, descriptor, position)
values ('${P1}', '${ALB_A}', 'Cô dâu', 12, '${PH_A1}', 0, ${VEC}, 0);`);
ok("thêm được người vào album của mình", r.ok, r.out.slice(0, 300));

r = asStudio(A, `
insert into public.album_photo_people (album_id, person_id, photo_id) values
  ('${ALB_A}','${P1}','${PH_A1}'), ('${ALB_A}','${P1}','${PH_A2}');`);
ok("nối được ảnh với người (đây là chỗ policy phức tạp nhất)", r.ok, r.out.slice(0, 400));

// `update` không chạm dòng nào cũng trả về thành công, nên phải đọc lại giá trị:
// nếu không, một policy chặn sạch vẫn cho bài này "đạt".
asStudio(A, `update public.album_people set name = 'Cô dâu Lan' where id = '${P1}';`);
ok(
  "sửa được tên người (đọc lại để chắc chắn ĐỔI THẬT)",
  asStudio(A, `select name from public.album_people where id = '${P1}';`).out.trim().endsWith("Cô dâu Lan")
);

asStudio(A, `delete from public.album_photo_people where person_id = '${P1}' and photo_id = '${PH_A2}';`);
ok(
  "xoá được một dòng nối (lượt lưu sau ghi đè danh sách ảnh)",
  asStudio(A, `select count(*) from public.album_photo_people where person_id = '${P1}';`).out.trim().endsWith("1")
);

/* ── 2. Studio KHÁC → phải bị chối ──────────────────────────────────────── */
console.log("\n— Studio khác không được đụng vào —");
r = asStudio(B, `
insert into public.album_people (album_id, name, face_count, cover_at, position)
values ('${ALB_A}', 'Kẻ lạ', 1, 0, 9);`);
ok("studio B KHÔNG thêm được người vào album của A", !r.ok);

r = asStudio(B, `update public.album_people set name = 'Bị đổi' where id = '${P1}';`);
ok(
  "studio B KHÔNG sửa được tên người của A",
  r.ok && Number(asStudio(A, `select count(*) from public.album_people where id='${P1}' and name='Cô dâu Lan';`).out.split("\n").pop()) === 1,
  "RLS phải làm lệnh update không chạm được dòng nào"
);

r = asStudio(B, `select count(*) from public.album_people where album_id = '${ALB_A}';`);
ok("studio B KHÔNG đọc được người của A", r.ok && r.out.trim().endsWith("0"), r.out.slice(0, 200));

/* ── 3. Hàng rào toàn vẹn mà khoá ngoại không làm được ──────────────────── */
console.log("\n— Không trộn được hai album —");
r = asStudio(A, `
insert into public.album_photo_people (album_id, person_id, photo_id)
values ('${ALB_A}', '${P1}', '${PH_B1}');`);
ok("ảnh của album KHÁC không nối vào được (dù cùng chủ)", !r.ok);

r = asStudio(B, `
insert into public.album_people (id, album_id, name, face_count, cover_at, position)
values ('dddddddd-0000-0000-0000-000000000001', '${ALB_B}', 'Người của B', 3, 0, 0);
insert into public.album_photo_people (album_id, person_id, photo_id)
values ('${ALB_B}', 'dddddddd-0000-0000-0000-000000000001', '${PH_A1}');`);
ok("studio B không nối được ảnh của A vào người của B", !r.ok);

/* ── 4. Ràng buộc dữ liệu ───────────────────────────────────────────────── */
console.log("\n— Ràng buộc dữ liệu —");
r = asStudio(A, `
insert into public.album_people (album_id, name, face_count, cover_at, position)
values ('${ALB_A}', 'cô dâu lan', 1, 0, 5);`);
ok("hai người trùng tên (khác hoa/thường) trong một album bị chối", !r.ok);

r = asStudio(A, `
insert into public.album_people (album_id, name, face_count, cover_at, position) values
  ('${ALB_A}', '', 1, 0, 6), ('${ALB_A}', '', 1, 0, 7);`);
ok("nhiều người CHƯA đặt tên thì vẫn được (tên rỗng không tính trùng)", r.ok, r.out.slice(0, 200));

r = asStudio(A, `
insert into public.album_people (album_id, name, face_count, cover_at, position, descriptor)
values ('${ALB_A}', 'Vector hỏng', 1, 0, 8, array[1,2,3]::real[]);`);
ok("vector sai số chiều (3 thay vì 128) bị chối", !r.ok);

/* ── 5. Xoá album phải cuốn theo mọi thứ ────────────────────────────────── */
console.log("\n— Dọn dẹp theo album —");
const before = asStudio(A, `select count(*) from public.album_photo_people where album_id='${ALB_A}';`).out.split("\n").pop();
ok("trước khi xoá album còn dòng nối", Number(before) > 0, `đếm ${before}`);
r = sql(`delete from public.albums where id = '${ALB_A}';`);
ok("xoá album chạy được", r.ok, r.out.slice(0, 200));
const left = sql(
  `select (select count(*) from public.album_people where album_id='${ALB_A}')
        + (select count(*) from public.album_photo_people where album_id='${ALB_A}');`
).out.split("\n").pop();
ok("…và cuốn theo cả người lẫn dòng nối (không để rác)", Number(left) === 0, `còn ${left}`);

console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
