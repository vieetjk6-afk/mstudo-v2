/* eslint-disable @typescript-eslint/no-explicit-any */

import { fetchThumb, scanJpeg } from "./face-node";
import { fetchAllPhotos } from "./photos";
import { centroid, groupFaces, matchKnown, type FaceVector, type KnownPerson, type Person } from "./face-group";

/**
 * QUÉT KHUÔN MẶT CHO CẢ ALBUM — chạy trên máy chủ, không cần ai mở trình duyệt.
 *
 * Bản trước bắt studio mở bảng điều khiển album thì việc quét mới chạy. Studio
 * nói đúng: bước đó thừa, studio không tìm mặt bao giờ, chỉ khách mới cần. Tệ
 * hơn, nó làm tính năng phụ thuộc vào một hành động chẳng ai có lý do để làm —
 * album gửi đi rồi mà chưa ai mở màn đó thì khách bấm vào không thấy gì.
 *
 * File này là phần điều phối: lấy ảnh về, gọi @/lib/face-node để nhận diện, ghi
 * vào album_faces, rồi gom thành người trong album_people. Luật gom cụm nằm ở
 * @/lib/face-group (thuần, có kiểm thử riêng) — ở đây chỉ có vào/ra dữ liệu.
 *
 * CHIA MẺ THEO ĐỒNG HỒ, không theo số ảnh: một lượt gọi serverless có trần thời
 * gian cứng, và bị cắt giữa chừng thì mất luôn kết quả của mẻ đó. Nên vòng quét
 * tự dừng trước hạn, ghi những gì đã có, rồi lượt cron sau chạy tiếp từ đúng chỗ
 * đó — `photos.faces_scanned_at` là cái mốc.
 */

/**
 * GHI XUỐNG DB SAU MỖI BAO NHIÊU ẢNH.
 *
 * 20, và con số này KHÔNG phải để tối ưu — nó là điều kiện để bộ quét tiến lên
 * được. Bản trước đặt 100: ở ~0,75 giây một ảnh thì 100 ảnh mất 75 giây, mà một
 * hàm serverless có thể bị cắt ở 60 giây (giới hạn gói Hobby của Vercel). Khi
 * đó lượt quét CHƯA BAO GIỜ tới mốc ghi — quét xong 80 ảnh rồi mất sạch, lượt
 * sau bắt đầu lại từ 0, và `chuaQuet` không bao giờ nhích. Không có lỗi nào hiện
 * ra ở đâu cả, vì về mặt code thì chẳng có gì sai.
 *
 * 20 ảnh ≈ 15 giây, an toàn dưới mọi hạn thời gian; đổi lại là thêm vài lượt
 * ghi, thứ rẻ hơn nhiều so với mất cả mẻ.
 */
const WRITE_CHUNK = 20;

/**
 * HẠN CHO MỘT LƯỢT QUÉT, và vì sao nó nhỏ đến thế.
 *
 * Đo trên chính máy chủ đó: /api/albums/<id>/face-thu (hạn 25 giây) trả lời
 * bình thường, còn lượt quét hạn 240 giây thì trình duyệt quay mãi rồi trắng —
 * hàm bị cắt trước khi kịp trả lời. Trần thật nằm đâu đó giữa hai mốc, và 60
 * giây là trần của gói Hobby trên Vercel.
 *
 * Nên mặc định 45 giây: chắc chắn kịp trả lời trên MỌI gói. Chậm hơn thật —
 * ~30 ảnh mỗi lượt thay vì ~160 — nhưng một lượt 240 giây bị cắt thì quét được
 * 0 ảnh, nên chậm mà xong vẫn hơn nhanh mà không bao giờ tới đích.
 *
 * Gói Pro (trần 300 giây) thì đặt biến FACE_SCAN_BUDGET_MS=240000 để lấy lại
 * tốc độ.
 */
export function hanQuetMs(): number {
  const n = Number(process.env.FACE_SCAN_BUDGET_MS);
  return Number.isFinite(n) && n >= 5_000 && n <= 280_000 ? n : 45_000;
}

export type ScanRow = {
  id: string;
  drive_file_id: string;
  name: string | null;
  is_video: boolean | null;
  faces_scanned_at: string | null;
};

export type ScanReport = {
  albumId: string;
  /** Tổng ảnh của album (đã phân trang qua trần 1000 của PostgREST). */
  tongAnh: number;
  scanned: number;
  faces: number;
  failed: number;
  remaining: number;
  clustered: number | null;
  ms: number;
  stoppedBy: "xong" | "het-gio" | "het-han-muc";
};

/** Ảnh còn phải quét: bỏ video, bỏ những tấm đã có mốc. */
export function pendingRows(rows: readonly ScanRow[]): ScanRow[] {
  return rows.filter((p) => !p.is_video && !p.faces_scanned_at && !!p.drive_file_id);
}

/**
 * Quét tới khi hết ảnh, hết giờ, hoặc hết hạn mức.
 *
 * `budgetMs` phải NHỎ HƠN maxDuration của route đủ để còn kịp ghi mẻ cuối và trả
 * JSON — chết vì hết giờ thì không ai biết nó đã đi tới đâu.
 */
export async function scanAlbum(
  db: any,
  albumId: string,
  opts: { budgetMs: number; maxPhotos: number }
): Promise<ScanReport> {
  const t0 = Date.now();
  /*
   * `fetchAllPhotos` chứ KHÔNG phải `.select()` trơn.
   *
   * PostgREST trả tối đa 1000 dòng mỗi lượt, im lặng, không báo gì. Album 2000
   * ảnh thì bộ quét chỉ THẤY 1000 ảnh đầu — quét xong chúng là nó tưởng đã xong
   * album, và một nửa album không bao giờ có khuôn mặt. Hàm này phân trang qua
   * trần đó; nó vốn có sẵn trong repo đúng vì lý do này.
   */
  const rows = (await fetchAllPhotos(
    db,
    albumId,
    "id, drive_file_id, name, is_video, faces_scanned_at"
  )) as ScanRow[];
  const todo = pendingRows(rows);
  let scanned = 0;
  let faces = 0;
  let failed = 0;
  let stoppedBy: ScanReport["stoppedBy"] = "xong";

  const faceRows: Record<string, unknown>[] = [];
  const doneIds: string[] = [];

  /** Đẩy những gì đang giữ trong tay xuống DB. Gọi sau mỗi mẻ và ở cuối. */
  const flush = async () => {
    if (faceRows.length) {
      const batch = faceRows.splice(0, faceRows.length);
      const { error: e1 } = await db.from("album_faces").upsert(batch, { onConflict: "photo_id,at" });
      if (e1) throw new Error(`ghi_album_faces_that_bai: ${e1.message}`);
      // Có mặt MỚI → album vào lại hàng đợi gom. Đặt ở đây chứ không ở cuối hàm:
      // lượt quét có thể bị cắt vì hết giờ, và lúc đó phần đã ghi vẫn phải được
      // gom ở lượt sau. Kiểm lỗi vì lý do y hệt nhánh album rỗng ở clusterAlbum.
      const { error: e3 } = await db.from("albums").update({ faces_clustered_at: null }).eq("id", albumId);
      if (e3) throw new Error(`dat_lai_hang_doi_gom_that_bai: ${e3.message}`);
    }
    while (doneIds.length) {
      const part = doneIds.splice(0, WRITE_CHUNK);
      const { error: e2 } = await db
        .from("photos")
        .update({ faces_scanned_at: new Date().toISOString() })
        .in("id", part);
      if (e2) throw new Error(`ghi_moc_quet_that_bai: ${e2.message}`);
    }
  };

  /*
   * TẢI ẢNH KẾ TIẾP TRONG LÚC ĐANG NHẬN DIỆN ẢNH HIỆN TẠI.
   *
   * Đo trên máy chủ thật: tải một thumbnail từ Drive mất ~900 ms, nhận diện mất
   * ~1.250 ms. Làm tuần tự thì 41% thời gian là CPU ngồi chờ mạng — mà giờ CPU
   * là thứ tính tiền và là thứ quyết định một lượt cron quét được bao nhiêu ảnh.
   *
   * Đường ống sâu ĐÚNG MỘT bậc, không hơn: sâu hơn thì phải giữ nhiều ảnh trong
   * bộ nhớ cùng lúc, mà lợi thì không thêm — nhận diện vẫn là khâu chậm nhất và
   * nó chỉ chạy được một ảnh một lúc.
   */
  const tai = (p?: ScanRow) => (p ? fetchThumb(p.drive_file_id).catch(() => null) : Promise.resolve(null));
  let cho: Promise<Uint8Array | null> = tai(todo[0]);

  for (let i = 0; i < todo.length; i++) {
    const p = todo[i];
    const bytesCho = cho;
    if (Date.now() - t0 > opts.budgetMs) {
      stoppedBy = "het-gio";
      break;
    }
    if (scanned >= opts.maxPhotos) {
      stoppedBy = "het-han-muc";
      break;
    }
    // Khởi động lượt tải kế TRƯỚC khi nhận diện tấm này — đó là toàn bộ mẹo.
    cho = tai(todo[i + 1]);
    try {
      const bytes = await bytesCho;
      if (!bytes) throw new Error("khong_tai_duoc_anh");
      const found = await scanJpeg(bytes);
      found.forEach((f, at) => {
        faceRows.push({
          album_id: albumId,
          photo_id: p.id,
          at,
          box: [f.box.x, f.box.y, f.box.w, f.box.h],
          descriptor: f.descriptor,
          sharpness: f.sharpness,
        });
      });
      faces += found.length;
      // Đánh mốc KỂ CẢ khi không thấy mặt nào. Không đánh thì ảnh cổng hoa, ảnh
      // nhẫn, ảnh thiệp sẽ được quét lại mãi mãi và album không bao giờ "xong".
      doneIds.push(p.id);
      scanned++;
    } catch {
      // Một tấm hỏng không được chặn cả album, và KHÔNG đánh mốc — lượt cron sau
      // vẫn thử lại, biết đâu chỉ là Drive nghẽn nhất thời.
      failed++;
    }
    if (doneIds.length >= WRITE_CHUNK) await flush();
  }
  await flush();

  const remaining = todo.length - scanned - failed;
  return {
    albumId,
    tongAnh: rows.length,
    scanned,
    faces,
    failed,
    remaining: Math.max(0, remaining),
    clustered: null,
    ms: Date.now() - t0,
    stoppedBy,
  };
}

/**
 * Gom toàn bộ khuôn mặt đã quét của album thành từng NGƯỜI.
 *
 * Dựng lại từ đầu chứ không vá từng dòng: lượt gom là sự thật mới nhất, và xoá
 * theo album thì các dòng nối tự đi theo (on delete cascade). Tên studio đã đặt
 * được giữ lại bằng cách ghép cụm mới với người cũ theo tâm cụm.
 */
export async function clusterAlbum(db: any, albumId: string): Promise<number> {
  const { data: stored, error } = await db
    .from("album_faces")
    .select("photo_id, at, box, descriptor, sharpness")
    .eq("album_id", albumId);
  if (error) throw new Error(`doc_album_faces_that_bai: ${error.message}`);
  const list = (stored ?? []) as {
    photo_id: string;
    at: number;
    box: number[] | null;
    descriptor: number[] | null;
    sharpness: number | null;
  }[];

  const vecs: FaceVector[] = list
    .filter((f) => Array.isArray(f.descriptor) && f.descriptor.length === 128)
    .map((f) => ({
      key: f.photo_id,
      at: f.at,
      v: f.descriptor as number[],
      area: (f.box?.[2] ?? 0) * (f.box?.[3] ?? 0),
      sharpness: f.sharpness ?? 0,
      box: f.box ? { x: f.box[0], y: f.box[1], w: f.box[2], h: f.box[3] } : undefined,
    }));
  /*
   * Không có khuôn mặt nào (album toàn ảnh phong cảnh, hoặc chưa quét tấm nào):
   * vẫn phải RA KHỎI HÀNG ĐỢI, nếu không lượt cron nào cũng gom lại album này.
   *
   * KIỂM LỖI, đừng nuốt. Bản trước bỏ qua `error` ở đúng dòng này, và hậu quả
   * nhìn thấy được trong log thật: ba album quay lại hàng đợi ở MỌI lượt cron,
   * lần nào cũng `clustered: 0`, ăn hết phần thời gian dành cho việc gom mà
   * không ai biết vì sao. Một câu cập nhật hỏng lặng lẽ là một vòng lặp vô hạn.
   */
  if (vecs.length === 0) {
    const { error: e } = await db
      .from("albums")
      .update({ faces_clustered_at: new Date().toISOString() })
      .eq("id", albumId);
    if (e) throw new Error(`danh_dau_album_rong_that_bai: ${e.message}`);
    return 0;
  }

  const people: Person[] = groupFaces(vecs).people;

  const { data: old } = await db.from("album_people").select("*").eq("album_id", albumId);
  const known: KnownPerson[] = ((old ?? []) as any[]).map((k) => ({
    id: k.id,
    name: k.name ?? "",
    descriptor: (k.descriptor as number[] | null) ?? [],
  }));
  const centroids = people.map((p) => ({ id: p.id, descriptor: centroid(p.faceIdx.map((i) => vecs[i].v)) }));
  const matches = matchKnown(centroids, known);

  const { error: eDel } = await db.from("album_people").delete().eq("album_id", albumId);
  if (eDel) throw new Error(`xoa_nguoi_cu_that_bai: ${eDel.message}`);

  for (const [i, p] of people.entries()) {
    const b = p.coverBox;
    const { data: row, error: eIns } = await db
      .from("album_people")
      .insert({
        album_id: albumId,
        name: matches[i]?.name ?? "",
        face_count: p.faces,
        cover_photo_id: p.coverKey || null,
        cover_at: p.coverAt,
        cover_box: b ? [b.x, b.y, b.w, b.h] : null,
        descriptor: centroids[i].descriptor,
        position: i,
      })
      .select("id")
      .single();
    if (eIns) throw new Error(`them_nguoi_that_bai: ${eIns.message}`);
    for (let k = 0; k < p.photoKeys.length; k += 500) {
      const part = p.photoKeys.slice(k, k + 500);
      const { error: e2 } = await db
        .from("album_photo_people")
        .insert(part.map((photo_id) => ({ album_id: albumId, person_id: row.id as string, photo_id })));
      if (e2) throw new Error(`noi_anh_voi_nguoi_that_bai: ${e2.message}`);
    }
  }
  // Ra khỏi hàng đợi. Đặt SAU vòng ghi: hỏng giữa chừng thì album ở lại hàng đợi
  // và lượt cron sau dựng lại từ đầu, chứ không mắc kẹt với nửa danh sách người.
  const { error: eMark } = await db
    .from("albums")
    .update({ faces_clustered_at: new Date().toISOString() })
    .eq("id", albumId);
  if (eMark) throw new Error(`danh_dau_da_gom_that_bai: ${eMark.message}`);
  return people.length;
}

/**
 * Những album ĐÃ PHÁT HÀNH còn ảnh chưa quét — MỚI NHẤT TRƯỚC.
 *
 * Bản trước hỏi ngược: lấy mọi ảnh chưa quét rồi đếm theo album, xếp album nhiều
 * ảnh chờ nhất lên đầu. Hai chỗ sai, và chúng cộng lại thành hỏng thật:
 *
 *  1. PostgREST cắt ở 1000 dòng. App này nhiều studio dùng chung, tổng ảnh chưa
 *     quét lên hàng chục nghìn — nên nó chỉ nhìn thấy 1000 ảnh ĐẦU TIÊN theo
 *     một thứ tự không ai định nghĩa, rồi "xếp hạng" trên mẫu đó. Con số
 *     `pending` in ra vì thế cũng sai: báo 682 trong khi album đó còn 952.
 *  2. Kể cả nếu đếm đúng, "nhiều ảnh chờ nhất" là luật sai. Album cũ khổng lồ
 *     của studio khác sẽ chiếm mọi lượt cron, còn album vừa tạo — đúng cái sắp
 *     gửi cho khách — thì xếp hàng vô tận. Đó chính là điều đã xảy ra.
 *
 * Nên hỏi XUÔI: đi từ bảng `albums`, mới nhất trước, và với mỗi album hỏi một
 * câu đếm rẻ tiền "còn ảnh nào chưa quét không". Dừng ngay khi đủ số album cần.
 * Không dính trần 1000 dòng, và album vừa tạo được quét trước — đúng thứ tự mà
 * studio cần.
 */
export async function albumsNeedingScan(db: any, limit = 5): Promise<{ id: string; pending: number }[]> {
  const { data: albums, error } = await db
    .from("albums")
    .select("id")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) throw new Error(`tim_album_can_quet_that_bai: ${error.message}`);

  const out: { id: string; pending: number }[] = [];
  const ids = ((albums ?? []) as { id: string }[]).map((a) => a.id);
  // Hỏi theo lô 8 câu song song: tuần tự thì 120 lượt gọi ăn hết hạn thời gian
  // trước khi quét được tấm nào.
  for (let i = 0; i < ids.length && out.length < limit; i += 8) {
    const lo = ids.slice(i, i + 8);
    const dem = await Promise.all(
      lo.map(async (id) => {
        const { count } = await db
          .from("photos")
          .select("id", { count: "exact", head: true })
          .eq("album_id", id)
          .is("faces_scanned_at", null)
          .eq("is_video", false);
        return { id, pending: count ?? 0 };
      })
    );
    for (const d of dem) {
      if (d.pending > 0 && out.length < limit) out.push(d);
    }
  }
  return out;
}

/**
 * Những album ĐÃ PHÁT HÀNH đang nằm trong hàng đợi gom nhóm.
 *
 * "Đang nằm trong hàng đợi" = `faces_clustered_at is null`, dấu do chính bộ quét
 * đặt lại mỗi khi ghi thêm khuôn mặt. Nhờ vậy đây là một truy vấn có chỉ mục,
 * không phải đếm khuôn mặt của từng album mỗi 5 phút.
 */
export async function albumsNeedingCluster(db: any, limit = 5): Promise<string[]> {
  const { data, error } = await db
    .from("albums")
    .select("id")
    .eq("status", "published")
    .is("faces_clustered_at", null)
    // Mới nhất trước, cùng luật với `albumsNeedingScan`. Không có `order` thì
    // PostgREST trả về theo thứ tự vật lý — cùng ba album ở mọi lượt.
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`tim_album_can_gom_that_bai: ${error.message}`);
  return ((data ?? []) as { id: string }[]).map((a) => a.id);
}
