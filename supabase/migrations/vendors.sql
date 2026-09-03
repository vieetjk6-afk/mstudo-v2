-- ============================================================================
-- NHÀ CUNG CẤP & ĐƠN ĐẶT NGOÀI
--
-- Album in, makeup thuê ngoài, xe hoa, địa điểm — tất cả đang chỉ là MỘT DÒNG
-- CHI trong studio_expenses. Nên không ai trả lời được câu hỏi hằng ngày của
-- studio: "đơn album của khách A đã in xong chưa?".
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_contracts')
  then missing := missing || 'studio_contracts'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_expenses')
  then missing := missing || 'studio_expenses'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

-- ── Sổ nhà cung cấp ─────────────────────────────────────────────────────────
create table if not exists public.studio_vendors (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null default '',
  kind       text not null default 'other'
               check (kind in ('album', 'makeup', 'dress', 'car', 'venue', 'print', 'other')),
  phone      text,
  contact    text,
  note       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists studio_vendors_owner_idx on public.studio_vendors (owner_id, active);

-- ── Đơn đặt ngoài ───────────────────────────────────────────────────────────
create table if not exists public.vendor_orders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,

  -- Nhà cung cấp rời sổ thì đơn CŨ vẫn phải đọc được để đối soát → set null,
  -- không cascade. `vendor_name` giữ lại tên tại thời điểm đặt.
  vendor_id   uuid references public.studio_vendors (id) on delete set null,
  vendor_name text,

  -- Đơn có thể không gắn hợp đồng nào (mua phông nền, in card studio).
  contract_id uuid references public.studio_contracts (id) on delete set null,

  title       text not null default '',
  amount      integer not null default 0,  -- VND
  -- đã gửi → đang làm → đã nhận → đã giao khách. KHÔNG có "đã huỷ": đơn huỷ thì
  -- xoá, vì một đơn huỷ còn nằm đây sẽ tiếp tục được cộng tiền và tiếp tục bị
  -- đếm là trễ hẹn (xem src/lib/vendors.ts).
  status      text not null default 'sent'
                check (status in ('sent', 'doing', 'received', 'delivered')),
  due_date    date,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists vendor_orders_owner_idx    on public.vendor_orders (owner_id, status, due_date);
create index if not exists vendor_orders_contract_idx on public.vendor_orders (contract_id);

-- ── Nối sang sổ chi, KHÔNG đếm tiền hai lần ─────────────────────────────────
-- Mỗi đơn sinh ĐÚNG MỘT dòng studio_expenses mang vendor_order_id của nó. Mọi
-- lần sửa đơn CẬP NHẬT chính dòng đó (upsert theo cột unique bên dưới) chứ
-- không thêm dòng mới — nếu không, sửa giá đơn ba lần là ba dòng chi và báo cáo
-- lợi nhuận sai gấp ba.
alter table public.studio_expenses
  add column if not exists vendor_order_id uuid references public.vendor_orders (id) on delete cascade;

-- UNIQUE (chứ không chỉ index tra nhanh): đây là hàng rào thật chặn dòng chi
-- trùng, kể cả khi hai tab cùng bấm lưu một đơn.
create unique index if not exists studio_expenses_vendor_order_uidx
  on public.studio_expenses (vendor_order_id)
  where vendor_order_id is not null;

-- Xoá đơn thì dòng chi đi theo (on delete cascade ở trên) — tiền của một đơn
-- không còn tồn tại thì cũng không được nằm lại trong báo cáo.

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.studio_vendors enable row level security;
alter table public.vendor_orders  enable row level security;

drop policy if exists studio_vendors_owner_all on public.studio_vendors;
create policy studio_vendors_owner_all on public.studio_vendors
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists vendor_orders_owner_all on public.vendor_orders;
create policy vendor_orders_owner_all on public.vendor_orders
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select v.name, o.title, o.status, o.due_date, o.amount
-- from public.vendor_orders o left join public.studio_vendors v on v.id = o.vendor_id
-- order by o.due_date;
