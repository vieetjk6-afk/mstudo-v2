-- ─────────────────────────────────────────────────────────────────────────
-- Mã hợp đồng / báo giá KHÔNG TRÙNG (chạy SAU schema.sql)
--
-- Trước đây số thứ tự = đếm số mã đã có trong tháng + 1. Hai cách ra mã trùng:
--   • xoá một hợp đồng giữa chừng: có 001, 002, 003, xoá 002 → đếm được 2 →
--     mã kế là 003, trùng với cái đang có;
--   • hai người tạo cùng lúc: cùng đếm ra 2, cùng nhận 003.
-- Không có ràng buộc unique nên trùng là lọt im lặng.
--
-- Giờ: bộ đếm theo (studio, tiền tố tháng), lấy số bằng MỘT câu
-- `insert … on conflict do update … returning` — nguyên tử, hai lượt cùng lúc
-- nhận hai số khác nhau. Lần đầu (hoặc khi có mã nhập tay lớn hơn) bộ đếm tự
-- bắt kịp số LỚN NHẤT đang có, nên xoá hợp đồng không làm lùi số.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.studio_code_seq (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  prefix   text not null,
  last     integer not null default 0,
  primary key (owner_id, prefix)
);
-- Chỉ hàm security definer bên dưới đọc/ghi bảng này.
alter table public.studio_code_seq enable row level security;

create or replace function public.next_studio_code(p_owner uuid, p_prefix text, p_kind text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max  integer := 0;
  v_next integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_studio_member(p_owner) then
    raise exception 'không có quyền với studio này' using errcode = '42501';
  end if;
  if p_prefix is null or p_prefix !~ '^[A-Z]{2}-[0-9]{2}-[0-9]{4}-$' then
    raise exception 'tiền tố mã không hợp lệ' using errcode = '22023';
  end if;

  -- Số lớn nhất đang có (phần đuôi chỉ toàn chữ số, tối đa 9 chữ số).
  if p_kind = 'contract' then
    select coalesce(max(substr(code, length(p_prefix) + 1)::integer), 0) into v_max
      from public.studio_contracts
     where owner_id = p_owner and code like p_prefix || '%'
       and substr(code, length(p_prefix) + 1) ~ '^[0-9]{1,9}$';
  elsif p_kind = 'quote' then
    select coalesce(max(substr(code, length(p_prefix) + 1)::integer), 0) into v_max
      from public.studio_quotes
     where owner_id = p_owner and code like p_prefix || '%'
       and substr(code, length(p_prefix) + 1) ~ '^[0-9]{1,9}$';
  else
    raise exception 'loại mã không hợp lệ' using errcode = '22023';
  end if;

  insert into public.studio_code_seq as s (owner_id, prefix, last)
  values (p_owner, p_prefix, v_max + 1)
  on conflict (owner_id, prefix)
    do update set last = greatest(s.last, v_max) + 1
  returning last into v_next;
  return v_next;
end;
$$;

revoke all on function public.next_studio_code(uuid, text, text) from public, anon;
grant execute on function public.next_studio_code(uuid, text, text) to authenticated, service_role;

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select public.next_studio_code('<owner uuid>', 'HD-11-2026-', 'contract');
