/* Kiểm thử BƯỚC SHELL của .github/workflows/quet-khuon-mat.yml.
 *
 * Vì sao một bài kiểm thử cho một file YAML. File đó chạy KHÔNG AI NGỒI XEM, mỗi
 * 10 phút, và việc duy nhất của nó là nói ra sự thật khi có chuyện. Nó đã hỏng
 * đúng ở việc đó — lượt cron 05:12 ngày 10/09/2026 báo đỏ với đúng một chữ
 * "Process completed with exit code 5" và không một manh mối nào:
 *
 *   ly_do=$(jq -r '…' /tmp/ra.json 2>/dev/null)
 *   echo "::error::App trả ${ma}. ${ly_do:-…}"
 *
 * jq 1.7 thoát mã 5 khi thân KHÔNG phải JSON (trang lỗi HTML của Vercel, hoặc
 * rỗng vì curl hết giờ). Với `bash -e`, một phép GÁN từ lệnh hỏng kết thúc script
 * ngay tại dòng gán — TRƯỚC dòng echo. Nên chế độ hỏng tệ nhất lại là chế độ duy
 * nhất không nói được gì, và dòng ::error:: được thêm vào để chẩn đoán thì chỉ
 * chạy trong những trường hợp vốn đã dễ chẩn đoán.
 *
 * Bài này chạy CHÍNH cái script trong YAML — trích ra, thay đúng lượt gọi mạng
 * bằng một file dựng sẵn — rồi đòi từng hình dạng thân trả về phải cho ra đúng
 * dòng chữ và đúng mã thoát. Sửa YAML mà làm mất một câu chẩn đoán thì đỏ ở đây.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

const YAML = ".github/workflows/quet-khuon-mat.yml";
const yml = readFileSync(YAML, "utf8");

/* ── Trích bước shell ra khỏi YAML ───────────────────────────────────────── */
const moc = "        run: |\n";
ok("tìm được bước shell trong YAML", yml.includes(moc));
const than = yml.slice(yml.indexOf(moc) + moc.length);
const script = than
  .split("\n")
  .map((l) => (l.startsWith(" ".repeat(10)) ? l.slice(10) : l))
  .join("\n");

/*
 * Thay lượt gọi mạng bằng `cp` từ file mẫu. Mọi thứ khác — thứ tự kiểm tra, câu
 * jq, điều kiện dừng sớm — là code THẬT trong YAML, không phải bản chép lại.
 */
const daThay = script.replace(/ma=\$\(curl[\s\S]*?\|\| echo "000"\)/, 'cp "${MAU}" /tmp/ra.json; ma="${MA}"');
// Chỉ đòi không còn LỆNH curl nào chạy được; chữ "curl" trong dòng chú thích của
// YAML thì cứ để nguyên — bắt cả nó là bắt sai, và làm bài kiểm đỏ vì một câu
// giải thích.
ok("thay được lượt gọi curl bằng file dựng sẵn", daThay !== script && !/^\s*[^#\n]*\bcurl\b/m.test(daThay));

const thu = mkdtempSync(join(tmpdir(), "cron-log-"));
const duong = join(thu, "buoc.sh");
// Một lượt mỗi lần chạy: bài này kiểm CÂU CHỮ và MÃ THOÁT, không kiểm vòng lặp.
writeFileSync(duong, daThay.replace("sleep 3", "true").replace("for i in $(seq 1 8); do", "for i in 1; do"));

function chay(than_json, ma) {
  const mau = join(thu, "mau.json");
  writeFileSync(mau, than_json);
  rmSync("/tmp/ra.json", { force: true });
  try {
    const out = execFileSync("bash", ["-e", duong], {
      env: { ...process.env, SECRET: "x", BASE: "y", MAU: mau, MA: String(ma) },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { out, code: 0 };
  } catch (e) {
    return { out: `${e.stdout ?? ""}${e.stderr ?? ""}`, code: e.status };
  }
}

/* ── Các hình dạng thân trả về mà route thật sinh ra ─────────────────────── */
const LANH = '{"ok":true,"ms":45,"daNhinThay":{"canGom":["c"],"canQuet":[{"id":"a","pending":300}]},"reports":[{"albumId":"c","clustered":3},{"albumId":"a","scanned":42,"daXacNhan":42}]}';
const GOM_0 = '{"ok":true,"ms":45,"daNhinThay":{"canGom":["a","b"],"canQuet":[]},"reports":[{"albumId":"a","clustered":0},{"albumId":"b","clustered":0}]}';
const GHI_KHONG_AN = '{"ok":true,"ms":45,"daNhinThay":{"canGom":[],"canQuet":[{"id":"a","pending":343}]},"reports":[{"albumId":"a","scanned":0,"daXacNhan":0,"stoppedBy":"ghi-khong-an"}]}';
const HET = '{"ok":true,"ms":12,"daNhinThay":{"canGom":[],"canQuet":[]},"reports":[]}';
const TAT = '{"ok":true,"tat":true,"note":"FACE_SCAN_OFF=1"}';
const LOI = '{"ok":false,"error":"column faces_scanned_at does not exist","hint":"Chạy supabase/khuon-mat.sql","reports":[]}';
const TRANG_HTML = "<!DOCTYPE html><html>An error occurred with this application.</html>";

{
  const { out, code } = chay(LANH, 200);
  ok("lượt lành: in đủ bốn con số", /quét 42 ảnh · xác nhận 42 mốc · gom 3 người/.test(out), out.trim());
  ok("lượt lành: in cả độ dài hàng đợi", /hàng đợi 1 quét \/ 1 gom/.test(out), out.trim());
  ok("lượt lành: không dừng sớm", !/dừng sớm/.test(out) && code === 0);
}

/*
 * BA trạng thái mà bản trước in ra Y HỆT NHAU — cả ba đều là "quét 0 ảnh". Đây
 * là lý do dòng log phải mang theo độ dài hàng đợi: ba chuyện này cần ba cách
 * sửa khác nhau, mà đọc log cũ thì không tách nổi.
 */
{
  const a = chay(HET, 200);
  const b = chay(GOM_0, 200);
  const c = chay(GHI_KHONG_AN, 200);
  ok("hết việc thật → 0 quét / 0 gom", /hàng đợi 0 quét \/ 0 gom/.test(a.out), a.out.trim());
  ok("gom mãi album không có mặt → 0 quét / 2 gom", /hàng đợi 0 quét \/ 2 gom/.test(b.out), b.out.trim());
  ok("tìm ra album cần quét mà quét 0 → 1 quét / 0 gom", /hàng đợi 1 quét \/ 0 gom/.test(c.out), c.out.trim());
  ok(
    "ba trạng thái cho ra ba dòng log KHÁC nhau",
    new Set([a.out, b.out, c.out].map((s) => s.trim())).size === 3
  );
  ok("hết việc thì dừng sớm", /Không còn gì để quét/.test(a.out) && a.code === 0);
  ok("còn việc thì KHÔNG dừng sớm", !/Không còn gì để quét/.test(b.out));
  ok("album ghi không ăn thì có cảnh báo ⚠", /⚠ CÓ ALBUM GHI KHÔNG ĂN/.test(c.out), c.out.trim());
  ok("lượt lành thì KHÔNG có cảnh báo ⚠", !/⚠/.test(chay(LANH, 200).out));
}

/*
 * BA nguyên nhân của "quét 0 ảnh" — log cũ in cả ba y hệt nhau, và chúng cần ba
 * cách sửa khác nhau. Đây là lý do dòng log phải mang `lỗi tải` và câu lỗi mẫu.
 */
{
  const DRIVE_TU_CHOI = '{"ok":true,"ms":45,"daNhinThay":{"canGom":[],"canQuet":[{"id":"a","pending":300}]},"reports":[{"albumId":"a","scanned":0,"failed":37,"daXacNhan":0,"loiMau":"khong_tai_duoc_anh","stoppedBy":"tai-quet-loi"}]}';
  const THIEU_MO_HINH = '{"ok":true,"ms":45,"daNhinThay":{"canGom":[],"canQuet":[{"id":"a","pending":300}]},"reports":[{"albumId":"a","scanned":0,"failed":3,"daXacNhan":0,"loiMau":"ssd_mobilenetv1 model weights not found","stoppedBy":"tai-quet-loi"}]}';
  const HANG_DOI_LECH = '{"ok":true,"ms":2,"daNhinThay":{"canGom":[],"canQuet":[{"id":"a","pending":300}]},"reports":[{"albumId":"a","scanned":0,"failed":0,"daXacNhan":0,"loiMau":null,"stoppedBy":"xong"}]}';

  const a = chay(DRIVE_TU_CHOI, 200);
  ok("Drive từ chối tải: in số lỗi tải", /lỗi tải 37/.test(a.out), a.out.trim());
  ok("Drive từ chối tải: in câu lỗi mẫu", /lỗi mẫu: khong_tai_duoc_anh/.test(a.out), a.out.trim());
  ok("Drive từ chối tải: cảnh báo album tắc", /⚠ ALBUM TẮC/.test(a.out), a.out.trim());

  const b = chay(THIEU_MO_HINH, 200);
  ok("thiếu trọng số mô hình: câu lỗi nói ra", /model weights not found/.test(b.out), b.out.trim());

  const c = chay(HANG_DOI_LECH, 200);
  ok("hàng đợi lệch: lỗi tải 0 và KHÔNG cảnh báo tắc", /lỗi tải 0/.test(c.out) && !/⚠/.test(c.out), c.out.trim());
  ok(
    "ba nguyên nhân cho ra ba dòng log KHÁC nhau",
    new Set([a.out, b.out, c.out].map((x) => x.trim())).size === 3
  );
  // `pending: 300` là dữ liệu của studio — không được lọt ra log công khai.
  ok("không nguyên nhân nào làm lọt số ảnh còn tồn", ![a.out, b.out, c.out].some((o) => /300/.test(o)));
}

{
  // FACE_SCAN_OFF=1: thân KHÔNG có khoá `reports`. Bản grep chuỗi `"reports":[]`
  // không khớp, nên nó gọi tiếp bảy lượt nữa vào một bộ quét đang tắt.
  const { out, code } = chay(TAT, 200);
  ok("bộ quét tắt: nói ra", /đang TẮT/.test(out), out.trim());
  ok("bộ quét tắt: thoát 0, không gọi thêm lượt", code === 0 && !/lượt 2/.test(out));
}

/* ── Đường LỖI — chỗ đã hỏng thật ────────────────────────────────────────── */
{
  const { out, code } = chay(LOI, 500);
  ok("500 có thân JSON: in đúng câu lỗi của app", /column faces_scanned_at does not exist/.test(out), out.trim());
  ok("500 có thân JSON: in cả gợi ý việc phải làm", /khuon-mat\.sql/.test(out), out.trim());
  ok("500 có thân JSON: thoát 1", code === 1);
}

for (const [ten, than] of [
  ["trang lỗi HTML của Vercel", TRANG_HTML],
  ["thân RỖNG (curl hết giờ)", ""],
]) {
  const { out, code } = chay(than, 500);
  // Đây là hồi quy cho lượt 05:12 ngày 10/09: mã thoát 5 và KHÔNG một chữ nào.
  ok(`${ten}: vẫn in được dòng ::error::`, /::error::/.test(out), JSON.stringify(out));
  ok(`${ten}: nói rõ thân không phải JSON`, /không phải JSON/.test(out), out.trim());
  ok(`${ten}: thoát 1 chứ không phải 5`, code === 1, `thoát ${code}`);
}

{
  // 200 mà thân không phải JSON: mọi câu jq phía sau đều thoát 5 và giết script.
  const { out, code } = chay(TRANG_HTML, 200);
  ok("200 nhưng thân không phải JSON: có dòng ::error::", /::error::/.test(out), JSON.stringify(out));
  ok("200 nhưng thân không phải JSON: thoát 1", code === 1, `thoát ${code}`);
}

{
  const { out, code } = chay("{}", 401);
  ok("401: chỉ đúng vào CRON_SECRET lệch nhau", /CRON_SECRET ở GitHub khác với trên Vercel/.test(out), out.trim());
  ok("401: thoát 1", code === 1);
}

/* ── Hàng rào riêng tư: log Actions của repo public ──────────────────────── */
{
  // `pending: 343` và id album nằm trong thân JSON. Chúng KHÔNG được lọt ra log:
  // đó là số liệu kinh doanh của studio, không phải thứ cần cho chẩn đoán từ xa.
  const { out } = chay(GHI_KHONG_AN, 200);
  ok("không in số ảnh còn tồn của album", !/343/.test(out), out.trim());
  const { out: o2 } = chay(LANH, 200);
  ok("không in id album", !/"a"|albumId/.test(o2), o2.trim());
}

rmSync(thu, { recursive: true, force: true });
console.log(`\n${fail === 0 ? "Tất cả đều đạt" : `${fail} lỗi`}`);
process.exit(fail === 0 ? 0 : 1);
