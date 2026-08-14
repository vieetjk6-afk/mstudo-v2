-- ════════════════════════════════════════════════════════════════════════════
-- ĐỔI ĐỊA CHỈ FILE STORAGE SAU KHI CHÉP DỮ LIỆU SANG PROJECT SUPABASE MỚI
--
-- Vì sao cần: app lưu ảnh bằng `getPublicUrl()`, tức là trong database là URL
-- ĐẦY ĐỦ dạng
--     https://<ma-project>.supabase.co/storage/v1/object/public/<bucket>/<file>
-- Chép dữ liệu sang project mới thì các URL đó VẪN trỏ về project CŨ. Chừng nào
-- project cũ còn sống thì ảnh vẫn hiện (nên rất dễ bỏ sót), nhưng xoá hoặc tạm
-- dừng project cũ là mọi ảnh chết: logo studio, ảnh chuyển khoản của khách,
-- ảnh thiệp cưới, ảnh bìa album, ảnh trong trình tạo website…
--
-- Script này quét MỌI cột text / varchar / jsonb trong schema `public` và thay
-- mã project cũ bằng mã mới. Chạy MỘT LẦN, SAU khi chép dữ liệu xong và SAU khi
-- đã tải các bucket từ project cũ lên project mới.
--
-- Chạy ở: SQL Editor của project MỚI.
-- ════════════════════════════════════════════════════════════════════════════

-- ⬅️ SỬA 2 GIÁ TRỊ `ma_cu` / `ma_moi` ở đầu mỗi khối DO bên dưới (có 2 khối).
--    Mã project là phần trước `.supabase.co` trong Project URL
--    (Project Settings → API → Project URL).

do $$
declare
  ma_cu   text := 'abcdefghijklmnopqrst';   -- ⬅️ mã project CŨ
  ma_moi  text := 'zyxwvutsrqponmlkjihg';   -- ⬅️ mã project MỚI
  cu      text;
  moi     text;
  r       record;
  n       bigint;
  tong    bigint := 0;
  tbl     text;
begin
  if ma_cu = ma_moi then
    raise exception 'Mã project cũ và mới giống nhau — sửa lại 2 biến ở đầu khối.';
  end if;

  cu  := 'https://' || ma_cu  || '.supabase.co';
  moi := 'https://' || ma_moi || '.supabase.co';

  -- Trigger nghiệp vụ (hạn mức album, ghi log, updated_at) không nên chạy vì
  -- đây là thao tác sửa kỹ thuật, không phải người dùng đổi dữ liệu.
  --
  -- KHÔNG dùng session_replication_role: đó là tham số chỉ superuser đặt được,
  -- mà role `postgres` của Supabase không phải superuser → lỗi 42501
  -- "permission denied to set parameter". Tắt theo từng bảng như script chép
  -- dữ liệu vẫn làm — chủ bảng có quyền này.
  --
  -- An toàn khi lỗi: cả khối DO này nằm trong MỘT transaction, và ALTER TABLE
  -- trong Postgres cũng có transaction. Nửa đường mà raise thì trigger tự trở
  -- về trạng thái bật, không có chuyện tắt lửng lơ.
  for tbl in
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
  loop
    begin
      execute format('alter table public.%I disable trigger user', tbl);
    exception when others then null;   -- bảng không đổi được thì cứ chạy tiếp
    end;
  end loop;

  for r in
    select c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying', 'jsonb')
      and c.is_generated = 'NEVER'
      and c.is_updatable = 'YES'
    order by c.table_name, c.column_name
  loop
    if r.data_type = 'jsonb' then
      execute format(
        'update public.%I set %I = replace(%I::text, %L, %L)::jsonb where %I::text like %L',
        r.table_name, r.column_name, r.column_name, cu, moi, r.column_name, '%' || cu || '%'
      );
    else
      execute format(
        'update public.%I set %I = replace(%I, %L, %L) where %I like %L',
        r.table_name, r.column_name, r.column_name, cu, moi, r.column_name, '%' || cu || '%'
      );
    end if;

    get diagnostics n = row_count;
    if n > 0 then
      tong := tong + n;
      raise notice '% . % → % dòng', r.table_name, r.column_name, n;
    end if;
  end loop;

  -- Bật lại trigger nghiệp vụ. App dựa vào chúng (hạn mức album, updated_at,
  -- ghi log) nên để tắt là phần mềm chạy sai một cách âm thầm.
  for tbl in
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
  loop
    begin
      execute format('alter table public.%I enable trigger user', tbl);
    exception when others then null;
    end;
  end loop;

  raise notice '── Xong: đã đổi % dòng từ % sang %', tong, cu, moi;
end $$;

-- ── Kiểm tra lại: khối này phải in ra "sạch" ───────────────────────────────
do $$
declare
  ma_cu text := 'abcdefghijklmnopqrst';   -- ⬅️ mã project CŨ (giống khối trên)
  cu    text;
  r     record;
  n     bigint;
  con   bigint := 0;
begin
  cu := 'https://' || ma_cu || '.supabase.co';

  for r in
    select c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying', 'jsonb')
    order by c.table_name, c.column_name
  loop
    if r.data_type = 'jsonb' then
      execute format('select count(*) from public.%I where %I::text like %L',
                     r.table_name, r.column_name, '%' || cu || '%') into n;
    else
      execute format('select count(*) from public.%I where %I like %L',
                     r.table_name, r.column_name, '%' || cu || '%') into n;
    end if;

    if n > 0 then
      con := con + n;
      raise notice 'CÒN SÓT: % . % → % dòng', r.table_name, r.column_name, n;
    end if;
  end loop;

  if con = 0 then
    raise notice '── Sạch: không còn URL nào trỏ về project cũ.';
  else
    raise notice '── Còn % dòng trỏ về project cũ — xem danh sách bên trên.', con;
  end if;
end $$;
