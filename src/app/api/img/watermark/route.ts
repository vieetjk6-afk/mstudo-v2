import { NextResponse } from "next/server";
import { DRIVE_CACHE_ERR, DRIVE_CACHE_OK, fetchDriveImage } from "@/lib/drive-image";
import { watermarkJpeg } from "@/lib/watermark";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
// KHÔNG đặt force-dynamic: kết quả chỉ phụ thuộc (id, w, t) nên cache được.
// Nhờ vậy lượt tải thứ hai của cùng một ảnh được CDN phục vụ, không chạm vào
// hàm này — và không tính vào Fast Origin Transfer.

/**
 * Ảnh Drive đã đóng dấu chìm, dùng cho nút "tải ảnh" ở album khách hàng.
 *
 *   GET /api/img/watermark?id=<driveId>&t=<chữ>&w=2560&name=<tên file>
 *
 * Trước đây trình duyệt tự đóng dấu bằng canvas (xem lib/watermark.ts để biết
 * vì sao chuyển sang máy chủ).
 */

// Giới hạn bề rộng. 2560 là mức bản cũ dùng; cho tới 4096 phòng khi cần in.
const MIN_W = 320;
const MAX_W = 4096;
const DEFAULT_W = 2560;
const MAX_TEXT = 120;

/** Tên file cho Content-Disposition, an toàn với tên tiếng Việt. */
function contentDisposition(name: string): string {
  const clean = name.replace(/[\r\n"\\]/g, "").trim() || "anh.jpg";
  const withExt = /\.jpe?g$/i.test(clean) ? clean : `${clean.replace(/\.[a-z0-9]{2,4}$/i, "")}.jpg`;
  // ASCII làm bản dự phòng + filename* mã hoá UTF-8 cho trình duyệt hiện đại.
  const ascii = withExt.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(withExt)}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const id = searchParams.get("id") || "";
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  const text = (searchParams.get("t") || "").slice(0, MAX_TEXT).trim();
  if (!text) {
    // Không có chữ thì không có gì để đóng dấu. Trả lỗi thay vì lặng lẽ phục vụ
    // ảnh sạch — xem ghi chú "fail closed" trong lib/watermark.ts.
    return NextResponse.json({ error: "missing_text" }, { status: 400 });
  }

  const width = Math.min(Math.max(Number(searchParams.get("w")) || DEFAULT_W, MIN_W), MAX_W);

  // Đóng dấu tốn CPU và bộ nhớ (giải mã + dựng lại ảnh 2560px). Chặn kẻ lạ
  // dội request để đốt tài nguyên máy chủ. Khách tải cả album vẫn thoải mái:
  // 60 ảnh/phút cao hơn tốc độ bấm tay rất nhiều.
  if (!rateLimit(`wm:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const res = await fetchDriveImage(id, width);
  if (!res) {
    return NextResponse.json(
      { error: "fetch_failed", hint: "Ảnh có thể chưa được chia sẻ công khai trên Drive." },
      { status: 502, headers: { "Cache-Control": DRIVE_CACHE_ERR } },
    );
  }

  try {
    const { body, contentType } = await watermarkJpeg(Buffer.from(await res.arrayBuffer()), text);
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(body.length),
        "Content-Disposition": contentDisposition(searchParams.get("name") || "anh.jpg"),
        "Cache-Control": DRIVE_CACHE_OK,
      },
    });
  } catch {
    // Hỏng thì báo lỗi, TUYỆT ĐỐI không trả ảnh chưa đóng dấu.
    return NextResponse.json(
      { error: "watermark_failed" },
      { status: 502, headers: { "Cache-Control": DRIVE_CACHE_ERR } },
    );
  }
}
