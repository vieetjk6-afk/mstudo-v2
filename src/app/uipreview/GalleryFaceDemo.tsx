"use client";

import GalleryView from "@/app/album/[slug]/GalleryView";
import type { PersonChip } from "@/lib/face-people";

/* ═══════════════════════════════════════════════════════════════════════════
   XEM TRƯỚC "TÌM ẢNH THEO KHUÔN MẶT" trên ALBUM GIAO KHÁCH.

   Đây là màn tôi đã BỎ SÓT: khối tìm mặt được gắn vào /a/[slug] (album chọn
   ảnh) nhưng không gắn vào /album/[slug] (album giao khách), trong khi yêu cầu
   nói rõ là cần CẢ HAI. Chủ studio mở link giao khách và không thấy gì — hoàn
   toàn đúng, vì ở đó chưa có gì cả.

   Màn này tồn tại để lần sau không lặp lại: hai trang khách, hai lần phải nhìn.
   ═══════════════════════════════════════════════════════════════════════════ */

const PHOTOS = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  drive_file_id: `d${i + 1}`,
  name: `DSC_44${70 + i}.JPG`,
  source_id: null,
  position: i,
}));

const PEOPLE: PersonChip[] = [
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
  {
    id: "P3",
    name: "",
    coverPhotoId: "p6",
    coverBox: [0.35, 0.4, 0.2, 0.3],
    descriptor: null,
    faceCount: 5,
    photoIds: ["p6", "p7"],
  },
];

export default function GalleryFaceDemo() {
  return (
    <GalleryView
      gallery={{
        id: "g1",
        slug: "xem-truoc-giao-khach",
        title: "Album giao khách xem trước",
        event_date: null,
        cover_url: null,
        hasPassword: false,
        allowDownload: false,
      }}
      initialPhotos={PHOTOS}
      initialPeople={PEOPLE}
      totalPhotos={PHOTOS.length}
      initialSources={[]}
      feedback={[]}
      studioName="Mai Studio"
    />
  );
}
