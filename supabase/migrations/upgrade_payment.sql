-- ============================================================================
-- Thanh toán gói dịch vụ MStudo bằng chuyển khoản (VietQR)
--
-- Luồng: studio chọn gói → trang thanh toán hiện mã QR đúng số tiền + nội dung
-- riêng của yêu cầu đó → studio chuyển rồi bấm "Tôi đã chuyển khoản" → admin
-- nhận thông báo đẩy → admin đối chiếu sao kê rồi bấm "Đã nhận tiền" (tự nâng
-- cấp gói) hoặc "Chưa nhận được" (giao dịch thất bại).
--
-- KHÔNG có cổng thanh toán tự động, và đó là cố ý — giống hệt cọc giữ ngày của
-- studio: "studio BÁO đã chuyển" tách hẳn khỏi "MStudo ĐÃ NHẬN". Tiền chỉ được
-- coi là nhận khi người thật nhìn thấy nó trong sao kê.
-- ============================================================================

alter table public.upgrade_requests
  add column if not exists payment_status text not null default 'none';
-- Ràng buộc rời để chạy lại được trên DB đã có cột.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'upgrade_requests_payment_status_check'
  ) then
    alter table public.upgrade_requests
      add constraint upgrade_requests_payment_status_check
      check (payment_status in ('none', 'awaiting_confirm', 'paid', 'failed'));
  end if;
end $$;

-- Nội dung chuyển khoản của yêu cầu này ("MS-4K7Q") — admin dò sao kê bằng nó.
alter table public.upgrade_requests add column if not exists payment_code text;
-- Số tiền CHỐT phía máy chủ lúc tạo yêu cầu (đã trừ giảm giá). Cột `amount` cũ
-- nhận từ trình duyệt nên không tin được để thu tiền.
alter table public.upgrade_requests add column if not exists payment_amount integer;
alter table public.upgrade_requests add column if not exists declared_at timestamptz;
alter table public.upgrade_requests add column if not exists reviewed_at timestamptz;
alter table public.upgrade_requests add column if not exists reviewed_by uuid references auth.users (id) on delete set null;
alter table public.upgrade_requests add column if not exists review_note text;

create unique index if not exists upgrade_requests_payment_code_key
  on public.upgrade_requests (payment_code) where payment_code is not null;
create index if not exists upgrade_requests_payment_status_idx
  on public.upgrade_requests (payment_status, created_at desc);

-- Chủ tài khoản ĐỌC yêu cầu của chính mình: trang thanh toán phải hiện được số
-- tiền, mã nội dung và trạng thái duyệt. Chính sách cũ chỉ cho admin đọc.
-- (Ghi vẫn chỉ qua service-role — studio không được tự đổi trạng thái.)
drop policy if exists upgrade_requests_owner_read on public.upgrade_requests;
create policy upgrade_requests_owner_read on public.upgrade_requests
  for select using (user_id = auth.uid() or public.is_admin());

-- ============================================================================
-- Tài khoản NHẬN tiền của MStudo — nguồn của mã QR trên trang thanh toán.
-- site_settings đọc công khai được, nhưng số tài khoản nhận tiền vốn đã in trên
-- mọi mã QR gửi cho studio nên không phải bí mật.
-- ============================================================================
alter table public.site_settings add column if not exists pay_bank_bin     text;
alter table public.site_settings add column if not exists pay_bank_account text;
alter table public.site_settings add column if not exists pay_bank_holder  text;
alter table public.site_settings add column if not exists pay_bank_name    text;
