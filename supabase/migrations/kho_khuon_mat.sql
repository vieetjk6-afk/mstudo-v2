-- ============================================================================
-- KHO KHUÔN MẶT DẠNG FILE (Storage) — đợt 1 của việc dời album_faces ra khỏi DB
--
-- Vì sao: album_faces (mỗi khuôn mặt một dòng, vector 128 số) đẩy database tới
-- sát trần 500 MB của gói Free, trong khi Storage gần như trống (trần 1 GB).
-- Mỗi lượt quét giờ ghi thêm một "mảnh" nhị phân vào bucket này (định dạng ở
-- src/lib/face-kho.ts); khách tự quét trên máy mình cũng góp mảnh vào đây.
--
-- Bucket RIÊNG TƯ, không policy nào: chỉ service-role (máy chủ) đọc/ghi. Khách
-- không bao giờ tải file — so khớp chạy ở máy chủ, chỉ trả danh sách ảnh.
-- Trần 4 MB một file: mảnh thường vài chục KB, bản gộp của album 3.000 ảnh
-- khoảng 2–3 MB.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('face-kho', 'face-kho', false, 4194304, array['application/octet-stream'])
on conflict (id) do update
  set public = false,
      file_size_limit = 4194304,
      allowed_mime_types = array['application/octet-stream'];
