-- ════════════════════════════════════════════════════════════════════════════
-- KIỂM TRA AN TOÀN TRƯỚC KHI CHẠY clone-from-old-project.sql
--
-- ⚠️ `clone-from-old-project.sql` XOÁ SẠCH project đích rồi mới chép:
--       delete from auth.users;                    ← mất mọi tài khoản
--       truncate table <mọi bảng public> cascade;  ← mất mọi dữ liệu nghiệp vụ
--    Không có bước hỏi lại, không hoàn tác được.
--
-- Chạy file này TRƯỚC, ở SQL Editor của project MỚI (project đích). Nó không
-- sửa gì cả, chỉ đếm xem đang có gì sắp bị xoá.
--
-- Đọc kết quả:
--   • "TRỐNG — chép được"        → chạy clone thoải mái.
--   • "CÓ DỮ LIỆU — sẽ mất hết"  → DỪNG LẠI. Xem mục "Nếu đích đã có dữ liệu"
--                                   trong docs/gop-ban-cu-va-chuyen-doi.md.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Bảng nào đang có dữ liệu, bao nhiêu dòng ────────────────────────────
do $$
declare
  r    record;
  n    bigint;
  tong bigint := 0;
  users bigint;
begin
  select count(*) into users from auth.users;
  if users > 0 then
    raise notice 'auth.users → % tài khoản (SẼ BỊ XOÁ)', users;
    tong := tong + users;
  end if;

  for r in
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name <> 'mig_progress'
    order by table_name
  loop
    execute format('select count(*) from public.%I', r.table_name) into n;
    if n > 0 then
      tong := tong + n;
      raise notice 'public.% → % dòng', r.table_name, n;
    end if;
  end loop;

  raise notice '────────────────────────────────────────────────';
  if tong = 0 then
    raise notice 'TRỐNG — chép được. Chạy clone-from-old-project.sql bình thường.';
  else
    raise notice 'CÓ DỮ LIỆU: % dòng sẽ bị xoá sạch nếu chạy clone. DỪNG LẠI.', tong;
    raise notice 'Xem "Nếu đích đã có dữ liệu" trong docs/gop-ban-cu-va-chuyen-doi.md';
  end if;
end $$;

-- ── 2. Dữ liệu ở đích là THẬT hay chỉ để xem thử? ──────────────────────────
-- Bảng dưới cho biết ai đã đăng nhập và tạo gì trong project mới. Nếu chỉ có
-- 1–2 tài khoản của bạn và vài bản ghi nháp thì bỏ đi được; nếu có hợp đồng của
-- khách thật, ảnh khách đã chọn… thì tuyệt đối đừng chạy clone.
select 'tài khoản'      as muc, count(*)::text as so_luong,
       coalesce(string_agg(email, ', ' order by created_at), '—') as chi_tiet
from auth.users
union all
select 'hợp đồng', count(*)::text,
       coalesce(string_agg(distinct coalesce(client_name, title), ', '), '—')
from public.studio_contracts
union all
select 'album', count(*)::text,
       coalesce(string_agg(distinct title, ', '), '—')
from public.albums
union all
select 'khách đã chọn ảnh', count(*)::text, '—' from public.selections
union all
select 'khoản đã thu', count(*)::text, '—' from public.contract_payments;
