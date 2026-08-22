-- ============================================================================
-- VÁ QUYỀN ĐỌC/GHI HẠNG MỤC HỢP ĐỒNG CHO THÀNH VIÊN STUDIO
--
-- TRIỆU CHỨNG
--   Quản lý chi nhánh tạo hợp đồng, chọn hạng mục, bấm lưu → hợp đồng có, hạng
--   mục KHÔNG có, tổng tiền 0đ. Chủ studio sửa hạng mục thì quản lý chi nhánh
--   vẫn thấy 0đ. Chủ studio thì mọi thứ bình thường.
--
-- NGUYÊN NHÂN
--   schema.sql khai policy cho các bảng con của hợp đồng HAI LẦN:
--
--     ~dòng 845  contract_items_owner_all …  using (c.owner_id = auth.uid())
--                → CHỈ chủ studio. Nhân viên, quản lý, quản lý chi nhánh đều
--                  không đọc và không ghi được.
--     ~dòng 1462 khối do $$ … $$ chạy lại policy đó với is_studio_member(c.owner_id)
--                → đúng: mọi thành viên của studio.
--
--   Bản đúng nằm SAU nên khi chạy trọn schema.sql thì nó thắng. Nhưng khối
--   do $$ … $$ đặt tất cả các bảng con trong MỘT lệnh: chỉ cần một bảng trong
--   danh sách chưa tồn tại (tính năng thêm sau) là cả khối văng lỗi và MỌI bảng
--   sau đó giữ nguyên bản chỉ-chủ-studio. Chạy schema.sql theo từng đoạn, hoặc
--   dừng giữa chừng vì một lỗi khác, cũng cho ra đúng hậu quả đó.
--
--   Hạng mục nằm ở bảng con, còn hợp đồng nằm ở bảng cha — nên hợp đồng thì
--   thấy mà tiền thì không. Đúng như triệu chứng.
--
-- CÁCH VÁ
--   Chạy lại policy cho TỪNG bảng, mỗi bảng một lệnh độc lập và bỏ qua bảng
--   chưa tồn tại. Một bảng thiếu không còn kéo theo những bảng khác.
--
-- AN TOÀN KHI CHẠY LẠI: chỉ thay policy, không đụng dữ liệu. Chạy bao nhiêu lần
-- cũng ra cùng một kết quả.
-- ============================================================================

-- Hàm kiểm tra thành viên (khai lại cho chắc — DB cũ có thể chưa có).
create or replace function public.is_studio_member(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select
    target = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and studio_owner_id = target)
    or public.is_admin();
$$;

-- Bảng CHA: hợp đồng và báo giá.
do $$
declare t text;
begin
  foreach t in array array['studio_contracts', 'studio_quotes'] loop
    -- to_regclass trả NULL khi bảng chưa có ⇒ bỏ qua, không làm hỏng cả lượt.
    if to_regclass('public.' || t) is null then
      raise notice 'bỏ qua %: bảng chưa tồn tại', t;
      continue;
    end if;
    begin
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %1$s_owner_all on public.%1$s', t);
      execute format(
        'create policy %1$s_owner_all on public.%1$s for all '
        'using (public.is_studio_member(owner_id)) '
        'with check (public.is_studio_member(owner_id))', t);
      raise notice 'đã vá %', t;
    exception when others then
      -- Một bảng hỏng KHÔNG được kéo theo các bảng còn lại — đó chính là lỗi
      -- của khối cũ trong schema.sql mà migration này sinh ra để sửa.
      raise notice 'lỗi khi vá %: %', t, sqlerrm;
    end;
  end loop;
end $$;

-- Bảng CON của hợp đồng: quyền lấy theo chủ của hợp đồng cha.
do $$
declare t text;
begin
  foreach t in array array[
    'contract_items', 'contract_crew', 'contract_edit_requests', 'contract_payments',
    'contract_payment_plan', 'contract_tasks', 'contract_equipment', 'contract_products',
    'contract_quote_options'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'bỏ qua %: bảng chưa tồn tại', t;
      continue;
    end if;
    begin
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %1$s_owner_all on public.%1$s', t);
      execute format(
        'create policy %1$s_owner_all on public.%1$s for all '
        'using (exists (select 1 from public.studio_contracts c '
        '               where c.id = contract_id and public.is_studio_member(c.owner_id))) '
        'with check (exists (select 1 from public.studio_contracts c '
        '                    where c.id = contract_id and public.is_studio_member(c.owner_id)))', t);
      raise notice 'đã vá %', t;
    exception when others then
      raise notice 'lỗi khi vá %: %', t, sqlerrm;
    end;
  end loop;
end $$;

-- Hạng mục báo giá: quyền lấy theo chủ của báo giá cha.
do $$
begin
  if to_regclass('public.quote_items') is not null then
    alter table public.quote_items enable row level security;
    drop policy if exists quote_items_owner_all on public.quote_items;
    create policy quote_items_owner_all on public.quote_items for all
      using (exists (select 1 from public.studio_quotes q
                     where q.id = quote_id and public.is_studio_member(q.owner_id)))
      with check (exists (select 1 from public.studio_quotes q
                          where q.id = quote_id and public.is_studio_member(q.owner_id)));
  end if;
end $$;

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- Câu này phải trả về is_studio_member cho MỌI bảng con. Chỗ nào còn
-- "auth.uid()" trần là chỗ chưa vá được.
--
--   select tablename, policyname, qual
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('contract_items','contract_crew','contract_payments','studio_contracts')
--   order by tablename;
