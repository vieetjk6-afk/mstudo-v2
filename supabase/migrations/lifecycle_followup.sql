-- ============================================================================
-- THEO ĐUỔI & VÒNG ĐỜI — ba chỗ dữ liệu bị bỏ trống khiến việc rơi vào im lặng:
--
--   1) Khách nhận link chọn ảnh rồi quên → không có mốc nào để biết đã im bao
--      lâu, nên không nhắc lại được.
--   2) Ảnh gốc trên Drive không có hạn lưu trữ → Drive đầy dần, không ai biết
--      album nào giữ được nữa.
--   3) Báo giá gửi đi không có hạn hiệu lực thực thi → khách quay lại đòi giá cũ.
--      (Cột studio_quotes.expires_at ĐÃ có sẵn trong schema nhưng chưa từng được
--      ghi hay đọc ở đâu — migration này chỉ thêm chính sách mặc định.)
--
-- Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================================

-- ── 1) Vòng đời lưu trữ ảnh gốc ────────────────────────────────────────────
-- delivered_at: lần ĐẦU album chuyển sang giai đoạn giao khách. Mốc đếm hạn lưu
-- trữ tính từ đây chứ không phải created_at — album chọn ảnh có thể mở hàng
-- tháng trước khi giao.
alter table public.albums add column if not exists delivered_at timestamptz;

-- storage_until: ngày studio dự định dọn ảnh gốc khỏi Drive. null = giữ vô hạn
-- (studio đặt chính sách 0 tháng). Studio gia hạn được bất cứ lúc nào.
alter table public.albums add column if not exists storage_until date;

-- storage_notice_at: lần cuối đã nhắc studio về album này. Chống nhắc lặp mỗi
-- ngày trong suốt cửa sổ cảnh báo.
alter table public.albums add column if not exists storage_notice_at timestamptz;

-- Cron quét album sắp hết hạn: lọc theo hạn, nên đánh index theo hạn.
create index if not exists albums_storage_until_idx
  on public.albums (storage_until)
  where storage_until is not null;

-- ── 2) Chính sách của studio ───────────────────────────────────────────────
-- Giữ ảnh gốc bao nhiêu tháng sau khi giao khách. 0 = không đặt hạn (giữ mãi).
-- Mặc định 6 tháng: đủ dài cho khách in lại, đủ ngắn để Drive không phình vô hạn.
alter table public.profiles
  add column if not exists storage_months integer not null default 6;

-- Hạn hiệu lực mặc định của báo giá, tính bằng ngày kể từ lúc gửi khách.
-- 0 = không đặt hạn. Mặc định 15 ngày — đủ để khách suy nghĩ, đủ ngắn để bảng
-- giá mùa sau không bị ràng buộc bởi báo giá mùa trước.
alter table public.profiles
  add column if not exists quote_valid_days integer not null default 15;

-- BẮT BUỘC: migrations/c1_profiles_column_grants.sql đã THU HỒI quyền UPDATE
-- toàn bảng profiles và chỉ cấp lại theo từng cột. Không cấp thêm hai cột này
-- thì thẻ "Chính sách studio" lưu sẽ im lặng không đổi được gì.
-- Cả hai đều là cấu hình vô hại (số tháng / số ngày), không phải cột nhạy cảm
-- như role hay plan.
grant update (storage_months, quote_valid_days) on public.profiles to authenticated;

-- ── 3) Theo đuổi khách chưa chọn ảnh ───────────────────────────────────────
-- Cột select_invited_at trên hợp đồng: lần đầu mời khách chọn ảnh. Cron dựa vào
-- đây để biết đã im lặng bao nhiêu ngày.
--
-- Vì sao không đọc thẳng zalo_messages: studio CHƯA kết nối Zalo vẫn cần thấy
-- hợp đồng đang tắc trên Tổng quan, mà lúc đó bảng zalo_messages rỗng.
alter table public.studio_contracts
  add column if not exists select_invited_at timestamptz;

-- Số lần đã nhắc lại (0–3). Tách khỏi zalo_messages vì lời nhắc có thể đi qua
-- kênh khác (thông báo trong app) chứ không riêng Zalo.
alter table public.studio_contracts
  add column if not exists select_nudges integer not null default 0;

alter table public.studio_contracts
  add column if not exists select_nudged_at timestamptz;

-- ── 4) Mốc "khách đã xem" cho báo giá đã có sẵn (viewed_at) ────────────────
-- Chỉ thêm index phục vụ cron tự đóng báo giá quá hạn.
create index if not exists studio_quotes_expiry_idx
  on public.studio_quotes (expires_at)
  where expires_at is not null;
