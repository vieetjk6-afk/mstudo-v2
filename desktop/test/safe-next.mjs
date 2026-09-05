/* Kiểm thử chốt chặn open-redirect của tham số `?next=`.
 *
 * Vì sao đáng test: chốt này đứng giữa "đăng nhập xong về đúng trang" và "đăng
 * nhập THẬT trên mstudo.com rồi bị ném sang trang giả". Bản cũ chỉ kiểm tra
 * `startsWith("/") && !startsWith("//")` nên `/\evil.com` lọt — trình duyệt coi
 * dấu gạch ngược là gạch chéo với scheme http/https, thành ra:
 *
 *     window.location.assign("/\\evil.com")  →  https://evil.com/
 *
 * Bài test dưới đây khoá lại đúng lớp bypass đó (gạch ngược, bản %5C, ký tự
 * điều khiển bị trình duyệt lược bỏ) VÀ kiểm luôn rằng đường dẫn nội bộ hợp lệ
 * vẫn đi qua — vì một chốt chặn quá tay thì mọi người đăng nhập xong đều rơi về
 * trang mặc định, và không ai báo lỗi đó cả.
 *
 * Nạp thẳng code thật ở src/lib/safe-next.ts.
 */
import { safeNextPath, DEFAULT_NEXT } from "../../src/lib/safe-next.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

/* ── Đường dẫn nội bộ hợp lệ: PHẢI đi qua nguyên vẹn ────────────────────── */
check("đường dẫn thường", safeNextPath("/dashboard/albums"), "/dashboard/albums");
check("kèm query", safeNextPath("/dashboard/studio?tab=hop-dong"), "/dashboard/studio?tab=hop-dong");
check("kèm neo", safeNextPath("/dashboard/studio#lich"), "/dashboard/studio#lich");
check("dấu tiếng Việt đã mã hoá", safeNextPath("/a/anh-c%C6%B0%E1%BB%9Bi"), "/a/anh-c%C6%B0%E1%BB%9Bi");

/* ── Rỗng / thiếu: về trang mặc định ─────────────────────────────────────── */
check("null", safeNextPath(null), DEFAULT_NEXT);
check("undefined", safeNextPath(undefined), DEFAULT_NEXT);
check("chuỗi rỗng", safeNextPath(""), DEFAULT_NEXT);
check("fallback tự chọn", safeNextPath("", "/album"), "/album");

/* ── Open redirect kiểu cũ (bản cũ đã chặn được) ─────────────────────────── */
check("URL tuyệt đối", safeNextPath("https://evil.com"), DEFAULT_NEXT);
check("không scheme", safeNextPath("//evil.com"), DEFAULT_NEXT);
check("javascript:", safeNextPath("javascript:alert(1)"), DEFAULT_NEXT);
check("đường dẫn tương đối", safeNextPath("dashboard"), DEFAULT_NEXT);

/* ── ĐÂY là lớp bypass bản cũ để lọt ─────────────────────────────────────── */
check("gạch ngược", safeNextPath("/\\evil.com"), DEFAULT_NEXT);
check("gạch chéo rồi gạch ngược", safeNextPath("/\\/evil.com"), DEFAULT_NEXT);
check("gạch ngược mã hoá", safeNextPath("/%5Cevil.com"), DEFAULT_NEXT);
check("gạch ngược mã hoá thường", safeNextPath("/%5cevil.com"), DEFAULT_NEXT);
check("tab chen giữa", safeNextPath("/\t/evil.com"), DEFAULT_NEXT);
check("xuống dòng chen giữa", safeNextPath("/\n\\evil.com"), DEFAULT_NEXT);
check("NUL chen giữa", safeNextPath("/\u0000/evil.com"), DEFAULT_NEXT);
check("khoảng trắng đầu", safeNextPath(" //evil.com"), DEFAULT_NEXT);

/* ── Chốt lại bằng chính bộ phân giải URL của trình duyệt ────────────────
 * Không tin vào mắt mình nữa: đem kết quả đi phân giải như trình duyệt sẽ làm
 * và đòi host phải VẪN LÀ mstudo.com. Bài này bắt được mọi biến thể tương lai
 * mà danh sách ở trên chưa nghĩ ra.                                          */
const ORIGIN = "https://mstudo.com";
const ATTACKS = [
  "https://evil.com", "//evil.com", "/\\evil.com", "/\\/evil.com",
  "/%5Cevil.com", "/\t/evil.com", "/\n\\evil.com", "\\\\evil.com",
  "/\u0000\\evil.com", "  /\\evil.com", "https:evil.com", "/..\\..\\evil.com",
];
for (const raw of ATTACKS) {
  const resolved = new URL(safeNextPath(raw), ORIGIN);
  check(`phân giải vẫn ở mstudo.com: ${JSON.stringify(raw)}`, resolved.host, "mstudo.com");
}

console.log(fail === 0 ? "\nTất cả OK" : `\n${fail} bài HỎNG`);
process.exit(fail === 0 ? 0 : 1);
