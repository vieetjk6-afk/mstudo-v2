"use client";

import AlbumFaceAuto from "@/components/AlbumFaceAuto";

/* ═══════════════════════════════════════════════════════════════════════════
   XEM TRƯỚC BẢNG "TỰ ĐỘNG GOM KHUÔN MẶT" của màn album studio.

   Màn thật nằm sau đăng nhập + Supabase nên không mở được để nhìn. Ở đây bảng
   được dựng với client Supabase trỏ vào địa chỉ dự phòng, nên mọi câu truy vấn
   đều hỏng — và đó CHÍNH LÀ thứ cần nhìn: bảng phải vẽ ra được và nói ra được
   nó đang hỏng ở đâu, chứ không im lặng biến mất.

   Đúng ba lần liên tiếp chủ studio báo "không thấy tính năng này". Một khối
   không bao giờ hiện ra thì không có cách nào phân biệt "chưa chạy migration",
   "chưa deploy" và "có lỗi" — nên điều tối thiểu nó phải làm là LUÔN HIỆN.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function FaceAutoDemo() {
  return (
    <div style={{ maxWidth: 720 }}>
      <AlbumFaceAuto albumId="00000000-0000-0000-0000-000000000001" />
    </div>
  );
}
