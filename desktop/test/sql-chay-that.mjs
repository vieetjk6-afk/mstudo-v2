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

console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
