-- ============================================================================
-- CHỮ KÝ BÊN A ĐÃ LƯU CỦA STUDIO
--
-- Studio ký xác nhận hợp đồng rất nhiều lần — mỗi lần vẽ lại chữ ký trên màn
-- hình vừa mất công vừa mỗi lần một khác. Lưu MỘT chữ ký (tên người đại diện +
-- ảnh chữ ký) cho cả studio; lần sau bấm "Ký bằng chữ ký đã lưu" là xong.
--
-- Chỉ ghi qua route /api/studio/signature (chủ / quản lý), để một tài khoản
-- nhân viên bất kỳ không thay được chữ ký đại diện của studio. Thành viên
-- studio đọc được (màn hợp đồng cần hiện ra để ký).
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

create table if not exists public.studio_saved_signature (
  owner_id    uuid primary key references public.profiles (id) on delete cascade,
  signer_name text not null,
  signature   text not null,              -- ảnh PNG data URL
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
alter table public.studio_saved_signature enable row level security;

drop policy if exists studio_saved_signature_member_read on public.studio_saved_signature;
create policy studio_saved_signature_member_read on public.studio_saved_signature
  for select using (public.is_studio_member(owner_id));
