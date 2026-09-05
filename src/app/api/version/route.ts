import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * BẢN NÀO ĐANG CHẠY — mở /api/version là biết.
 *
 * Vì sao cần: đã có năm vòng "tôi không thấy tính năng đó", trên năm màn hình
 * khác nhau. Câu hỏi đầu tiên phải trả lời trong mọi lần như vậy là "máy chủ có
 * đang chạy đúng đoạn mã đó không", mà trước giờ KHÔNG AI trả lời được — kể cả
 * tôi, vì môi trường của tôi không gọi được tên miền thật. Đoán tiếp mà không
 * biết điều này là đoán trong bóng tối.
 *
 * Vercel bơm sẵn các biến này lúc dựng; chạy ở máy thì chúng rỗng và ta nói
 * "local". Không có bí mật gì ở đây: mã nguồn vốn công khai, và commit đang chạy
 * thì ai xem trang cũng suy ra được.
 */
export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || "";
  return NextResponse.json({
    commit: sha ? sha.slice(0, 7) : "local",
    commitFull: sha || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    // "production" hay "preview" — một bản preview mở nhầm cũng giải thích được
    // vì sao thấy khác với bản thật.
    env: process.env.VERCEL_ENV || "local",
    builtAt: process.env.VERCEL_DEPLOYMENT_ID ? undefined : null,
    // Mốc để đối chiếu nhanh: có tính năng tìm khuôn mặt hay chưa.
    tinhNang: {
      timTheoKhuonMat: true,
      tuDongGomMat: true,
    },
  });
}
