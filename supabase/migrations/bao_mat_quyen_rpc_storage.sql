-- ============================================================================
-- VÁ BẢO MẬT — quyền gọi RPC, bộ đếm số phiếu thu, storage, crew_account,
-- affiliate_codes.
-- Chạy MỘT LẦN trên Supabase (SQL Editor). An toàn khi chạy lại (idempotent).
--
-- Các file gốc (atomic_redemptions.sql, accounting.sql, schema.sql,
-- wedding_invitations.sql, crew_profile_show.sql) cũng đã được sửa y như dưới
-- đây — để project MỚI dựng ra đúng ngay, và chạy lại một file gốc cũ không mở
-- lại lỗ. File này là phần vá cho project ĐANG CHẠY.
-- ============================================================================

-- ── 1) RPC SECURITY DEFINER chỉ cho service-role ─────────────────────────────
-- Bốn hàm này nhận `p_user_id` từ người gọi và chạy với quyền chủ hàm (bỏ qua
-- RLS). Supabase mặc định cấp EXECUTE cho anon + authenticated, nên bất kỳ ai
-- cầm anon key đều gọi thẳng được qua /rest/v1/rpc: tự kích hoạt dùng thử cho
-- tài khoản người khác, đốt lượt dùng của mã giảm giá, sinh mã affiliate hộ
-- người khác… App chỉ gọi chúng từ API route bằng service-role (sau khi đã tự
-- kiểm đăng nhập), nên thu hồi hết quyền của client là không vỡ gì.
--
-- Bọc trong to_regprocedure: database chưa có hàm nào thì bỏ qua hàm đó, không
-- làm hỏng cả lượt chạy.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.redeem_discount_trial(text, uuid, timestamptz, text, integer, boolean, boolean, boolean, boolean)',
    'public.start_free_trial(uuid, timestamptz, text, integer, boolean, boolean, boolean, boolean)',
    'public.consume_discount_code(text)',
    'public.get_or_create_affiliate_code(uuid, text)'
  ] loop
    if to_regprocedure(fn) is null then
      raise notice 'bỏ qua %: hàm chưa tồn tại', fn;
      continue;
    end if;
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- ── 2) next_receipt_no: chỉ cấp số cho studio CỦA MÌNH ───────────────────────
-- Bản cũ nhận `p_owner` tuỳ ý: một tài khoản bất kỳ đăng nhập rồi gọi RPC với
-- id của studio khác là đẩy được bộ đếm số phiếu của họ (dãy số thủng lỗ chỗ —
-- đúng thứ kế toán không giải thích được). Giờ người gọi phải là chủ hoặc nhân
-- viên của studio đó (is_studio_member — nhân viên in phiếu với p_owner là id
-- chủ studio), hoặc là service-role.
create or replace function public.next_receipt_no(p_owner uuid, p_year integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_studio_member(p_owner) then
    raise exception 'không có quyền cấp số phiếu cho studio này' using errcode = '42501';
  end if;
  insert into public.studio_receipt_seq (owner_id, year, last_no)
  values (p_owner, p_year, 1)
  on conflict (owner_id, year)
  do update set last_no = public.studio_receipt_seq.last_no + 1
  returning last_no into v_no;
  return v_no;
end;
$$;

revoke all on function public.next_receipt_no(uuid, integer) from public, anon;
grant execute on function public.next_receipt_no(uuid, integer) to authenticated, service_role;

-- ── 3) Storage: bỏ quyền LIỆT KÊ công khai, ghi chỉ trong thư mục của mình ───
-- Ba bucket đều PUBLIC: ảnh vẫn mở được bằng URL công khai mà không cần policy
-- SELECT nào. Policy SELECT chỉ mở thêm đường LIỆT KÊ toàn bucket — với
-- payment-proofs nghĩa là ai cũng duyệt được ảnh chuyển khoản (tên, số tài
-- khoản, số tiền) của mọi studio.
--
-- Đường dẫn thật trong app (đã đối chiếu):
--   • /api/upload (client của user)      → `<user_id>/<ts>.<ext>`
--   • /api/upload/large (URL ký sẵn)     → `tmp/<user_id>/<uuid>.<ext>`
--   • /api/c/[token]/proof, /api/book/deposit (service-role) → `client/…`, `booking/…`
--   • thiệp cưới (service-role / URL ký sẵn) → wedding-photos, không qua RLS
-- Service-role và URL ký sẵn bỏ qua RLS, nên chỉ hai dạng đầu cần policy.
--
-- Vẫn giữ SELECT trong thư mục của chính mình: Storage đòi quyền SELECT cho
-- `upload(…, { upsert: true })` và `remove()` (ContractEditor xoá ảnh CK cũ).
--
-- Dùng split_part thay cho storage.foldername(): cùng nghĩa (đoạn trước dấu
-- '/' đầu tiên) mà không phụ thuộc hàm riêng của Supabase.

-- payment-proofs
drop policy if exists payment_proofs_read on storage.objects;
create policy payment_proofs_read on storage.objects
  for select to authenticated using (
    bucket_id = 'payment-proofs'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );
drop policy if exists payment_proofs_insert on storage.objects;
create policy payment_proofs_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'payment-proofs'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );
drop policy if exists payment_proofs_update on storage.objects;
create policy payment_proofs_update on storage.objects
  for update to authenticated using (
    bucket_id = 'payment-proofs'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  ) with check (
    bucket_id = 'payment-proofs'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );
drop policy if exists payment_proofs_delete on storage.objects;
create policy payment_proofs_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'payment-proofs'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );

-- logos
drop policy if exists logos_read on storage.objects;
create policy logos_read on storage.objects
  for select to authenticated using (
    bucket_id = 'logos'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );
drop policy if exists logos_write on storage.objects;
create policy logos_write on storage.objects
  for insert to authenticated with check (
    bucket_id = 'logos'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );
drop policy if exists logos_update on storage.objects;
create policy logos_update on storage.objects
  for update to authenticated using (
    bucket_id = 'logos'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  ) with check (
    bucket_id = 'logos'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );
drop policy if exists logos_delete on storage.objects;
create policy logos_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'logos'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );

-- wedding-photos: mọi thao tác đi qua service-role / URL ký sẵn; khách xem ảnh
-- bằng URL công khai. Policy đọc chỉ còn tác dụng cho phép liệt kê → bỏ.
drop policy if exists wedding_photos_read on storage.objects;

-- ── 4) crew_account: không cho client đọc ────────────────────────────────────
-- Bảng giữ `calendar_token` — ai có token là tải được feed lịch (.ics) của thợ,
-- gồm tên khách và địa điểm. Policy cũ cho MỌI tài khoản đăng nhập đọc cả bảng.
-- App chỉ đọc/ghi nó qua service-role (/api/crew, /api/crew-calendar), nên bỏ
-- hẳn policy: RLS bật mà không có policy = chỉ service-role chạm được.
drop policy if exists crew_account_read on public.crew_account;

-- ── 5) affiliate_codes: chủ mã chỉ được ĐỌC ──────────────────────────────────
-- `for all` cho phép người dùng tự sửa `code` (giành mã đẹp của người khác khi
-- mã cũ bị tắt) hay tự bật lại `active` mà admin đã tắt. Mọi thao tác ghi đều
-- đi qua service-role (RPC get_or_create_affiliate_code, upgrade-activate).
drop policy if exists affiliate_codes_owner on public.affiliate_codes;
create policy affiliate_codes_owner on public.affiliate_codes
  for select using (user_id = auth.uid());

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- 1) Bốn hàm RPC KHÔNG còn anon/authenticated (chỉ postgres, service_role):
-- select p.proname, r.rolname
-- from pg_proc p
-- cross join lateral aclexplode(p.proacl) a
-- join pg_roles r on r.oid = a.grantee
-- where p.proname in ('start_free_trial', 'redeem_discount_trial',
--                     'consume_discount_code', 'get_or_create_affiliate_code')
-- order by 1, 2;
--
-- 2) Policy storage còn lại:
-- select policyname, cmd, roles from pg_policies
-- where schemaname = 'storage' and tablename = 'objects' order by 1;
