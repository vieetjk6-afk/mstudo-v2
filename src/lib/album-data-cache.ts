import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPhotos } from "@/lib/photos";
import { loadAlbumPeople } from "@/lib/face-people-load";
import type { PeopleLink, PeopleRow } from "@/lib/face-people";

/* ═══════════════════════════════════════════════════════════════════════════
   DỮ LIỆU NẶNG CỦA TRANG ALBUM KHÁCH — nhớ giữa các request.

   Vì sao: link album giao khách được gửi cho cả họ hàng, bạn bè; MỖI lượt mở
   trước đây đọc lại toàn bộ danh sách ảnh (album 1.500 ảnh ≈ 200 KB) và mọi
   liên kết người–ảnh của tìm theo khuôn mặt (hàng nghìn dòng ≈ vài trăm KB) từ
   Supabase. Dự án từng bị khoá vì vượt 5 GB egress của gói Free, mà gần như
   toàn bộ là byte truy vấn database. Nhớ phần này vài phút là 100 lượt mở chỉ
   còn tốn như 1–2 lượt.

   CÁI GÌ KHÔNG NHỚ: dòng `albums` (trạng thái xuất bản, mật khẩu, giai đoạn)
   luôn đọc mới ở trang — studio khoá / gỡ album là có hiệu lực ngay. Nguồn
   ảnh, lựa chọn của khách, ảnh in, góp ý cũng đọc mới (đều nhỏ). Ở đây chỉ có
   danh sách ảnh và khuôn mặt.

   CŨ ĐI KHI NÀO: khoá nhớ có "phiên bản dữ liệu" = số ảnh (bảng đếm sẵn
   album_photo_counts) + mốc gom khuôn mặt — đồng bộ Drive thêm / bớt ảnh, xoá
   ảnh, quét xong khuôn mặt là khoá đổi và lượt mở kế tiếp đọc mới ngay. Đổi tên
   / sắp xếp lại thì trễ tối đa TTL (5 phút) — cùng cỡ với CDN của
   /api/album/[slug]/photos (10 phút) vốn đã có từ trước. Route máy chủ ghi dữ
   liệu album thì gọi revalidateAlbumData() để bỏ ngay.

   Đọc lỗi thì NÉM trong hàm được nhớ (strict) — không bao giờ nhớ một album
   thiếu ảnh — và lùi về đọc thẳng không nhớ để trang vẫn mở được.
   ═══════════════════════════════════════════════════════════════════════════ */

const TTL = 300;

export const albumCacheTag = (albumId: string) => `album-data:${albumId}`;

/** Bỏ dữ liệu đã nhớ của album — gọi từ route máy chủ vừa ghi ảnh / nguồn / khuôn mặt. */
export function revalidateAlbumData(albumId: string): void {
  try {
    revalidateTag(albumCacheTag(albumId), { expire: 0 });
  } catch {
    /* ngoài ngữ cảnh request (test, script) — bỏ qua, TTL vẫn lo */
  }
}

/**
 * "Phiên bản" dữ liệu ảnh của album: đổi khi số ảnh đổi hoặc vừa gom lại khuôn
 * mặt. Hai câu đọc một dòng, chạy song song. Bảng / cột chưa có (chưa chạy
 * migration) thì phần đó là "?" — khi ấy chỉ còn TTL lo việc làm mới.
 */
export async function albumDataVersion(albumId: string): Promise<string> {
  // Không bao giờ ném: trang khách chờ hàm này trước khi đọc ảnh — hỏng thì chỉ
  // mất phần "đổi khoá ngay", TTL vẫn lo.
  try {
    const db = createAdminClient();
    const [c, f] = await Promise.all([
      db.from("album_photo_counts").select("photo_count").eq("album_id", albumId).maybeSingle(),
      db.from("albums").select("faces_clustered_at").eq("id", albumId).maybeSingle(),
    ]);
    const count = c.error ? "?" : String((c.data as { photo_count?: number } | null)?.photo_count ?? 0);
    const faces = f.error ? "?" : String((f.data as { faces_clustered_at?: string | null } | null)?.faces_clustered_at ?? "-");
    return `${count}|${faces}`;
  } catch {
    return "?|?";
  }
}

async function readPhotos(albumId: string, columns: string, strict: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await fetchAllPhotos(createAdminClient(), albumId, columns, { strict })) as any[];
}

/**
 * Toàn bộ ảnh của album (cột `columns`, thứ tự position, id). Mỗi bộ cột là
 * một mục nhớ riêng (trang /a và /album xin cột khác nhau). Nguồn (album_sources)
 * KHÔNG nhớ — vài dòng, trang tự đọc mới.
 */
export async function loadAlbumPhotos(albumId: string, columns: string, version: string) {
  try {
    return await unstable_cache(() => readPhotos(albumId, columns, true), ["album-photos-v1", albumId, columns, version], {
      revalidate: TTL,
      tags: [albumCacheTag(albumId)],
    })();
  } catch {
    return readPhotos(albumId, columns, false);
  }
}

/**
 * Nhóm khuôn mặt + liên kết người–ảnh (xem @/lib/face-people-load). Tách mục
 * nhớ riêng với ảnh: mỗi mục phải dưới 2 MB thì Vercel mới chịu lưu, và album
 * đông người có thể có hàng chục nghìn liên kết.
 */
export async function loadAlbumPeopleCached(
  albumId: string,
  enabled: boolean,
  version: string,
): Promise<{ people: PeopleRow[]; links: PeopleLink[] }> {
  if (!enabled) return { people: [], links: [] };
  try {
    return await unstable_cache(
      () => loadAlbumPeople(createAdminClient(), albumId, true, { strict: true }),
      ["album-people-v1", albumId, version],
      { revalidate: TTL, tags: [albumCacheTag(albumId)] },
    )();
  } catch {
    return loadAlbumPeople(createAdminClient(), albumId, true).catch(() => ({ people: [], links: [] }));
  }
}
