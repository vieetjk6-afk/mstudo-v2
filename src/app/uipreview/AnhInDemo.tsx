"use client";

import GalleryView from "@/app/album/[slug]/GalleryView";
import AlbumPrintPanel from "@/app/dashboard/albums/[id]/AlbumPrintPanel";

/* ═══════════════════════════════════════════════════════════════════════════
   XEM TRƯỚC "ẢNH IN TẶNG".
   - Album giao khách của hợp đồng tặng 3 ảnh in, khách chưa gửi.
   - Thẻ "Ảnh in tặng" bên studio (tab Giao khách của album), khách đã gửi.
   ═══════════════════════════════════════════════════════════════════════════ */

const PHOTOS = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  drive_file_id: `d${i + 1}`,
  name: `DSC_44${70 + i}.JPG`,
  source_id: null,
  position: i,
}));

export function AnhInKhachDemo() {
  return (
    <GalleryView
      gallery={{
        id: "g1",
        slug: "xem-truoc-anh-in",
        title: "Lan & Minh — ảnh cưới",
        event_date: null,
        // Có ảnh bìa để thấy nút "Xem album" (phải dừng ở thẻ chọn ảnh in).
        cover_url: "/vieetjk-ai-icon.png",
        hasPassword: false,
        allowDownload: false,
      }}
      initialPhotos={PHOTOS}
      totalPhotos={PHOTOS.length}
      initialSources={[]}
      feedback={[]}
      studioName="Mai Studio"
      print={{ quota: 3, picks: [], sentAt: null, copiedAt: null }}
    />
  );
}

export function AnhInStudioDemo() {
  return (
    <div className="mx-auto max-w-3xl">
      <AlbumPrintPanel
        albumId="a1"
        info={{
          quota: 20,
          contractId: "c1",
          contractQuota: 20,
          albumQuota: 0,
          picks: PHOTOS.slice(0, 6).map((p) => ({ photo_id: p.id, photo_name: p.name })),
          sentAt: "2026-10-18T09:00:00Z",
          copiedAt: null,
        }}
        photos={PHOTOS}
        hasDeliveryFolder
      />
    </div>
  );
}

/** Album lẻ (không thuộc hợp đồng): studio nhập số ảnh in tặng ngay trong album. */
export function AnhInAlbumLeDemo() {
  return (
    <div className="mx-auto max-w-3xl">
      <AlbumPrintPanel
        albumId="a2"
        info={{ quota: 0, contractId: null, contractQuota: 0, albumQuota: 0, picks: [], sentAt: null, copiedAt: null }}
        photos={PHOTOS}
        hasDeliveryFolder
      />
    </div>
  );
}
