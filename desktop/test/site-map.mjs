/* Kiểm thử link Google Maps dán vào thiệp / website (src/lib/site-map.ts).
 *
 * Vì sao đáng test: cặp đôi dán link bản đồ theo đủ kiểu — chữ kèm tên quán từ
 * nút Chia sẻ của app, thiếu https://, mã nhúng <iframe> copy trên máy tính. Các
 * mẫu thiệp cũ gắn thẳng chuỗi đó vào href, thành đường dẫn tương đối → khách
 * bấm "Chỉ đường" ra trang 404 của chính mình. Bài test khoá lại: nút luôn ra
 * một link Google mở được, và không bao giờ là link đi chỗ khác.
 *
 * Nạp thẳng code thật ở src/lib/site-map.ts.
 */
import { isShortMapLink, mapEmbedSrc, mapOpenHref, pickMapLink } from "../../src/lib/site-map.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const SHORT = "https://maps.app.goo.gl/AbCdEf123456";
const SHARE_TEXT = `Trung tâm tiệc cưới Lavender\n88 Nguyễn Huệ, Bến Nghé, Quận 1, Hồ Chí Minh\n${SHORT}`;
const PLACE = "https://www.google.com/maps/place/Lavender/@10.7743,106.7038,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d10.774312!4d106.703812!16s";
const EMBED = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.4!2d106.7038!3d10.7743!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1svi!2s!4v1700000000000";
const IFRAME = `<iframe src="${EMBED}" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>`;
const SEARCH = (q) => `https://www.google.com/maps/search/?api=1&query=${q}`;

/* ── Bóc đường link khỏi chữ dán kèm ─────────────────────────────────────── */
check("chữ từ nút Chia sẻ → chỉ còn link", pickMapLink(SHARE_TEXT), SHORT);
check("link kèm dấu chấm cuối câu", pickMapLink(`Địa chỉ đây nha: ${SHORT}.`), SHORT);
check("chỉ có link → giữ nguyên", pickMapLink(`  ${PLACE}  `), PLACE);
check("mã nhúng → giữ nguyên cho bước bóc src", pickMapLink(IFRAME), IFRAME);
check("địa chỉ chữ → giữ nguyên", pickMapLink("88 Nguyễn Huệ, Q.1"), "88 Nguyễn Huệ, Q.1");
check("chữ kèm link rút gọn vẫn nhận là link rút gọn", isShortMapLink(SHARE_TEXT), true);

/* ── Nút "Chỉ đường": luôn ra link Google mở được ────────────────────────── */
check("link rút gọn → mở nguyên link", mapOpenHref(SHORT), SHORT);
check("thiếu https:// → thêm vào", mapOpenHref("maps.app.goo.gl/AbCdEf123456"), SHORT);
check("chữ từ nút Chia sẻ → link rút gọn", mapOpenHref(SHARE_TEXT), SHORT);
check("link đầy đủ → mở nguyên link", mapOpenHref(PLACE), PLACE);
check("mã nhúng <iframe> → mở theo toạ độ", mapOpenHref(IFRAME), SEARCH("10.7743,106.7038"));
check("URL nhúng dán thẳng → không mở trang nhúng (Google báo lỗi)", mapOpenHref(EMBED), SEARCH("10.7743,106.7038"));
check("địa chỉ chữ → tìm theo địa chỉ", mapOpenHref("88 Nguyễn Huệ, Q.1"), SEARCH(encodeURIComponent("88 Nguyễn Huệ, Q.1")));
check("toạ độ dán tay", mapOpenHref("10.7743, 106.7038"), SEARCH("10.7743,106.7038"));
check("trống → không có nút", mapOpenHref(""), null);
check("link lạ → không dẫn ra ngoài Google", mapOpenHref("https://evil.example/x").startsWith("https://www.google.com/maps/"), true);
check("javascript: → không thành href chạy mã", mapOpenHref("javascript:alert(1)").startsWith("https://www.google.com/maps/"), true);

/* ── Bản đồ nhúng ────────────────────────────────────────────────────────── */
check("chữ kèm link đầy đủ → ghim đúng toạ độ", mapEmbedSrc(`Lavender\n${PLACE}`), "https://www.google.com/maps?q=10.774312,106.703812(Lavender)&z=17&hl=vi&output=embed");
check("mã nhúng → dùng nguyên URL nhúng", mapEmbedSrc(IFRAME), EMBED);
check("link rút gọn chưa mở → lấy theo địa chỉ dự phòng", mapEmbedSrc(SHORT, "88 Nguyễn Huệ"), `https://www.google.com/maps?q=${encodeURIComponent("88 Nguyễn Huệ")}&hl=vi&output=embed`);

console.log(fail === 0 ? "\nTất cả OK" : `\n${fail} bài HỎNG`);
process.exit(fail === 0 ? 0 : 1);
