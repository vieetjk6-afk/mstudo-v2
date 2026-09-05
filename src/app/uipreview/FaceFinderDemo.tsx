"use client";

import CustomerAlbum from "@/app/a/[slug]/CustomerAlbum";
import { LangProvider } from "@/lib/i18n";
import type { PersonChip } from "@/lib/face-people";

/* ═══════════════════════════════════════════════════════════════════════════
   XEM TRƯỚC "TÌM ẢNH THEO KHUÔN MẶT" của album khách.

   Mở bằng tay thì cần: một album thật, ảnh thật trên Drive, chạy migration, rồi
   đợi máy chủ quét xong một lượt — ba bước, mỗi bước sai một kiểu khác nhau.

   Màn này CHỈ xem trước hàng khuôn mặt (bấm để lọc). Đường "gửi ảnh của bạn"
   không xem trước ở đây được nữa: từ khi nhận diện chuyển lên máy chủ, nó cần
   một album THẬT đã quét xong để so — xem @/lib/face-node và route
   /api/album/[slug]/face-match.

   Ở đây `initialPeople` truyền thẳng (nó vốn là prop, KHÔNG phải cửa hậu nào
   thêm vào code chạy thật). Ảnh vẫn đi qua /api/img như bình thường; bài kiểm
   tra Playwright chặn đường đó và trả về ảnh sinh tại chỗ có một ô màu ở ĐÚNG
   vị trí `coverBox`, nên nhìn ảnh thẻ là biết phép cắt đúng hay sai.

   Cái cần nhìn:
    • Ảnh thẻ phải cắt ra ĐÚNG khuôn mặt, không phải cả tấm — một tấm ảnh cưới
      có hai ba người thì lấy cả tấm là khách không chỉ được vào mặt mình.
    • Người studio CHƯA đặt tên vẫn phải hiện. Họ mới là phần đông.
    • Bấm một mặt phải lọc lưới xuống đúng ảnh của người đó, bấm lại thì thôi.
   ═══════════════════════════════════════════════════════════════════════════ */

const PHOTOS = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  drive_file_id: `d${i + 1}`,
  name: `DSC_44${70 + i}.JPG`,
  source_id: null,
  position: i,
}));

const PEOPLE: PersonChip[] = [
  // coverBox trỏ vào ô màu mà bài kiểm thử vẽ sẵn trên ảnh giả, để nhìn ảnh thẻ
  // là biết phép cắt có đúng chỗ không.
  {
    id: "P1",
    name: "Cô dâu",
    coverPhotoId: "p1",
    coverBox: [0.1, 0.1, 0.2, 0.3],
    descriptor: null,
    faceCount: 12,
    photoIds: ["p1", "p2", "p3", "p4"],
  },
  {
    id: "P2",
    name: "Chú rể",
    coverPhotoId: "p3",
    coverBox: [0.6, 0.15, 0.2, 0.3],
    descriptor: null,
    faceCount: 9,
    photoIds: ["p3", "p4", "p5"],
  },
  // Chưa đặt tên — khách vẫn nhận ra bằng mặt. Đây là phần đông trong album thật.
  {
    id: "P3",
    name: "",
    coverPhotoId: "p6",
    coverBox: [0.35, 0.4, 0.2, 0.3],
    descriptor: null,
    faceCount: 5,
    photoIds: ["p6", "p7"],
  },
  // Không có khung mặt (album lưu từ bản trước): phải lùi về lấy cả tấm.
  {
    id: "P4",
    name: "Không có khung",
    coverPhotoId: "p8",
    coverBox: null,
    descriptor: null,
    faceCount: 3,
    photoIds: ["p8"],
  },
];

export default function FaceFinderDemo() {
  return (
    <LangProvider>
      <CustomerAlbum
        album={{
          id: "a1",
          slug: "xem-truoc",
          title: "Album xem trước",
          description: null,
          cover_url: null,
          selection_limit: 0,
          watermark_enabled: false,
          watermark_text: null,
          hasPassword: false,
          allowDownload: false,
          allowNotes: false,
        }}
        initialPhotos={PHOTOS}
        initialSources={[]}
        initialPeople={PEOPLE}
        studioName="Mai Studio"
      />
    </LangProvider>
  );
}
