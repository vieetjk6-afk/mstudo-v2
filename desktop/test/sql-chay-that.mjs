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
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
let coPg = false;
// initdb có thể nằm trên PATH ("") hoặc ở /usr/lib/postgresql/<bản>/bin (Debian /
// Ubuntu, không trên PATH). Dò mọi bản có trên máy, mới nhất trước.
let banCo = [];
try {
  banCo = readdirSync("/usr/lib/postgresql")
    .filter((v) => /^\d+$/.test(v))
    .sort((a, b) => Number(b) - Number(a))
    .map((v) => `/usr/lib/postgresql/${v}/bin`);
} catch {
  /* không có thư mục này */
}
for (const c of ["", ...banCo]) {
  try {
    execSync(`${c ? join(c, "initdb") : "initdb"} --version`, { stdio: "ignore" });
    PGBIN = c;
    coPg = true;
    break;
  } catch {
    /* thử chỗ tiếp theo */
  }
}
// Trước đây: `!PGBIN && !existsSync("/usr/bin/initdb")` — initdb tìm thấy trên PATH
// (PGBIN = "") mà không nằm đúng /usr/bin thì bài vẫn tự BỎ QUA.
if (!coPg) skip("không có initdb/psql trên máy này.");

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

/* ── 2b. Phân quyền hợp đồng theo vai trò, trên CẢ HAI đường cài ────────────
 *
 * migrations/phan_quyen_vai_tro_hop_dong.sql thay policy mà schema.sql và các
 * migration trước đã tạo. Trên project mới, bộ sinh xếp khối do $$ vào PHẦN 2 và
 * `create policy` vào PHẦN 3 — nên một policy cũ còn sót là chuyện đã xảy ra thật
 * (rls_thanh_vien_hop_dong bị schema.sql ghi đè). Kiểm trên database thật xem
 * bản cuối cùng là bản nào. Hành vi từng vai trò: desktop/test/rls-luu-nguoi.mjs.
 */
console.log("\n— Phân quyền hợp đồng theo vai trò —");
const BANG_HD = [
  "studio_contracts", "contract_items", "contract_crew", "contract_edit_requests", "contract_payments",
  "contract_payment_plan", "contract_tasks", "contract_equipment", "contract_products",
  "contract_quote_options", "contract_client_proofs", "studio_crew",
];
const inList = (xs) => xs.map((t) => `'${t}'`).join(",");
for (const db of ["moi", ...(first ? ["cu"] : [])]) {
  const nhan = db === "moi" ? "project mới" : "project đang chạy";
  ok(
    `${nhan}: không còn policy cũ (…_owner_all / …_owner / …_owner_read) trên họ hợp đồng`,
    q(db, `select count(*) from pg_policies where schemaname='public' and tablename in (${inList([...BANG_HD, "contract_reschedules"])}) and policyname ~ '_owner(_all|_read)?$'`) === "0",
    q(db, `select string_agg(tablename || '.' || policyname, ', ') from pg_policies where schemaname='public' and tablename in (${inList([...BANG_HD, "contract_reschedules"])}) and policyname ~ '_owner(_all|_read)?$'`)
  );
  ok(
    `${nhan}: mỗi bảng có đủ policy đọc + ghi theo vai trò`,
    q(db, `select count(distinct tablename) from pg_policies where schemaname='public' and tablename in (${inList(BANG_HD)}) and policyname like '%\\_member\\_write'`) === String(BANG_HD.length) &&
      q(db, `select count(distinct tablename) from pg_policies where schemaname='public' and tablename in (${inList([...BANG_HD, "contract_reschedules", "contract_addenda"])}) and policyname like '%\\_member\\_read'`) === String(BANG_HD.length + 2)
  );
  ok(
    `${nhan}: policy mới gọi hàm vai trò dạng (select …) — initPlan, không phải từng dòng`,
    q(db, `select count(*) from pg_policies where schemaname='public' and tablename in (${inList(BANG_HD)}) and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'is_studio_member\\('`) === "0"
  );
  ok(
    `${nhan}: is_studio_member kiểm profiles.is_active`,
    /is_active/.test(q(db, "select pg_get_functiondef('public.is_studio_member(uuid)'::regprocedure)"))
  );
  ok(
    `${nhan}: trigger chỉ-chủ-studio-được-huỷ + kế-toán-chỉ-đánh-dấu-đã-trả`,
    q(db, "select count(*) from pg_trigger where tgname in ('guard_contract_cancel','guard_contract_crew_accountant') and not tgisinternal") === "2"
  );
}

/* ── 3. Gói riêng của tính năng khuôn mặt ─────────────────────────────────
 *
 * Đây là bài học phải trả giá bằng nhiều vòng: SQL Editor chạy cả file trong MỘT
 * transaction, nên `cap-nhat.sql` gộp 9 migration có nghĩa là một hàng rào của
 * tính năng KHÁC bật lên là cuốn theo cả tính năng này. Gói riêng phải cài được
 * trên một database CHỈ CÓ SCHEMA NỀN — không cần kế toán, không cần lịch hẹn,
 * không cần gì khác.
 */
console.log("\n— Gói riêng: khuon-mat.sql trên database chỉ có schema nền —");
newDb("nen");
runFile("nen", join(DIR, "shim.sql"));
{
  /*
   * Dựng nền bằng BỘ SINH, không dùng schema.sql thô.
   *
   * Trong file gốc, nhiều policy và `alter table … add column` đứng TRƯỚC bảng
   * (hoặc cột) mà chúng tham chiếu — chạy thẳng trên database trắng là lỗi. Đó
   * chính là lý do build-setup-all.mjs tồn tại: nó xếp lại theo ba nhịp. Bài
   * kiểm thử này đã trượt đúng vào đó một lần.
   */
  const g = join(SUPA, ".tmp-nen-test.mjs");
  const src2 = execSync(`cat ${join(SUPA, "build-setup-all.mjs")}`, { encoding: "utf8" });
  const cut2 = src2.indexOf("// ── Gói riêng từng tính năng");
  writeFileSync(
    g,
    src2
      .slice(0, cut2)
      .replace(
        'emit("setup-all.sql", ORDER, header);',
        'emit(".tmp-nen-test.sql", ORDER.filter(([rel]) => rel === "schema.sql"), header);'
      )
  );
  execSync(`node ${g}`, { stdio: "ignore" });
  rmSync(g);
  tries("dựng được database CHỈ có schema nền", () => runFile("nen", join(SUPA, ".tmp-nen-test.sql")));
  rmSync(join(SUPA, ".tmp-nen-test.sql"), { force: true });
}
/*
 * Dựng lại ĐÚNG tình huống thật đã xảy ra: database thiếu MỘT bảng nền mà một
 * migration KHÁC đòi hỏi. Ở đây bỏ `studio_appointments` (do
 * migrations/studio_appointments.sql tạo, không nằm trong schema.sql) — đúng
 * kiểu project chỉ chạy schema nền mà chưa chạy hết migration.
 */
ok(
  "database này KHÔNG có studio_appointments (bảng mà migration khác đòi)",
  q("nen", "select count(*) from information_schema.tables where table_schema='public' and table_name='studio_appointments'") === "0"
);
{
  // Chính vì thế cap-nhat.sql PHẢI gãy — và vì SQL Editor chạy cả file trong một
  // transaction nên nó cuốn theo cả tính năng khuôn mặt.
  let vo = false;
  try {
    runFile("nen", join(SUPA, "cap-nhat.sql"));
  } catch {
    vo = true;
  }
  ok("cap-nhat.sql gãy trên database đó (hàng rào của tính năng KHÁC bật)", vo);
  ok(
    "…và cuốn theo cả tính năng khuôn mặt: KHÔNG bảng nào được tạo",
    q("nen", "select count(*) from information_schema.tables where table_schema='public' and table_name in ('album_people','album_faces')") === "0"
  );
}
tries("nhưng khuon-mat.sql thì CÀI ĐƯỢC trên đúng database đó", () =>
  runFile("nen", join(SUPA, "khuon-mat.sql"))
);
tries("…chạy lại vẫn vô hại", () => runFile("nen", join(SUPA, "khuon-mat.sql")));
ok(
  "…và tạo đủ ba bảng của tính năng",
  q("nen", "select count(*) from information_schema.tables where table_schema='public' and table_name in ('album_people','album_photo_people','album_faces')") === "3"
);
ok(
  "…kèm cột đánh dấu đã quét trên photos",
  q("nen", "select count(*) from information_schema.columns where table_name='photos' and column_name='faces_scanned_at'") === "1"
);
// Hàng đợi gom nhóm của máy chủ. Thiếu cột này thì bộ quét ghi khuôn mặt xong
// mà không album nào được gom — khách thấy album trống trơn phần khuôn mặt,
// không có lỗi nào hiện ra ở đâu cả.
ok(
  "…và cột hàng đợi gom nhóm trên albums",
  q("nen", "select count(*) from information_schema.columns where table_name='albums' and column_name='faces_clustered_at'") === "1"
);

// Tự xác nhận chuyển khoản: MỌI đợt thanh toán phải tự có mã đợt, kể cả đợt do
// chỗ nào đó chèn mà không biết cột này (mẫu hợp đồng, báo giá chuyển thành HĐ…).
// Thiếu default là QR của đợt đó không có mã, và tiền về lại phải dò tay.
ok(
  "Đợt thanh toán tự có mã đợt (default gen_pay_code)",
  /gen_pay_code/.test(q("moi", "select column_default from information_schema.columns where table_name='contract_payment_plan' and column_name='pay_code'"))
);
ok(
  "…và mã sinh ra đúng dạng MS + 8 ký tự không dễ nhầm",
  q("moi", "select public.gen_pay_code() ~ '^MS[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$'") === "t"
);

// Studio gỡ "Đã thu" ở màn hợp đồng (xoá contract_payments) → giao dịch SePay
// đã ghi vào khoản đó phải quay về hàng chờ, không được mãi "Đã tự ghi thu".
// Dựng dữ liệu với session_replication_role = replica để bỏ qua khoá ngoại
// (database test không có auth.users thật). Phải là lượt psql RIÊNG với lượt
// xoá: Postgres kiểm lại khoá ngoại khi cập nhật dòng chèn trong CÙNG giao dịch.
q(
  "moi",
  "set session_replication_role = replica; " +
    "insert into public.studio_bank_transactions (id, owner_id, provider_txn_id, status, payment_id, contract_id) values " +
    "('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'test-go-thu', 'matched', " +
    "'00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1'); " +
    "insert into public.contract_payments (id, contract_id, amount) values " +
    "('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 5000000)"
);
ok(
  "Gỡ khoản thu → giao dịch ngân hàng về lại 'chưa rõ của ai'",
  // psql in cả thẻ "DELETE 1" trước kết quả select → chỉ lấy dòng cuối.
  q(
    "moi",
    "delete from public.contract_payments where id = '00000000-0000-0000-0000-0000000000b1'; " +
      "select status || '/' || coalesce(note, '') || '/' || coalesce(payment_id::text, 'null') || '/' || coalesce(contract_id::text, 'null') " +
      "from public.studio_bank_transactions where id = '00000000-0000-0000-0000-0000000000a1'"
  ).split("\n").pop() === "unmatched/unlinked/null/null"
);

// Huỷ hợp đồng ghi khoản hoàn là một lần thu kind='refund', số ÂM. Ràng buộc
// kind cũ (4 giá trị) mà còn thì mọi lần huỷ có hoàn tiền đều hỏng ở máy chủ.
ok(
  "Lần thu nhận loại 'refund' (hoàn tiền khi huỷ hợp đồng)",
  q(
    "moi",
    "set session_replication_role = replica; " +
      "insert into public.contract_payments (contract_id, amount, kind) values " +
      "('00000000-0000-0000-0000-0000000000c2', -2500000, 'refund') returning kind"
  ).split("\n").includes("refund")
);
ok(
  "…và bảng lịch sử dời lịch có sẵn",
  q("moi", "select count(*) from information_schema.tables where table_name = 'contract_reschedules'") === "1"
);


// ── Vòng 2: khoá giá sau ký · phụ lục · nhật ký thao tác · voucher ──────────
// Các trigger này chỉ chạy khi CÓ người dùng (auth.uid() khác null) — lời gọi
// từ máy chủ (service role) được đi qua. Shim ở trên luôn trả null, nên ở đây
// đổi nó sang đọc biến phiên `test.uid` để đóng vai "người dùng đang đăng nhập".
// Thân hàm để trong nháy đơn: q() đưa SQL qua shell trong nháy kép, `$q$` sẽ bị
// shell nuốt mất.
const P = "00000000-0000-0000-0000-00000000aa01";
const SIGNED = "00000000-0000-0000-0000-00000000cc01";
const OPEN = "00000000-0000-0000-0000-00000000cc02";
const AS_USER = `set test.uid = '${P}'; `;
q(
  "moi",
  "create or replace function auth.uid() returns uuid language sql stable as " +
    "'select nullif(current_setting(''test.uid'', true), '''')::uuid'"
);
q(
  "moi",
  "set session_replication_role = replica; " +
    `insert into public.profiles (id, email) values ('${P}', 'chu@studio.test') on conflict do nothing; ` +
    `insert into public.studio_contracts (id, owner_id, title, client_token, client_signed_at) values ('${SIGNED}', '${P}', 'HĐ đã ký', 'tok-da-ky', now()); ` +
    `insert into public.studio_contracts (id, owner_id, title, client_token) values ('${OPEN}', '${P}', 'HĐ chưa ký', 'tok-chua-ky'); ` +
    `insert into public.contract_items (contract_id, name, qty, unit_price, position) values ('${SIGNED}', 'Gói cưới', 1, 20000000, 0)`
);
const threw = (sql) => {
  try {
    q("moi", sql);
    return "";
  } catch (e) {
    return String(e.stderr || e);
  }
};
ok(
  "Hợp đồng ĐÃ KÝ: người dùng không chèn thêm hạng mục gốc được",
  threw(AS_USER + `insert into public.contract_items (contract_id, name, qty, unit_price, position) values ('${SIGNED}', 'Lén thêm', 1, 1, 1)`).includes("contract_signed_locked")
);
ok(
  "…không xoá được hạng mục gốc",
  threw(AS_USER + `delete from public.contract_items where contract_id = '${SIGNED}'`).includes("contract_signed_locked")
);
ok(
  "…không sửa giá được",
  threw(AS_USER + `update public.contract_items set unit_price = 1 where contract_id = '${SIGNED}'`).includes("contract_signed_locked")
);
ok(
  "Hợp đồng CHƯA ký: người dùng vẫn lưu hạng mục như cũ",
  threw(AS_USER + `insert into public.contract_items (contract_id, name, qty, unit_price, position) values ('${OPEN}', 'Album', 2, 1500000, 0)`) === ""
);
ok(
  "…và lần lưu đó vào nhật ký, MỘT dòng cho cả câu lệnh, kèm người thao tác",
  q("moi", `select count(*) || '/' || max(actor_id::text) || '/' || max(summary) from public.studio_audit_log where contract_id = '${OPEN}' and action = 'items.save'`) ===
    `1/${P}/Lưu 1 hạng mục · tổng 3.000.000đ`
);
// Máy chủ chép phụ lục đã ký thành hạng mục (auth.uid() null → đi qua hàng rào).
q(
  "moi",
  `insert into public.contract_addenda (id, contract_id, owner_id, no, lines, signed_at, signed_by, signed_name) values ` +
    `('00000000-0000-0000-0000-00000000ad01', '${SIGNED}', '${P}', 1, '[]', now(), 'client', 'Lan'); ` +
    `insert into public.contract_items (contract_id, addendum_id, name, qty, unit_price, position) values ` +
    `('${SIGNED}', '00000000-0000-0000-0000-00000000ad01', 'Thêm album', 1, 2500000, 5)`
);
ok(
  "Máy chủ chép được dòng phụ lục vào hợp đồng đã ký",
  q("moi", `select count(*) from public.contract_items where contract_id = '${SIGNED}' and addendum_id is not null`) === "1"
);
ok(
  "…còn người dùng thì không xoá được dòng phụ lục đã ký",
  threw(AS_USER + `delete from public.contract_items where addendum_id is not null`).includes("contract_signed_locked")
);
ok(
  "…và máy chủ không ghi dòng nhật ký trùng (trigger bỏ qua khi không có người dùng)",
  q("moi", `select count(*) from public.studio_audit_log where contract_id = '${SIGNED}'`) === "0"
);
// Nhật ký tiền: xoá khoản thu phải để lại dấu, kể cả khi dòng đã biến mất.
q("moi", AS_USER + `insert into public.contract_payments (id, contract_id, amount, kind) values ('00000000-0000-0000-0000-00000000bb01', '${OPEN}', 5000000, 'deposit')`);
q("moi", AS_USER + `delete from public.contract_payments where id = '00000000-0000-0000-0000-00000000bb01'`);
ok(
  "Ghi rồi xoá khoản thu → nhật ký có đủ hai dòng",
  q("moi", `select string_agg(action, ',' order by id) from public.studio_audit_log where entity = 'payment'`) === "payment.insert,payment.delete"
);
ok(
  "…người dùng không sửa / xoá được nhật ký (không có policy ghi)",
  q("moi", "select count(*) from pg_policies where tablename = 'studio_audit_log' and cmd <> 'SELECT'") === "0"
);
// Voucher: xoá khoản thu voucher → thẻ quay về còn hiệu lực.
q(
  "moi",
  `insert into public.contract_payments (id, contract_id, amount, kind) values ('00000000-0000-0000-0000-00000000bb02', '${OPEN}', 2000000, 'voucher'); ` +
    `insert into public.studio_vouchers (owner_id, code, amount, paid, status, redeemed_contract_id, redeemed_payment_id, redeemed_at) values ` +
    `('${P}', 'QUA-TEST22', 2000000, true, 'redeemed', '${OPEN}', '00000000-0000-0000-0000-00000000bb02', now())`
);
ok(
  "Xoá khoản thu voucher → thẻ về lại 'còn hiệu lực'",
  q(
    "moi",
    "delete from public.contract_payments where id = '00000000-0000-0000-0000-00000000bb02'; " +
      "select status || '/' || coalesce(redeemed_payment_id::text, 'null') from public.studio_vouchers where code = 'QUA-TEST22'"
  ).split("\n").pop() === "active/null"
);

// Chương trình voucher: hợp đồng huỷ → voucher ưu đãi CHƯA DÙNG tự huỷ; voucher
// đã dùng thì giữ nguyên. Mỗi hợp đồng chỉ phát được MỘT voucher chương trình.
q(
  "moi",
  `insert into public.studio_vouchers (owner_id, code, kind, amount, paid, status, source_contract_id, program_issued) values ` +
    `('${P}', 'UD-TEST01', 'loyalty', 1000000, true, 'active', '${OPEN}', true)`
);
ok(
  "Voucher chương trình: không phát được cái thứ hai cho cùng hợp đồng",
  threw(
    `insert into public.studio_vouchers (owner_id, code, kind, amount, paid, status, source_contract_id, program_issued) values ` +
      `('${P}', 'UD-TEST02', 'loyalty', 1000000, true, 'active', '${OPEN}', true)`
  ) !== ""
);
ok(
  "Huỷ hợp đồng → voucher ưu đãi chưa dùng tự huỷ",
  q("moi", `update public.studio_contracts set status = 'cancelled' where id = '${OPEN}'; select status from public.studio_vouchers where code = 'UD-TEST01'`)
    .split("\n").pop() === "void"
);

// Xoá hẳn một hợp đồng ĐÃ KÝ có phụ lục (studio xoá HĐ đã huỷ): hạng mục và dòng
// phụ lục bị xoá dây chuyền — hàng rào khoá giá KHÔNG được chặn việc đó.
ok(
  "Người dùng xoá được hợp đồng đã ký có phụ lục (xoá dây chuyền không bị khoá)",
  threw(AS_USER + `delete from public.studio_contracts where id = '${SIGNED}'`) === ""
);
ok(
  "…và việc xoá hợp đồng vào nhật ký",
  q("moi", `select count(*) from public.studio_audit_log where contract_id = '${SIGNED}' and action = 'contract.delete'`) === "1"
);

// ── Lưu lựa chọn ảnh theo phần chênh (save_album_selection) ────────────────
// Trang khách gửi lại TOÀN BỘ danh sách mỗi lần bấm. Hàm phải: thêm ảnh mới,
// xoá ảnh đã bỏ, bỏ qua ảnh của album khác, và KHÔNG ghi lại dòng không đổi
// (mỗi lượt ghi thừa là một sự kiện Realtime dội vào màn studio).
console.log("\n— Lưu lựa chọn ảnh theo phần chênh —");
{
  const A = "00000000-0000-0000-0000-0000000a1b01";
  const B = "00000000-0000-0000-0000-0000000a1b02";
  const ph = (n) => `00000000-0000-0000-0000-0000000f0${String(n).padStart(3, "0")}`;
  const PX = ph(99); // ảnh của album KHÁC
  q(
    "moi",
    "set session_replication_role = replica; " +
      `insert into public.albums (id, owner_id, slug, title, status) values ` +
      `('${A}', '${P}', 'chon-anh-a', 'A', 'published'), ('${B}', '${P}', 'chon-anh-b', 'B', 'published'); ` +
      `insert into public.photos (id, album_id, drive_file_id, name) values ` +
      [1, 2, 3, 4].map((n) => `('${ph(n)}', '${A}', 'f${n}', 'IMG_${n}.jpg')`).join(", ") +
      `, ('${PX}', '${B}', 'fx', 'IMG_X.jpg')`
  );
  const arr = (ids) => (ids ? `array[${ids.map((i) => `'${ph(i)}'`).join(",")}]::uuid[]` : "null");
  const save = (sess, picks, dislikes, notes = "{}", name = "Lan") =>
    q(
      "moi",
      `select pick_count || '/' || dislike_count from public.save_album_selection(` +
        `'${A}', '${sess}', '${name}', ${arr(picks)}, '${notes}'::jsonb, ${arr(dislikes)})`
    );
  const picks = (sess, table = "selections") =>
    q("moi", `select coalesce(string_agg(photo_name, ',' order by photo_name), '') from public.${table} where album_id = '${A}' and session_id = '${sess}'`);
  const xmin = (sess, n) =>
    q("moi", `select xmin::text from public.selections where session_id = '${sess}' and photo_id = '${ph(n)}'`);

  ok("Lần lưu đầu: thêm 2 ảnh chọn + 1 ảnh không thích", save("s1", [1, 2], [3], '{"' + ph(1) + '": "đẹp"}') === "2/1");
  ok("…đúng hai dòng chọn, kèm tên ảnh", picks("s1") === "IMG_1.jpg,IMG_2.jpg");
  ok("…ghi chú của khách được lưu", q("moi", `select client_note from public.selections where session_id = 's1' and photo_id = '${ph(1)}'`) === "đẹp");
  ok("…và ảnh không thích nằm ở bảng riêng", picks("s1", "dislikes") === "IMG_3.jpg");
  const x1 = xmin("s1", 1);

  // Bỏ ảnh 2, thêm ảnh 4, kèm một id của album khác (phải bị bỏ qua).
  ok(
    "Bấm tiếp: bỏ 1 ảnh, thêm 1 ảnh, id album khác bị bỏ qua",
    q(
      "moi",
      `select pick_count || '/' || dislike_count from public.save_album_selection(` +
        `'${A}', 's1', 'Lan', array['${ph(1)}','${ph(4)}','${PX}']::uuid[], '{"${ph(1)}": "đẹp"}'::jsonb, '{}'::uuid[])`
    ) === "2/0"
  );
  ok("…danh sách còn đúng ảnh 1 và 4", picks("s1") === "IMG_1.jpg,IMG_4.jpg");
  ok("…không ghi ảnh của album khác", q("moi", `select count(*) from public.selections where photo_id = '${PX}'`) === "0");
  ok("…mảng không thích rỗng → xoá ảnh không thích cũ", picks("s1", "dislikes") === "");
  ok("…dòng KHÔNG đổi gì thì không bị ghi lại (không có sự kiện Realtime thừa)", xmin("s1", 1) === x1);

  save("s1", [1, 4], null, '{"' + ph(1) + '": "in to"}');
  ok("Sửa ghi chú → chỉ dòng đó được cập nhật", q("moi", `select client_note from public.selections where session_id = 's1' and photo_id = '${ph(1)}'`) === "in to" && xmin("s1", 1) !== x1);

  save("s2", [2], [3]);
  save("s2", [2], null); // client cũ không gửi dislikedIds
  ok("Client cũ không gửi danh sách không thích → không đụng bảng dislikes", picks("s2", "dislikes") === "IMG_3.jpg");
  ok("…và phiên khác không ảnh hưởng phiên s1", picks("s1") === "IMG_1.jpg,IMG_4.jpg");
  ok("Bỏ hết ảnh → phiên không còn dòng nào", save("s1", [], null) === "0/0" && picks("s1") === "");
  ok(
    "Chỉ service_role gọi được hàm (anon / authenticated thì không)",
    q(
      "moi",
      "select has_function_privilege('anon', 'public.save_album_selection(uuid, text, text, uuid[], jsonb, uuid[])', 'execute')::text || '/' || " +
        "has_function_privilege('authenticated', 'public.save_album_selection(uuid, text, text, uuid[], jsonb, uuid[])', 'execute')::text || '/' || " +
        "has_function_privilege('service_role', 'public.save_album_selection(uuid, text, text, uuid[], jsonb, uuid[])', 'execute')::text"
    ) === "false/false/true"
  );
}
if (first) {
  ok(
    "cap-nhat.sql cũng tạo hàm save_album_selection cho project đang chạy",
    q("cu", "select count(*) from pg_proc where proname = 'save_album_selection'") === "1"
  );
}

// ── Giới hạn tần suất bền không cần Upstash (rate_limit_hit) ─────────────
// Bộ đếm chống dò mật khẩu album / SĐT hợp đồng khi chưa có Upstash — phải
// đếm đúng, bắt đầu lại khi hết cửa sổ, và chỉ service_role gọi được.
{
  const hit = (k, win = 60) => q("moi", `select public.rate_limit_hit('${k}', ${win})`);
  ok("rate_limit_hit: lượt đầu = 1, lượt sau cộng dồn", hit("k1") === "1" && hit("k1") === "2" && hit("k1") === "3");
  ok("…khoá khác đếm riêng", hit("k2") === "1");
  q("moi", "update public.rate_limit_hits set window_start = now() - interval '2 minutes' where key = 'k1'");
  ok("…hết cửa sổ thì đếm lại từ 1", hit("k1") === "1" && hit("k1") === "2");
  q("moi", "insert into public.rate_limit_hits (key, window_start, hits) values ('cu', now() - interval '3 days', 9)");
  let don = false;
  for (let i = 0; i < 400 && !don; i++) {
    hit(`dọn${i}`);
    don = q("moi", "select count(*) from public.rate_limit_hits where key = 'cu'") === "0";
  }
  ok("…dòng cũ hơn 1 ngày được dọn dần, không cần cron", don);
  ok(
    "…chỉ service_role gọi được hàm (anon / authenticated thì không)",
    q(
      "moi",
      "select has_function_privilege('anon', 'public.rate_limit_hit(text, int)', 'execute')::text || '/' || " +
        "has_function_privilege('authenticated', 'public.rate_limit_hit(text, int)', 'execute')::text || '/' || " +
        "has_function_privilege('service_role', 'public.rate_limit_hit(text, int)', 'execute')::text"
    ) === "false/false/true"
  );
  ok(
    "…anon / authenticated không đọc được bảng đếm",
    q("moi", "select has_table_privilege('anon', 'public.rate_limit_hits', 'select')::text || '/' || has_table_privilege('authenticated', 'public.rate_limit_hits', 'select')::text") === "false/false"
  );
}

// ── Dùng thử & hết hạn gói (dung_thu_va_het_han.sql) ──────────────────────
// Tài khoản ĐÃ MUA gói (kể cả đã hết hạn, đã bị hạ về free) không dùng thử được
// nữa; dùng thử hết hạn bị cron hạ về free; hạn mức album coi gói hết hạn là free.
{
  const MUA = "00000000-0000-0000-0000-00000000bb01";
  const MOI = "00000000-0000-0000-0000-00000000bb02";
  const HET = "00000000-0000-0000-0000-00000000bb03";
  q(
    "moi",
    "set session_replication_role = replica; " +
      `insert into auth.users (id, email) values ('${MUA}', 'mua@test'), ('${MOI}', 'moi@test'), ('${HET}', 'het@test') on conflict do nothing; ` +
      `insert into public.profiles (id, email) values ('${MUA}', 'mua@test'), ('${MOI}', 'moi@test'), ('${HET}', 'het@test') on conflict do nothing`
  );
  const trial = (id) =>
    q("moi", `select public.start_free_trial('${id}', now() + interval '7 days', 'studio', null, true, true, true, true)`);

  // Mua gói tháng (trigger tự ghi paid_plan_at), rồi hết hạn và bị hạ về free.
  q("moi", `update public.profiles set plan = 'basic', plan_cycle = 'month', plan_expires_at = now() + interval '30 days' where id = '${MUA}'`);
  ok("Gán gói tháng → paid_plan_at được ghi tự động", q("moi", `select (paid_plan_at is not null)::text from public.profiles where id = '${MUA}'`) === "true");
  q("moi", `update public.profiles set plan_expires_at = now() - interval '1 day' where id = '${MUA}'`);
  q("moi", "select public.downgrade_expired_plans()");
  ok(
    "…hết hạn → cron hạ về free",
    q("moi", `select plan || '/' || coalesce(plan_cycle, '-') || '/' || coalesce(plan_expires_at::text, '-') from public.profiles where id = '${MUA}'`) === "free/-/-"
  );
  ok("…đã từng mua gói thì KHÔNG dùng thử được nữa", trial(MUA) === "already_paid");
  ok("Tài khoản chưa mua gói → dùng thử được", trial(MOI) === "ok");
  ok("…và chỉ một lần", trial(MOI) === "already_used");
  ok("Dùng thử không bị tính là đã mua gói", q("moi", `select (paid_plan_at is null)::text from public.profiles where id = '${MOI}'`) === "true");

  // Dùng thử hết hạn → hạ về free, cột quyền cũ về giá trị gói free.
  q("moi", `update public.profiles set plan_expires_at = now() - interval '1 minute' where id = '${MOI}'`);
  ok(
    "Dùng thử hết hạn → enforce_album_quota coi là free (chặn album giao khách)",
    threw(`set test.uid = '${MOI}'; insert into public.albums (owner_id, title, is_gallery) values ('${MOI}', 'Giao khách', true)`).includes("gallery")
  );
  q("moi", "select public.downgrade_expired_plans()");
  ok(
    "…cron hạ dùng thử hết hạn về free, đánh dấu trial_expired cho băng thông báo",
    q(
      "moi",
      `select plan || '/' || plan_cycle || '/' || monthly_album_limit || '/' || can_zip || '/' || can_galleries from public.profiles where id = '${MOI}'`
    ) === "free/trial_expired/5/false/false"
  );

  // Gói còn hạn không bị đụng tới.
  q("moi", `update public.profiles set plan = 'studio', plan_cycle = 'year', plan_expires_at = now() + interval '1 year' where id = '${HET}'`);
  q("moi", "select public.downgrade_expired_plans()");
  ok("Gói còn hạn KHÔNG bị hạ", q("moi", `select plan from public.profiles where id = '${HET}'`) === "studio");
  ok(
    "downgrade_expired_plans chỉ service_role gọi được",
    q(
      "moi",
      "select has_function_privilege('authenticated', 'public.downgrade_expired_plans()', 'execute')::text || '/' || " +
        "has_function_privilege('service_role', 'public.downgrade_expired_plans()', 'execute')::text"
    ) === "false/true"
  );
}

// ── Số phiên bản dữ liệu cho desktop (phien_ban_du_lieu_desktop.sql) ───────
// Desktop trả 304 mà không đọc bảng nào khi số này không đổi — nên trigger phải
// tăng ở MỌI thay đổi desktop thấy được, và KHÔNG tăng ở cột album desktop không đọc.
{
  const CHU = "00000000-0000-0000-0000-00000000dd01";
  const so = () => q("moi", `select coalesce((select version from public.studio_data_version where owner_id = '${CHU}'), 0)::text`);
  q(
    "moi",
    "set session_replication_role = replica; " +
      `insert into auth.users (id, email) values ('${CHU}', 'pb@test') on conflict do nothing; ` +
      `insert into public.profiles (id, email) values ('${CHU}', 'pb@test') on conflict do nothing; ` +
      `insert into public.albums (id, owner_id, slug, title) values ('00000000-0000-0000-0000-00000000dd0a', '${CHU}', 'pb-album', 'A') on conflict do nothing`
  );
  const s0 = Number(so());
  q("moi", `insert into public.studio_contracts (id, owner_id, client_token) values ('00000000-0000-0000-0000-00000000dd02', '${CHU}', 'pb-tok')`);
  const s1 = Number(so());
  ok("Thêm hợp đồng → tăng số phiên bản", s1 === s0 + 1, `${s0} → ${s1}`);
  q("moi", `insert into public.contract_items (contract_id) values ('00000000-0000-0000-0000-00000000dd02')`);
  const s2 = Number(so());
  // > chứ không === +1: trigger touch_contract (hop_dong_cap_nhat_theo_con.sql)
  // còn chạm updated_at của hợp đồng cha → tăng thêm một lần. Desktop chỉ cần biết "đã đổi".
  ok("Thêm hạng mục hợp đồng (bảng con, tra chủ qua contract_id) → tăng", s2 > s1, `${s1} → ${s2}`);
  q("moi", `insert into public.studio_quotes (id, owner_id, client_token) values ('00000000-0000-0000-0000-00000000dd03', '${CHU}', 'pb-q')`);
  q("moi", `insert into public.quote_items (quote_id) values ('00000000-0000-0000-0000-00000000dd03')`);
  const s3 = Number(so());
  ok("Báo giá + dòng báo giá (tra chủ qua quote_id) → tăng 2", s3 === s2 + 2, `${s2} → ${s3}`);
  q("moi", `update public.albums set title = 'B' where id = '00000000-0000-0000-0000-00000000dd0a'`);
  ok("Sửa cột album desktop KHÔNG đọc → không tăng", Number(so()) === s3);
  q("moi", `update public.albums set phase = 'delivery' where id = '00000000-0000-0000-0000-00000000dd0a'`);
  const s4 = Number(so());
  ok("Đổi giai đoạn album → tăng", s4 === s3 + 1, `${s3} → ${s4}`);
  q("moi", `delete from public.studio_contracts where id = '00000000-0000-0000-0000-00000000dd02'`);
  ok("Xoá hợp đồng (kéo theo hạng mục) → tăng, không lỗi", Number(so()) > s4);
  // RLS bật, không policy: kể cả khi Supabase cấp quyền bảng mặc định cho
  // anon / authenticated, họ vẫn đọc ra 0 dòng — chỉ service-role đọc được.
  ok(
    "…bật RLS, không policy (chỉ service-role đọc)",
    q("moi", "select relrowsecurity::text || '/' || (select count(*) from pg_policies where tablename = 'studio_data_version')::text from pg_class where oid = 'public.studio_data_version'::regclass") === "true/0"
  );
}

/* ── Rà soát 11/2026: mã không trùng + chặn tự sửa tên miền ─────────────── */
console.log("\n— Mã hợp đồng / báo giá không trùng —");
{
  const O = "00000000-0000-0000-0000-0000000ee001";
  // Đổi kết quả auth.role() của shim. Thân hàm trong nháy đơn (không dùng $q$:
  // lệnh đi qua bash, `$q` bị shell nuốt mất).
  const vaiTro = (r) => q("moi", `create or replace function auth.role() returns text language sql stable as 'select ''${r}''::text'`);
  q("moi",
    `insert into auth.users (id, email) values ('${O}', 'ma@test') on conflict do nothing; ` +
    `insert into public.profiles (id, email) values ('${O}', 'ma@test') on conflict do nothing; ` +
    `insert into public.studio_contracts (owner_id, title, code, client_token) values ` +
    `('${O}', 'a', 'HD-11-2026-001', 'ma-1'), ('${O}', 'c', 'HD-11-2026-003', 'ma-3')`);
  // Shim cho auth.role() = 'anon'; giả làm máy chủ (service role) để gọi hàm.
  vaiTro("service_role");
  const next = (pre, kind) => Number(q("moi", `select public.next_studio_code('${O}', '${pre}', '${kind}')`));
  const n1 = next("HD-11-2026-", "contract");
  const n2 = next("HD-11-2026-", "contract");
  ok("Đã có 001 và 003 (002 bị xoá) → số kế là 4, không phải 3", n1 === 4, `nhận ${n1}`);
  ok("Gọi lần nữa → 5 (giữ số nguyên tử, không cấp trùng)", n2 === 5, `nhận ${n2}`);
  ok("Báo giá đếm riêng, bắt đầu từ 1", next("BG-11-2026-", "quote") === 1);
  vaiTro("anon");
  let blocked = false;
  try { next("HD-11-2026-", "contract"); } catch { blocked = true; }
  ok("Người ngoài studio gọi hàm → bị từ chối", blocked);

  console.log("\n— Sửa bảng con → hợp đồng cha đổi updated_at —");
  q("moi", `update public.studio_contracts set updated_at = '2020-01-01' where owner_id = '${O}' and code = 'HD-11-2026-001'`);
  const cid = q("moi", `select id from public.studio_contracts where owner_id = '${O}' and code = 'HD-11-2026-001'`);
  q("moi", `insert into public.contract_items (contract_id, name, qty, unit_price) values ('${cid}', 'x', 1, 100), ('${cid}', 'y', 1, 200)`);
  ok("Thêm hạng mục → updated_at của hợp đồng nhảy về hiện tại",
    q("moi", `select updated_at > now() - interval '1 minute' from public.studio_contracts where id = '${cid}'`) === "t");
  q("moi", `update public.studio_contracts set updated_at = '2020-01-01' where id = '${cid}'`);
  q("moi", `delete from public.contract_items where contract_id = '${cid}'`);
  ok("Xoá hạng mục cũng vậy",
    q("moi", `select updated_at > now() - interval '1 minute' from public.studio_contracts where id = '${cid}'`) === "t");

  console.log("\n— Chặn tự sửa tên miền website qua REST —");
  vaiTro("service_role"); // dựng dữ liệu mẫu như route máy chủ
  q("moi", `insert into public.sites (owner_id, subdomain) values ('${O}', 'ten-cu')`);
  vaiTro("authenticated");
  q("moi", `update public.sites set subdomain = 'login', custom_domain_verified = true where owner_id = '${O}'`);
  ok("Tài khoản thường KHÔNG đổi được subdomain / tự xác minh tên miền",
    q("moi", `select subdomain || '/' || custom_domain_verified from public.sites where owner_id = '${O}'`) === "ten-cu/false");
  const O2 = "00000000-0000-0000-0000-0000000ee002";
  q("moi",
    `insert into auth.users (id, email) values ('${O2}', 'ma2@test') on conflict do nothing; ` +
    `insert into public.profiles (id, email) values ('${O2}', 'ma2@test') on conflict do nothing; ` +
    `insert into public.sites (owner_id, subdomain) values ('${O2}', 'login')`);
  ok("Tài khoản thường tạo site kèm subdomain → subdomain bị bỏ",
    q("moi", `select coalesce(subdomain, 'null') from public.sites where owner_id = '${O2}'`) === "null");
  vaiTro("service_role");
  q("moi", `update public.sites set subdomain = 'ten-moi' where owner_id = '${O}'`);
  ok("Máy chủ (service role) vẫn đổi được",
    q("moi", `select subdomain from public.sites where owner_id = '${O}'`) === "ten-moi");
  vaiTro("anon");
}

console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
