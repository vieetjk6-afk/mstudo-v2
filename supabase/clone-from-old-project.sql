-- ════════════════════════════════════════════════════════════════════════════
-- CHÉP TOÀN BỘ DỮ LIỆU TỪ PROJECT SUPABASE CŨ SANG PROJECT MỚI
--
-- Chạy HOÀN TOÀN trong trình duyệt: Supabase (project MỚI) → SQL Editor.
-- Không cần cài pg_dump hay dùng dòng lệnh. Cách làm: bật postgres_fdw để
-- database MỚI tự mở kết nối sang database CŨ rồi hút dữ liệu về.
--
-- ĐIỀU KIỆN: project mới đã chạy xong supabase/setup-all.sql (đủ bảng, đủ cột).
--
-- ⚠️ Script này XOÁ SẠCH dữ liệu đang có trong project MỚI rồi chép đè từ
--    project cũ. Đừng chạy trên project đang có dữ liệu thật.
--
-- ⚠️ File trong Storage (logo, ảnh cưới, ảnh chuyển khoản) KHÔNG đi theo —
--    chúng nằm ở kho file chứ không nằm trong database. Xem docs/thiet-lap-moi.md.
--
-- ── CHẠY THEO 4 LẦN, KHÔNG DÁN MỘT PHÁT CẢ FILE ────────────────────────────
--   Lần 1: PHẦN 1 (kết nối)            → chạy một lần
--   Lần 2: PHẦN 2 (cài bộ máy chép)    → chạy một lần
--   Lần 3: PHẦN 3 (chép) → BẤM RUN LẠI NHIỀU LẦN cho tới khi báo "XONG TẤT CẢ"
--   Lần 4: PHẦN 4 (dọn dẹp)            → chạy một lần
--
--   Vì sao phải chia: SQL Editor có giới hạn thời gian cho mỗi lệnh
--   ("upstream timeout"). Dữ liệu thật kéo qua mạng từ project cũ không thể
--   xong trong một lệnh, nên PHẦN 3 làm việc theo ĐỢT ~40 giây rồi tự dừng và
--   ghi nhớ chỗ đang dở. Bấm Run lại là nó chép tiếp từ đúng chỗ đó.
-- ════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PHẦN 1 · KẾT NỐI TỚI PROJECT CŨ  (chạy một lần)                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Lấy thông tin ở project CŨ: Project Settings → Database → Connection string
-- → chọn tab "Session pooler". Bạn cần 3 thứ trong chuỗi đó:
--    host     : aws-0-<vùng>.pooler.supabase.com     (KHÔNG dùng db.xxx.supabase.co)
--    user     : postgres.<mã-project-cũ>
--    password : mật khẩu database của project cũ
-- Sửa đúng 3 chỗ có dấu ⬅️ bên dưới rồi chạy khối này.

create extension if not exists postgres_fdw;

drop server if exists old_project cascade;

create server old_project
  foreign data wrapper postgres_fdw
  options (
    host    'aws-0-ap-southeast-1.pooler.supabase.com',   -- ⬅️ SỬA: host của project cũ
    port    '5432',
    dbname  'postgres',
    sslmode 'require',
    -- Kéo về từng khối 2000 dòng thay vì 100 (mặc định) → ít vòng mạng hơn hẳn.
    fetch_size '2000'
  );

create user mapping for current_user
  server old_project
  options (
    user     'postgres.abcdefghijklmnop',                 -- ⬅️ SỬA: user của project cũ
    password 'mat-khau-database-cu'                       -- ⬅️ SỬA: mật khẩu database cũ
  );

-- Soi các bảng bên project cũ (chỉ đọc, không đụng gì tới dữ liệu cũ).
drop schema if exists old_public cascade;
create schema old_public;
import foreign schema public from server old_project into old_public;

drop schema if exists old_auth cascade;
create schema old_auth;
import foreign schema auth limit to (users, identities)
  from server old_project into old_auth;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PHẦN 2 · CÀI BỘ MÁY CHÉP  (chạy một lần, ngay sau phần 1)                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Những cái bẫy mà bộ máy này phải tự lo:
--   • Giới hạn thời gian: chép theo đợt, hết ~40 giây thì dừng và nhớ chỗ dở.
--   • Bảng lớn: chép theo lô 2000 dòng, nhớ tới khoá chính cuối cùng đã chép,
--     nên một bảng vài trăm nghìn dòng vẫn qua được nhiều lần bấm Run.
--   • Thứ tự khoá ngoại: xếp bảng theo độ sâu phụ thuộc (cha trước con), bảng
--     nào vẫn lỗi thì hẹn lượt sau — không cần khai báo tay cây phụ thuộc.
--   • Trigger on_auth_user_created tự sinh hồ sơ rỗng khi thêm tài khoản → chép
--     auth TRƯỚC rồi mới dọn bảng public, nên hồ sơ thật không bị hồ sơ rỗng
--     chen mất (nếu không, admin sẽ tụt xuống photographer).
--   • Cột GENERATED (auth.users.confirmed_at, auth.identities.email) do Postgres
--     tự tính, cấm insert giá trị vào → phải loại khỏi danh sách cột.
--   • Lệch cột giữa hai project: chỉ chép cột CÓ Ở CẢ HAI thay vì gãy toàn bộ.

create table if not exists public.mig_progress (
  bang     text primary key,
  thu_tu   int    not null,
  pk_col   text,
  last_pk  text,
  so_dong  bigint not null default 0,
  so_lan_loi int  not null default 0,
  xong     boolean not null default false,
  ghi_chu  text
);

-- Danh sách cột chép được: có ở cả hai bên, bỏ cột do Postgres tự tính.
create or replace function public.mig_cols(dst_schema text, src_schema text, tbl text)
returns text language sql stable as $$
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    from information_schema.columns c
   where c.table_schema = dst_schema
     and c.table_name   = tbl
     and c.is_generated = 'NEVER'
     and coalesce(c.identity_generation, '') <> 'ALWAYS'
     and exists (select 1 from information_schema.columns o
                  where o.table_schema = src_schema
                    and o.table_name   = tbl
                    and o.column_name  = c.column_name);
$$;

-- Chuẩn bị: chép tài khoản đăng nhập, dọn bảng public, lập kế hoạch chép.
create or replace function public.mig_prepare()
returns table (viec text, ket_qua text)
language plpgsql as $mig$
declare
  tbl   text;
  cols  text;
  n     bigint;
  danh  text;
begin
  -- 1) Tài khoản đăng nhập trước tiên (mọi bảng khác đều móc vào đây).
  --    Xoá user của project mới: nếu bạn đã lỡ tạo admin tay thì tài khoản đó
  --    trùng email với admin cũ và sẽ chặn không cho chép user cũ sang.
  delete from auth.users;

  foreach tbl in array array['users', 'identities'] loop
    cols := public.mig_cols('auth', 'old_auth', tbl);
    if cols is null then continue; end if;
    execute format('insert into auth.%I (%s) select %s from old_auth.%I on conflict do nothing',
                   tbl, cols, cols, tbl);
    get diagnostics n = row_count;
    viec := 'auth.' || tbl; ket_qua := n || ' dòng';
    return next;
  end loop;

  -- 2) Dọn sạch dữ liệu nghiệp vụ (gồm hồ sơ rỗng trigger vừa sinh ở bước 1
  --    và dòng site_settings mặc định).
  select string_agg(format('public.%I', table_name), ', ')
    into danh
    from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE'
     and table_name <> 'mig_progress';
  execute 'truncate table ' || danh || ' cascade';
  viec := 'dọn bảng public'; ket_qua := 'xong';
  return next;

  -- 2b) TẮT trigger nghiệp vụ trong lúc chép.
  --     Bắt buộc, không phải cho nhanh: `albums` có trigger enforce_album_quota
  --     chặn tạo album vượt hạn mức / chưa được cấp quyền gallery — nó bắn lỗi
  --     "Tài khoản chưa được cấp quyền tạo gallery" ngay khi chép album cũ sang.
  --     albums hỏng thì studio_contracts (có khoá ngoại trỏ tới albums) hỏng
  --     theo, rồi toàn bộ contract_* hỏng tiếp — sập dây chuyền từ một gốc.
  --     Trigger albums_log_creation cũng sẽ đẻ thêm dòng rác vào album_creations.
  --     Dữ liệu chép sang là dữ liệu ĐÃ HỢP LỆ ở project cũ, không cần kiểm lại.
  --     mig_step() tự BẬT LẠI khi chép xong hết (và PHẦN 4 bật lại lần nữa).
  n := 0;
  for tbl in
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
       and table_name <> 'mig_progress'
  loop
    begin
      execute format('alter table public.%I disable trigger user', tbl);
      n := n + 1;
    exception when others then
      null;  -- bảng không có trigger hoặc không đủ quyền → bỏ qua
    end;
  end loop;
  viec := 'tắt trigger nghiệp vụ'; ket_qua := n || ' bảng (sẽ tự bật lại khi xong)';
  return next;

  -- 3) Lập kế hoạch: xếp bảng theo độ sâu phụ thuộc khoá ngoại (cha trước con).
  delete from public.mig_progress;

  create temp table if not exists _depth (tbl text primary key, d int) on commit drop;
  delete from _depth;

  insert into _depth (tbl, d)
  select t.table_name, 0
    from information_schema.tables t
   where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
     and t.table_name <> 'mig_progress'
     and exists (select 1 from information_schema.tables o
                  where o.table_schema = 'old_public' and o.table_name = t.table_name);

  -- Nới dần: bảng con luôn sâu hơn bảng cha ít nhất 1 bậc. 12 vòng thừa sức
  -- cho mọi cây phụ thuộc thực tế; tự cắt sớm khi không còn gì đổi.
  for n in 1..12 loop
    update _depth c
       set d = sub.md
      from (
        select ch.tbl, max(pa.d) + 1 as md
          from _depth ch
          join pg_constraint k on k.contype = 'f'
                              and k.conrelid = ('public.' || quote_ident(ch.tbl))::regclass
          join _depth pa on pa.tbl = (select relname from pg_class where oid = k.confrelid)
         where pa.tbl <> ch.tbl
         group by ch.tbl
      ) sub
     where c.tbl = sub.tbl and c.d < sub.md;
    exit when not found;
  end loop;

  insert into public.mig_progress (bang, thu_tu, pk_col)
  select d.tbl,
         d.d * 1000 + row_number() over (partition by d.d order by d.tbl),
         (select kcu.column_name
            from information_schema.table_constraints tc
            join information_schema.key_column_usage kcu
              on kcu.constraint_name = tc.constraint_name
             and kcu.table_schema = tc.table_schema
           where tc.table_schema = 'public' and tc.table_name = d.tbl
             and tc.constraint_type = 'PRIMARY KEY'
           order by kcu.ordinal_position
           limit 1)
    from _depth d;

  viec := 'lập kế hoạch'; ket_qua := (select count(*) from public.mig_progress) || ' bảng cần chép';
  return next;
end
$mig$;

-- Bật lại toàn bộ trigger nghiệp vụ. Chạy được nhiều lần, vô hại.
-- QUAN TRỌNG: app dựa vào các trigger này (hạn mức album, updated_at, ghi log)
-- nên nếu để tắt thì phần mềm sẽ chạy sai một cách âm thầm.
create or replace function public.mig_bat_lai_trigger()
returns text language plpgsql as $mig$
declare tbl text; n int := 0;
begin
  for tbl in
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
       and table_name <> 'mig_progress'
  loop
    begin
      execute format('alter table public.%I enable trigger user', tbl);
      n := n + 1;
    exception when others then null;
    end;
  end loop;
  return 'đã bật lại trigger trên ' || n || ' bảng';
end
$mig$;

-- Chép một ĐỢT. Bấm Run lại nhiều lần cho tới khi báo "XONG TẤT CẢ".
create or replace function public.mig_step(giay int default 40, lo int default 2000)
returns table (bang text, da_chep bigint, trang_thai text)
language plpgsql as $mig$
declare
  bat_dau timestamptz := clock_timestamp();
  r       record;
  cols    text;
  newlast text;
  n       bigint;
  het_gio boolean := false;
begin
  for r in select * from public.mig_progress where not xong order by thu_tu loop
    cols := public.mig_cols('public', 'old_public', r.bang);

    if cols is null or r.pk_col is null then
      update public.mig_progress set xong = true,
             ghi_chu = coalesce(ghi_chu, 'bỏ qua — không có cột khớp hoặc không có khoá chính')
       where mig_progress.bang = r.bang;
      continue;
    end if;

    loop
      begin
        -- Lấy khoá cuối bằng "order by … desc limit 1" chứ KHÔNG dùng max():
        -- Postgres không có aggregate max() cho kiểu uuid, mà phần lớn khoá
        -- chính ở đây là uuid.
        execute format(
          'with src as (select %s from old_public.%I %s order by %I limit %s), '
          || 'ins as (insert into public.%I (%s) select %s from src on conflict do nothing) '
          || 'select (select %I::text from src order by %I desc limit 1), (select count(*) from src)',
          cols, r.bang,
          case when r.last_pk is null then '' else format('where %I > %L', r.pk_col, r.last_pk) end,
          r.pk_col, lo,
          r.bang, cols, cols,
          r.pk_col, r.pk_col
        ) into newlast, n;
      exception when others then
        -- Thường là bảng cha chưa chép xong → hoãn sang lượt sau. Nhưng nếu cứ
        -- lỗi mãi (nguyên nhân khác) thì phải bỏ cuộc, nếu không sẽ lặp vô tận
        -- và không bao giờ báo xong.
        update public.mig_progress
           set so_lan_loi = mig_progress.so_lan_loi + 1,
               xong    = (mig_progress.so_lan_loi + 1 >= 5),
               ghi_chu = case when mig_progress.so_lan_loi + 1 >= 5
                              then 'LỖI (bỏ qua sau 5 lần) · ' || sqlerrm
                              else 'hoãn, sẽ thử lại · ' || sqlerrm end
         where mig_progress.bang = r.bang;
        n := -1;
        exit;
      end;

      exit when n = 0;

      r.last_pk := newlast;
      update public.mig_progress
         set last_pk = newlast, so_dong = mig_progress.so_dong + n, ghi_chu = null
       where mig_progress.bang = r.bang;

      if clock_timestamp() - bat_dau > make_interval(secs => giay) then
        het_gio := true;
        exit;
      end if;
    end loop;

    if n = 0 then
      update public.mig_progress set xong = true where mig_progress.bang = r.bang;
    end if;

    exit when het_gio;
  end loop;

  return query
    select p.bang, p.so_dong,
           case when p.ghi_chu like 'LỖI%' then p.ghi_chu
                when p.xong then 'xong'
                when p.so_dong > 0 then 'đang dở — bấm Run lại'
                else coalesce(p.ghi_chu, 'chưa tới lượt') end
      from public.mig_progress p
     where p.so_dong > 0 or not p.xong or p.ghi_chu like 'LỖI%'
     order by (p.ghi_chu like 'LỖI%') desc, p.xong, p.thu_tu;

  if not exists (select 1 from public.mig_progress where not xong) then
    -- Xong hết → bật lại trigger nghiệp vụ ngay, đừng chờ người dùng nhớ.
    bang := '✅ XONG TẤT CẢ';
    da_chep := (select sum(so_dong) from public.mig_progress);
    trang_thai := public.mig_bat_lai_trigger() || ' · chạy tiếp PHẦN 4 để dọn dẹp';
    return next;
  else
    bang := '⏳ CHƯA XONG';
    da_chep := (select count(*) from public.mig_progress where not xong);
    trang_thai := 'bảng còn lại — bấm Run lại (trigger nghiệp vụ đang TẮT cho tới khi xong)';
    return next;
  end if;
end
$mig$;

select * from public.mig_prepare();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PHẦN 3 · CHÉP DỮ LIỆU  ·  BẤM RUN LẠI NHIỀU LẦN                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Chạy riêng dòng dưới. Mỗi lần chạy làm ~40 giây rồi dừng, nhớ chỗ đang dở.
-- Bấm Run lại cho tới khi thấy dòng "✅ XONG TẤT CẢ".
--
--   select * from public.mig_step();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PHẦN 4 · DỌN DẸP  (chạy sau khi đã thấy "XONG TẤT CẢ")                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Bật lại trigger nghiệp vụ (mig_step đã tự bật khi xong, chạy lại cho chắc)
-- rồi gỡ kết nối tới project cũ để mật khẩu không nằm lại trong database mới.
--
--   select public.mig_bat_lai_trigger();
--   drop schema if exists old_public cascade;
--   drop schema if exists old_auth cascade;
--   drop server if exists old_project cascade;
--   drop function if exists public.mig_step(int, int);
--   drop function if exists public.mig_bat_lai_trigger();
--   drop function if exists public.mig_prepare();
--   drop function if exists public.mig_cols(text, text, text);
--   drop table if exists public.mig_progress;
