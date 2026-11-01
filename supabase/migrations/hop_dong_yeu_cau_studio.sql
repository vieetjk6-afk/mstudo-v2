-- ============================================================================
-- Hợp đồng: tên cô dâu/chú rể, tên & ghi chú ngày chính, nội dung chuyển khoản
--
-- 1) studio_contracts.bride_name / groom_name — một hợp đồng cho cả hai nhà.
--    Trước đây chỉ có client_name (người ký), tên còn lại phải ghi vào ghi chú
--    rồi tự lục lại.
--
-- 2) studio_contracts.event_label / event_note — ngày chính tự đặt tên
--    ("Lễ nhà gái", "Ngày cưới"…) và ghi chú riêng cho ngày đó. Ngày phụ vẫn là
--    mốc lịch (studio_events, đã có cột note) nên hiện sẵn trên Lịch, lịch thợ,
--    Google Lịch và cổng khách.
--
-- 3) profiles.qr_note_date — nội dung chuyển khoản trên mã QR hợp đồng:
--      false (mặc định) → chỉ số hợp đồng
--      true             → số hợp đồng + ngày chính
--    Không còn tên đợt ("Cọc giữ lịch"…) hay tên khách trong nội dung. Mã đợt
--    MSxxxxxxxx chỉ thêm khi studio đã bật SePay (studio_bank_hooks.enabled).
--
-- Chạy trên Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- ============================================================================

alter table public.studio_contracts add column if not exists bride_name  text;
alter table public.studio_contracts add column if not exists groom_name  text;
alter table public.studio_contracts add column if not exists event_label text;
alter table public.studio_contracts add column if not exists event_note  text;

alter table public.profiles add column if not exists qr_note_date boolean not null default false;

-- BẮT BUỘC: migrations/c1_profiles_column_grants.sql đã thu hồi quyền UPDATE cả
-- bảng profiles — cột mới phải cấp riêng thì chủ studio mới tự lưu được.
grant update (qr_note_date) on public.profiles to authenticated;
