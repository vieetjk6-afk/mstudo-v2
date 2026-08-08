-- ============================================================================
-- MStudo — Ghi chú nội bộ trong hợp đồng (tính năng mới số 13 của bản thiết kế)
--
-- Luồng trao đổi giữa người trong studio về MỘT hợp đồng: "khách đổi ý thêm 1
-- outfit", "cần dậy sớm hơn 30 phút"… Gõ @tên để nhắc ai đó; tên được nhắc lưu
-- riêng ở `mentions` để sau này lọc / gửi thông báo mà không phải bới lại chữ.
--
-- KHÁCH KHÔNG BAO GIỜ THẤY bảng này: trang `/c/<token>` chạy bằng service-role
-- và chỉ đọc đúng các bảng nó cần — ghi chú nội bộ không nằm trong số đó.
--
-- Chạy được nhiều lần (idempotent). Dán vào Supabase SQL Editor.
-- ============================================================================

create table if not exists public.contract_notes (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  -- Người viết. Nhân viên nghỉ việc thì hồ sơ bị xoá → author_id về null, nên
  -- tên được CHỤP LẠI ngay lúc viết để dòng ghi chú cũ không mất danh tính.
  author_id   uuid references public.profiles (id) on delete set null,
  author_name text not null default '',
  body        text not null default '',
  -- Các tên đã @nhắc trong body, đã bỏ dấu @.
  mentions    text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists contract_notes_contract_idx
  on public.contract_notes (contract_id, created_at);

alter table public.contract_notes enable row level security;

-- Cùng luật với các bảng con khác của hợp đồng: mọi thành viên studio sở hữu
-- hợp đồng đó đều đọc/ghi được (chủ, quản lý, nhân viên, và admin hệ thống).
drop policy if exists contract_notes_owner_all on public.contract_notes;
create policy contract_notes_owner_all on public.contract_notes
  for all using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and public.is_studio_member(c.owner_id))
  ) with check (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and public.is_studio_member(c.owner_id))
  );
