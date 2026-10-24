"use client";

import AlbumEditor, { type CustomerShare } from "@/app/dashboard/albums/[id]/AlbumEditor";
import type { Album, AlbumSource, Photo } from "@/lib/types";

/**
 * Chép mã ảnh ở màn album (studio): nút "Chép N mã ảnh / Tải .txt" trên tab Ảnh
 * (theo giai đoạn đang lọc) và tab "Khách chia sẻ" (mỗi link khách tạo cho
 * người khác xem). Dữ liệu giả — ảnh Drive không tải được nên ô ảnh để trống.
 */

const ALBUM = {
  id: "demo-album", owner_id: "u1", slug: "nhi-tuan", title: "Phương Nhi & Anh Tuấn", status: "published",
  phase: "delivery", is_gallery: false, created_at: "2026-09-01T00:00:00Z",
} as unknown as Album;

const SOURCES = [
  { id: "s-sel", album_id: "demo-album", stage: "selection", drive_url: "https://drive.google.com/drive/folders/x", position: 0 },
  { id: "s-del", album_id: "demo-album", stage: "delivery", drive_url: "https://drive.google.com/drive/folders/y", position: 1 },
] as unknown as AlbumSource[];

const photo = (i: number, src: string): Photo => ({
  id: `p${src}${i}`, album_id: "demo-album", source_id: src, drive_file_id: `f${src}${i}`,
  name: `${src === "s-del" ? "NHI_" : "DSC_"}${String(1000 + i * 7)}.JPG`, position: i, is_video: false, created_at: "",
});
const PHOTOS = [...Array.from({ length: 6 }, (_, i) => photo(i, "s-sel")), ...Array.from({ length: 5 }, (_, i) => photo(i, "s-del"))];

const SHARES: CustomerShare[] = [
  { token: "aB3dE9xQ", photoIds: ["ps-del0", "ps-del2", "ps-del3"], createdAt: "2026-10-20T09:14:00Z" },
  { token: "Zz81kLmP", photoIds: ["ps-del1", "ps-del4", "gone-id"], createdAt: "2026-10-18T20:02:00Z" },
];

export default function AlbumMaAnhDemo({ tab }: { tab: "photos" | "shares" }) {
  return (
    <AlbumEditor album={ALBUM} initialSources={SOURCES} initialPhotos={PHOTOS} customerShares={SHARES} initialTab={tab} />
  );
}
