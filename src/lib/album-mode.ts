/**
 * CHẾ ĐỘ ALBUM CỦA HỢP ĐỒNG — `studio_contracts.album_mode`
 * (supabase/migrations/che_do_album_hop_dong.sql).
 *
 *   • "desktop" — Album mặc định: app MStudo Desktop đổ ảnh lên cây thư mục
 *     Drive của hợp đồng (JPG Goc → chọn ảnh, File ChinhSua → giao khách), máy
 *     chủ tự tạo album + tự chuyển sang giao khách (@/lib/studio-drive).
 *   • "manual"  — Nhập link riêng: KHÔNG dựng cây Drive. Khách xác nhận hợp đồng
 *     (ký / nhận cọc / studio duyệt) thì tạo MỘT album trống; studio có link ảnh
 *     lúc nào thì dán vào album đó (link chọn ảnh → stage 'selection', link ảnh
 *     hoàn thiện → stage 'delivery'). Cùng một album đi từ chọn ảnh sang giao
 *     khách — không bao giờ đẻ album giao riêng.
 *   • null      — hợp đồng cũ (trước khi có cột): giữ y hành vi tự động cũ.
 *
 * File này THUẦN (không import gì) để kiểm thử bằng Node:
 * desktop/test/album-mode.mjs.
 */

export type AlbumMode = "desktop" | "manual";

export const ALBUM_MODE_LABEL: Record<AlbumMode, string> = {
  desktop: "Album mặc định — tự đồng bộ từ mstudo desktop",
  manual: "Nhập link ảnh riêng",
};

/** Giá trị lạ / rỗng → null (hợp đồng cũ, giữ hành vi cũ). */
export function normalizeAlbumMode(v: unknown): AlbumMode | null {
  return v === "desktop" || v === "manual" ? v : null;
}

/** Studio đã đủ điều kiện dùng album mặc định (đồng bộ từ desktop) chưa. */
export type AlbumModeReadiness = {
  /** Máy chủ đã cấu hình OAuth Drive cho studio (biến môi trường). */
  driveConfigured: boolean;
  /** Studio đã kết nối Google Drive (có refresh token). */
  driveConnected: boolean;
  /** Đã có thư mục gốc mặc định trên Drive (studio_drive.root_folder_id). */
  rootFolderReady: boolean;
  /** Có ít nhất một máy MStudo Desktop đang hoạt động (chưa thu hồi). */
  desktopConnected: boolean;
  /** Gói hiện tại có MStudo Desktop (gói Studio đầy đủ). Thiếu = coi như có. */
  planAllowsDesktop?: boolean;
};

export type ReadinessHint = { key: string; text: string; href: string; action?: "create_root" };

export const DRIVE_SETUP_HREF = "/dashboard/studio/drive-sync";
export const DESKTOP_SETUP_HREF = "/dashboard/studio/desktop";

/** Đủ cả bốn điều kiện thì mới chọn được album mặc định. */
export function isDesktopReady(r: AlbumModeReadiness | null | undefined): boolean {
  if (!r) return false;
  return (
    r.planAllowsDesktop !== false &&
    r.driveConfigured &&
    r.driveConnected &&
    r.rootFolderReady &&
    r.desktopConnected
  );
}

/** Những việc còn thiếu, nói bằng lời của studio + chỗ để làm. Rỗng = sẵn sàng. */
export function readinessHints(r: AlbumModeReadiness | null | undefined): ReadinessHint[] {
  if (!r) return [{ key: "unknown", text: "Chưa kiểm tra được kết nối mstudo desktop / Google Drive.", href: DESKTOP_SETUP_HREF }];
  const out: ReadinessHint[] = [];
  if (r.planAllowsDesktop === false) {
    out.push({ key: "plan", text: "Gói hiện tại chưa có mstudo desktop — nâng cấp gói Studio để dùng album tự đồng bộ.", href: "/dashboard/upgrade" });
    return out;
  }
  if (!r.desktopConnected) {
    out.push({ key: "desktop", text: "Chưa kết nối app mstudo desktop trên máy tính của studio.", href: DESKTOP_SETUP_HREF });
  }
  if (!r.driveConfigured) {
    out.push({ key: "drive_config", text: "Máy chủ chưa bật đồng bộ Google Drive cho studio — liên hệ quản trị mstudo.", href: DRIVE_SETUP_HREF });
  } else if (!r.driveConnected) {
    out.push({ key: "drive", text: "Chưa kết nối Google Drive của studio.", href: DRIVE_SETUP_HREF });
  } else if (!r.rootFolderReady) {
    out.push({ key: "root", text: "Chưa tạo thư mục mặc định của studio trên Google Drive.", href: DRIVE_SETUP_HREF, action: "create_root" });
  }
  return out;
}

/** Mặc định khi tạo hợp đồng: sẵn sàng → album mặc định, chưa → nhập link riêng. */
export function defaultAlbumMode(r: AlbumModeReadiness | null | undefined): AlbumMode {
  return isDesktopReady(r) ? "desktop" : "manual";
}

/**
 * Chế độ thực sự được lưu khi studio chọn `wanted`. Chọn album mặc định mà chưa
 * sẵn sàng thì lùi về nhập link riêng (cách thủ công) — đúng yêu cầu "nhắc studio
 * và dùng cách thủ công".
 */
export function resolveAlbumMode(wanted: AlbumMode | null | undefined, r: AlbumModeReadiness | null | undefined): AlbumMode {
  if (wanted === "manual") return "manual";
  if (wanted === "desktop") return isDesktopReady(r) ? "desktop" : "manual";
  return defaultAlbumMode(r);
}

/** Có dựng cây thư mục Drive / album tự động cho hợp đồng này không. */
export function shouldCreateDriveTree(mode: AlbumMode | null | undefined): boolean {
  return mode !== "manual";
}

/** Trạng thái coi như KHÁCH ĐÃ XÁC NHẬN hợp đồng (ký / nhận cọc / studio duyệt). */
const CONFIRMED = new Set(["approved", "in_progress", "post_production", "completed"]);

export function isConfirmedStatus(status: string | null | undefined): boolean {
  return CONFIRMED.has(status || "");
}

/**
 * Chế độ nhập link riêng: hợp đồng ở trạng thái này thì phải có album chưa.
 * Hợp đồng cũ / album mặc định: không áp dụng (luồng Drive tự lo).
 */
export function shouldEnsureManualAlbum(
  mode: AlbumMode | null | undefined,
  status: string | null | undefined,
  hasPhotoWork = true
): boolean {
  return mode === "manual" && hasPhotoWork && isConfirmedStatus(status);
}

/** Tình trạng album của hợp đồng tại lúc hoàn thành. */
export type ManualAlbumState = {
  /** Hợp đồng đã có album (selection_album_id). */
  exists: boolean;
  /** Album đã ở giai đoạn giao khách. */
  isDelivery: boolean;
  /** Số nguồn stage='delivery' (link ảnh hoàn thiện đã dán). */
  deliverySources: number;
  /** Số ảnh/video đã đồng bộ từ các nguồn giao khách. */
  deliveryPhotos: number;
};

/**
 * Hoàn thành hợp đồng ở chế độ nhập link riêng thì làm gì với album:
 *   • "already"  — album đã giao khách, không làm gì.
 *   • "create"   — chưa có album: tạo album trống rồi nhắc dán link hoàn thiện.
 *   • "promote"  — đã có link hoàn thiện VÀ đã có ảnh (hoặc studio bấm giao
 *                  ngay) → chuyển CHÍNH album sang giao khách.
 *   • "remind"   — chưa có link / link chưa ra ảnh → giữ chọn ảnh, nhắc studio
 *                  "Dán link ảnh hoàn thiện để giao khách". KHÔNG tạo album mới.
 */
export type ManualCompletionAction = "already" | "create" | "promote" | "remind";

export function manualCompletionAction(s: ManualAlbumState, opts?: { force?: boolean }): ManualCompletionAction {
  if (!s.exists) return "create";
  if (s.isDelivery) return "already";
  if (s.deliverySources === 0) return "remind";
  if (s.deliveryPhotos > 0 || opts?.force) return "promote";
  return "remind";
}

/**
 * Hợp đồng chọn album mặc định nhưng điều kiện đã mất (gỡ máy desktop, ngắt
 * Drive…) → cần cảnh báo ở tab Sản phẩm kèm nút "Chuyển sang nhập link riêng".
 */
export function needsDesktopWarning(mode: AlbumMode | null | undefined, r: AlbumModeReadiness | null | undefined): boolean {
  return mode === "desktop" && !!r && !isDesktopReady(r);
}

/** Nhận diện link Google Drive dán vào (thư mục hoặc file). */
export function isDriveLink(url: string): boolean {
  const u = (url || "").trim();
  return /^https?:\/\/(drive|docs)\.google\.com\//i.test(u);
}
