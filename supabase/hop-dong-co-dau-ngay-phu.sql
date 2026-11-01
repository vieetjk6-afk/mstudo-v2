-- ══════════════════════════════════════════════════════════════════════════
-- mstudo — HỢP ĐỒNG — TÊN CÔ DÂU/CHÚ RỂ, NGÀY CHÍNH, NỘI DUNG CHUYỂN KHOẢN
--
-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay.
--
-- Cách dùng: Supabase → SQL Editor → dán TOÀN BỘ file này → Run.
-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
--
-- Chỉ gồm migration của riêng việc này: bốn cột trên studio_contracts và
-- cột qr_note_date trên profiles. Chỉ cần bảng có từ schema nền. Chạy lại
-- cả file này cũng an toàn.
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — TẠO BẢNG
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/hop_dong_yeu_cau_studio.sql — Hợp đồng: tên cô dâu/chú rể, tên & ghi chú ngày chính, nội dung chuyển khoản chỉ số HĐ (tuỳ chọn kèm ngày)
-- ══════════════════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/hop_dong_yeu_cau_studio.sql — Hợp đồng: tên cô dâu/chú rể, tên & ghi chú ngày chính, nội dung chuyển khoản chỉ số HĐ (tuỳ chọn kèm ngày)
-- ══════════════════════════════════════════════════════════════════════════

-- BẮT BUỘC: migrations/c1_profiles_column_grants.sql đã thu hồi quyền UPDATE cả
-- bảng profiles — cột mới phải cấp riêng thì chủ studio mới tự lưu được.
grant update (qr_note_date) on public.profiles to authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- KIỂM TRA — bảng kết quả dưới đây là BẰNG CHỨNG đã chạy đúng chỗ.
-- Cột `co` phải là `t` (true) hết. Có `f` nào nghĩa là chưa xong.
-- ══════════════════════════════════════════════════════════════════════════
select 'album_people'   as thu, to_regclass('public.album_people')   is not null as co
union all
select 'album_photo_people', to_regclass('public.album_photo_people') is not null
union all
select 'album_faces', to_regclass('public.album_faces') is not null
union all
select 'photos.faces_scanned_at', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'photos' and column_name = 'faces_scanned_at')
union all
select 'albums.faces_clustered_at', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'albums' and column_name = 'faces_clustered_at');

