import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { albumsNeedingCluster, albumsNeedingScan, clusterAlbum, hanQuetMs, scanAlbum } from "@/lib/face-scan-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * 60 giây, không phải 300.
 *
 * 300 là trần của gói Pro; gói Hobby cắt ở 60. Khai 300 trên Hobby thì hàm vẫn
 * bị giết ở 60 mà code lại tưởng mình còn thời gian — và bị giết giữa chừng thì
 * mất luôn phần chưa kịp ghi. Khai đúng 60 để cả hai gói cùng chạy được.
 */
export const maxDuration = 60;

/** Dừng quét trước hạn đủ để còn kịp trả JSON. Xem `hanQuetMs`. */
const SCAN_BUDGET_MS = hanQuetMs();
/**
 * Phần đầu lượt dành cho gom nhóm.
 *
 * Nhỏ có chủ ý: gom là phép tính trên vector đã có, nhanh; để nó ăn quá nhiều
 * thì lượt cron này không quét được ảnh nào và album không bao giờ tiến.
 */
const GOM_BUDGET_MS = Math.round(SCAN_BUDGET_MS * 0.4);
/** Trần ảnh mỗi lượt, để một album khổng lồ không chiếm hết mọi lượt cron. */
const MAX_PHOTOS = 400;
/** Số album chạm tới trong một lượt. */
const MAX_ALBUMS = 3;

/**
 * TỰ QUÉT KHUÔN MẶT CHO CÁC ALBUM ĐÃ PHÁT HÀNH.
 *
 * Đây là thứ thay cho bước "studio mở bảng điều khiển album rồi ngồi chờ" của
 * bản trước. Studio không cần tìm mặt bao giờ — chỉ khách mới cần — nên việc
 * quét không được đứng sau một hành động của studio.
 *
 * Bật/tắt bằng biến môi trường FACE_SCAN_OFF=1 (mặc định BẬT). Có công tắc vì
 * đây là việc duy nhất trong app tiêu CPU máy chủ đáng kể: ~11 phút CPU cho một
 * album 800 ảnh, một lần duy nhất cho mỗi ảnh.
 */
export async function GET(req: NextRequest) {
  // Fail-closed: thiếu CRON_SECRET thì khoá, đừng mở.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (process.env.FACE_SCAN_OFF === "1") {
    return NextResponse.json({ ok: true, tat: true, note: "FACE_SCAN_OFF=1" });
  }

  const db = createAdminClient();
  const t0 = Date.now();
  const reports: unknown[] = [];
  const daNhinThay: Record<string, unknown> = {};
  try {
    /*
     * GOM NHÓM TRƯỚC, QUÉT SAU — và thứ tự này có hai lý do.
     *
     * 1. ĐÚNG VỀ SẢN PHẨM. Khuôn mặt đã quét mà chưa gom thì khách vẫn không
     *    thấy gì. Gom trước nghĩa là công của lượt cron TRƯỚC tới tay khách
     *    ngay, thay vì phải đợi tới lúc quét xong cả album.
     *
     * 2. NÓ LÀ NHỊP TIM. Đặt sau, lượt quét ăn hết 45 giây thì bước gom không
     *    bao giờ tới lượt, và `faces_clustered_at` cứ là null mãi — nên không
     *    có cách nào phân biệt "cron không chạy" với "cron chạy nhưng chưa gom
     *    tới". Đặt trước thì mọi lượt cron thành công đều để lại dấu thời gian,
     *    và /api/face-status trả lời được câu đó bằng số.
     */
    const canGom = await albumsNeedingCluster(db, MAX_ALBUMS);
    daNhinThay.canGom = canGom;
    for (const id of canGom) {
      if (Date.now() - t0 > GOM_BUDGET_MS) break;
      reports.push({ albumId: id, clustered: await clusterAlbum(db, id) });
    }

    const targets = await albumsNeedingScan(db, MAX_ALBUMS);
    daNhinThay.canQuet = targets;
    daNhinThay.conLaiSauKhiGom = SCAN_BUDGET_MS - (Date.now() - t0);
    for (const a of targets) {
      const left = SCAN_BUDGET_MS - (Date.now() - t0);
      // Dưới 12 giây thì không đủ cho cả nạp mô hình lẫn một mẻ có ích — để lượt
      // cron sau làm, còn hơn bị cắt giữa chừng.
      if (left < 12_000) break;
      /*
       * Album KHÔNG TIẾN được thì tự bỏ sớm và nhường phần còn lại cho album kế.
       *
       * Hàng đợi xếp album mới nhất trước, nên trước đây một album kẹt đứng mãi
       * ở đầu hàng: mỗi lượt cron nó ăn trọn 45 giây, quét lại đúng những tấm
       * cũ, ghi mốc, mốc không nằm lại, lượt sau thấy y nguyên. Ba chỗ
       * MAX_ALBUMS bị chiếm vĩnh viễn và mọi album cũ hơn không bao giờ tới
       * lượt — đó chính là "album khác không thấy khuôn mặt", trong khi bộ quét
       * vẫn chạy đều và log vẫn xanh.
       *
       * Giờ `scanAlbum` phát hiện mốc không ăn ngay sau mẻ ghi ĐẦU TIÊN và trả
       * về `stoppedBy: "ghi-khong-an"` sau vài giây, nên vòng lặp này còn thừa
       * thời gian để phục vụ những album lành phía sau.
       */
      reports.push(await scanAlbum(db, a.id, { budgetMs: left, maxPhotos: MAX_PHOTOS }));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Thiếu bảng là tình huống có thật (studio chưa chạy supabase/khuon-mat.sql)
    // và phải đọc ra được từ log, chứ không phải một chuỗi Postgres thô.
    const thieuBang = /album_faces|album_people|faces_scanned_at|does not exist|schema cache/i.test(msg);
    /*
     * 500, KHÔNG phải 200.
     *
     * Bản trước trả 200 kèm `ok:false` cho dễ đọc JSON. Cái giá của nó lộ ra
     * ngay lần đầu dùng thật: bộ hẹn giờ thấy 200 là coi như xong, và một lượt
     * cron HỎNG trông y hệt một lượt cron KHÔNG CÓ GÌ ĐỂ LÀM. Mã lỗi HTTP tồn
     * tại đúng để phân biệt hai chuyện đó — thân JSON vẫn giữ nguyên để đọc.
     */
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        hint: thieuBang ? "Chạy supabase/khuon-mat.sql trong Supabase SQL Editor." : undefined,
        reports,
      },
      { status: 500 }
    );
  }
  /*
   * `daNhinThay` để "reports rỗng" thôi mơ hồ.
   *
   * Rỗng có thể là "không còn gì để làm" (đúng) hoặc "tìm album cần quét ra số
   * không trong khi database đầy ảnh chưa quét" (sai, và là thứ vừa xảy ra).
   * Hai chuyện đó nhìn giống hệt nhau nếu chỉ có `reports: []`.
   */
  return NextResponse.json({ ok: true, ms: Date.now() - t0, daNhinThay, reports });
}
