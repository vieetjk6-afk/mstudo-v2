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
