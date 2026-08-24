/* Kiểm thử ĐỒNG BỘ GOOGLE LỊCH — luật lên lịch + các đường phải tự gọi đồng bộ.
 *
 * Vì sao đáng test: lỗi người dùng báo là "hợp đồng ký xong lịch không tự lên
 * Google, phải vào sửa tay". Nguyên nhân KHÔNG nằm ở logic — nó nằm ở chỗ GỌI:
 * mọi lượt đồng bộ trước đây đều bắt đầu bằng một `fetch` từ trình duyệt đã
 * đăng nhập, mà lúc khách bấm ký ở cổng công khai thì không có trình duyệt nào
 * như thế cả. Kiểu lỗi này `tsc` và `next build` đều xanh.
 *
 * Nên phần 2 của file là một phép quét NGUỒN: bốn đường có thể đổi trạng thái
 * hoặc lịch của hợp đồng mà KHÔNG có phiên đăng nhập của chủ studio đều phải
 * gọi `syncContractCalendar`. Ai gỡ một lời gọi ra là test đỏ.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gcalPlan, GCAL_CONTRACT_STATUSES } from "../../src/lib/gcal-plan.ts";

const SRC = resolve(import.meta.dirname, "../../src");

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

/* ── 1. Luật "hợp đồng nào lên Google Lịch" ──────────────────────────────── */

check("đã duyệt + có ngày → lên lịch", gcalPlan({ status: "approved", event_date: "2026-09-01" }).action, "upsert");
check("đang thực hiện → lên lịch", gcalPlan({ status: "in_progress", event_date: "2026-09-01" }).action, "upsert");
check("đã hoàn thành → vẫn giữ trên lịch", gcalPlan({ status: "completed", event_date: "2026-09-01" }).action, "upsert");

check("bản nháp → chưa lên lịch", gcalPlan({ status: "draft", event_date: "2026-09-01" }).action, "drop");
check("đã gửi mà chưa ký → chưa lên lịch", gcalPlan({ status: "sent", event_date: "2026-09-01" }).action, "drop");
// Huỷ và lùi-về-nháp phải GỠ sự kiện, không phải "bỏ qua": để lại trên Google
// thì thợ vẫn thấy buổi chụp và vẫn tới.
check("đã huỷ → gỡ khỏi lịch", gcalPlan({ status: "cancelled", event_date: "2026-09-01" }).action, "drop");
check("đã duyệt nhưng XOÁ ngày chụp → gỡ khỏi lịch", gcalPlan({ status: "approved", event_date: null }).action, "drop");
check("không ngày, không trạng thái → gỡ", gcalPlan({}).action, "drop");

// Lý do phải đọc được: nó hiện thẳng lên toast của chủ studio.
check(
  "lý do phân biệt được chưa-có-ngày với chưa-ký",
  [gcalPlan({ status: "approved", event_date: null }).reason, gcalPlan({ status: "draft", event_date: "2026-09-01" }).reason],
  ["hợp đồng chưa có ngày chụp", "hợp đồng chưa xác nhận/ký — chỉ lịch đã chốt mới lên Google"],
);

check("đúng ba trạng thái được lên lịch", [...GCAL_CONTRACT_STATUSES], ["approved", "in_progress", "completed"]);

/* ── 2. Mọi đường KHÔNG có phiên đăng nhập đều phải tự đồng bộ ───────────── */

const MUST_SYNC = [
  // Khách bấm ký ở cổng công khai — khoảnh khắc chính xác mà người dùng báo lỗi.
  ["api/c/[token]/route.ts", "khách ký hợp đồng"],
  // Đổi trạng thái từ web (ContractEditor, bảng công việc, danh sách HĐ).
  ["api/studio/contract-status/route.ts", "đổi trạng thái hợp đồng"],
  // App máy tính ghi thẳng qua token thiết bị, không qua trình duyệt web.
  ["api/desktop/mutate/route.ts", "app máy tính sửa hợp đồng"],
];

for (const [rel, what] of MUST_SYNC) {
  const src = readFileSync(resolve(SRC, "app", rel), "utf8");
  check(`${what} → tự đẩy lên Google Lịch`, /syncContractCalendar\s*\(/.test(src), true);
}

// Cron/tự chuyển sang "đang thực hiện" khi tới ngày cũng chạy ngoài trình duyệt.
const advance = readFileSync(resolve(SRC, "lib/contract-status.ts"), "utf8");
check("tự chuyển trạng thái theo ngày → tự đẩy lên Google Lịch", /syncContractCalendar\s*\(/.test(advance), true);

// Hàm dùng chung phải nuốt lỗi: Google hỏng thì việc ký vẫn phải xong.
const sync = readFileSync(resolve(SRC, "lib/gcal-sync.ts"), "utf8");
check("syncContractCalendar có bắt lỗi, không ném ra ngoài", /catch/.test(sync.split("export async function syncContractCalendar")[1] ?? ""), true);

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
