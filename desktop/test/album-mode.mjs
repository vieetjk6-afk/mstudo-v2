/* Kiểm thử luật CHẾ ĐỘ ALBUM của hợp đồng (src/lib/album-mode.ts).
 *
 * Studio chọn khi tạo hợp đồng: (A) album mặc định tự đồng bộ từ mstudo desktop,
 * hoặc (B) nhập link ảnh riêng. Những điều phải giữ:
 *   1. Chỉ chọn được (A) khi đủ: kết nối desktop + Drive + thư mục gốc (+ gói).
 *      Thiếu thì mặc định (B) và nói rõ thiếu gì.
 *   2. (B) KHÔNG dựng cây thư mục Drive; hợp đồng cũ (null) và (A) vẫn dựng.
 *   3. (B) khách xác nhận (đã duyệt / đang làm / hậu kỳ / hoàn thành) → có album.
 *   4. (B) hoàn thành: có link hoàn thiện + có ảnh → chuyển CHÍNH album sang giao
 *      khách; chưa có → nhắc dán link, KHÔNG tạo album mới.
 *
 * Nạp thẳng code thật.
 */
import {
  normalizeAlbumMode,
  isDesktopReady,
  readinessHints,
  defaultAlbumMode,
  resolveAlbumMode,
  shouldCreateDriveTree,
  isConfirmedStatus,
  shouldEnsureManualAlbum,
  manualCompletionAction,
  needsDesktopWarning,
  isDriveLink,
} from "../../src/lib/album-mode.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const READY = { driveConfigured: true, driveConnected: true, rootFolderReady: true, desktopConnected: true, planAllowsDesktop: true };
const without = (k, v = false) => ({ ...READY, [k]: v });

// ── normalizeAlbumMode ─────────────────────────────────────────────────────
check("desktop", normalizeAlbumMode("desktop"), "desktop");
check("manual", normalizeAlbumMode("manual"), "manual");
check("null → null (hợp đồng cũ)", normalizeAlbumMode(null), null);
check("giá trị lạ → null", normalizeAlbumMode("drive"), null);
check("thiếu cột → null", normalizeAlbumMode(undefined), null);

// ── Sẵn sàng cho album mặc định ───────────────────────────────────────────
check("đủ điều kiện → sẵn sàng", isDesktopReady(READY), true);
check("chưa kết nối desktop", isDesktopReady(without("desktopConnected")), false);
check("chưa kết nối Drive", isDesktopReady(without("driveConnected")), false);
check("chưa có thư mục gốc", isDesktopReady(without("rootFolderReady")), false);
check("máy chủ chưa cấu hình Drive", isDesktopReady(without("driveConfigured")), false);
check("gói không có desktop", isDesktopReady(without("planAllowsDesktop")), false);
check("thiếu cờ gói = coi như có", isDesktopReady({ ...READY, planAllowsDesktop: undefined }), true);
check("không đọc được trạng thái", isDesktopReady(null), false);

check("đủ → không nhắc gì", readinessHints(READY), []);
check(
  "thiếu desktop + thư mục gốc → nhắc hai việc",
  readinessHints({ ...READY, desktopConnected: false, rootFolderReady: false }).map((h) => h.key),
  ["desktop", "root"]
);
check("thư mục gốc → nút tạo ngay", readinessHints(without("rootFolderReady"))[0].action, "create_root");
check(
  "chưa nối Drive thì không nhắc thư mục gốc (làm Drive trước)",
  readinessHints({ ...READY, driveConnected: false, rootFolderReady: false }).map((h) => h.key),
  ["drive"]
);
check("gói chưa có desktop → chỉ nhắc nâng cấp", readinessHints(without("planAllowsDesktop")).map((h) => h.key), ["plan"]);
check("mọi nhắc nhở có link cài đặt", readinessHints({ driveConfigured: true, driveConnected: false, rootFolderReady: false, desktopConnected: false }).every((h) => h.href.startsWith("/dashboard/")), true);

// ── Mặc định & lựa chọn ───────────────────────────────────────────────────
check("sẵn sàng → mặc định album desktop", defaultAlbumMode(READY), "desktop");
check("chưa sẵn sàng → mặc định nhập link", defaultAlbumMode(without("desktopConnected")), "manual");
check("chưa kiểm tra → nhập link", defaultAlbumMode(null), "manual");
check("chọn desktop khi chưa sẵn sàng → lùi về nhập link", resolveAlbumMode("desktop", without("rootFolderReady")), "manual");
check("chọn desktop khi sẵn sàng", resolveAlbumMode("desktop", READY), "desktop");
check("chọn nhập link dù sẵn sàng", resolveAlbumMode("manual", READY), "manual");
check("chưa chọn → theo mặc định", resolveAlbumMode(null, READY), "desktop");

// ── Cây thư mục Drive ─────────────────────────────────────────────────────
check("nhập link riêng → KHÔNG tạo cây Drive", shouldCreateDriveTree("manual"), false);
check("album mặc định → tạo cây Drive", shouldCreateDriveTree("desktop"), true);
check("hợp đồng cũ → giữ hành vi cũ (tạo cây)", shouldCreateDriveTree(null), true);

// ── Khách xác nhận → có album ─────────────────────────────────────────────
for (const st of ["approved", "in_progress", "post_production", "completed"]) {
  check(`${st} = đã xác nhận`, isConfirmedStatus(st), true);
}
for (const st of ["draft", "sent", "cancelled", null]) {
  check(`${st} = chưa xác nhận`, isConfirmedStatus(st), false);
}
check("manual + approved → tạo album", shouldEnsureManualAlbum("manual", "approved"), true);
check("manual + nháp → chưa", shouldEnsureManualAlbum("manual", "draft"), false);
check("manual + makeup (không hậu kỳ ảnh) → không", shouldEnsureManualAlbum("manual", "approved", false), false);
check("desktop → không tạo album trống", shouldEnsureManualAlbum("desktop", "approved"), false);
check("hợp đồng cũ → không", shouldEnsureManualAlbum(null, "completed"), false);

// ── Hoàn thành ở chế độ nhập link riêng ──────────────────────────────────
const st = (o) => ({ exists: true, isDelivery: false, deliverySources: 0, deliveryPhotos: 0, ...o });
check("chưa có album → tạo (rồi nhắc)", manualCompletionAction(st({ exists: false })), "create");
check("đã giao khách → thôi", manualCompletionAction(st({ isDelivery: true })), "already");
check("chưa dán link hoàn thiện → nhắc, KHÔNG tạo album", manualCompletionAction(st({})), "remind");
check("chưa có link mà bấm giao ngay → vẫn nhắc", manualCompletionAction(st({}), { force: true }), "remind");
check("có link + có ảnh → chuyển giai đoạn", manualCompletionAction(st({ deliverySources: 1, deliveryPhotos: 12 })), "promote");
check("có link mà chưa ra ảnh → nhắc", manualCompletionAction(st({ deliverySources: 1 })), "remind");
check("có link chưa ra ảnh + bấm giao ngay → chuyển", manualCompletionAction(st({ deliverySources: 1 }), { force: true }), "promote");

// ── Cảnh báo album mặc định mất kết nối ──────────────────────────────────
check("desktop + mất kết nối → cảnh báo", needsDesktopWarning("desktop", without("desktopConnected")), true);
check("desktop + đủ → không", needsDesktopWarning("desktop", READY), false);
check("manual → không cảnh báo", needsDesktopWarning("manual", without("desktopConnected")), false);
check("chưa có trạng thái → không cảnh báo vội", needsDesktopWarning("desktop", null), false);

// ── Link Drive ───────────────────────────────────────────────────────────
check("link thư mục Drive", isDriveLink("https://drive.google.com/drive/folders/abc123"), true);
check("link khác", isDriveLink("https://photos.app.goo.gl/xyz"), false);

console.log(fail === 0 ? "\nTất cả đều đạt." : `\n${fail} ca KHÔNG đạt.`);
process.exit(fail === 0 ? 0 : 1);
