-- ============================================================================
-- KHOÁ GIÁ SAU KHI KHÁCH KÝ + PHỤ LỤC HỢP ĐỒNG
--
-- Trước đây khách ký xong, studio vẫn sửa tự do bảng hạng mục: tổng tiền đổi,
-- bản khách đã ký không còn khớp, và không có dấu vết nào. Sau migration này:
--
--  1) Hợp đồng khách ĐÃ KÝ → hạng mục gốc (addendum_id is null) bất biến. Hàng
--     rào là trigger dưới DB, không chỉ là nút bị ẩn trên giao diện.
--  2) Muốn thêm/bớt dịch vụ → tạo PHỤ LỤC. Phụ lục chưa ký chỉ là bản nháp
--     (cột `lines` jsonb), KHÔNG nằm trong contract_items, nên mọi chỗ cộng tổng
--     tiền của app (công nợ, báo cáo, cổng khách, xuất kế toán) không đếm nó.
--  3) Khách ký phụ lục ở cổng khách (hoặc studio xác nhận thay khi đã thoả
--     thuận qua điện thoại) → máy chủ chép các dòng nháp thành contract_items
--     mang addendum_id. Từ lúc đó tổng hợp đồng = gốc + các phụ lục đã ký, và
--     các dòng ấy cũng bất biến.
--
-- Người đi qua được hàng rào: lời gọi KHÔNG có người dùng đăng nhập
-- (auth.uid() is null) — tức service role của các route máy chủ (đã tự kiểm
-- quyền, và là đường duy nhất chép phụ lục đã ký) và SQL Editor của chủ project.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
begin
  if to_regclass('public.contract_items') is null or to_regclass('public.studio_contracts') is null then
    raise exception 'Thiếu bảng nền contract_items / studio_contracts. Hãy chạy supabase/setup-all.sql trước.';
  end if;
end $$;

create table if not exists public.contract_addenda (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  no          smallint not null default 1,
  title       text not null default '',
  note        text,
  -- Dòng nháp: [{ name, description, qty, unit_price }] — unit_price âm = giảm giá.
  lines       jsonb not null default '[]'::jsonb,
  signed_at   timestamptz,
  signed_by   text check (signed_by in ('client', 'studio')),
  signed_name text,
  signature   text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (contract_id, no)
);
create index if not exists contract_addenda_contract_idx on public.contract_addenda (contract_id);

alter table public.contract_items
  add column if not exists addendum_id uuid references public.contract_addenda (id) on delete cascade;

-- Đọc: mọi thành viên studio. Ghi: CHỈ qua route máy chủ (service role) — không
-- cấp policy ghi nào cho authenticated.
alter table public.contract_addenda enable row level security;
drop policy if exists contract_addenda_member_read on public.contract_addenda;
create policy contract_addenda_member_read on public.contract_addenda
  for select using (public.is_studio_member(owner_id));

-- ── Hàng rào: hạng mục của hợp đồng đã ký là bất biến ───────────────────────
create or replace function public.guard_signed_contract_items()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rows_to_check public.contract_items[];
  r public.contract_items;
  signed timestamptz;
  found_contract boolean;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  -- Xoá DÂY CHUYỀN (xoá hợp đồng / phụ lục → ON DELETE CASCADE): lệnh xoá hạng
  -- mục do trigger khoá ngoại của Postgres chạy, nên độ sâu trigger > 1. Lúc đó
  -- dòng hợp đồng cha VẪN còn thấy được, nên không dựa vào "cha còn không" được.
  -- Người dùng xoá hạng mục trực tiếp thì độ sâu = 1 → vẫn bị xét như thường.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  if tg_op = 'INSERT' then rows_to_check := array[new];
  elsif tg_op = 'DELETE' then rows_to_check := array[old];
  else rows_to_check := array[old, new];
  end if;

  foreach r in array rows_to_check loop
    signed := null;
    found_contract := false;
    select client_signed_at, true into signed, found_contract
      from public.studio_contracts where id = r.contract_id;
    -- Không thấy hợp đồng cha → không có gì để giữ.
    if not found_contract then
      continue;
    end if;
    -- Dòng của phụ lục đã ký: luôn khoá (phụ lục chưa ký không có dòng nào ở đây).
    if r.addendum_id is not null then
      raise exception 'contract_signed_locked' using hint = 'Hạng mục của phụ lục đã ký không sửa được.';
    end if;
    if signed is not null then
      raise exception 'contract_signed_locked' using hint = 'Khách đã ký hợp đồng — thêm/bớt dịch vụ bằng phụ lục.';
    end if;
  end loop;
  return coalesce(new, old);
end $$;

drop trigger if exists guard_signed_contract_items on public.contract_items;
create trigger guard_signed_contract_items
  before insert or update or delete on public.contract_items
  for each row execute function public.guard_signed_contract_items();
