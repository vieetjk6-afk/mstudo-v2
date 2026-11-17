/* Kiểm thử migration "Chụp theo khung giờ" trên Postgres THẬT.
 *
 * Vì sao đáng test: lời hứa của tính năng là "hai khách không bao giờ cùng một
 * khung" và "khung giữ chờ cọc tự nhả" — cả hai sống trong SQL (UNIQUE, hàm
 * security definer, trigger), không test được bằng cách đọc TypeScript.
 *
 * Dựng: setup-all.sql → chup_theo_khung_gio.sql HAI lần (chứng minh chạy lại
 * vô hại). Không có Postgres trên máy → BỎ QUA, thoát 0.
 */
import { dungPostgres } from "./pg-tam.mjs";

const pg = dungPostgres({ port: "5461" });
if (!pg.ok) {
  console.log(`⏭  BỎ QUA: ${pg.lyDo}`);
  process.exit(0);
}

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const DB = "mini";
const MIG = pg.supa("migrations/chup_theo_khung_gio.sql");
pg.newDb(DB);
pg.runFile(DB, pg.supa("setup-all.sql"));
pg.runFile(DB, MIG);
pg.runFile(DB, MIG);
check("migration chạy hai lần không lỗi", true, true);

const A = "11111111-1111-1111-1111-111111111111"; // chủ studio A
const B = "22222222-2222-2222-2222-222222222222"; // chủ studio B
const S = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // đợt của A
const q = (t) => pg.q(DB, t);
const st = (json) => JSON.parse(json).status;

q(`insert into auth.users (id, email) values ('${A}', 'a@x.vn'), ('${B}', 'b@x.vn') on conflict do nothing;
   insert into public.profiles (id, email, role, is_active, full_name)
   values ('${A}', 'a@x.vn', 'photographer', true, 'Studio A'), ('${B}', 'b@x.vn', 'photographer', true, 'Studio B')
   on conflict (id) do update set is_active = true;
   insert into public.studio_mini_sessions (id, owner_id, token, title, session_date, start_min, end_min, slot_minutes, gap_minutes, price, deposit, location)
   values ('${S}', '${A}', 'tok-a', 'Chụp Tết', current_date + 7, 540, 660, 20, 5, 300000, 500000, 'Studio A');`);

const book = (start, name, extra = "") =>
  q(`select public.mini_book_slot('${S}', ${start}, '${name}', '0901234567', null${extra});`);

// ── Khung phải là khung thật ────────────────────────────────────────────────
check("khung lệch lưới bị chối", st(book(545, "Lệch")), "invalid_slot");
check("khung tràn giờ kết thúc bị chối", st(book(665, "Tràn")), "invalid_slot");

// ── Đặt có cọc: giữ chỗ + yêu cầu đặt lịch + dòng lịch ─────────────────────
const r1 = JSON.parse(book(540, "An", ", false, 'COC-AAAA', 'tok-dep-1', 30"));
check("đặt khung 09:00 thành công", r1.status, "ok");
check("cọc kẹp theo giá khung (500k → 300k)", r1.deposit_amount, 300000);
check("có hạn giữ chỗ", !!r1.hold_expires_at, true);
check("sinh yêu cầu đặt lịch chờ cọc", q(`select deposit_status || '|' || deposit_amount || '|' || service from public.studio_bookings where id = '${r1.booking_id}';`), "awaiting|300000|Khung giờ 09:00–09:20 · Chụp Tết");
check("sinh dòng lịch làm việc", q(`select kind || '|' || start_time || '|' || end_time || '|' || title from public.studio_appointments where owner_id = '${A}';`), "shoot|09:00|09:20|Khung giờ · Chụp Tết — An (chờ cọc)");

// ── UNIQUE: khách thứ hai bị chối, không để lại rác ────────────────────────
check("khách thứ hai cùng khung → taken", st(book(540, "Bình", ", false, 'COC-BBBB', 'tok-dep-2', 30")), "taken");
check("không sinh yêu cầu thừa", q(`select count(*) from public.studio_bookings where owner_id = '${A}';`), "1");
check("không sinh dòng lịch thừa", q(`select count(*) from public.studio_appointments where owner_id = '${A}';`), "1");
const dup = pg.sql(DB, `insert into public.studio_mini_slots (session_id, owner_id, start_min) values ('${S}', '${A}', 540);`);
check("chèn thẳng dòng khoá trùng → vi phạm UNIQUE", !dup.ok && /studio_mini_slots_slot_uniq/.test(dup.out), true);

// ── Hết hạn giữ → hàm đặt tự nhả ───────────────────────────────────────────
q(`update public.studio_mini_slots set hold_expires_at = now() - interval '1 minute' where id = '${r1.slot_id}';`);
const r2 = JSON.parse(book(540, "Chi", ", false, 'COC-CCCC', 'tok-dep-3', 30"));
check("khung hết hạn giữ → khách sau đặt được", r2.status, "ok");
check("dòng lịch của khách cũ biến mất, còn đúng 1", q(`select count(*) || '|' || max(client_name) from public.studio_appointments where owner_id = '${A}';`), "1|Chi");
check("yêu cầu cũ được ghi 'hết hạn giữ chỗ'", q(`select note like '⏱ Hết hạn%' from public.studio_bookings where id = '${r1.booking_id}';`), "t");

// ── Khách báo đã chuyển → dừng đồng hồ, dòng lịch bỏ "(chờ cọc)" ──────────
q(`update public.studio_bookings set deposit_status = 'paid' where id = '${r2.booking_id}';`);
check("báo đã chuyển → chắc chỗ", q(`select hold_expires_at is null from public.studio_mini_slots where id = '${r2.slot_id}';`), "t");
check("tiêu đề lịch bỏ (chờ cọc)", q(`select title from public.studio_appointments where owner_id = '${A}';`), "Khung giờ · Chụp Tết — Chi");

// ── Chuyển cọc MUỘN ────────────────────────────────────────────────────────
q(`update public.studio_bookings set deposit_status = 'confirmed' where id = '${r1.booking_id}';`);
check("chuyển muộn, khung đã có người → báo studio", q(`select count(*) from public.studio_notifications where owner_id = '${A}' and message like '%hết hạn giữ chỗ%';`), "1");
const r3 = JSON.parse(book(565, "Dung", ", false, 'COC-DDDD', 'tok-dep-4', 30"));
q(`update public.studio_mini_slots set hold_expires_at = now() - interval '1 minute' where id = '${r3.slot_id}';
   select public.mini_release_expired('${S}');`);
check("nhả tay khung hết hạn", q(`select count(*) from public.studio_mini_slots where session_id = '${S}';`), "1");
q(`update public.studio_bookings set deposit_status = 'confirmed' where id = '${r3.booking_id}';`);
check("chuyển muộn, khung còn trống → lấy lại khung", q(`select count(*) from public.studio_mini_slots where booking_id = '${r3.booking_id}' and hold_expires_at is null;`), "1");

// ── Đặt tay, không cọc, huỷ ────────────────────────────────────────────────
const r4 = JSON.parse(book(590, "Vãng lai", ", true"));
check("đặt tay: chắc chỗ, không sinh yêu cầu", [r4.status, r4.booking_id, r4.hold_expires_at], ["ok", null, null]);
q(`delete from public.studio_mini_slots where id = '${r4.slot_id}';`);
check("huỷ khoá → dòng lịch biến mất", q(`select count(*) from public.studio_appointments where owner_id = '${A}';`), "2");
q(`delete from public.studio_bookings where id = '${r3.booking_id}';`);
check("xoá yêu cầu → khung trống lại + lịch biến mất", q(`select (select count(*) from public.studio_mini_slots where session_id = '${S}') || '|' || (select count(*) from public.studio_appointments where owner_id = '${A}');`), "1|1");
const r5 = JSON.parse(book(615, "Không cọc"));
check("không truyền mã cọc → không cọc, chắc chỗ", [r5.status, r5.deposit_amount, r5.hold_expires_at], ["ok", 0, null]);

// ── Đợt đóng / đã qua ──────────────────────────────────────────────────────
q(`update public.studio_mini_sessions set is_open = false where id = '${S}';`);
check("đợt đóng → khách online bị chối", st(book(590, "Muộn")), "closed");
check("đợt đóng → studio vẫn đặt tay được", st(book(590, "Tay", ", true")), "ok");
q(`update public.studio_mini_sessions set is_open = true where id = '${S}';`);

// ── Sửa đợt đã có khách ────────────────────────────────────────────────────
const g1 = pg.sql(DB, `update public.studio_mini_sessions set slot_minutes = 30 where id = '${S}';`);
check("đổi độ dài khung khi đã có khách → bị chặn", !g1.ok && /mini_session_has_bookings/.test(g1.out), true);
const g2 = pg.sql(DB, `update public.studio_mini_sessions set end_min = 600 where id = '${S}';`);
check("rút giờ kết thúc cắt mất khách → bị chặn", !g2.ok && /mini_session_has_bookings/.test(g2.out), true);
check("kéo dài giờ kết thúc → được", pg.sql(DB, `update public.studio_mini_sessions set end_min = 700 where id = '${S}';`).ok, true);
q(`update public.studio_mini_sessions set title = 'Chụp Tết 2027', location = 'Phim trường' where id = '${S}';`);
check("đổi tên / địa điểm → dòng lịch đổi theo", q(`select title || '|' || location from public.studio_appointments where client_name = 'Chi';`), "Khung giờ · Chụp Tết 2027 — Chi|Phim trường");

// ── Quyền ──────────────────────────────────────────────────────────────────
const anonCall = pg.sql(DB, `set role anon;\nselect public.mini_book_slot('${S}', 640, 'x', '0900000000', null);`);
check("anon không gọi được hàm đặt", !anonCall.ok && /permission denied/.test(anonCall.out), true);
const userCall = pg.asUser(DB, A, `select public.mini_book_slot('${S}', 640, 'x', '0900000000', null);`);
check("người đăng nhập không gọi được hàm đặt", !userCall.ok && /permission denied/.test(userCall.out), true);
const userRel = pg.asUser(DB, A, `select public.mini_release_expired(null);`);
check("người đăng nhập không gọi được hàm nhả", !userRel.ok && /permission denied/.test(userRel.out), true);
const svc = pg.asService(DB, `select public.mini_book_slot('${S}', 640, 'Dịch vụ', '0900000000', null) ->> 'status';`);
check("service_role gọi được", svc.out, "ok");
const anonRead = pg.sql(DB, `set role anon;\nselect count(*) from public.studio_mini_slots;`);
check("anon không đọc được bảng khoá", !anonRead.ok && /permission denied/.test(anonRead.out), true);
check("chủ studio đọc được đợt + khoá của mình", pg.asUser(DB, A, `select (select count(*) from public.studio_mini_sessions) || '|' || (select count(*) > 0 from public.studio_mini_slots);`).out, "1|true");
check("studio khác không thấy gì", pg.asUser(DB, B, `select (select count(*) from public.studio_mini_sessions) || '|' || (select count(*) from public.studio_mini_slots);`).out, "0|0");
const userWrite = pg.asUser(DB, A, `insert into public.studio_mini_slots (session_id, owner_id, start_min) values ('${S}', '${A}', 665);`);
check("chủ studio không ghi thẳng bảng khoá được", !userWrite.ok && /permission denied|row-level security/.test(userWrite.out), true);
const userUpd = pg.asUser(DB, A, `update public.studio_mini_sessions set price = 1 where id = '${S}' returning id;`);
check("chủ studio không sửa thẳng đợt được", !userUpd.ok || userUpd.out === "", true);
// Nhân viên xác nhận cọc ở màn Đặt lịch (RLS thường) → trigger vẫn dừng được đồng hồ.
const r6 = JSON.parse(q(`select public.mini_book_slot('${S}', 665, 'Giang', '0901234567', null, false, 'COC-GGGG', 'tok-dep-6', 30);`));
pg.asUser(DB, A, `update public.studio_bookings set deposit_status = 'confirmed' where id = '${r6.booking_id}';`);
check("chủ studio xác nhận cọc qua RLS → khung chắc chỗ", q(`select hold_expires_at is null from public.studio_mini_slots where id = '${r6.slot_id}';`), "t");

// ── Xoá đợt ────────────────────────────────────────────────────────────────
q(`delete from public.studio_mini_sessions where id = '${S}';`);
check("xoá đợt → khoá + lịch đi theo, yêu cầu ở lại", q(`select (select count(*) from public.studio_mini_slots) || '|' || (select count(*) from public.studio_appointments where owner_id = '${A}') || '|' || (select count(*) > 0 from public.studio_bookings where owner_id = '${A}');`), "0|0|true");

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
