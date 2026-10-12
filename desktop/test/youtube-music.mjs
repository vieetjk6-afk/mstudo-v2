/* Kiểm thử nhận diện link YouTube cho nhạc nền thiệp.
 *
 * Vì sao đáng test: thẻ <audio> im lặng khi gặp link YouTube — không lỗi, không
 * cảnh báo. Nếu hàm nhận diện bỏ sót một kiểu link khách hay dán (youtu.be có
 * `?si=`, m.youtube, music.youtube, shorts…) thì thiệp lại câm đúng như cũ, và
 * cặp đôi chỉ biết khi khách báo. Ngược lại, mã video được ghép thẳng vào URL
 * nhúng, nên thứ không phải mã 11 ký tự phải bị loại.
 *
 * Nạp thẳng code thật ở src/lib/youtube-music.ts.
 */
import { parseYoutubeMusic, isMusicPageLink } from "../../src/lib/youtube-music.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const ID = "dQw4w9WgXcQ";
const at = (start) => ({ id: ID, start });

/* ── Mọi kiểu link YouTube khách hay dán ─────────────────────────────────── */
check("watch", parseYoutubeMusic(`https://www.youtube.com/watch?v=${ID}`), at(0));
check("watch kèm list", parseYoutubeMusic(`https://www.youtube.com/watch?v=${ID}&list=RD${ID}&index=2`), at(0));
check("youtu.be kèm si (nút Chia sẻ)", parseYoutubeMusic(`https://youtu.be/${ID}?si=AbCdEf123`), at(0));
check("m.youtube (điện thoại)", parseYoutubeMusic(`https://m.youtube.com/watch?v=${ID}`), at(0));
check("music.youtube", parseYoutubeMusic(`https://music.youtube.com/watch?v=${ID}&feature=share`), at(0));
check("shorts", parseYoutubeMusic(`https://youtube.com/shorts/${ID}?feature=share`), at(0));
check("embed", parseYoutubeMusic(`https://www.youtube.com/embed/${ID}`), at(0));
check("nocookie", parseYoutubeMusic(`https://www.youtube-nocookie.com/embed/${ID}`), at(0));
check("live", parseYoutubeMusic(`https://www.youtube.com/live/${ID}`), at(0));
check("thiếu https", parseYoutubeMusic(`youtu.be/${ID}`), at(0));
check("thừa khoảng trắng", parseYoutubeMusic(`  https://youtu.be/${ID}\n`), at(0));

/* ── Mốc bắt đầu (bỏ đoạn dạo đầu) ──────────────────────────────────────── */
check("t=45", parseYoutubeMusic(`https://youtu.be/${ID}?t=45`), at(45));
check("t=45s", parseYoutubeMusic(`https://www.youtube.com/watch?v=${ID}&t=45s`), at(45));
check("t=1m30s", parseYoutubeMusic(`https://www.youtube.com/watch?v=${ID}&t=1m30s`), at(90));
check("t=1h2m3s", parseYoutubeMusic(`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`), at(3723));
check("start=20 (link nhúng)", parseYoutubeMusic(`https://www.youtube.com/embed/${ID}?start=20`), at(20));
check("t lạ → từ đầu", parseYoutubeMusic(`https://youtu.be/${ID}?t=abc`), at(0));

/* ── Không phải video YouTube → null (để <audio> lo như cũ) ─────────────── */
check("file mp3", parseYoutubeMusic("https://example.com/nhac.mp3"), null);
check("file đã tải lên", parseYoutubeMusic("/api/file?id=1AbC"), null);
check("trang kênh", parseYoutubeMusic("https://www.youtube.com/@sontungmtp"), null);
check("rỗng", parseYoutubeMusic(""), null);
check("undefined", parseYoutubeMusic(undefined), null);
check("tên miền giả", parseYoutubeMusic(`https://youtube.com.evil.vn/watch?v=${ID}`), null);
check("mã quá ngắn", parseYoutubeMusic("https://youtu.be/abc"), null);
check("mã chèn ký tự lạ", parseYoutubeMusic(`https://www.youtube.com/watch?v=${ID.slice(0, 10)}"`), null);

/* ── Trang nghe nhạc (không phải file) → nhắc trong trình chỉnh sửa ─────── */
check("zing", isMusicPageLink("https://zingmp3.vn/bai-hat/abc.html"), true);
check("spotify", isMusicPageLink("https://open.spotify.com/track/xyz"), true);
check("drive", isMusicPageLink("https://drive.google.com/file/d/1AbC/view"), true);
check("mp3 không bị nhắc", isMusicPageLink("https://example.com/nhac.mp3"), false);
check("file đã tải lên không bị nhắc", isMusicPageLink("/api/file?id=1AbC"), false);
check("youtube không bị nhắc", isMusicPageLink(`https://youtu.be/${ID}`), false);

console.log(fail === 0 ? "\nTất cả OK" : `\n${fail} bài HỎNG`);
process.exit(fail === 0 ? 0 : 1);
