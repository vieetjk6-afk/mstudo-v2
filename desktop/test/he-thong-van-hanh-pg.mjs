/* Chạy THẬT supabase/migrations/he_thong_van_hanh.sql trên Postgres tạm.
 *
 * Vì sao: bảng nhật ký vận hành chỉ có ích khi (1) SQL chạy được và chạy LẠI
 * được, (2) log_system_error cộng dồn đúng và báo "mới" đúng — sai là admin bị
 * nhắc mỗi lượt hoặc không bao giờ được nhắc, (3) dọn không xoá mất dòng mà
 * scripts/chay-sql.mjs cần, (4) người ngoài (anon / tài khoản đăng nhập) không
 * đọc được nhật ký lỗi và không gọi được hàm.
 *
 * Chạy: node desktop/test/he-thong-van-hanh-pg.mjs
 */
import { dungPostgres } from "./pg-tam.mjs";

const pg = dungPostgres({ port: "5462" });
if (!pg.ok) {
  console.log(`⏭  BỎ QUA: ${pg.lyDo}`);
  process.exit(0);
}

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `\n    ${String(note).slice(0, 600)}`}`);
};
const DB = "vanhanh";
const MIG = pg.supa("migrations/he_thong_van_hanh.sql");

try {
  pg.newDb(DB);
  pg.runFile(DB, pg.supa("setup-all.sql"));
  pg.runFile(DB, MIG);
  pg.runFile(DB, MIG);
  ok("migration chạy được sau setup-all.sql và chạy LẠI được", true);
} catch (e) {
  ok("migration chạy được sau setup-all.sql và chạy LẠI được", false, e.message);
  process.exit(1);
}
const j = (s) => JSON.parse(s);

/* ── system_runs đúng khuôn mà scripts/chay-sql.mjs ghi vào ──────────────── */
const cols = pg.q(DB, "select string_agg(column_name || ':' || data_type, ',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='system_runs'");
ok("system_runs đúng 7 cột như đã hẹn", cols === "id:bigint,kind:text,name:text,ok:boolean,detail:jsonb,duration_ms:integer,started_at:timestamp with time zone", cols);
const ins = pg.sql(DB, "insert into public.system_runs (kind, name, ok, detail, duration_ms) values ('sql', 'cap-nhat.sql', true, jsonb_build_object('sha256', 'abc', 'git_sha', ''), 12);");
ok("chủ bảng (postgres — scripts/chay-sql.mjs) ghi được dù bật RLS", ins.ok, ins.out);

/* ── log_system_error ────────────────────────────────────────────────────── */
const log = (sig, extra = "") => j(pg.q(DB, `select public.log_system_error('${sig}', 'server', 'x is undefined', '/api/a?token=bi-mat', '{"method":"GET"}'::jsonb${extra})`));
const a1 = log("sig-a");
const a2 = log("sig-a");
const a3 = log("sig-a");
ok("lần đầu: count 1, is_new true", a1.count === 1 && a1.is_new === true, JSON.stringify(a1));
ok("lặp lại trong ngày: cộng dồn, không còn 'mới'", a2.count === 2 && a3.count === 3 && a2.is_new === false && a3.is_new === false);
ok("một dòng cho mỗi (chữ ký, ngày); query string bị bỏ", pg.q(DB, "select count(*) || '|' || max(count) || '|' || max(path) from public.system_errors where signature='sig-a'") === "1|3|/api/a");
// Giả hôm qua đã gặp → hôm nay không "mới"; gặp từ 10 ngày trước → "mới" lại.
pg.q(DB, "insert into public.system_errors (signature, day, source, message) values ('sig-b', (now() at time zone 'utc')::date - 1, 'server', 'm'), ('sig-c', (now() at time zone 'utc')::date - 10, 'server', 'm')");
const b = log("sig-b");
const c = log("sig-c");
ok("hôm qua đã gặp → hôm nay count 1 nhưng KHÔNG mới", b.count === 1 && b.is_new === false, JSON.stringify(b));
ok("lần gần nhất cách 10 ngày (> 7) → mới lại", c.count === 1 && c.is_new === true, JSON.stringify(c));
const cl = j(pg.q(DB, "select public.log_system_error('sig-d', 'la', repeat('y', 5000), repeat('/p', 400), null)"));
ok("nguồn lạ → 'server'; thông báo và đường dẫn bị cắt ngay trong hàm", cl.is_new && pg.q(DB, "select source || '|' || length(message) || '|' || length(path) from public.system_errors where signature='sig-d'") === "server|500|300");
ok("chữ ký rỗng → không ghi", j(pg.q(DB, "select public.log_system_error('', 'server', 'm')")).count === 0);

/* ── system_run_state ────────────────────────────────────────────────────── */
pg.q(DB, `insert into public.system_runs (kind, name, ok, detail, duration_ms, started_at) values
  ('cron', 'reminders', true,  '{"sent":3}', 900, now() - interval '3 days'),
  ('cron', 'reminders', false, '{"error":"Resend 500"}', 400, now() - interval '1 hour'),
  ('cron', 'backup',    true,  '{"rows":10}', 2000, now() - interval '5 hours')`);
const st = j(pg.q(DB, "select public.system_run_state()"));
const rem = st.runs.find((r) => r.kind === "cron" && r.name === "reminders");
ok("system_run_state: lượt GẦN NHẤT của từng việc + mốc tốt gần nhất", st.runs.length === 3 && rem.ok === false && rem.detail.error === "Resend 500" && rem.last_ok_at && Date.parse(rem.last_ok_at) < Date.parse(rem.started_at), JSON.stringify(st).slice(0, 400));
ok("…có mốc lượt cron đầu tiên và cả dòng 'sql'", !!st.first_run_at && st.runs.some((r) => r.kind === "sql" && r.detail.sha256 === "abc"));

/* ── system_stats ────────────────────────────────────────────────────────── */
pg.q(DB, "insert into storage.buckets (id, name) values ('wedding-photos', 'wedding-photos'), ('rong', 'rong') on conflict do nothing");
pg.q(DB, `insert into storage.objects (bucket_id, name, metadata) values
  ('wedding-photos', 'a.jpg', '{"size": 1000}'), ('wedding-photos', 'b.jpg', '{"size": 2500}'), ('wedding-photos', 'thu-muc', null)`);
const s = j(pg.q(DB, "select public.system_stats()"));
ok("system_stats: đủ khoá db_bytes / tables / buckets / storage_bytes", ["db_bytes", "tables", "buckets", "storage_bytes"].every((k) => k in s) && s.db_bytes > 1_000_000, JSON.stringify(s).slice(0, 300));
ok("…tối đa 12 bảng public, có tên + dung lượng + số dòng ước lượng", s.tables.length === 12 && s.tables.every((t) => typeof t.name === "string" && t.bytes >= 0 && t.rows >= 0) && s.tables[0].bytes >= s.tables[11].bytes);
ok("…bảng thật nằm trong danh sách", pg.q(DB, `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in (${s.tables.map((t) => `'${t.name}'`).join(",")})`) === "12");
const wb = s.buckets.find((x) => x.bucket === "wedding-photos");
ok("…từng bucket: số file + byte (metadata thiếu size tính 0)", wb?.objects === 3 && wb.bytes === 3500 && s.storage_bytes === 3500, JSON.stringify(s.buckets));
pg.q(DB, "alter table storage.objects rename to objects_tam");
const s2 = pg.sql(DB, "select public.system_stats()");
ok("không có storage.objects → vẫn trả kết quả, buckets rỗng", s2.ok && j(s2.out).buckets.length === 0 && j(s2.out).storage_bytes === 0, s2.out);
pg.q(DB, "alter table storage.objects_tam rename to objects");

/* ── Dọn ─────────────────────────────────────────────────────────────────── */
pg.q(DB, `insert into public.system_runs (kind, name, ok, started_at) values
  ('cron', 'automations', true,  now() - interval '90 days'),
  ('cron', 'automations', true,  now() - interval '70 days'),
  ('cron', 'automations', false, now() - interval '65 days'),
  ('cron', 'automations', false, now() - interval '61 days'),
  ('sql',  'goi-cu.sql',  true,  now() - interval '200 days'),
  ('sql',  'goi-cu.sql',  false, now() - interval '100 days')`);
pg.q(DB, "insert into public.system_errors (signature, day, source, message) values ('cu', (now() at time zone 'utc')::date - 40, 'server', 'm'), ('vua', (now() at time zone 'utc')::date - 20, 'server', 'm')");
const n = Number(pg.q(DB, "select public.prune_system_logs()"));
const left = pg.q(DB, "select string_agg(ok::text || '@' || round(extract(epoch from now() - started_at) / 86400), ',' order by started_at) from public.system_runs where name = 'automations'");
ok("dọn: bỏ lượt quá 60 ngày, GIỮ lượt gần nhất và lượt tốt gần nhất của từng việc", left === "true@70,false@61", `${left} (xoá ${n})`);
ok("…dòng 'sql' tốt gần nhất không bao giờ mất (chay-sql.mjs cần nó)", pg.q(DB, "select count(*) from public.system_runs where name = 'goi-cu.sql'") === "2");
ok("…lượt trong 60 ngày còn nguyên", pg.q(DB, "select count(*) from public.system_runs where name = 'reminders'") === "2");
ok("…lỗi quá 30 ngày bị xoá, lỗi 20 ngày còn", pg.q(DB, "select string_agg(signature, ',' order by signature) from public.system_errors where signature in ('cu','vua')") === "vua");

/* ── Quyền ───────────────────────────────────────────────────────────────── */
const UID = "11111111-1111-4111-8111-111111111111";
const deny = (r) => !r.ok && /permission denied/i.test(r.out);
for (const [who, run] of [
  ["tài khoản đăng nhập", (q) => pg.asUser(DB, UID, q)],
  ["anon", (q) => pg.sql(DB, `set role anon;\n${q}`)],
]) {
  ok(`${who}: KHÔNG đọc được system_errors / system_runs`, deny(run("select count(*) from public.system_errors;")) && deny(run("select count(*) from public.system_runs;")));
  ok(`${who}: KHÔNG ghi được system_runs`, deny(run("insert into public.system_runs (kind, name, ok) values ('cron', 'gia', true);")));
  ok(
    `${who}: KHÔNG gọi được 4 hàm`,
    deny(run("select public.log_system_error('s', 'server', 'm');")) &&
      deny(run("select public.system_stats();")) &&
      deny(run("select public.system_run_state();")) &&
      deny(run("select public.prune_system_logs();")),
  );
}
const sv = pg.asService(DB, "insert into public.system_runs (kind, name, ok, detail, duration_ms) values ('cron', 'reminders', true, '{}', 5);\nselect count(*) from public.system_errors;\nselect (public.log_system_error('sv', 'client', 'm', '/x'))->>'is_new';\nselect jsonb_typeof(public.system_stats()->'tables');\nselect jsonb_typeof(public.system_run_state()->'runs');\nselect public.prune_system_logs() >= 0;");
ok("service_role: ghi / đọc bảng và gọi cả 4 hàm", sv.ok && /true\narray\narray\nt$/.test(sv.out), sv.out);
ok("RLS bật trên cả hai bảng, không policy nào", pg.q(DB, "select string_agg(relname || ':' || relrowsecurity || ':' || (select count(*) from pg_policies p where p.tablename = c.relname), ',' order by relname) from pg_class c where relname in ('system_runs','system_errors')") === "system_errors:true:0,system_runs:true:0");

console.log(fail ? `\n${fail} kiểm tra hỏng` : "\nTất cả kiểm tra đều qua");
process.exit(fail ? 1 : 0);
