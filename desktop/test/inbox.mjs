/* Kiểm thử luật của HỘP THƯ HỢP NHẤT — phần quyết định "có được nhắn lại không".
 *
 * Vì sao đáng test: cửa sổ trả lời là luật của NỀN TẢNG NGOÀI, không phải của
 * mình. Sai theo hướng chặt thì nhân viên thấy ô soạn bị khoá và kêu; sai theo
 * hướng lỏng thì họ gõ xong một câu tư vấn dài, bấm gửi, Facebook trả lỗi — và
 * khách thì vẫn đang ngồi chờ. Không ai muốn phát hiện chuyện đó lúc đang bán hàng.
 *
 * Ba cái bẫy:
 *   • Kênh của chính mình (website, Zalo cá nhân) KHÔNG có cửa sổ → luôn gửi được.
 *   • Thiếu mốc tin cuối của khách phải fail-CLOSED, chứ không phải "cho gửi thử".
 *   • Mốc phải tính từ tin của KHÁCH, và ranh giới 24h/48h phải đúng chiều.
 */
import {
  PLATFORMS, PLATFORM_INFO, isPlatform, platformLabel, platformColor,
  canReply, replyBlockedReason, previewText,
} from "../../src/lib/inbox/platforms.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

/* ── Danh mục kênh ───────────────────────────────────────────────────────── */
check("đủ năm kênh", PLATFORMS.length, 5);
check("mọi kênh đều có mô tả", PLATFORMS.every((p) => PLATFORM_INFO[p].hint.length > 10), true);
check("mọi kênh đều khai cách nhận tin", PLATFORMS.every((p) => ["webhook", "worker", "internal"].includes(PLATFORM_INFO[p].ingest)), true);
check("khoá kênh trùng với khoá trong bảng", PLATFORMS.every((p) => PLATFORM_INFO[p].key === p), true);
check("kênh lạ bị loại", isPlatform("tiktok"), false);
check("null bị loại", isPlatform(null), false);
check("nhãn kênh lạ không rỗng", platformLabel("tiktok"), "Kênh khác");
check("màu kênh lạ có giá trị", platformColor(undefined).startsWith("#"), true);

/* ── Cửa sổ trả lời ──────────────────────────────────────────────────────── */
const NOW = Date.parse("2026-03-10T12:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3600_000).toISOString();

check("website: luôn nhắn được, kể cả không có tin nào của khách", canReply("website", null, NOW), true);
check("Zalo cá nhân: không giới hạn thời gian", canReply("zalo_personal", hoursAgo(500), NOW), true);

check("Facebook trong 24h → gửi được", canReply("facebook", hoursAgo(23), NOW), true);
check("Facebook quá 24h → KHOÁ", canReply("facebook", hoursAgo(25), NOW), false);
check("Instagram cùng luật 24h", [canReply("instagram", hoursAgo(1), NOW), canReply("instagram", hoursAgo(30), NOW)], [true, false]);
check("Zalo OA trong 48h → gửi được", canReply("zalo_oa", hoursAgo(47), NOW), true);
check("Zalo OA quá 48h → KHOÁ", canReply("zalo_oa", hoursAgo(49), NOW), false);

// Ranh giới: đúng 24h là ĐÃ hết cửa sổ (nền tảng tính "trong vòng", không phải "tới hết").
check("đúng 24h → đã hết cửa sổ", canReply("facebook", hoursAgo(24), NOW), false);

// Fail-closed: thiếu hoặc hỏng mốc thời gian thì KHOÁ, không đoán.
check("thiếu mốc tin khách → khoá", canReply("facebook", null, NOW), false);
check("chuỗi rỗng → khoá", canReply("facebook", "", NOW), false);
check("ngày giờ hỏng → khoá", canReply("facebook", "hôm qua", NOW), false);
check("kênh lạ → khoá", canReply("tiktok", hoursAgo(1), NOW), false);

// Nhận mốc bằng số ms cũng phải đúng (payload realtime hay đưa số).
check("nhận mốc dạng số ms", canReply("facebook", NOW - 3600_000, NOW), true);

/* ── Câu giải thích khi bị khoá ──────────────────────────────────────────── */
check("kênh không giới hạn → không có câu cảnh báo", replyBlockedReason("website"), "");
check("Facebook có nêu đúng số giờ", replyBlockedReason("facebook").includes("24 giờ"), true);
check("Zalo OA có nêu đúng số giờ", replyBlockedReason("zalo_oa").includes("48 giờ"), true);
check("câu cảnh báo gợi ý việc phải làm", replyBlockedReason("facebook").includes("gọi điện"), true);

/* ── Dòng xem trước ──────────────────────────────────────────────────────── */
check("gộp khoảng trắng và xuống dòng", previewText("Chào  bạn\n\nmình muốn hỏi"), "Chào bạn mình muốn hỏi");
check("tin dài bị cắt kèm dấu ba chấm", previewText("a".repeat(200)).length, 120);
check("tin chỉ có ảnh vẫn hiện ra gì đó", previewText("", 1), "📎 Tệp đính kèm");
check("nhiều tệp thì đếm", previewText("   ", 3), "📎 3 tệp đính kèm");
check("tin rỗng hoàn toàn", previewText("", 0), "(tin trống)");

console.log(fail === 0 ? "\nTất cả đều đạt." : `\n${fail} kiểm thử KHÔNG đạt.`);
process.exit(fail === 0 ? 0 : 1);
