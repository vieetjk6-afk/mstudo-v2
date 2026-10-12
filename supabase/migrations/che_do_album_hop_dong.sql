-- ════════════════════════════════════════════════════════════════════════════
-- Chế độ album của hợp đồng: studio_contracts.album_mode
--
--   'desktop' — Album mặc định: app mstudo desktop đổ ảnh lên cây thư mục Drive
--               của hợp đồng, máy chủ tự tạo album chọn ảnh và tự chuyển sang
--               giao khách (src/lib/studio-drive.ts).
--   'manual'  — Nhập link ảnh riêng: KHÔNG dựng thư mục Drive. Khách xác nhận
--               hợp đồng (ký / nhận cọc / studio duyệt) thì tạo MỘT album trống;
--               studio dán link Drive ảnh chọn, rồi link ảnh hoàn thiện vào CHÍNH
--               album đó — cùng một album đi từ chọn ảnh sang giao khách.
--   NULL      — hợp đồng tạo trước bản này: giữ nguyên hành vi tự động cũ.
--
-- Mã nguồn chịu được việc CHƯA chạy file này (đọc cột riêng, lỗi thiếu cột thì
-- coi như NULL) — xem src/lib/missing-column.ts.
-- Chạy lại nhiều lần an toàn.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.studio_contracts
  add column if not exists album_mode text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'studio_contracts_album_mode_check'
      and conrelid = 'public.studio_contracts'::regclass
  ) then
    alter table public.studio_contracts
      add constraint studio_contracts_album_mode_check
      check (album_mode is null or album_mode in ('desktop', 'manual'));
  end if;
end $$;

comment on column public.studio_contracts.album_mode is
  'Chế độ album: desktop = album mặc định đồng bộ từ mstudo desktop; manual = studio tự dán link ảnh; NULL = hợp đồng cũ (hành vi tự động cũ).';
