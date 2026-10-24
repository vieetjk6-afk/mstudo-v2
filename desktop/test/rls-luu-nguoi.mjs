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

/* ── 4b. Kho khuôn mặt của lượt quét tự động ─────────────────────────────── */
console.log("\n— Kho khuôn mặt (lượt quét tự động) —");
{
  const VEC128 = `array[${Array.from({ length: 128 }, (_, i) => (i / 500).toFixed(3)).join(",")}]::real[]`;
  let r = asStudio(A, `
insert into public.album_faces (album_id, photo_id, at, box, descriptor, sharpness)
values ('${ALB_A}', '${PH_A1}', 0, array[0.1,0.1,0.2,0.3]::real[], ${VEC128}, 120);`);
  ok("studio ghi được khuôn mặt đã quét vào album của mình", r.ok, r.out.slice(0, 400));

  // Đánh dấu "đã quét" là mắt xích sống còn: thiếu quyền này thì lượt quét chạy
  // mãi không xong mà không báo lỗi gì cho studio.
  r = asStudio(A, `update public.photos set faces_scanned_at = now() where id = '${PH_A1}';`);
  ok(
    "studio đánh dấu được ảnh ĐÃ QUÉT (nếu không, lượt quét lặp vô tận)",
    asStudio(A, `select count(*) from public.photos where id='${PH_A1}' and faces_scanned_at is not null;`)
      .out.trim().endsWith("1")
  );

  r = asStudio(B, `
insert into public.album_faces (album_id, photo_id, at, box, descriptor, sharpness)
values ('${ALB_A}', '${PH_A1}', 1, array[0.1,0.1,0.2,0.3]::real[], ${VEC128}, 10);`);
  ok("studio B KHÔNG ghi được vào kho của A", !r.ok);

  r = asStudio(A, `
insert into public.album_faces (album_id, photo_id, at, box, descriptor, sharpness)
values ('${ALB_A}', '${PH_B1}', 0, array[0.1,0.1,0.2,0.3]::real[], ${VEC128}, 10);`);
  ok("ảnh của album khác không ghi vào kho được (dù cùng chủ)", !r.ok);

  r = asStudio(A, `
insert into public.album_faces (album_id, photo_id, at, box, descriptor, sharpness)
values ('${ALB_A}', '${PH_A2}', 0, array[0.1,0.1]::real[], ${VEC128}, 10);`);
  ok("khung sai độ dài (2 số thay vì 4) bị chối", !r.ok);

  r = asStudio(A, `
insert into public.album_faces (album_id, photo_id, at, box, descriptor, sharpness)
values ('${ALB_A}', '${PH_A2}', 0, array[0.1,0.1,0.2,0.3]::real[], array[1,2,3]::real[], 10);`);
  ok("vector sai số chiều (3 thay vì 128) bị chối", !r.ok);

  // Quét lại cùng một tấm phải GHI ĐÈ, không nổ khoá chính — lượt quét sau khi
  // studio thêm ảnh sẽ chạm lại những tấm cũ.
  r = asStudio(A, `
insert into public.album_faces (album_id, photo_id, at, box, descriptor, sharpness)
values ('${ALB_A}', '${PH_A1}', 0, array[0.2,0.2,0.3,0.4]::real[], ${VEC128}, 200)
on conflict (photo_id, at) do update set box = excluded.box, sharpness = excluded.sharpness;`);
  ok("quét lại cùng một khuôn mặt thì GHI ĐÈ, không nổ khoá chính", r.ok, r.out.slice(0, 300));
}

/* ── 5. Xoá album phải cuốn theo mọi thứ ────────────────────────────────── */
console.log("\n— Dọn dẹp theo album —");
const before = asStudio(A, `select count(*) from public.album_photo_people where album_id='${ALB_A}';`).out.split("\n").pop();
ok("trước khi xoá album còn dòng nối", Number(before) > 0, `đếm ${before}`);
r = sql(`delete from public.albums where id = '${ALB_A}';`);
ok("xoá album chạy được", r.ok, r.out.slice(0, 200));
const left = sql(
  `select (select count(*) from public.album_people where album_id='${ALB_A}')
        + (select count(*) from public.album_photo_people where album_id='${ALB_A}')
        + (select count(*) from public.album_faces where album_id='${ALB_A}');`
).out.split("\n").pop();
ok("…và cuốn theo cả người, dòng nối lẫn kho khuôn mặt (không để rác)", Number(left) === 0, `còn ${left}`);

/* ── 6. Hợp đồng theo VAI TRÒ — migrations/phan_quyen_vai_tro_hop_dong.sql ──
 *
 * Trình duyệt có anon key + JWT của nhân viên, nên mọi luật vai trò mà chỉ nằm
 * trong route API đều lách được bằng một lệnh gọi PostgREST thẳng. Phần này chạy
 * đúng những lệnh đó dưới role `authenticated` với uid của từng vai trò.
 */
console.log("\n— Hợp đồng theo vai trò (gọi thẳng PostgREST) —");
const U = (n) => `0000000${n}-0000-0000-0000-00000000000${n}`.slice(-36);
const STAFF = U(3), BM = U(4), BM0 = U(5), ACC = U(6), MGR = U(7), OFF = U(8), MB = U(9);
const BR1 = "b1000000-0000-0000-0000-000000000001";
const BR2 = "b2000000-0000-0000-0000-000000000002";
const C1 = "c1000000-0000-0000-0000-000000000001"; // BR1, giao cho STAFF
const C2 = "c2000000-0000-0000-0000-000000000002"; // BR2, chưa giao ai
const C3 = "c3000000-0000-0000-0000-000000000003"; // chưa gán cơ sở, giao cho OFF (đã khoá)
const C4 = "c4000000-0000-0000-0000-000000000004"; // BR2, có hạng mục hậu kỳ giao cho STAFF
const CB = "cb000000-0000-0000-0000-00000000000b"; // của studio B
const CREW2 = "ce000000-0000-0000-0000-000000000002";
const PROD4 = "cf000000-0000-0000-0000-000000000004";
{
  const seedRoles = sql(`
insert into auth.users (id, email) values
  ('${STAFF}','staff@a.vn'), ('${BM}','bm@a.vn'), ('${BM0}','bm0@a.vn'), ('${ACC}','acc@a.vn'),
  ('${MGR}','mgr@a.vn'), ('${OFF}','off@a.vn'), ('${MB}','mgr@b.vn');
insert into public.studio_branches (id, owner_id, name) values ('${BR1}','${A}','Quận 1'), ('${BR2}','${A}','Gò Vấp');
update public.profiles set studio_owner_id = '${A}', studio_role = 'staff' where id = '${STAFF}';
update public.profiles set studio_owner_id = '${A}', studio_role = 'branch_manager', studio_branch_id = '${BR1}' where id = '${BM}';
update public.profiles set studio_owner_id = '${A}', studio_role = 'branch_manager' where id = '${BM0}';
update public.profiles set studio_owner_id = '${A}', studio_role = 'accountant' where id = '${ACC}';
update public.profiles set studio_owner_id = '${A}', studio_role = 'manager' where id = '${MGR}';
update public.profiles set studio_owner_id = '${A}', studio_role = 'staff', is_active = false where id = '${OFF}';
update public.profiles set studio_owner_id = '${B}', studio_role = 'manager' where id = '${MB}';
insert into public.studio_contracts (id, owner_id, title, client_token, branch_id, assigned_to, code) values
  ('${C1}','${A}','HĐ C1','tok-c1','${BR1}','${STAFF}','HD-01-2026-001'),
  ('${C2}','${A}','HĐ C2','tok-c2','${BR2}', null,     'HD-01-2026-002'),
  ('${C3}','${A}','HĐ C3','tok-c3', null,   '${OFF}',  'HD-01-2026-003'),
  ('${C4}','${A}','HĐ C4','tok-c4','${BR2}', null,     'HD-01-2026-004'),
  ('${CB}','${B}','HĐ B', 'tok-cb', null,    null,     'HD-01-2026-001');
insert into public.contract_payments (contract_id, amount, kind) values
  ('${C1}', 1000000, 'deposit'), ('${C2}', 2000000, 'deposit'), ('${C4}', 3000000, 'deposit');
insert into public.contract_crew (id, contract_id, name, phone, salary) values ('${CREW2}','${C2}','Thợ Gò Vấp','0900000002', 800000);
insert into public.contract_products (id, contract_id, name, assigned_to) values ('${PROD4}','${C4}','Chỉnh ảnh','${STAFF}');
insert into public.studio_crew (owner_id, name, phone, branch_id) values
  ('${A}','Thợ Q1','0911000001','${BR1}'), ('${A}','Thợ GV','0911000002','${BR2}'), ('${A}','Thợ tự do','0911000003', null);
`);
  ok("gieo được studio A có 2 chi nhánh, 6 vai trò, 4 hợp đồng", seedRoles.ok, seedRoles.out.slice(0, 400));
}

/** Giá trị dòng cuối (psql in thẻ lệnh "SET" trước kết quả). */
const val = (uid, body) => asStudio(uid, body).out.split("\n").pop().trim();
// Bọc trong [ ] để "không thấy gì" vẫn là một dòng có thật, không lẫn với thẻ "SET".
const seen = (uid) =>
  val(uid, `select '[' || coalesce(string_agg(title, ',' order by title), '') || ']' from public.studio_contracts;`).slice(1, -1);
const titleOf = (id) => sql(`select title from public.studio_contracts where id = '${id}';`).out.split("\n").pop().trim();
const pay = (uid, cid, extra = "") =>
  asStudio(uid, `insert into public.contract_payments (contract_id, amount, kind) values ('${cid}', ${extra || "500000, 'installment'"});`);

// is_active + ranh giới studio
ok("chủ studio A thấy đủ 4 hợp đồng của mình (không thấy của B)", seen(A) === "HĐ C1,HĐ C2,HĐ C3,HĐ C4", seen(A));
ok("tài khoản đã KHOÁ không còn thấy hợp đồng nào (kể cả hợp đồng giao cho mình)", seen(OFF) === "", seen(OFF));
ok("…và is_studio_member trả false cho tài khoản đã khoá", val(OFF, `select public.is_studio_member('${A}');`) === "f");
sql(`update public.profiles set is_active = false where id = '${B}';`);
ok("chủ studio bị khoá → quản lý của studio đó cũng mất quyền", seen(MB) === "", seen(MB));
sql(`update public.profiles set is_active = true where id = '${B}';`);
ok("…mở khoá lại thì quản lý thấy lại hợp đồng của studio mình", seen(MB) === "HĐ B", seen(MB));

// staff: chỉ hợp đồng được giao (+ đọc hợp đồng có việc hậu kỳ giao cho mình)
ok("nhân viên chỉ thấy hợp đồng giao cho mình + hợp đồng có hạng mục hậu kỳ của mình", seen(STAFF) === "HĐ C1,HĐ C4", seen(STAFF));
ok(
  "nhân viên KHÔNG đọc được khoản thu của hợp đồng không giao cho mình",
  val(STAFF, `select count(*) from public.contract_payments where contract_id = '${C2}';`) === "0"
);
r = asStudio(STAFF, `update public.studio_contracts set title = 'Bị sửa' where id = '${C2}';`);
ok("nhân viên KHÔNG sửa được hợp đồng không giao cho mình", r.ok && titleOf(C2) === "HĐ C2", r.out.slice(0, 200));
ok("nhân viên KHÔNG chèn được khoản thu vào hợp đồng không giao cho mình", !pay(STAFF, C2).ok);
ok("…kể cả hợp đồng chỉ được ĐỌC vì có việc hậu kỳ (C4)", !pay(STAFF, C4).ok);
ok("nhân viên KHÔNG ghi được khoản HOÀN TIỀN (kind = refund)", !pay(STAFF, C1, "-200000, 'refund'").ok);
r = asStudio(STAFF, `update public.studio_contracts set status = 'cancelled' where id = '${C1}';`);
ok("nhân viên KHÔNG huỷ được hợp đồng (chỉ chủ studio)", !r.ok && /contract_cancel_owner_only/.test(r.out), r.out.slice(0, 200));
r = asStudio(STAFF, `update public.studio_contracts set assigned_to = '${MGR}' where id = '${C1}';`);
ok("nhân viên KHÔNG chuyển được hợp đồng của mình sang người khác", !r.ok);
r = asStudio(STAFF, `insert into public.studio_contracts (owner_id, title, client_token) values ('${A}', 'Không giao ai', 'tok-s0');`);
ok("nhân viên KHÔNG tạo được hợp đồng không giao cho mình", !r.ok);
// Những việc màn hợp đồng / cổng /staff vẫn phải làm được.
r = asStudio(STAFF, `update public.studio_contracts set title = 'HĐ C1 sửa' where id = '${C1}';`);
ok("nhân viên VẪN sửa được hợp đồng giao cho mình", r.ok && titleOf(C1) === "HĐ C1 sửa", r.out.slice(0, 200));
ok("…VẪN ghi được lần thu trên hợp đồng đó (màn hợp đồng ghi thẳng)", pay(STAFF, C1).ok);
r = asStudio(STAFF, `insert into public.studio_contracts (owner_id, title, client_token, assigned_to) values ('${A}', 'HĐ nhân viên tạo', 'tok-s1', '${STAFF}') returning title;`);
ok("…VẪN tạo được hợp đồng giao cho chính mình (NewContractForm)", r.ok, r.out.slice(0, 200));
r = asStudio(STAFF, `update public.contract_products set status = 'in_progress' where id = '${PROD4}';`);
ok(
  "…VẪN đẩy được trạng thái hạng mục hậu kỳ giao cho mình (cổng /staff)",
  r.ok && sql(`select status from public.contract_products where id = '${PROD4}';`).out.endsWith("in_progress"),
  r.out.slice(0, 200)
);
ok(
  "…và mã hợp đồng mới đếm trên TOÀN studio, không chỉ phần mình thấy (không cấp trùng mã)",
  val(STAFF, `select public.contract_code_count('${A}', 'HD-01-2026-');`) === "4"
);
ok(
  "…nhưng không đếm được hợp đồng của studio KHÁC",
  !asStudio(STAFF, `select public.contract_code_count('${B}', 'HD-');`).ok
);

// branch_manager: chỉ chi nhánh của mình
ok("quản lý chi nhánh Q1 chỉ thấy hợp đồng của Q1", seen(BM) === "HĐ C1 sửa", seen(BM));
ok("quản lý chi nhánh CHƯA gán cơ sở không thấy hợp đồng nào (fail-closed)", seen(BM0) === "", seen(BM0));
ok(
  "quản lý chi nhánh KHÔNG đọc được khoản thu của cơ sở khác",
  val(BM, `select count(*) from public.contract_payments where contract_id = '${C2}';`) === "0"
);
r = asStudio(BM, `update public.studio_contracts set title = 'Bị sửa' where id = '${C2}';`);
ok("quản lý chi nhánh KHÔNG sửa được hợp đồng cơ sở khác", r.ok && titleOf(C2) === "HĐ C2");
ok("quản lý chi nhánh KHÔNG chèn được khoản thu cho cơ sở khác", !pay(BM, C2).ok);
r = asStudio(BM, `update public.studio_contracts set branch_id = '${BR2}' where id = '${C1}';`);
ok("quản lý chi nhánh KHÔNG đẩy được hợp đồng sang cơ sở khác", !r.ok);
r = asStudio(BM, `insert into public.studio_contracts (owner_id, title, client_token, branch_id) values ('${A}', 'HĐ GV', 'tok-b2', '${BR2}');`);
ok("quản lý chi nhánh KHÔNG tạo được hợp đồng cho cơ sở khác", !r.ok);
r = asStudio(BM, `update public.studio_contracts set status = 'cancelled' where id = '${C1}';`);
ok("quản lý chi nhánh KHÔNG huỷ được hợp đồng", !r.ok && /contract_cancel_owner_only/.test(r.out), r.out.slice(0, 200));
ok("quản lý chi nhánh VẪN ghi được lần thu cho hợp đồng cơ sở mình", pay(BM, C1).ok);
r = asStudio(BM, `insert into public.studio_contracts (owner_id, title, client_token, branch_id) values ('${A}', 'HĐ Q1 mới', 'tok-b1', '${BR1}');`);
ok("…VẪN tạo được hợp đồng cho cơ sở mình", r.ok, r.out.slice(0, 200));
ok(
  "quản lý chi nhánh thấy thợ của cơ sở mình + thợ tự do, không thấy thợ cơ sở khác",
  val(BM, `select string_agg(name, ',' order by name) from public.studio_crew;`) === "Thợ Q1,Thợ tự do"
);
r = asStudio(BM, `insert into public.studio_crew (owner_id, name, phone, branch_id) values ('${A}', 'Lén', '0911999999', '${BR2}');`);
ok("quản lý chi nhánh KHÔNG thêm được thợ vào cơ sở khác", !r.ok);

// accountant: đọc toàn studio, không ghi — trừ đánh dấu đã trả lương
ok("kế toán ĐỌC được toàn bộ hợp đồng (màn Thu chi cần)", seen(ACC).split(",").length === seen(A).split(",").length, seen(ACC));
ok("kế toán KHÔNG chèn được khoản thu", !pay(ACC, C2).ok);
r = asStudio(ACC, `update public.studio_contracts set title = 'Bị sửa' where id = '${C2}';`);
ok("kế toán KHÔNG sửa được hợp đồng", r.ok && titleOf(C2) === "HĐ C2");
r = asStudio(ACC, `update public.contract_crew set paid = true, paid_at = now() where id = '${CREW2}';`);
ok(
  "kế toán VẪN đánh dấu được đã trả lương (Bảng lương ghi thẳng)",
  r.ok && sql(`select paid from public.contract_crew where id = '${CREW2}';`).out.endsWith("t"),
  r.out.slice(0, 200)
);
r = asStudio(ACC, `update public.contract_crew set salary = 99000000 where id = '${CREW2}';`);
ok("…nhưng KHÔNG sửa được tiền lương", !r.ok && /payroll_paid_only/.test(r.out), r.out.slice(0, 200));

// manager: toàn studio, trừ huỷ / hoàn tiền
ok("quản lý thấy toàn studio", seen(MGR) === seen(A), seen(MGR));
ok("quản lý ghi được lần thu", pay(MGR, C2).ok);
ok("quản lý KHÔNG ghi được khoản hoàn tiền", !pay(MGR, C2, "-100000, 'refund'").ok);
r = asStudio(MGR, `update public.studio_contracts set status = 'cancelled' where id = '${C2}';`);
ok("quản lý KHÔNG huỷ được hợp đồng", !r.ok && /contract_cancel_owner_only/.test(r.out));

// chủ studio: huỷ + hoàn tiền
ok("chủ studio ghi được khoản hoàn tiền", pay(A, C2, "-100000, 'refund'").ok);
r = asStudio(A, `update public.studio_contracts set status = 'cancelled' where id = '${C2}';`);
ok("chủ studio huỷ được hợp đồng", r.ok && sql(`select status from public.studio_contracts where id = '${C2}';`).out.endsWith("cancelled"), r.out.slice(0, 200));
r = asStudio(MGR, `update public.studio_contracts set title = 'HĐ C2 đã huỷ' where id = '${C2}';`);
ok("…và quản lý VẪN sửa được hợp đồng ĐÃ huỷ (chốt chỉ chặn lúc chuyển sang huỷ)", r.ok && titleOf(C2) === "HĐ C2 đã huỷ", r.out.slice(0, 200));

// initPlan: hàm "người gọi là ai" tính MỘT lần mỗi câu, không phải mỗi dòng.
{
  const plan = asStudio(STAFF, `explain (costs off) select * from public.contract_payments;`).out;
  const filters = plan.split("\n").filter((l) => /Filter:/.test(l)).join("\n");
  ok(
    "policy dùng dạng initPlan: hàm vai trò nằm trong InitPlan, không nằm trong Filter từng dòng",
    /InitPlan/.test(plan) && !/studio_scope_owner|studio_my_branch|is_admin\(\)/.test(filters),
    plan.slice(0, 1200)
  );
}

console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
