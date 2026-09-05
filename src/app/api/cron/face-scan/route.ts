import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { albumsNeedingCluster, albumsNeedingScan, clusterAlbum, scanAlbum } from "@/lib/face-scan-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * Trần thời gian của một lượt. Nhận diện khuôn mặt tốn ~0,8 giây một ảnh (đo
 * thật: npm run test:face-may-chu), nên một lượt 300 giây quét được ~300 ảnh —
 * album cưới 800 ảnh xong sau ba lượt cron.
 */
export const maxDuration = 300;

/** Dừng quét trước hạn đủ để còn kịp gom nhóm và trả JSON. */
const SCAN_BUDGET_MS = 210_000;
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
  try {
    const targets = await albumsNeedingScan(db, MAX_ALBUMS);
    for (const a of targets) {
      const left = SCAN_BUDGET_MS - (Date.now() - t0);
      // Dưới 20 giây thì không đủ cho cả nạp mô hình lẫn một mẻ có ích — để lượt
      // cron sau làm, còn hơn bị cắt giữa chừng.
      if (left < 20_000) break;
      const r = await scanAlbum(db, a.id, { budgetMs: left, maxPhotos: MAX_PHOTOS });
      reports.push(r);
    }

    // Gom nhóm cho những album đang nằm trong hàng đợi — gồm cả album vừa quét
    // xong ở trên, album mà lượt cron TRƯỚC hết giờ đúng trước bước gom, và
    // album cũ vừa được studio thêm ảnh. Một chỗ duy nhất lo cả ba, vì cả ba đều
    // để lại đúng một dấu: albums.faces_clustered_at = null.
    for (const id of await albumsNeedingCluster(db, MAX_ALBUMS)) {
      if (Date.now() - t0 > SCAN_BUDGET_MS) break;
      reports.push({ albumId: id, clustered: await clusterAlbum(db, id) });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Thiếu bảng là tình huống có thật (studio chưa chạy supabase/khuon-mat.sql)
    // và phải đọc ra được từ log, chứ không phải một chuỗi Postgres thô.
    const thieuBang = /album_faces|album_people|faces_scanned_at|does not exist|schema cache/i.test(msg);
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        hint: thieuBang ? "Chạy supabase/khuon-mat.sql trong Supabase SQL Editor." : undefined,
        reports,
      },
      { status: 200 }
    );
  }
  return NextResponse.json({ ok: true, ms: Date.now() - t0, reports });
}
