"use client";

import CustomerAlbum from "@/app/a/[slug]/CustomerAlbum";
import { LangProvider } from "@/lib/i18n";
import type { PersonChip } from "@/lib/face-people";

/* ═══════════════════════════════════════════════════════════════════════════
   XEM TRƯỚC CHIP LỌC THEO NGƯỜI trong album khách.

   Mở bằng tay thì cần: một album thật, ảnh thật trên Drive, chạy migration
   album_people.sql, rồi studio phải quét xong một lượt gom người và đặt tên —
   bốn bước, mỗi bước có thể sai một cách khác nhau.

   Ở đây `initialPeople` truyền thẳng (nó vốn là prop, KHÔNG phải cửa hậu nào
   thêm vào code chạy thật). Ảnh vẫn đi qua /api/img như bình thường; bài kiểm
   tra Playwright chặn đường đó và trả ảnh sinh tại chỗ.

   Cái cần nhìn: bấm chip phải lọc lưới xuống ĐÚNG ảnh của người đó, bấm lại
   phải trở về cả album, và hàng chip phải hiện ngay từ lượt vẽ đầu — hai lỗi
   hydrate trước đây (nút "Quét" kẹt vô hiệu) đều thuộc loại chỉ lộ ra ở đây.
   ═══════════════════════════════════════════════════════════════════════════ */

const PHOTOS = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  drive_file_id: `d${i + 1}`,
  name: `DSC_44${70 + i}.JPG`,
  source_id: null,
  position: i,
}));

const PEOPLE: PersonChip[] = [
  { id: "P1", name: "Cô dâu", coverPhotoId: "p1", photoIds: ["p1", "p2", "p3", "p4"] },
  { id: "P2", name: "Chú rể", coverPhotoId: "p3", photoIds: ["p3", "p4", "p5"] },
  { id: "P3", name: "Mẹ cô dâu", coverPhotoId: "p6", photoIds: ["p6", "p7"] },
];

export default function PeopleChipDemo() {
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
