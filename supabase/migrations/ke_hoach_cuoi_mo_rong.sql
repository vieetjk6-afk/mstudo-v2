-- ============================================================================
-- KẾ HOẠCH CƯỚI — MỞ RỘNG: khách mời & xếp bàn, nhà cung cấp, đội hỗ trợ ngày
-- cưới, đồ cần mang, ảnh cần chụp, phong cách (bảng màu, concept), cài đặt.
--
-- Thêm MỘT cột jsonb `extra` cho tất cả, thay vì một cột cho mỗi danh sách: cả
-- kế hoạch luôn được đọc và ghi trọn một dòng (kèm điều kiện `rev`), nên tách cột
-- không được gì, mà mỗi danh sách mới sau này lại phải thêm một migration.
-- Hình dạng (xem normalizePlan ở src/lib/wedding-plan.ts):
--   { guests: [...], vendors: [...], people: [...], packing: [...], shots: [...],
--     style: { colors, concept, links }, settings: { table_size, guests_expected } }
--
-- Bản web chịu được lúc CHƯA chạy file này: ba danh sách gốc (việc cần làm, ngân
-- sách, lịch trình ngày cưới) vẫn lưu được; các mục mới tạm ẩn với khách.
--
-- Chạy SAU migrations/ke_hoach_cuoi.sql. An toàn khi chạy lại.
-- ============================================================================

do $$
begin
  if to_regclass('public.wedding_plans') is null then
    raise exception 'Thiếu bảng wedding_plans. Hãy chạy supabase/migrations/ke_hoach_cuoi.sql trước.';
  end if;
end $$;

alter table public.wedding_plans
  add column if not exists extra jsonb not null default '{}'::jsonb;

comment on column public.wedding_plans.extra is
  'Kế hoạch cưới mở rộng: guests, vendors, people, packing, shots, style, settings (xem src/lib/wedding-plan.ts).';

notify pgrst, 'reload schema';
