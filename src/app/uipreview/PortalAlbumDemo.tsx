"use client";

import AlbumView from "@/app/portal/[token]/AlbumView";
import type { PortalPayload } from "@/app/portal/[token]/types";
import { parseFinalVideos } from "@/lib/final-links";

/**
 * Trang album nền tối của cổng khách (/portal, hợp đồng đã hoàn thành): lưới
 * ảnh tải dần + nút tải từng ảnh, khu xem video (phát lớn + danh sách phát),
 * mục Tải về có link toàn bộ file gốc. Dữ liệu giả — id Drive không có thật nên
 * ảnh chỉ hiện khi chụp bằng script có chặn /api/img.
 */
export function PortalAlbumDemo({ tab }: { tab?: "videos" }) {
  const photos = Array.from({ length: 64 }, (_, i) => ({
    id: `p${i}`,
    drive_file_id: `demo-photo-${i}`,
    name: `MAY_${String(1000 + i)}.jpg`,
    is_video: false,
  }));
  const videos = [
    { id: "v1", drive_file_id: "demo-video-1", name: "Highlight le gia tien.mp4", is_video: true },
  ];
  const data: PortalPayload = {
    contract: {
      code: "HD-0921",
      title: "Phóng sự cưới Nhật Ý & Minh Khoa",
      client_name: "Nhật Ý & Minh Khoa",
      client_phone: "0900000000",
      shoot_type: "wedding",
      event_date: "2026-09-21",
      event_time: "08:00",
      location: "Đà Lạt",
      status: "completed",
      note: null,
      client_signed_at: "2026-06-01T09:00:00Z",
      client_signed_name: "Phạm Thị Nhật Ý",
      brief_submitted_at: null,
      updated_at: "2026-10-01T09:00:00Z",
    },
    studio_name: "Mây Studio",
    studio_logo: null,
    studio_phone: null,
    bank: { bin: null, account: null, holder: null, name: null },
    items: [],
    payments: [],
    plan: [],
    products: [],
    milestones: [],
    tasks: [],
    appointments: [],
    album: {
      slug: "demo",
      title: "Nhật Ý & Minh Khoa",
      cover_url: null,
      download_enabled: true,
      watermark: null,
      photos: tab === "videos" ? [...photos.slice(0, 4), ...videos] : [...photos, ...videos],
    },
    final_links: {
      album_url: null,
      originals_url: "https://drive.google.com/drive/folders/demo-originals",
      videos: parseFinalVideos(
        "Phim cưới (bản đầy đủ) | https://youtu.be/dQw4w9WgXcQ\nTeaser 60 giây | https://vimeo.com/76979871\nhttps://drive.google.com/file/d/demo-drive-video-123456/view"
      ),
    },
    gallery: { slug: "demo", title: "Nhật Ý & Minh Khoa" },
    selection: null,
    wedding: null,
    story: null,
  };
  return <AlbumView key={tab ?? "photos"} token="demo" phone="0900000000" data={data} initialTab={tab} />;
}
