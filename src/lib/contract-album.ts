import { isDeliveryPhase } from "./album-phase";

/**
 * Hợp đồng ↔ album: album NÀO đang là album giao khách của hợp đồng.
 *
 * Một hợp đồng gắn tối đa hai album:
 *   • `selection_album_id` — "Album của hợp đồng". Khách chọn ảnh ở đây, rồi
 *     CHÍNH album này được chuyển sang giai đoạn giao khách (dự án hợp nhất —
 *     cùng một link khách đi từ chọn ảnh tới nhận ảnh).
 *   • `gallery_album_id`   — "Album giao riêng" (tuỳ chọn): album giao khách
 *     tách riêng, kiểu cũ của luồng đồng bộ Drive.
 *
 * Trước đây mỗi nơi tự đoán (cổng khách, trang /a/[slug], tin Zalo "ảnh đã sẵn
 * sàng", cron, màn hợp đồng) và đa số chỉ nhìn `gallery_album_id` — nên studio
 * chuyển album của hợp đồng sang giao khách mà hệ thống vẫn coi là "chưa giao",
 * tạo thêm một album "Giao khách · …" rỗng và đẩy khách sang đó.
 *
 * Luật (một chỗ duy nhất):
 *   1. Album giao riêng đang ở giai đoạn giao khách + đã xuất bản → nó thắng.
 *   2. Không thì album của hợp đồng, nếu nó đang ở giai đoạn giao khách + đã
 *      xuất bản.
 *   3. Không có cái nào → chưa giao (null).
 * `status` không truyền (undefined) thì coi như đã xuất bản — chỗ gọi nào không
 * nạp cột status thì tự chịu; truyền `null`/"draft" là chưa xuất bản.
 *
 * File THUẦN: không nhập gì của app ngoài album-phase (cũng thuần), để chạy được
 * ở server, trình duyệt và bộ kiểm thử Node (desktop/test/contract-album.mjs).
 */
export type LinkedAlbumLike = {
  id: string;
  phase?: string | null;
  is_gallery?: boolean | null;
  status?: string | null;
};

/** Album đang ở giai đoạn giao khách VÀ khách xem được. */
export function isLiveDelivery(a: LinkedAlbumLike | null | undefined): boolean {
  if (!a) return false;
  if (a.status !== undefined && a.status !== "published") return false;
  return isDeliveryPhase(a);
}

export type DeliveredAlbum<T extends LinkedAlbumLike> = { album: T; via: "gallery" | "selection" };

/** Album giao khách của hợp đồng (xem luật ở đầu file), hoặc null nếu chưa giao. */
export function resolveDeliveredAlbum<T extends LinkedAlbumLike>(linked: {
  gallery?: T | null;
  selection?: T | null;
}): DeliveredAlbum<T> | null {
  if (linked.gallery && isLiveDelivery(linked.gallery)) return { album: linked.gallery, via: "gallery" };
  if (linked.selection && isLiveDelivery(linked.selection)) return { album: linked.selection, via: "selection" };
  return null;
}

/** Một dòng trong ô chọn album của màn hợp đồng (page.tsx dựng, ContractEditor vẽ). */
export type ContractAlbumOption = {
  id: string;
  title: string;
  slug: string;
  phase: "selection" | "delivery";
  published: boolean;
  /** Album đang gắn ở một hợp đồng KHÁC. */
  linkedElsewhere: boolean;
};

/** Nhãn ô chọn: "Tên album · Giao khách · đang gắn HĐ khác". */
export function albumOptionLabel(a: ContractAlbumOption): string {
  return [a.title, albumPhaseLabel(a), a.linkedElsewhere ? "đang gắn HĐ khác" : null, a.published ? null : "nháp"]
    .filter(Boolean)
    .join(" · ");
}

/** Nhãn giai đoạn ngắn cho huy hiệu / ô chọn album. */
export function albumPhaseLabel(a: { phase?: string | null; is_gallery?: boolean | null } | null | undefined): string {
  return isDeliveryPhase(a) ? "Giao khách" : "Chọn ảnh";
}

/**
 * Các cột autosave của màn hợp đồng KHÔNG ĐƯỢC ghi. Trạng thái đi qua route
 * /api/studio/contract-status (đóng dấu completed_at, tạo album, Google Lịch);
 * hai cột album lưu NGAY khi chọn. Ghi chúng từ state cục bộ (có thể cũ) là
 * cách xoá mất album server vừa gắn. desktop/test/contract-album.mjs quét
 * autosaveContract để giữ luật này.
 */
export const AUTOSAVE_FORBIDDEN_KEYS = ["status", "gallery_album_id", "selection_album_id"] as const;
