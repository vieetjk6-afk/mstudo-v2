-- ============================================================================
-- CHỈ MỤC BỔ SUNG cho các câu lọc nóng và khoá ngoại chưa có chỉ mục
--
-- Không đổi dữ liệu, không đổi ai được thấy gì — chỉ thêm chỉ mục:
--
--   • studio_contracts(selection_album_id / gallery_album_id): trang khách
--     /a/[slug] và trang album trong dashboard tìm hợp đồng theo album. Hai cột
--     này còn là khoá ngoại `on delete set null` → mỗi lần XOÁ một album,
--     Postgres quét toàn bảng studio_contracts hai lượt để gỡ liên kết.
--   • selections / dislikes / album_photo_people (photo_id): khoá ngoại `on
--     delete cascade` tới photos mà chỉ mục hiện có đều KHÔNG bắt đầu bằng
--     photo_id → đồng bộ Drive xoá ảnh theo lô 200, mỗi ảnh quét toàn bảng.
--   • studio_events(contract_id): cổng khách và trang hợp đồng lọc theo cột này.
--   • studio_contracts(owner_id, event_date): danh sách hợp đồng của studio sắp
--     theo ngày, tra trùng lịch cùng ngày.
--   • contract_payments(paid_at): doanh thu theo tháng ở Tổng quan.
--
-- Bảng chưa có (project chưa chạy migration tương ứng) thì bỏ qua, để file này
-- không làm rollback cả cap-nhat.sql. Chạy lại nhiều lần vô hại.
-- ============================================================================

do $$
declare
  ix record;
begin
  for ix in
    select * from (values
      ('studio_contracts', 'studio_contracts_selection_album_idx', '(selection_album_id) where selection_album_id is not null', 'selection_album_id'),
      ('studio_contracts', 'studio_contracts_gallery_album_idx',   '(gallery_album_id) where gallery_album_id is not null',     'gallery_album_id'),
      ('studio_contracts', 'studio_contracts_owner_event_idx',     '(owner_id, event_date)',                                     'event_date'),
      ('selections',       'selections_photo_idx',                 '(photo_id)',                                                 'photo_id'),
      ('dislikes',         'dislikes_photo_idx',                   '(photo_id)',                                                 'photo_id'),
      ('album_photo_people','album_photo_people_photo_idx',        '(photo_id)',                                                 'photo_id'),
      ('studio_events',    'studio_events_contract_idx',           '(contract_id) where contract_id is not null',               'contract_id'),
      ('contract_payments','contract_payments_paid_at_idx',        '(paid_at)',                                                  'paid_at')
    ) as t(tbl, name, def, col)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = ix.tbl and column_name = ix.col
    ) then
      execute format('create index if not exists %I on public.%I %s', ix.name, ix.tbl, ix.def);
    end if;
  end loop;
end $$;
