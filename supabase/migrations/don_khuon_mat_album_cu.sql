-- ══════════════════════════════════════════════════════════════════════════
-- Dọn vector khuôn mặt của album đã giao khách lâu (chạy SAU album_faces)
--
-- album_faces là bảng nặng nhất database (~57% dung lượng): mỗi khuôn mặt một
-- vector 128 số. Nó chỉ cần cho bước GOM (dựng danh sách người của album). Tìm
-- theo khuôn mặt của khách chỉ dùng album_people (vector đại diện của mỗi
-- người) + album_photo_people — hai bảng nhỏ, KHÔNG bị xoá.
--
-- Cron /api/cron/cleanup-faces xoá album_faces của album đã giao khách quá 15
-- ngày (đã quét + gom xong) rồi đặt mốc faces_pruned_at. Có mốc này thì bước
-- gom KHÔNG BAO GIỜ chạy lại trên album đó: gom trên một album đã mất vector sẽ
-- xoá sạch danh sách người mà khách đang dùng để tìm ảnh.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.albums
  add column if not exists faces_pruned_at timestamptz;
