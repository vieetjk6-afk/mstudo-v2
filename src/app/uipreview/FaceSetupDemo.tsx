"use client";

import FaceSetupNotice from "@/components/FaceSetupNotice";

/* ═══════════════════════════════════════════════════════════════════════════
   XEM TRƯỚC BÁO "CHƯA BẬT ĐƯỢC TÌM ẢNH THEO KHUÔN MẶT".

   Ở màn này Supabase trỏ vào địa chỉ dự phòng nên MỌI câu hỏi bảng đều hỏng vì
   MẤT MẠNG, không phải vì thiếu bảng — nên đúng ra banner KHÔNG được hiện. Đó
   chính là thứ cần nhìn: nói "chưa chạy SQL" khi thật ra là rớt mạng thì lại đẩy
   studio đi sai hướng thêm một lần nữa.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function FaceSetupDemo() {
  return (
    <div style={{ maxWidth: 720 }}>
      <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx3)" }}>
        Supabase ở màn này hỏng vì <b>mất mạng</b>, không phải vì thiếu bảng — nên khung dưới đây phải
        TRỐNG. Hiện banner ở đây là sai.
      </p>
      <FaceSetupNotice />
      <div style={{ border: "1px dashed var(--bd)", borderRadius: 10, padding: 12, fontSize: 12.5 }}>
        (khung này chỉ để thấy ranh giới — banner nếu có sẽ nằm phía trên)
      </div>
    </div>
  );
}
