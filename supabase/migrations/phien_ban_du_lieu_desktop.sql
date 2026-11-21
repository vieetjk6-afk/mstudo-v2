-- ══════════════════════════════════════════════════════════════════════════
-- Số phiên bản dữ liệu của từng studio — cho mstudo desktop (chạy SAU schema.sql)
--
-- Desktop tải bản dữ liệu offline (/api/desktop/export?type=backup&lite=1) mỗi
-- 5 phút, kể cả khi thu xuống khay. Trước đây máy chủ đọc ĐỦ ~20 bảng rồi mới so
-- hash để trả 304 — 304 chỉ tiết kiệm băng thông Vercel, còn egress Supabase thì
-- vẫn tốn trọn mỗi lượt (288 lượt/ngày/máy).
--
-- Bảng này giữ MỘT con số cho mỗi studio, tự tăng bằng trigger mỗi khi một bảng
-- desktop dùng bị thêm / sửa / xoá. Máy chủ đọc con số (một dòng nhỏ) trước;
-- trùng với số máy đang giữ thì trả 304 mà không đọc bảng nào.
--
-- Chỉ service-role đọc (RLS bật, không policy) — route desktop dùng admin client.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.studio_data_version (
  owner_id   uuid primary key references public.profiles (id) on delete cascade,
  version    bigint not null default 0,
  changed_at timestamptz not null default now()
);
alter table public.studio_data_version enable row level security;

-- Tham số trigger: cách tìm chủ studio của dòng vừa đổi.
--   'owner'    → cột owner_id của chính dòng đó
--   'contract' → owner_id của studio_contracts theo cột contract_id
--   'quote'    → owner_id của studio_quotes theo cột quote_id
create or replace function public.bump_studio_data_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  o uuid;
begin
  if tg_argv[0] = 'owner' then
    o := (r ->> 'owner_id')::uuid;
  elsif tg_argv[0] = 'contract' then
    select c.owner_id into o from public.studio_contracts c where c.id = (r ->> 'contract_id')::uuid;
  elsif tg_argv[0] = 'quote' then
    select q.owner_id into o from public.studio_quotes q where q.id = (r ->> 'quote_id')::uuid;
  end if;
  -- Dòng con bị xoá dây chuyền sau khi hợp đồng cha đã đi: không tra được chủ —
  -- chính lượt xoá hợp đồng cha đã tăng số rồi.
  if o is not null then
    insert into public.studio_data_version as v (owner_id, version, changed_at)
    values (o, 1, now())
    on conflict (owner_id) do update set version = v.version + 1, changed_at = now();
  end if;
  return null;
end;
$$;

revoke all on function public.bump_studio_data_version() from public, anon, authenticated;

do $$
declare
  t text;
  owner_tables text[] := array[
    'studio_contracts', 'studio_quotes', 'studio_expenses', 'studio_bookings', 'studio_events',
    'studio_crew', 'studio_packages', 'studio_pricelist', 'studio_equipment', 'studio_services'
  ];
  contract_tables text[] := array[
    'contract_items', 'contract_crew', 'contract_payments', 'contract_payment_plan', 'contract_products',
    'contract_quote_options', 'contract_tasks', 'contract_edit_requests'
  ];
begin
  foreach t in array owner_tables loop
    execute format('drop trigger if exists %I on public.%I', 'tg_data_version', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.bump_studio_data_version(%L)',
      'tg_data_version', t, 'owner');
  end loop;
  foreach t in array contract_tables loop
    execute format('drop trigger if exists %I on public.%I', 'tg_data_version', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.bump_studio_data_version(%L)',
      'tg_data_version', t, 'contract');
  end loop;
end $$;

drop trigger if exists tg_data_version on public.quote_items;
create trigger tg_data_version after insert or update or delete on public.quote_items
  for each row execute function public.bump_studio_data_version('quote');

-- albums: desktop chỉ đọc 4 cột. Cột khác của album đổi liên tục (đếm ảnh,
-- mốc quét khuôn mặt…) — tăng số theo chúng thì desktop tải lại suốt ngày.
drop trigger if exists tg_data_version on public.albums;
create trigger tg_data_version after insert or delete or update of phase, status, is_gallery, owner_id on public.albums
  for each row execute function public.bump_studio_data_version('owner');
