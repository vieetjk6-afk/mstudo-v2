/* Kiểm thử luật thuần của "Chụp theo khung giờ" (src/lib/mini-session.ts).
 *
 * Vì sao đáng test: lưới khung sai một phút là khách đặt 09:20 mà studio thấy
 * 09:25; coi nhầm khoá hết hạn là "đã đặt" thì khung chết oan cả ngày; cọc lớn
 * hơn giá hiện thẳng vào mặt khách. Không có gì nổ khi sai — chỉ có khách đến
 * nhầm giờ. Nạp thẳng code thật.
 */
import {
  HOLD_MINUTES, hhmm, parseHhmm, slotRange, slotStarts, isValidSlot, lockState, slotGrid, slotCounts,
  slotDeposit, slotBookable, sessionPast, cleanSessionInput, orphanedLocks, cleanCustomer,
  holdMinutesLeft, sessionTimeLabel, miniSessionPath,
} from "../../src/lib/mini-session.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const G = { start_min: 540, end_min: 660, slot_minutes: 20, gap_minutes: 5 };
const NOW = Date.parse("2027-01-20T02:00:00Z");
const iso = (ms) => new Date(ms).toISOString();

// ── Giờ ────────────────────────────────────────────────────────────────────
check("545 → 09:05", hhmm(545), "09:05");
check("09:05 → 545", parseHhmm("09:05"), 545);
check("9:05 → 545", parseHhmm("9:05"), 545);
check("25:00 → null", parseHhmm("25:00"), null);
check("rỗng → null", parseHhmm(""), null);
check("khoảng giờ khung", slotRange(540, 20), "09:00–09:20");
check("giữ chỗ 30 phút", HOLD_MINUTES, 30);

// ── Sinh khung ─────────────────────────────────────────────────────────────
check("09:00–11:00, 20' + nghỉ 5' → 5 khung", slotStarts(G), [540, 565, 590, 615, 640]);
check("khung cuối phải kết thúc trong giờ", slotStarts({ ...G, end_min: 659 }), [540, 565, 590, 615]);
check("không nghỉ → 6 khung", slotStarts({ ...G, gap_minutes: 0 }).length, 6);
check("khoảng giờ ngắn hơn một khung → rỗng", slotStarts({ ...G, end_min: 555 }), []);
check("độ dài 0 → rỗng (không lặp vô hạn)", slotStarts({ ...G, slot_minutes: 0, gap_minutes: 0 }), []);
check("khung đúng lưới", isValidSlot(G, 565), true);
check("khung lệch lưới", isValidSlot(G, 560), false);
check("khung tràn giờ kết thúc", isValidSlot(G, 665), false);
check("khung trước giờ bắt đầu", isValidSlot(G, 515), false);
check("số lẻ không phải khung", isValidSlot(G, 540.5), false);

// ── Trạng thái khung & hạn giữ ─────────────────────────────────────────────
check("không khoá → trống", lockState(null, NOW), "free");
check("khoá chắc chỗ → đã đặt", lockState({ hold_expires_at: null }, NOW), "booked");
check("còn hạn giữ → đang giữ", lockState({ hold_expires_at: iso(NOW + 60_000) }, NOW), "held");
check("hết hạn giữ → trống", lockState({ hold_expires_at: iso(NOW - 1) }, NOW), "free");
check("đúng mốc hết hạn → trống", lockState({ hold_expires_at: iso(NOW) }, NOW), "free");
const locks = [
  { start_min: 540, hold_expires_at: null },
  { start_min: 565, hold_expires_at: iso(NOW + 600_000) },
  { start_min: 590, hold_expires_at: iso(NOW - 600_000) },
];
check("lưới: đặt / giữ / hết hạn / trống", slotGrid(G, locks, NOW).map((x) => x.state), ["booked", "held", "free", "free", "free"]);
check("đếm khung đã có người", slotCounts(G, locks, NOW), { total: 5, taken: 2 });
check("còn 10 phút giữ", holdMinutesLeft(iso(NOW + 600_000), NOW), 10);
check("còn 1 giây → làm tròn lên 1 phút", holdMinutesLeft(iso(NOW + 1000), NOW), 1);
check("hết hạn → 0", holdMinutesLeft(iso(NOW - 1000), NOW), 0);

// ── Tiền ───────────────────────────────────────────────────────────────────
check("cọc không vượt giá", slotDeposit(300000, 500000), 300000);
check("cọc nhỏ hơn giá giữ nguyên", slotDeposit(300000, 100000), 100000);
check("chưa đặt giá → giữ mức cọc", slotDeposit(0, 200000), 200000);
check("cọc âm → 0", slotDeposit(300000, -5), 0);

// ── Còn đặt được không ─────────────────────────────────────────────────────
const S = { session_date: "2027-01-20", is_open: true };
check("ngày mai → đặt được", slotBookable(S, 540, "2027-01-19", 1000), true);
check("hôm nay, khung chưa tới → đặt được", slotBookable(S, 600, "2027-01-20", 590), true);
check("hôm nay, khung đã bắt đầu → không", slotBookable(S, 590, "2027-01-20", 590), false);
check("đợt đã qua → không", slotBookable(S, 540, "2027-01-21", 0), false);
check("đợt đóng → không", slotBookable({ ...S, is_open: false }, 540, "2027-01-19", 0), false);
check("đợt hôm qua là đã qua", sessionPast("2027-01-19", "2027-01-20"), true);
check("đợt hôm nay chưa qua", sessionPast("2027-01-20", "2027-01-20"), false);

// ── Kiểm dữ liệu đợt ───────────────────────────────────────────────────────
const RAW = { title: "  Chụp Tết  ", session_date: "2027-01-20", ...G, price: 300000, deposit: 500000, location: " Studio ", note: "", is_open: true };
const ok = cleanSessionInput(RAW);
check("dữ liệu hợp lệ", ok.ok, true);
check("cắt khoảng trắng + kẹp cọc theo giá", [ok.value.title, ok.value.deposit, ok.value.location, ok.value.note], ["Chụp Tết", 300000, "Studio", null]);
check("thiếu tên", cleanSessionInput({ ...RAW, title: " " }).ok, false);
check("ngày sai dạng", cleanSessionInput({ ...RAW, session_date: "20/01/2027" }).ok, false);
check("kết thúc trước bắt đầu", cleanSessionInput({ ...RAW, end_min: 500 }).error, "Giờ kết thúc phải sau giờ bắt đầu.");
check("khung 2 phút bị chối", cleanSessionInput({ ...RAW, slot_minutes: 2 }).ok, false);
check("khoảng giờ không đủ một khung", cleanSessionInput({ ...RAW, end_min: 550 }).ok, false);
check("quá 200 khung", cleanSessionInput({ ...RAW, start_min: 0, end_min: 1439, slot_minutes: 5, gap_minutes: 0 }).ok, false);
check("giá âm", cleanSessionInput({ ...RAW, price: -1 }).ok, false);
check("số gửi dạng chuỗi vẫn đọc được", cleanSessionInput({ ...RAW, slot_minutes: "15" }).value.slot_minutes, 15);
check("không phải object", cleanSessionInput(null).ok, false);

// ── Sửa đợt đã có khách ────────────────────────────────────────────────────
const B = { ...G, session_date: "2027-01-20" };
check("chỉ đổi giờ kết thúc, không cắt ai → sửa được", orphanedLocks(B, { ...B, end_min: 700 }, locks, NOW).length, 0);
check("rút giờ kết thúc cắt khung 09:25", orphanedLocks(B, { ...B, end_min: 580 }, locks, NOW).map((l) => l.start_min), [565]);
check("đổi ngày → mọi khách còn hiệu lực bị ảnh hưởng", orphanedLocks(B, { ...B, session_date: "2027-01-21" }, locks, NOW).length, 2);
check("đổi độ dài khung → bị ảnh hưởng", orphanedLocks(B, { ...B, slot_minutes: 30 }, locks, NOW).length, 2);
check("chỉ còn khoá hết hạn → sửa tự do", orphanedLocks(B, { ...B, slot_minutes: 30 }, [locks[2]], NOW).length, 0);

// ── Khách ──────────────────────────────────────────────────────────────────
check("khách hợp lệ", cleanCustomer({ name: " An ", phone: "090 123 4567", note: "" }), { ok: true, name: "An", phone: "090 123 4567", note: null });
check("thiếu tên", cleanCustomer({ phone: "0901234567" }), { ok: false, error: "missing" });
check("SĐT quá ngắn", cleanCustomer({ name: "An", phone: "12345" }), { ok: false, error: "phone" });
check("tên quá dài bị cắt", cleanCustomer({ name: "x".repeat(500), phone: "0901234567" }).name.length, 120);

// ── Nhãn ───────────────────────────────────────────────────────────────────
check("nhãn giờ đợt", sessionTimeLabel(G), "09:00 – 11:00 · 20 phút/khung · nghỉ 5 phút");
check("nhãn giờ đợt không nghỉ", sessionTimeLabel({ ...G, gap_minutes: 0 }), "09:00 – 11:00 · 20 phút/khung");
check("đường dẫn công khai", miniSessionPath("abc"), "/book/dot/abc");

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
