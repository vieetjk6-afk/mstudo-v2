/* eslint-disable @typescript-eslint/no-explicit-any */

import { randomUUID } from "node:crypto";
import { fetchThumbChiTiet, scanJpeg, type KetQuaTai } from "./face-node";
import { centroid, groupFaces, matchKnown, type FaceVector, type KnownPerson, type Person } from "./face-group";
import { effectivePlan, planAllowsFaceSearch, type Plan } from "./plans";
// Luật "ảnh nào còn phải quét" nằm ở @/lib/face-can-quet — MỘT chỗ cho cả ba
// phía hỏi nó (hàng đợi, vòng quét, tiến độ cho khách). Re-export để những chỗ
// đang nhập từ đây không phải đổi.
import { apDungLocConQuet, pendingRows, type ScanRow } from "./face-can-quet";
export { apDungLocConQuet, pendingRows, type ScanRow } from "./face-can-quet";

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
 * Mẻ ghi đầu tiên của mỗi album — nhỏ, để "mốc quét có nằm lại không" lộ ra sau
 * vài giây thay vì sau nửa ngân sách. Xem chỗ dùng trong vòng quét.
 */
const FIRST_CHUNK = 3;

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

export type ScanReport = {
  albumId: string;
  /** Tổng ảnh của album — đếm bằng một câu head, không kéo dòng nào về. */
  tongAnh: number;
  /** Số dòng DB XÁC NHẬN đã ghi. Lệch với `scanned` nghĩa là ghi không ăn. */
  daGhiMoc: number;
  daGhiMat: number;
  /**
   * Số ảnh ĐỌC LẠI BẰNG MỘT CÂU RIÊNG mà thật sự đã mang mốc.
   *
   * Khác `daGhiMoc` ở đúng chỗ quan trọng: `daGhiMoc` đếm dòng do chính câu
   * UPDATE trả về (RETURNING). Con số đó có thể là ĐỒ CŨ LẤY TỪ CACHE — đúng
   * thứ đã xảy ra: Next 14 cache cả câu ghi đi qua fetch, nên câu UPDATE thứ
   * hai trở đi không rời khỏi máy chủ mà vẫn trả về "đã ghi N dòng" của lần
   * đầu (xem @/lib/supabase/no-cache-fetch). Nguyên nhân đó đã chữa từ gốc,
   * nhưng vòng kiểm này ở lại: một câu SELECT RIÊNG sau khi ghi là cách duy
   * nhất phân biệt "ghi thật" với "được kể lại là đã ghi", và nó rẻ.
   */
  daXacNhan: number;
  scanned: number;
  faces: number;
  failed: number;
  remaining: number;
  /**
   * MỘT câu lỗi mẫu của những tấm hỏng, hoặc null nếu không tấm nào hỏng.
   *
   * `failed` đếm được số tấm hỏng nhưng KHÔNG nói vì sao, và vòng lặp thì
   * `catch {}` trơn — nó ném đi đúng thứ duy nhất trả lời được câu hỏi. Cái giá
   * lộ ra trong log production ngày 10/09: tám lượt liên tiếp in "quét 0 ảnh"
   * với hàng đợi 3 album, không lỗi, không cảnh báo, và không cách nào biết là
   * Drive từ chối tải, hay trọng số mô hình không đi theo gói triển khai, hay
   * `todo` rỗng vì hai định nghĩa "còn phải quét" lệch nhau. Ba nguyên nhân,
   * ba cách sửa, một dòng log y hệt nhau.
   *
   * Giữ ĐÚNG MỘT câu, cắt ngắn: đây là manh mối để chẩn đoán, không phải sổ lỗi.
   */
  loiMau: string | null;
  clustered: number | null;
  ms: number;
  /**
   * `tai-quet-loi` = quét được 0 tấm trong khi CÓ tấm hỏng. Khác `xong` (không
   * còn gì để quét) ở chỗ nó là một album ĐANG TẮC: mốc không được ghi nên lượt
   * cron sau thấy y nguyên, và nó chiếm một trong ba chỗ hàng đợi mãi mãi. Cùng
   * họ với `ghi-khong-an` — một cách khác để vào đúng cái bẫy đó.
   */
  stoppedBy: "xong" | "het-gio" | "het-han-muc" | "ghi-khong-an" | "tai-quet-loi";
};

/**
 * Quét tới khi hết ảnh, hết giờ, hoặc hết hạn mức.
 *
 * `budgetMs` phải NHỎ HƠN maxDuration của route đủ để còn kịp ghi mẻ cuối và trả
 * JSON — chết vì hết giờ thì không ai biết nó đã đi tới đâu.
 */
export async function scanAlbum(
  db: any,
  albumId: string,
  opts: {
    budgetMs: number;
    maxPhotos: number;
    /**
     * Cửa thay ĐỒ NGHỀ, chỉ dùng cho kiểm thử (desktop/test/face-ghi-khong-an.mjs).
     * Production luôn bỏ trống và dùng fetchThumb/scanJpeg thật. Có cửa này thì
     * mới kiểm được luật ĐIỀU PHỐI (ghi có nằm lại không, có bỏ sớm nhường album
     * khác không) mà không cần mạng, không cần 12 MB trọng số, không cần database.
     */
    _tai?: (driveFileId: string) => Promise<Uint8Array | null | KetQuaTai>;
    _quet?: (bytes: Uint8Array) => Promise<
      { box: { x: number; y: number; w: number; h: number }; descriptor: number[]; sharpness: number }[]
    >;
  }
): Promise<ScanReport> {
  const t0 = Date.now();
  /*
   * CHỈ ĐỌC ẢNH CÒN PHẢI QUÉT — và chỉ một lô vừa cho lượt này.
   *
   * Bản trước kéo MỌI ảnh của album về (fetchAllPhotos) rồi mới lọc trên mảng:
   * album 1.449 ảnh là ~1.500 dòng qua đường truyền ở MỖI lượt gọi, 8 lượt mỗi
   * 10 phút suốt đêm, chỉ để tìm vài chục tấm chưa quét — egress Supabase thuần
   * (docs/supabase-usage.md). Giờ điều kiện chạy trên DB, cùng một định nghĩa
   * với hàng đợi và tiến độ của khách (apDungLocConQuet), cùng thứ tự
   * position, id như fetchAllPhotos.
   *
   * Lô tối đa `maxPhotos` dòng (kẹp ở 1000 — trần im lặng của PostgREST): lượt
   * nào cũng dừng ở hạn mức đó hoặc ở hạn giờ trước. Khác bản trước đúng một
   * chỗ: hạn mức giờ tính cả tấm hỏng / bỏ qua, nên lượt gọi đi hết lô mà DB
   * còn tấm chờ thì dừng `het-han-muc` và lượt sau đi tiếp.
   *
   * `count: "exact"` trả kèm TỔNG số tấm còn chờ trong cùng câu đó, để
   * `remaining` vẫn là số của cả album. `tongAnh` thì một câu head riêng — rẻ,
   * không kéo dòng nào về.
   */
  const lo = Math.min(Math.max(opts.maxPhotos, 1), 1000);
  const [cho0, dem0] = await Promise.all([
    apDungLocConQuet(
      db.from("photos").select("id, drive_file_id, name, is_video, faces_scanned_at", { count: "exact" }).eq("album_id", albumId)
    )
      .order("position")
      .order("id")
      .limit(lo),
    db.from("photos").select("id", { count: "exact", head: true }).eq("album_id", albumId),
  ]);
  // Đọc hỏng thì như bản trước (fetchAllPhotos trả mảng rỗng): không có gì để
  // quét ở lượt này, lượt sau thử lại. Nhưng giữ câu lỗi lại cho log.
  const rows = (cho0.error ? [] : cho0.data ?? []) as ScanRow[];
  // Lọc lại trên mảng (không tốn gì): lỡ điều kiện phía DB trôi khỏi định nghĩa
  // chung thì vòng quét vẫn không chạm tấm đã quét / video / thiếu drive_file_id.
  const todo = pendingRows(rows);
  /** Tổng số tấm còn chờ của CẢ album, không chỉ của lô này. */
  const tongCho = Math.max(cho0.error ? 0 : cho0.count ?? 0, todo.length);
  /** Lô đầy mà DB còn thêm tấm chờ: đi hết lô là hết hạn mức, chưa phải xong album. */
  const catLo = rows.length >= lo && tongCho > rows.length;
  let scanned = 0;
  let faces = 0;
  let failed = 0;
  /** Tấm hỏng VĨNH VIỄN (404, PNG) — đã đánh mốc, không thử lại. */
  let boQua = 0;
  /** Câu lỗi của tấm hỏng ĐẦU TIÊN — xem ScanReport.loiMau. */
  let loiMau: string | null = cho0.error ? `doc_anh_cho_quet_that_bai: ${cho0.error.message}`.slice(0, 200) : null;
  let stoppedBy: ScanReport["stoppedBy"] = "xong";

  const faceRows: Record<string, unknown>[] = [];
  const doneIds: string[] = [];
  /** Số dòng DB xác nhận đã ghi — không phải số ta định ghi. */
  let daGhiMat = 0;
  let daGhiMoc = 0;
  /** Số ảnh đọc lại BẰNG CÂU RIÊNG mà thật sự đã mang mốc. Xem ScanReport. */
  let daXacNhan = 0;
  /** Mốc ghi xong nhưng đọc lại vẫn null → dừng album này, nhường lượt. */
  let ghiKhongAn = false;

  /** Đẩy những gì đang giữ trong tay xuống DB. Gọi sau mỗi mẻ và ở cuối. */
  const flush = async () => {
    if (faceRows.length) {
      const batch = faceRows.splice(0, faceRows.length);
      /*
       * `.select()` sau khi ghi — ĐỌC LẠI CHÍNH THỨ VỪA GHI.
       *
       * Không có nó thì một câu ghi "thành công" mà chạm 0 dòng nhìn y hệt một
       * câu ghi thành công thật: không lỗi, không cảnh báo. Chuyện đó đã xảy ra
       * và ngốn ba vòng — lượt cron báo quét 40 ảnh, lượt sau vẫn thấy đủ 343
       * ảnh chưa quét. Đọc lại là cách duy nhất phân biệt.
       */
      const { data: d1, error: e1 } = await db
        .from("album_faces")
        .upsert(batch, { onConflict: "photo_id,at" })
        .select("photo_id");
      if (e1) throw new Error(`ghi_album_faces_that_bai: ${e1.message}`);
      daGhiMat += (d1 ?? []).length;
      if ((d1 ?? []).length === 0) throw new Error(`ghi_album_faces_cham_0_dong (gui ${batch.length} dong)`);
      // KHÔNG đưa album vào lại hàng đợi gom ở đây nữa — xem `veHangDoiGom` ở
      // cuối hàm. Đặt lại sau MỖI mẻ 20 ảnh nghĩa là mỗi lượt cron gom lại cả
      // album (đọc toàn bộ vector 128 số của mọi khuôn mặt), và đó là phần lớn
      // egress Supabase làm project bị khoá vì vượt hạn mức (11/2026).
    }
    while (doneIds.length) {
      const part = doneIds.splice(0, WRITE_CHUNK);
      const { data: d2, error: e2 } = await db
        .from("photos")
        .update({ faces_scanned_at: new Date().toISOString() })
        .in("id", part)
        .select("id");
      if (e2) throw new Error(`ghi_moc_quet_that_bai: ${e2.message}`);
      daGhiMoc += (d2 ?? []).length;
      // Chạm 0 dòng trong khi vừa gửi một danh sách id có thật = câu ghi bị chặn
      // ở đâu đó. Nổ ra to còn hơn quét lại đúng những tấm đó tới vô tận.
      if ((d2 ?? []).length === 0) throw new Error(`ghi_moc_quet_cham_0_dong (gui ${part.length} id)`);

      /*
       * ĐỌC LẠI BẰNG MỘT CÂU RIÊNG — không tin RETURNING của chính câu vừa ghi.
       *
       * Đây là chỗ bản trước còn mù. RETURNING nói "đã ghi 37 dòng" nhưng nó chỉ
       * chứng minh câu UPDATE KHỚP 37 dòng — mà thậm chí con số ấy cũng có thể
       * là đồ cũ lấy từ cache. Log production ngày 06/09: tám lượt liên tiếp đều
       * báo daGhiMoc 37–47, database chỉ nhận đúng MỘT mẻ (51/343 ảnh), và mọi
       * lượt đọc sau vẫn thấy nguyên 343 ảnh chưa quét.
       *
       * Gốc rễ đã chữa ở @/lib/supabase/no-cache-fetch. Vòng kiểm này ở lại làm
       * lưới an toàn: một câu SELECT RIÊNG là cách duy nhất phân biệt "ghi thật"
       * với "được kể lại là đã ghi". Rẻ: đếm head, không kéo dòng nào về.
       */
      const { count: thuc } = await db
        .from("photos")
        .select("id", { count: "exact", head: true })
        .in("id", part)
        .not("faces_scanned_at", "is", null);
      daXacNhan += thuc ?? 0;
      if ((thuc ?? 0) === 0) {
        // Không nổ ra: nổ thì cả lượt cron đỏ và MỌI album khác cũng đứng theo.
        // Ghi nhận rồi bỏ album này, để phần thời gian còn lại phục vụ album khác.
        ghiKhongAn = true;
        doneIds.length = 0;
        return;
      }
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
  const quetAnh = opts._quet ?? scanJpeg;
  /*
   * Cửa thay đồ nghề của kiểm thử trả `Uint8Array | null` — giữ nguyên chữ ký đó
   * (đổi là phải sửa cả face-ghi-khong-an.mjs vì một chuyện không liên quan) và
   * bọc lại thành hình dạng có lý do.
   */
  const taiAnh: (id: string) => Promise<KetQuaTai> = opts._tai
    ? async (id) => {
        const b = await opts._tai!(id);
        if (b && !(b instanceof Uint8Array)) return b; // kiểm thử đưa sẵn lý do (vd http-404)
        return b ? { bytes: b, lyDo: null } : { bytes: null, lyDo: "khong-tai-duoc (bản kiểm thử)" };
      }
    : fetchThumbChiTiet;
  /*
   * `.catch()` KHÔNG được nuốt câu lỗi. Bản trước là `.catch(() => null)`, và đó
   * là mắt cuối cùng của chuỗi làm mù: log nói "lỗi tải 54" nhưng Google từ chối
   * bằng câu gì thì mất sạch — mà chính câu đó quyết định phải sửa quyền chia sẻ
   * Drive, giãn nhịp gọi, hay chờ Drive xử lý xong file.
   */
  const tai = (p?: ScanRow): Promise<KetQuaTai> =>
    p
      ? taiAnh(p.drive_file_id).catch((e) => ({
          bytes: null as null,
          lyDo: `tai-nem-loi: ${e instanceof Error ? e.message : String(e)}`,
        }))
      : Promise.resolve({ bytes: null, lyDo: "khong-co-anh" });
  let cho: Promise<KetQuaTai> = tai(todo[0]);

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
      const { bytes, lyDo } = await bytesCho;
      /*
       * Lỗi VĨNH VIỄN thì đánh mốc luôn (0 khuôn mặt) thay vì thử lại mãi:
       * http-404 = file đã xoá khỏi Drive (cả hai nguồn đều hỏng mới tới đây),
       * khong-phai-jpeg = PNG, bộ quét không đọc được. Log production 01/11:
       * một album 111 tấm 404, lượt cron nào cũng tải lại cả 111 tấm và chiếm
       * một chỗ hàng đợi quét.
       */
      if (!bytes && lyDo && /^(http-404|khong-phai-jpeg)/.test(lyDo)) {
        doneIds.push(p.id);
        boQua++;
        if (loiMau === null) loiMau = `bo_qua_vinh_vien: ${lyDo}`.slice(0, 200);
        continue;
      }
      // Câu lỗi mang theo LÝ DO của Drive (http-403, khong-phai-anh, anh-giu-cho…)
      // chứ không phải một chữ "khong_tai_duoc_anh" chung cho năm nguyên nhân.
      if (!bytes) throw new Error(`khong_tai_duoc_anh: ${lyDo}`);
      const found = await quetAnh(bytes);
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
    } catch (e) {
      // Một tấm hỏng không được chặn cả album, và KHÔNG đánh mốc — lượt cron sau
      // vẫn thử lại, biết đâu chỉ là Drive nghẽn nhất thời.
      //
      // Nhưng GIỮ LẠI câu lỗi đầu tiên. Bản trước `catch {}` trơn, và đó là lý
      // do một album tắc chỉ hiện ra dưới dạng "quét 0 ảnh" — đếm được cái hỏng
      // mà không biết nó hỏng vì gì.
      failed++;
      if (loiMau === null) loiMau = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    }
    /*
     * Mẻ ghi ĐẦU TIÊN cố ý nhỏ (FIRST_CHUNK), các mẻ sau mới dùng WRITE_CHUNK.
     *
     * Lý do là thời gian: chỉ sau khi ghi rồi đọc lại ta mới biết mốc có nằm lại
     * hay không. Đợi đủ 20 tấm mới ghi lần đầu nghĩa là một album kẹt vẫn tiêu
     * mất ~25 giây trong ngân sách 45 giây trước khi lộ ra. Ghi thử vài tấm
     * trước thì phát hiện trong khoảng 5 giây, phần còn lại của lượt cron vẫn
     * đủ để phục vụ album khác.
     */
    const nguong = daGhiMoc === 0 ? FIRST_CHUNK : WRITE_CHUNK;
    if (doneIds.length >= nguong) await flush();
    // Ghi mốc không ăn thì quét tiếp là quét lại đúng những tấm vừa quét — dừng
    // ngay, để thời gian còn lại của lượt cron dành cho album khác.
    if (ghiKhongAn) {
      stoppedBy = "ghi-khong-an";
      break;
    }
  }
  if (stoppedBy === "xong" && catLo) stoppedBy = "het-han-muc";
  if (!ghiKhongAn) await flush();

  /*
   * ĐƯA ALBUM VÀO LẠI HÀNG ĐỢI GOM — tối đa một lần cho mỗi lượt quét hết album.
   *
   * Chỉ khi lượt này CÓ ghi khuôn mặt mới, và:
   *   • đã đi hết danh sách (`xong`) → album quét xong, gom một lần là đủ; hoặc
   *   • lần gom trước đã cũ hơn 12 giờ → album khổng lồ quét nhiều đêm vẫn
   *     cho khách thấy dần, nhưng không gom lại sau mỗi lượt cron.
   * Bản trước đặt lại sau MỖI mẻ ghi: album 1.449 ảnh quét ~35 tấm/lượt bị gom
   * lại ~40 lần, mỗi lần đọc toàn bộ vector khuôn mặt của album từ Supabase.
   */
  if (daGhiMat > 0 && !ghiKhongAn) {
    let veHangDoiGom = stoppedBy === "xong";
    if (!veHangDoiGom) {
      const { data: al } = await db.from("albums").select("faces_clustered_at").eq("id", albumId).maybeSingle();
      const luc = al?.faces_clustered_at ? Date.parse(al.faces_clustered_at as string) : NaN;
      veHangDoiGom = Number.isFinite(luc) && Date.now() - luc > 12 * 3600_000;
    }
    if (veHangDoiGom) {
      const { error: e3 } = await db.from("albums").update({ faces_clustered_at: null }).eq("id", albumId);
      if (e3) throw new Error(`dat_lai_hang_doi_gom_that_bai: ${e3.message}`);
    }
  }

  const remaining = tongCho - scanned - failed - boQua;
  /*
   * Quét được 0 tấm mà CÓ tấm hỏng thì không phải "xong" — đó là album đang
   * TẮC. Phân biệt được điều này là điều kiện để nó hiện ra trong log: `xong`
   * nghĩa là hết việc, và một album tắc đội lốt "xong" thì lượt cron nào cũng
   * nhặt lại nó, chiếm một trong ba chỗ hàng đợi, im lặng.
   */
  const taiQuetLoi = scanned === 0 && failed > 0;
  return {
    albumId,
    tongAnh: dem0.count ?? 0,
    daGhiMoc,
    daGhiMat,
    daXacNhan,
    scanned,
    faces,
    failed,
    remaining: Math.max(0, remaining),
    loiMau,
    clustered: null,
    ms: Date.now() - t0,
    stoppedBy: ghiKhongAn ? "ghi-khong-an" : taiQuetLoi ? "tai-quet-loi" : stoppedBy,
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
  // Đọc THEO TRANG: PostgREST lặng lẽ cắt ở 1000 dòng, nên album đông người
  // (đám cưới 1.500 ảnh dễ có vài nghìn khuôn mặt) trước đây chỉ được gom từ
  // 1000 mặt đầu — người xuất hiện ở cuối album biến mất khỏi hàng chip, và vì
  // lượt gom XOÁ rồi dựng lại người, họ mất luôn tên studio đã đặt. Trang nào
  // lỗi thì NÉM chứ không gom trên phần đọc dở (sẽ xoá nhầm người).
  type FaceRow = { photo_id: string; at: number; box: number[] | null; descriptor: number[] | null; sharpness: number | null };
  const list: FaceRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await db
      .from("album_faces")
      .select("photo_id, at, box, descriptor, sharpness")
      .eq("album_id", albumId)
      .order("photo_id")
      .order("at")
      .range(from, from + 999);
    if (error) throw new Error(`doc_album_faces_that_bai: ${error.message}`);
    const rows = (page ?? []) as FaceRow[];
    list.push(...rows);
    if (rows.length === 0 || rows.length < 1000) break;
  }

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
    const { data: d, error: e } = await db
      .from("albums")
      .update({ faces_clustered_at: new Date().toISOString() })
      .eq("id", albumId)
      .select("id");
    if (e) throw new Error(`danh_dau_album_rong_that_bai: ${e.message}`);
    if ((d ?? []).length === 0) throw new Error(`danh_dau_album_rong_cham_0_dong: ${albumId}`);
    return 0;
  }

  const people: Person[] = groupFaces(vecs).people;

  // Đúng ba cột matchKnown cần — không `*` (cover_box, face_count… đọc về là thừa).
  const { data: old } = await db.from("album_people").select("id, name, descriptor").eq("album_id", albumId);
  const known: KnownPerson[] = ((old ?? []) as any[]).map((k) => ({
    id: k.id,
    name: k.name ?? "",
    descriptor: (k.descriptor as number[] | null) ?? [],
  }));
  const centroids = people.map((p) => ({ id: p.id, descriptor: centroid(p.faceIdx.map((i) => vecs[i].v)) }));
  const matches = matchKnown(centroids, known);

  const { error: eDel } = await db.from("album_people").delete().eq("album_id", albumId);
  if (eDel) throw new Error(`xoa_nguoi_cu_that_bai: ${eDel.message}`);

  /*
   * GHI THEO LÔ, id sinh sẵn ở đây.
   *
   * Bản trước chèn từng người một (`insert().select("id").single()`) chỉ để
   * lấy id DB cấp cho các dòng nối — album 150 người là 150+ lượt gọi Supabase
   * mỗi lần gom. Sinh id ngay tại đây thì biết trước người nào mang id nào: cả
   * người lẫn dòng nối ghi được theo lô, và không phải đọc lại dòng nào.
   *
   * Dòng nối trỏ tới album_people bằng khoá ngoại, nên một lô người không nằm
   * lại thì lô nối nổ ra ngay — không có chuyện nối im lặng vào người không có.
   */
  const nguoi = people.map((p, i) => {
    const b = p.coverBox;
    return {
      id: randomUUID(),
      album_id: albumId,
      name: matches[i]?.name ?? "",
      face_count: p.faces,
      cover_photo_id: p.coverKey || null,
      cover_at: p.coverAt,
      cover_box: b ? [b.x, b.y, b.w, b.h] : null,
      descriptor: centroids[i].descriptor,
      position: i,
    };
  });
  // 100 người một lô: mỗi dòng mang vector 128 số (~2,5 KB JSON), giữ thân yêu cầu vừa phải.
  for (let k = 0; k < nguoi.length; k += 100) {
    const { error: eIns } = await db.from("album_people").insert(nguoi.slice(k, k + 100));
    if (eIns) throw new Error(`them_nguoi_that_bai: ${eIns.message}`);
  }
  const noi = people.flatMap((p, i) => p.photoKeys.map((photo_id) => ({ album_id: albumId, person_id: nguoi[i].id, photo_id })));
  for (let k = 0; k < noi.length; k += 500) {
    const { error: e2 } = await db.from("album_photo_people").insert(noi.slice(k, k + 500));
    if (e2) throw new Error(`noi_anh_voi_nguoi_that_bai: ${e2.message}`);
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

/**
 * LỌC THEO GÓI — chỉ giữ album của chủ được dùng tìm ảnh theo khuôn mặt.
 *
 * Đặt ở TẦNG CHỌN ALBUM chứ không ở tầng hiển thị, vì đây là chốt tiêu tiền:
 * quét một album 800 ảnh tốn ~11 phút CPU máy chủ. Chặn ở trang khách thì CPU
 * đã tiêu xong rồi mới chặn — vô nghĩa.
 *
 * Một câu truy vấn cho cả lô chủ sở hữu, không phải mỗi album một câu.
 */
async function chuDuocDungTimMat(db: any, ownerIds: string[]): Promise<Set<string>> {
  const uniq = [...new Set(ownerIds.filter(Boolean))];
  if (uniq.length === 0) return new Set();
  const { data, error } = await db
    .from("profiles")
    .select("id, plan, plan_expires_at, role")
    .in("id", uniq);
  // Hỏng thì trả về TẬP RỖNG, không phải "cho qua hết". Không đo được quyền thì
  // đừng tiêu CPU — thà chậm một lượt cron còn hơn quét cho gói không được dùng.
  if (error) throw new Error(`doc_goi_chu_album_that_bai: ${error.message}`);
  const ok = new Set<string>();
  for (const r of (data ?? []) as { id: string; plan: Plan | null; plan_expires_at: string | null; role: string | null }[]) {
    if (planAllowsFaceSearch(effectivePlan(r.plan, r.plan_expires_at), r.role === "admin")) ok.add(r.id);
  }
  return ok;
}

export async function albumsNeedingScan(db: any, limit = 5): Promise<{ id: string; pending: number }[]> {
  const { data: albums, error } = await db
    .from("albums")
    .select("id, owner_id")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) throw new Error(`tim_album_can_quet_that_bai: ${error.message}`);

  const out: { id: string; pending: number }[] = [];
  const rows = (albums ?? []) as { id: string; owner_id: string }[];
  // Chỉ giữ album của chủ ĐỦ GÓI — xem chuDuocDungTimMat.
  const duocDung = await chuDuocDungTimMat(db, rows.map((a) => a.owner_id));
  const ids = rows.filter((a) => duocDung.has(a.owner_id)).map((a) => a.id);
  /*
   * HỎI "CÒN VIỆC KHÔNG" TRƯỚC KHI ĐẾM.
   *
   * Đêm nào cron cũng gọi tới đây hàng chục lượt, và phần lớn album đã quét
   * xong từ lâu. Bản trước vẫn đếm từng album một — tới 120 câu đếm mỗi lượt
   * chỉ để ra "không có gì", hoặc để tìm đúng một album đang quét dở nằm sâu
   * trong danh sách. Một câu `limit(1)` trên cả lô (chỉ mục một phần
   * photos_faces_pending_idx) trả lời "có không" với tối đa một dòng; câu đếm
   * chỉ chạy cho nhóm 8 album nào thật sự còn tấm chờ.
   *
   * Câu hỏi lỗi thì coi như "có" và đếm như cũ — không đổi hành vi lúc hỏng.
   */
  const conViec = async (nhom: string[]) => {
    const { data, error } = await apDungLocConQuet(db.from("photos").select("album_id").in("album_id", nhom)).limit(1);
    return !!error || (data ?? []).length > 0;
  };
  if (ids.length === 0 || !(await conViec(ids))) return out;
  // Hỏi theo lô 8 câu song song: tuần tự thì 120 lượt gọi ăn hết hạn thời gian
  // trước khi quét được tấm nào.
  for (let i = 0; i < ids.length && out.length < limit; i += 8) {
    const lo = ids.slice(i, i + 8);
    // Chỉ một nhóm (ít album đủ gói) thì câu hỏi chung ở trên đã trả lời rồi.
    if (lo.length < ids.length && !(await conViec(lo))) continue;
    const dem = await Promise.all(
      lo.map(async (id) => {
        const { count } = await apDungLocConQuet(
          db.from("photos").select("id", { count: "exact", head: true }).eq("album_id", id)
        );
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
    .select("id, owner_id")
    .eq("status", "published")
    .is("faces_clustered_at", null)
    // Mới nhất trước, cùng luật với `albumsNeedingScan`. Không có `order` thì
    // PostgREST trả về theo thứ tự vật lý — cùng ba album ở mọi lượt.
    .order("created_at", { ascending: false })
    // Lấy dư rồi mới lọc theo gói: lọc sau `limit` thì một lô toàn album của
    // gói thấp sẽ ra danh sách rỗng, và album đủ gói phía sau không bao giờ
    // tới lượt gom.
    .limit(Math.max(limit * 8, 40));
  if (error) throw new Error(`tim_album_can_gom_that_bai: ${error.message}`);
  const rows = (data ?? []) as { id: string; owner_id: string }[];
  const duocDung = await chuDuocDungTimMat(db, rows.map((a) => a.owner_id));
  return rows.filter((a) => duocDung.has(a.owner_id)).slice(0, limit).map((a) => a.id);
}
