/* Kiểm thử luật của HỘP THƯ HỢP NHẤT — phần quyết định "có được nhắn lại không".
 *
 * Vì sao đáng test: cửa sổ trả lời là luật của NỀN TẢNG NGOÀI, không phải của
 * mình. Sai theo hướng chặt thì nhân viên thấy ô soạn bị khoá và kêu; sai theo
 * hướng lỏng thì họ gõ xong một câu tư vấn dài, bấm gửi, Facebook trả lỗi — và
 * khách thì vẫn đang ngồi chờ. Không ai muốn phát hiện chuyện đó lúc đang bán hàng.
 *
 * Ba cái bẫy:
 *   • Kênh của chính mình (website, Zalo cá nhân) KHÔNG có cửa sổ → luôn gửi được.
 *   • TikTok đi qua cầu nối: cửa ingest chỉ được mở cho worker/bridge, tuyệt
 *     đối không cho kênh đã có webhook ký chữ ký riêng.
 *   • Thiếu mốc tin cuối của khách phải fail-CLOSED, chứ không phải "cho gửi thử".
 *   • Mốc phải tính từ tin của KHÁCH, và ranh giới 24h/48h phải đúng chiều.
 */
import {
  PLATFORMS, PLATFORM_INFO, isPlatform, platformLabel, platformColor,
  canReply, replyBlockedReason, previewText, acceptsIngest,
} from "../../src/lib/inbox/platforms.ts";
import { validRelayUrl, signBridgePayload } from "../../src/lib/inbox/bridge-protocol.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

/* ── Danh mục kênh ───────────────────────────────────────────────────────── */
check("đủ sáu kênh", PLATFORMS.length, 6);
check("mọi kênh đều có mô tả", PLATFORMS.every((p) => PLATFORM_INFO[p].hint.length > 10), true);
check("mọi kênh đều khai cách nhận tin", PLATFORMS.every((p) => ["webhook", "worker", "bridge", "internal"].includes(PLATFORM_INFO[p].ingest)), true);
check("khoá kênh trùng với khoá trong bảng", PLATFORMS.every((p) => PLATFORM_INFO[p].key === p), true);
check("kênh lạ bị loại", isPlatform("threads"), false);
check("null bị loại", isPlatform(null), false);
check("nhãn kênh lạ không rỗng", platformLabel("threads"), "Kênh khác");
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
check("kênh lạ → khoá", canReply("threads", hoursAgo(1), NOW), false);

// Nhận mốc bằng số ms cũng phải đúng (payload realtime hay đưa số).
check("nhận mốc dạng số ms", canReply("facebook", NOW - 3600_000, NOW), true);

/* ── Câu giải thích khi bị khoá ──────────────────────────────────────────── */
check("kênh không giới hạn → không có câu cảnh báo", replyBlockedReason("website"), "");
check("Facebook có nêu đúng số giờ", replyBlockedReason("facebook").includes("24 giờ"), true);
check("Zalo OA có nêu đúng số giờ", replyBlockedReason("zalo_oa").includes("48 giờ"), true);
check("câu cảnh báo gợi ý việc phải làm", replyBlockedReason("facebook").includes("gọi điện"), true);

/* ── TikTok & cầu nối ────────────────────────────────────────────────────
   TikTok đi qua cầu nối chứ không webhook thẳng, nên hai thứ phải đúng: chỉ
   kênh dạng worker/bridge mới được bơm tin qua /api/inbox/ingest, và URL cầu
   nối phải chặn được SSRF. */
check("tiktok là kênh hợp lệ", isPlatform("tiktok"), true);
check("tiktok nhận tin qua cầu nối", PLATFORM_INFO.tiktok.ingest, "bridge");
check("tiktok: MStudo không tự chặn cửa sổ", canReply("tiktok", null, NOW), true);

check("cửa ingest mở cho worker và cầu nối", [acceptsIngest("zalo_personal"), acceptsIngest("tiktok")], [true, true]);
// Kênh có webhook riêng KHÔNG được đi cửa ingest: vào được là bỏ qua bước kiểm
// chữ ký của Meta/Zalo, hạ xác thực mạnh xuống còn một bí mật dùng chung.
check("cửa ingest ĐÓNG với kênh có webhook", [acceptsIngest("facebook"), acceptsIngest("instagram"), acceptsIngest("zalo_oa")], [false, false, false]);
check("cửa ingest đóng với chatbox website", acceptsIngest("website"), false);
check("cửa ingest đóng với kênh lạ", acceptsIngest("tiktok_shop"), false);

check("URL cầu nối phải là https", validRelayUrl("http://doitac.vn/hook").ok, false);
check("URL cầu nối https hợp lệ", validRelayUrl("https://doitac.vn/hook").ok, true);
check("chuỗi rác không phải URL", validRelayUrl("doitac.vn").ok, false);
// SSRF: mấy địa chỉ này gọi được là máy chủ tự moi ruột chính nó.
for (const bad of [
  "https://localhost/x", "https://127.0.0.1/x", "https://10.1.2.3/x",
  "https://192.168.1.1/x", "https://169.254.169.254/latest/meta-data/",
  "https://172.16.0.1/x", "https://[::1]/x", "https://kho.internal/x",
]) {
  check(`chặn địa chỉ nội bộ ${bad}`, validRelayUrl(bad).ok, false);
}
// 172.32 KHÔNG thuộc dải riêng tư 172.16–172.31 — chặn nhầm là chặn cả tên miền thật.
check("không chặn nhầm 172.32.x.x", validRelayUrl("https://172.32.0.1/x").ok, true);

/* Chữ ký tin đi ra: dấu thời gian phải nằm TRONG phần được ký, nếu không kẻ
   chặn đường sửa `t` để phát lại tin cũ mà chữ ký vẫn hợp lệ. */
const SIG_NOW = 1_772_000_000_000;
const sigA = signBridgePayload('{"text":"a"}', "khoa-bi-mat", SIG_NOW);
check("chữ ký đúng định dạng t=…,s=…", /^t=\d+,s=[0-9a-f]{64}$/.test(sigA), true);
check("dấu thời gian tính bằng giây", sigA.startsWith(`t=${Math.floor(SIG_NOW / 1000)},`), true);
check("cùng đầu vào → cùng chữ ký", signBridgePayload('{"text":"a"}', "khoa-bi-mat", SIG_NOW), sigA);
check("đổi nội dung → đổi chữ ký", signBridgePayload('{"text":"b"}', "khoa-bi-mat", SIG_NOW) !== sigA, true);
check("đổi khoá → đổi chữ ký", signBridgePayload('{"text":"a"}', "khoa-khac", SIG_NOW) !== sigA, true);
check("đổi thời gian → đổi chữ ký", signBridgePayload('{"text":"a"}', "khoa-bi-mat", SIG_NOW + 1000) !== sigA, true);

/* ── Dòng xem trước ──────────────────────────────────────────────────────── */
check("gộp khoảng trắng và xuống dòng", previewText("Chào  bạn\n\nmình muốn hỏi"), "Chào bạn mình muốn hỏi");
check("tin dài bị cắt kèm dấu ba chấm", previewText("a".repeat(200)).length, 120);
check("tin chỉ có ảnh vẫn hiện ra gì đó", previewText("", 1), "📎 Tệp đính kèm");
check("nhiều tệp thì đếm", previewText("   ", 3), "📎 3 tệp đính kèm");
check("tin rỗng hoàn toàn", previewText("", 0), "(tin trống)");

console.log(fail === 0 ? "\nTất cả đều đạt." : `\n${fail} kiểm thử KHÔNG đạt.`);
process.exit(fail === 0 ? 0 : 1);
