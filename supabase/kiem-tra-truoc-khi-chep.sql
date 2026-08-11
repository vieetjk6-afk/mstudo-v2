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
-- ⚠️ ĐỨNG ĐÚNG PROJECT ĐÃ. Hai project trông y hệt nhau trong SQL Editor, và
--    nếu bạn ĐÃ TỪNG chép dữ liệu sang project mới một lần thì cả hai còn chứa
--    cùng những cái tên khách như nhau — nhìn dữ liệu KHÔNG phân biệt được.
--    Cách chắc chắn duy nhất là thanh địa chỉ trình duyệt:
--        supabase.com/dashboard/project/<mã-project>
--    Mã đó phải khớp Project URL của project MỚI (Settings → API).
--    Mục 0 bên dưới cho thêm manh mối, nhưng không thay được việc nhìn URL.
--
-- Đọc kết quả:
--   • "TRỐNG — chép được"        → chạy clone thoải mái.
--   • "CÓ DỮ LIỆU — sẽ mất hết"  → xem mục 0 đã. Nếu đây là bản chép cũ của
--                                   chính bản cũ thì bỏ đi được (clone sẽ chép
--                                   lại bản mới nhất). Nếu có dòng tạo SAU ngày
--                                   chép — tức việc thật làm trên bản 2.0 —
--                                   thì DỪNG, xem mục "Nếu đích đã có dữ liệu"
--                                   trong docs/gop-ban-cu-va-chuyen-doi.md.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Manh mối: đây là bản đang chạy hay bản chép đã đóng băng? ────────────
-- Bản CŨ vẫn đang phục vụ khách nên luôn có dữ liệu của hôm nay / vài ngày qua.
-- Bản chép sang project mới thì đứng yên từ lúc chép. So "dòng mới nhất" là ra.
--
-- Lưu ý hai thứ KHÔNG dùng để phân biệt được, vì clone chép nguyên si:
--   • ngày tạo tài khoản (auth.users.created_at) — chép y hệt bản cũ;
--   • mã project trong URL ảnh — sau khi chép vẫn là mã CŨ cho tới khi chạy
--     rewrite-storage-urls.sql. In ra ở đây chỉ để biết bước đó đã chạy chưa.
do $$
declare
  r      record;
  ma     text[];
  gom    text[] := '{}';
  m      text;
  muon   timestamptz;
  moi_nhat timestamptz;
begin
  -- Dòng mới nhất trong toàn bộ schema public (mọi cột created_at).
  moi_nhat := null;
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.column_name = 'created_at'
      and c.data_type like 'timestamp%'
      and c.table_name <> 'mig_progress'
    order by c.table_name
  loop
    begin
      execute format('select max(created_at) from public.%I', r.table_name) into muon;
    exception when others then
      muon := null;
    end;
    if muon is not null then
      if moi_nhat is null or muon > moi_nhat then moi_nhat := muon; end if;
      raise notice 'public.% — dòng mới nhất: %', rpad(r.table_name, 28), muon;
    end if;
  end loop;

  raise notice '────────────────────────────────────────────────';
  if moi_nhat is null then
    raise notice 'Không có dữ liệu có mốc thời gian.';
  else
    raise notice 'DỮ LIỆU MỚI NHẤT Ở PROJECT NÀY: %', moi_nhat;
    raise notice '  • Nếu là hôm nay / hôm qua → đây là bản ĐANG CHẠY (project CŨ).';
    raise notice '  • Nếu đứng yên từ ngày bạn chép dữ liệu → đây là BẢN CHÉP (project MỚI).';
    raise notice 'Đối chiếu lại với thanh địa chỉ trước khi làm gì tiếp.';
  end if;

  -- Mã project nằm sẵn trong URL ảnh (app lưu URL đầy đủ).
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying', 'jsonb')
    order by c.table_name, c.column_name
  loop
    begin
      execute format(
        'select array_agg(distinct m) from ('
        || 'select substring(%I::text from %L) as m from public.%I '
        || 'where %I::text like %L limit 200) s',
        r.column_name, 'https://([a-z0-9]+)\.supabase\.co', r.table_name,
        r.column_name, '%.supabase.co%'
      ) into ma;
    exception when others then
      ma := null;  -- cột lạ kiểu / không đọc được, bỏ qua
    end;
    if ma is not null then
      foreach m in array ma loop
        if m is not null and not (gom @> array[m]) then
          gom := gom || m;
        end if;
      end loop;
    end if;
  end loop;

  raise notice '────────────────────────────────────────────────';
  if array_length(gom, 1) is null then
    raise notice 'URL ảnh: chưa có ảnh nào trong database.';
  else
    foreach m in array gom loop
      raise notice 'URL ảnh đang trỏ về project: %', m;
    end loop;
    raise notice 'Nếu mã này KHÁC mã trên thanh địa chỉ → rewrite-storage-urls.sql';
    raise notice 'chưa chạy (bước B7b). Đây KHÔNG phải dấu hiệu đứng nhầm project.';
  end if;
  raise notice '────────────────────────────────────────────────';
end $$;

-- Bucket đang có ở project này (dùng luôn cho bước chép Storage B7a).
select b.id as bucket, b.public as cong_khai, count(o.id) as so_file
from storage.buckets b
left join storage.objects o on o.bucket_id = b.id
group by b.id, b.public
order by b.id;

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
