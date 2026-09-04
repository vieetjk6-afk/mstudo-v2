-- ============================================================================
-- HOÁ ĐƠN & XUẤT KẾ TOÁN
--
-- Studio có doanh thu thật cần hai thứ app chưa có:
--   1. PHIẾU THU đưa khách cho mỗi lần nhận tiền — cần một SỐ PHIẾU bền, đánh
--      theo năm, không trùng.
--   2. KHOÁ SỔ: báo cáo tháng trước đã gửi kế toán, rồi ai đó sửa một hợp đồng
--      cũ và con số tháng trước đổi mà không ai biết. Mốc khoá sổ biến "đừng sửa
--      số cũ" từ lời dặn miệng thành hàng rào.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'contract_payments')
  then
    raise exception
      'Thiếu bảng nền: contract_payments. Hãy chạy supabase/setup-all.sql trước.';
  end if;
end $$;

-- ── Số phiếu thu ────────────────────────────────────────────────────────────
-- Đánh theo NĂM ('PT-2026-0007'), nếp sổ sách Việt Nam, và giữ số ngắn sau
-- mười năm. Định dạng do src/lib/accounting.ts (receiptNo) lo; ở đây chỉ lưu.
--
-- null = chưa in phiếu cho lần thu này. Số chỉ được cấp KHI IN, không cấp sẵn
-- cho mọi lần thu: studio ghi nhận một khoản rồi sửa/xoá là chuyện thường, mà
-- một dãy số phiếu thủng lỗ chỗ thì kế toán không giải thích được.
alter table public.contract_payments add column if not exists receipt_no  text;
alter table public.contract_payments add column if not exists receipt_at  timestamptz;

-- Số phiếu không được trùng TRONG MỘT studio. Ràng buộc phải qua hợp đồng vì
-- contract_payments không có owner_id — nên dùng bảng đếm riêng bên dưới thay vì
-- một unique index không biểu diễn được.
create index if not exists contract_payments_receipt_idx
  on public.contract_payments (receipt_no)
  where receipt_no is not null;

-- ── Bộ đếm số phiếu theo studio × năm ───────────────────────────────────────
-- Cấp số bằng UPDATE ... RETURNING trên một dòng (xem hàm bên dưới) nên hai lần
-- bấm in cùng lúc KHÔNG thể nhận cùng một số.
create table if not exists public.studio_receipt_seq (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  year     integer not null,
  last_no  integer not null default 0,
  primary key (owner_id, year)
);

alter table public.studio_receipt_seq enable row level security;
drop policy if exists studio_receipt_seq_owner_all on public.studio_receipt_seq;
create policy studio_receipt_seq_owner_all on public.studio_receipt_seq
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

/**
 * Cấp số phiếu thu kế tiếp cho một studio trong một năm.
 *
 * `insert ... on conflict do update` là một câu lệnh nguyên tử: hai người cùng
 * bấm in một lúc thì Postgres tuần tự hoá chúng và mỗi người nhận một số khác
 * nhau. Đọc-rồi-ghi ở tầng ứng dụng KHÔNG làm được điều đó.
 */
create or replace function public.next_receipt_no(p_owner uuid, p_year integer)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.studio_receipt_seq (owner_id, year, last_no)
  values (p_owner, p_year, 1)
  on conflict (owner_id, year)
  do update set last_no = public.studio_receipt_seq.last_no + 1
  returning last_no;
$$;

revoke all on function public.next_receipt_no(uuid, integer) from public, anon;
grant execute on function public.next_receipt_no(uuid, integer) to authenticated;

-- ── Khoá sổ ─────────────────────────────────────────────────────────────────
-- Ngày CUỐI CÙNG đã chốt. Mọi bút toán có ngày ≤ mốc này là bất biến (luật ở
-- src/lib/accounting.ts, isLocked). null = chưa khoá kỳ nào.
alter table public.profiles add column if not exists books_closed_until date;

-- BẮT BUỘC: c1_profiles_column_grants.sql đã thu hồi UPDATE toàn bảng profiles.
-- Không cấp cột này thì nút "Khoá sổ" bấm xong im lặng không đổi gì.
grant update (books_closed_until) on public.profiles to authenticated;

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select owner_id, year, last_no from public.studio_receipt_seq;
-- select receipt_no, receipt_at, amount from public.contract_payments
--   where receipt_no is not null order by receipt_at desc limit 10;

-- ── HÀNG RÀO KHOÁ SỔ (trigger) ──────────────────────────────────────────────
--
-- Mốc `books_closed_until` ở trên mới chỉ là một CON SỐ. Không có phần dưới đây
-- thì nó chỉ là lời dặn miệng có màu: giao diện nhắc, còn ai bấm sửa vẫn sửa
-- được, và đúng cái tình huống cần chặn (sửa một hợp đồng cũ làm đổi số của kỳ
-- đã gửi kế toán) vẫn xảy ra y như trước.
--
-- Chặn ở DB chứ không ở giao diện: RLS cho phép studio ghi thẳng vào hai bảng
-- này bằng anon key, nên một kiểm tra ở React không phải hàng rào.
--
-- CHỈ chặn thay đổi ĐỘNG TỚI TIỀN. Đóng dấu số phiếu thu (`receipt_no`), đính
-- ảnh chuyển khoản, sửa ghi chú… đều không làm đổi con số nào của kỳ, mà lại là
-- việc studio hay làm trên phiếu cũ — chặn cả những thứ đó thì studio sẽ đi mở
-- khoá sổ để in một tờ phiếu, và cái khoá thành vô nghĩa.

create or replace function public.guard_books_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner   uuid;
  v_closed  date;
  v_old_day date;
  v_new_day date;
  v_money_changed boolean := true;
begin
  -- Chủ sở hữu + ngày của bút toán, tuỳ bảng.
  if tg_table_name = 'studio_expenses' then
    v_owner   := coalesce(new.owner_id, old.owner_id);
    v_old_day := (case when tg_op <> 'INSERT' then old.spent_at end);
    v_new_day := (case when tg_op <> 'DELETE' then new.spent_at end);
    if tg_op = 'UPDATE' then
      v_money_changed := (new.amount is distinct from old.amount)
                      or (new.spent_at is distinct from old.spent_at)
                      or (new.category is distinct from old.category)
                      or (new.contract_id is distinct from old.contract_id);
    end if;
  else -- contract_payments
    select c.owner_id into v_owner
    from public.studio_contracts c
    where c.id = coalesce(new.contract_id, old.contract_id);
    v_old_day := (case when tg_op <> 'INSERT' then old.paid_at::date end);
    v_new_day := (case when tg_op <> 'DELETE' then new.paid_at::date end);
    if tg_op = 'UPDATE' then
      v_money_changed := (new.amount is distinct from old.amount)
                      or (new.paid_at is distinct from old.paid_at)
                      or (new.kind is distinct from old.kind)
                      or (new.contract_id is distinct from old.contract_id);
    end if;
  end if;

  if v_owner is null then
    return coalesce(new, old);
  end if;

  select p.books_closed_until into v_closed from public.profiles p where p.id = v_owner;
  if v_closed is null or not v_money_changed then
    return coalesce(new, old);
  end if;

  -- Xét CẢ hai mốc ngày: dời một bút toán RA KHỎI kỳ đã khoá cũng là làm đổi số
  -- của kỳ đó, y như sửa tại chỗ.
  if (v_old_day is not null and v_old_day <= v_closed)
     or (v_new_day is not null and v_new_day <= v_closed) then
    raise exception
      'Sổ đã khoá tới %. Bút toán trong kỳ đã chốt không sửa/xoá/thêm được. Mở khoá kỳ ở màn Thu chi & công nợ nếu thật sự cần.',
      to_char(v_closed, 'DD/MM/YYYY')
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists guard_books_closed_expenses on public.studio_expenses;
create trigger guard_books_closed_expenses
  before insert or update or delete on public.studio_expenses
  for each row execute function public.guard_books_closed();

drop trigger if exists guard_books_closed_payments on public.contract_payments;
create trigger guard_books_closed_payments
  before insert or update or delete on public.contract_payments
  for each row execute function public.guard_books_closed();

-- ── Kiểm tra hàng rào sau khi chạy ──────────────────────────────────────────
-- update public.profiles set books_closed_until = current_date where id = auth.uid();
-- insert into public.studio_expenses (owner_id, title, amount, spent_at)
--   values (auth.uid(), 'thử', 1000, current_date - 1);   -- PHẢI báo lỗi
-- update public.profiles set books_closed_until = null where id = auth.uid();
