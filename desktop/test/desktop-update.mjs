/* Kiểm thử ĐƯỜNG TỰ CẬP NHẬT của app desktop.
 *
 * Vì sao đáng test: đường này gãy KHÔNG kêu một tiếng nào. App hỏi GitHub API
 * không kèm đăng nhập nên chỉ đọc được release của repo CÔNG KHAI; repo mã
 * nguồn thì riêng tư. Build xong, file cài nằm ở repo riêng tư, app đi tìm ở
 * repo công khai, và người dùng bấm "Kiểm tra cập nhật" chỉ thấy "Bạn đang dùng
 * bản mới nhất" — mãi mãi, không có lấy một dòng lỗi. Đã xảy ra thật.
 *
 * Bốn chỗ phải khớp nhau và không chỗ nào tự nhắc chỗ kia:
 *   ui/app.js            RELEASE_REPO + RELEASE_TAG  (app đi tìm ở đâu)
 *   src-tauri/src/main.rs download_and_run           (cho phép tải từ đâu)
 *   workflow             RELEASE_CHANNEL_REPO        (đẩy file cài lên đâu)
 *   4 file phiên bản     APP_VERSION = version       (app tự biết mình bản nào)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = import.meta.dirname;
const read = (p) => readFileSync(resolve(dir, p), "utf8");
const js = read("../ui/app.js");
const rs = read("../src-tauri/src/main.rs");
const wf = read("../../.github/workflows/desktop-build.yml");

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const pick = (src, re, label) => {
  const m = re.exec(src);
  if (!m) { fail++; console.log(`✗ không đọc được ${label}`); return ""; }
  return m[1];
};

/* ── Kênh cập nhật: app tìm ở đâu, workflow đẩy lên đâu ───────────────────── */
const releaseRepo = pick(js, /const RELEASE_REPO = "([^"]+)"/, "RELEASE_REPO trong ui/app.js");
const releaseTag = pick(js, /const RELEASE_TAG = "([^"]+)"/, "RELEASE_TAG trong ui/app.js");
const channelRepo = pick(wf, /RELEASE_CHANNEL_REPO:\s*(\S+)/, "RELEASE_CHANNEL_REPO trong workflow");
const lc = (s) => s.toLowerCase(); // GitHub không phân biệt hoa thường ở tên repo

check("workflow đẩy bản cài lên ĐÚNG repo app đi tìm", lc(channelRepo), lc(releaseRepo));
check("app tìm bản mới ở kênh desktop-dev", releaseTag, "desktop-dev");
check("workflow đẩy vào đúng tag đó", new RegExp(`tag_name:\\s*${releaseTag}\\b`).test(wf), true);
// Repo mã nguồn là repo RIÊNG TƯ: đẩy vào release của chính nó thì app đọc ra
// 404. Nếu ai đó đổi RELEASE_REPO về repo này, test phải đỏ ngay.
check("kênh cập nhật KHÔNG phải repo mã nguồn (repo riêng tư)", lc(releaseRepo) === "vieetjk6-afk/mstudo-v2", false);
// Bước đẩy phải thật sự nằm trong workflow (không chỉ có biến).
check("workflow có bước đẩy bản cài lên kênh cập nhật", /repository:\s*\$\{\{\s*env\.RELEASE_CHANNEL_REPO\s*\}\}/.test(wf), true);
check("bước đẩy dùng secret RELEASE_TOKEN", /token:\s*\$\{\{\s*secrets\.RELEASE_TOKEN\s*\}\}/.test(wf), true);

/* ── Rust chỉ cho tải file cài từ đúng kênh đó ────────────────────────────── */
// download_and_run CHẠY file .exe tải về. Nới cái allowlist này ra là biến nó
// thành công cụ chạy mã tuỳ ý khi JS bị lợi dụng — nên nó phải hẹp, và phải
// hẹp ĐÚNG vào repo mà workflow đẩy lên, không thì tải về lại bị chặn.
const owner = releaseRepo.split("/")[0];
const allowHost = pick(rs, /parsed\.host_str\(\) != Some\("([^"]+)"\)/, "host cho phép trong download_and_run");
const allowPath = pick(rs, /!parsed\.path\(\)\.starts_with\("([^"]+)"\)/, "đường dẫn cho phép trong download_and_run");
check("chỉ tải file cài từ github.com", allowHost, "github.com");
check("đường dẫn cho phép khớp chủ repo của kênh cập nhật", lc(allowPath), lc(`/${owner}/`));
check("bắt buộc https", /parsed\.scheme\(\) != "https"/.test(rs), true);

/* ── Bốn chỗ ghi số phiên bản phải bằng nhau ──────────────────────────────── */
// APP_VERSION là con số app tự nhận về mình; số trong tên file cài lấy từ
// tauri.conf.json. Lệch nhau một nhịp là app hoặc không thấy bản mới, hoặc cài
// đi cài lại mãi một bản.
const versions = {
  "ui/app.js APP_VERSION": pick(js, /const APP_VERSION = "([^"]+)"/, "APP_VERSION"),
  "tauri.conf.json": JSON.parse(read("../src-tauri/tauri.conf.json")).version,
  "desktop/package.json": JSON.parse(read("../package.json")).version,
  "Cargo.toml": pick(read("../src-tauri/Cargo.toml"), /^version = "([^"]+)"/m, "version trong Cargo.toml"),
  "Cargo.lock": pick(read("../src-tauri/Cargo.lock"), /name = "mstudo-desktop"\nversion = "([^"]+)"/, "version trong Cargo.lock"),
};
check("bốn nơi ghi phiên bản đều khớp nhau", [...new Set(Object.values(versions))].length, 1);
if ([...new Set(Object.values(versions))].length !== 1) console.log("   ", versions);

console.log(fail === 0 ? "\nTất cả đạt." : `\n${fail} mục KHÔNG đạt.`);
process.exit(fail === 0 ? 0 : 1);
