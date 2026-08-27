-- ============================================================================
-- % cọc hợp đồng do studio tự đặt
--
-- Trước đây mức cọc mặc định của một hợp đồng viết cứng 25% trong mã nguồn
-- (làm tròn lên bội của 500k, tối thiểu 500k). Mỗi studio một chính sách —
-- người lấy 30%, người lấy 50% với hợp đồng cưới — nên con số này phải nằm ở
-- chỗ studio sửa được, cạnh cọc giữ ngày và hạn giữ ảnh trong "Chính sách
-- studio".
--
-- 0 = TẮT gợi ý cọc (studio tự nhập số tiền từng đợt).
-- ============================================================================

alter table public.profiles
  add column if not exists contract_deposit_percent smallint not null default 25;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_contract_deposit_percent_check') then
    alter table public.profiles
      add constraint profiles_contract_deposit_percent_check
      check (contract_deposit_percent >= 0 and contract_deposit_percent <= 100);
  end if;
end $$;

-- Chủ studio tự sửa được (giống booking_deposit ở migration referral_deposit).
-- Cấp quyền theo CỘT: vá C1 chặn UPDATE cả bảng profiles để không ai tự nâng
-- vai trò của mình.
grant update (contract_deposit_percent) on public.profiles to authenticated;
