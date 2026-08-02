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
-- ════════════════════════════════════════════════════════════════════════════


-- ── PHẦN 1 · KẾT NỐI TỚI PROJECT CŨ ─────────────────────────────────────────
-- Lấy thông tin ở project CŨ: Project Settings → Database → Connection string
-- → chọn tab "Session pooler". Bạn cần 3 thứ trong chuỗi đó:
--    host     : aws-0-<vùng>.pooler.supabase.com     (KHÔNG dùng db.xxx.supabase.co)
--    user     : postgres.<mã-project-cũ>
--    password : mật khẩu database của project cũ
-- Sửa đúng 3 chỗ có dấu ⬅️ bên dưới rồi chạy cả file.

create extension if not exists postgres_fdw;

drop server if exists old_project cascade;

create server old_project
  foreign data wrapper postgres_fdw
  options (
    host    'aws-0-ap-southeast-1.pooler.supabase.com',   -- ⬅️ SỬA: host của project cũ
    port    '5432',
    dbname  'postgres',
    sslmode 'require'
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


-- ── PHẦN 2 · HÀM CHÉP DỮ LIỆU ───────────────────────────────────────────────
-- Vì sao cần hàm chứ không phải vài câu insert:
--   • Thứ tự khoá ngoại: hợp đồng cần chủ studio có trước, ảnh cần album có
--     trước… Hàm chép nhiều LƯỢT, bảng nào chưa chép được thì để lượt sau —
--     không cần biết trước cây phụ thuộc.
--   • Lệch cột: nếu project cũ thừa/thiếu cột so với bản 2.0, hàm chỉ chép
--     những cột CÓ Ở CẢ HAI thay vì gãy toàn bộ.
--   • Cột GENERATED: `auth.users.confirmed_at` và `auth.identities.email` do
--     Postgres tự tính, cấm insert giá trị vào (lỗi "cannot insert a non-DEFAULT
--     value into column"). Hàm loại chúng khỏi danh sách cột; giá trị vẫn đúng
--     vì được tính lại từ các cột nguồn đã chép sang.
--   • Trigger on_auth_user_created tự tạo hồ sơ mỗi khi thêm tài khoản → phải
--     dọn bảng public SAU khi chép auth thì hồ sơ thật mới không bị hồ sơ rỗng
--     do trigger sinh ra chen mất.

create or replace function public.mig_clone()
returns table (bang text, so_dong bigint, trang_thai text)
language plpgsql
as $mig$
declare
  tbl        text;
  cols       text;
  n          bigint;
  pending    text[];
  still      text[];
  pass       int;
  loi        text;
begin
  -- 1) Tài khoản đăng nhập trước tiên (mọi bảng khác đều móc vào đây).
  --    Xoá sạch user của project mới: nếu bạn đã lỡ tạo admin tay thì tài khoản
  --    đó trùng email với admin cũ và sẽ chặn không cho chép user cũ sang.
  delete from auth.users;

  for tbl in select unnest(array['users', 'identities']) loop
    select string_agg(quote_ident(c.column_name), ', ')
      into cols
      from information_schema.columns c
     where c.table_schema = 'auth' and c.table_name = tbl
       and c.is_generated = 'NEVER'                            -- xem ghi chú ở hàm
       and coalesce(c.identity_generation, '') <> 'ALWAYS'
       and exists (select 1 from information_schema.columns o
                    where o.table_schema = 'old_auth' and o.table_name = tbl
                      and o.column_name = c.column_name);
    if cols is null then continue; end if;
    execute format('insert into auth.%I (%s) select %s from old_auth.%I on conflict do nothing',
                   tbl, cols, cols, tbl);
    get diagnostics n = row_count;
    bang := 'auth.' || tbl; so_dong := n; trang_thai := 'xong';
    return next;
  end loop;

  -- 2) Dọn sạch dữ liệu nghiệp vụ của project mới (gồm cả hồ sơ rỗng mà
  --    trigger vừa sinh ra ở bước 1 và dòng site_settings mặc định).
  select string_agg(format('public.%I', table_name), ', ')
    into cols
    from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE';
  execute 'truncate table ' || cols || ' cascade';

  -- 3) Chép từng bảng, lặp tối đa 8 lượt cho tới khi không còn tiến triển.
  pending := array(
    select t.table_name
      from information_schema.tables t
     where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
       and exists (select 1 from information_schema.tables o
                    where o.table_schema = 'old_public' and o.table_name = t.table_name)
     order by t.table_name
  );

  for pass in 1..8 loop
    still := '{}';
    foreach tbl in array pending loop
      begin
        select string_agg(quote_ident(c.column_name), ', ')
          into cols
          from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = tbl
           and c.is_generated = 'NEVER'
           and coalesce(c.identity_generation, '') <> 'ALWAYS'
           and exists (select 1 from information_schema.columns o
                        where o.table_schema = 'old_public' and o.table_name = tbl
                          and o.column_name = c.column_name);
        if cols is null then
          bang := tbl; so_dong := 0; trang_thai := 'bỏ qua — không có cột nào khớp';
          return next;
          continue;
        end if;
        execute format('insert into public.%I (%s) select %s from old_public.%I on conflict do nothing',
                       tbl, cols, cols, tbl);
        get diagnostics n = row_count;
        if n > 0 or pass > 1 then
          bang := tbl; so_dong := n; trang_thai := 'xong (lượt ' || pass || ')';
          return next;
        else
          bang := tbl; so_dong := 0; trang_thai := 'rỗng';
          return next;
        end if;
      exception when others then
        -- Nhiều khả năng bảng cha chưa được chép → hẹn lượt sau.
        still := still || tbl;
        loi := sqlerrm;
      end;
    end loop;

    exit when array_length(still, 1) is null;   -- xong sạch
    exit when still = pending;                  -- lặp mãi không tiến triển
    pending := still;
  end loop;

  -- 4) Bảng nào vẫn không chép được thì báo rõ kèm lỗi cuối cùng.
  if array_length(still, 1) is not null then
    foreach tbl in array still loop
      bang := tbl; so_dong := 0; trang_thai := 'LỖI — ' || coalesce(loi, 'không rõ');
      return next;
    end loop;
  end if;
end
$mig$;


-- ── PHẦN 3 · CHẠY & XEM KẾT QUẢ ─────────────────────────────────────────────
select * from public.mig_clone() order by trang_thai like 'LỖI%' desc, so_dong desc;


-- ── PHẦN 4 · DỌN DẸP ────────────────────────────────────────────────────────
-- Gỡ kết nối tới project cũ để mật khẩu không nằm lại trong database mới.
-- (Chạy sau khi đã xem kết quả ở phần 3 và thấy ổn.)
--
--   drop schema if exists old_public cascade;
--   drop schema if exists old_auth cascade;
--   drop server if exists old_project cascade;
--   drop function if exists public.mig_clone();
