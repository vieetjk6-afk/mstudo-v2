import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { isMissingColumn } from "@/lib/missing-column";
import { phanLoaiLoi } from "@/lib/pg-loi";
import type { PeopleLink, PeopleRow } from "@/lib/face-people";

/**
 * Đọc nhóm khuôn mặt của một album cho TRANG KHÁCH (faceChips).
 *
 * Trước đây bốn chỗ (trang /a, /album và hai route mở khoá) đều
 * `select("*")` — kéo theo cột `descriptor` 128 số thực (~1,5 KB/người) mà
 * faceChips không bao giờ dùng: album 100 người là ~150 KB egress Supabase cho
 * MỖI lượt khách mở album. Nay chỉ lấy đúng cột cần.
 *
 * `cover_box` là cột thêm sau: thử có nó trước, database chưa chạy lại
 * migration thì lùi về bản không có (ảnh thẻ lấy cả tấm) — giữ đúng lý do bản
 * cũ đã dùng `*`.
 *
 * `enabled = false` (gói không có tìm theo khuôn mặt) → không tốn câu nào.
 * album_photo_people đọc theo trang: album lớn có hơn 1000 liên kết, bản cũ
 * lặng lẽ cắt ở 1000 nên chip của người xuất hiện cuối album thiếu ảnh.
 */
const COLS = "id, name, cover_photo_id, face_count, position";

export async function loadAlbumPeople(
  db: SupabaseClient,
  albumId: string,
  enabled = true,
  opts: { strict?: boolean } = {},
): Promise<{ people: PeopleRow[]; links: PeopleLink[] }> {
  if (!enabled) return { people: [], links: [] };
  // strict (kết quả được nhớ giữa các request): lỗi thoáng qua thì NÉM, chỉ
  // "chưa có bảng" (chưa chạy migration) mới được coi là không có ai.
  const check = (error: unknown) => {
    if (opts.strict && error && phanLoaiLoi(error as { code?: string; message?: string }) !== "thieu-bang") {
      throw new Error((error as { message?: string }).message || "doc_album_people_loi");
    }
  };
  const q = (cols: string) => db.from("album_people").select(cols).eq("album_id", albumId).order("position");
  const linkPage = (from: number, to: number) =>
    db
      .from("album_photo_people")
      .select("person_id, photo_id")
      .eq("album_id", albumId)
      .order("person_id")
      .order("photo_id")
      .range(from, to)
      .then((r) => {
        check(r.error);
        return r;
      });
  const [pr, links] = await Promise.all([
    q(`${COLS}, cover_box`).then((r) => (r.error && isMissingColumn(r.error, "cover_box") ? q(COLS) : r)),
    fetchAllRows<PeopleLink>(linkPage),
  ]);
  check(pr.error);
  return { people: ((pr.data ?? []) as unknown as PeopleRow[]), links };
}
