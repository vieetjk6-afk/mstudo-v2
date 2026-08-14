-- ============================================================================
-- VÁ — Đăng nhập Google báo "server_error"
-- Chạy MỘT LẦN trên Supabase (SQL Editor). An toàn khi chạy lại (idempotent).
--
-- Vì sao cần: khi Google trả người dùng về, Supabase INSERT một dòng vào
-- auth.users; trigger on_auth_user_created chạy NGAY TRONG cùng transaction đó
-- để tạo hồ sơ ở public.profiles. Nếu insert hồ sơ lỗi (thiếu cột sau khi đổi
-- schema, ràng buộc check/unique, email null…) thì CẢ transaction bị rollback:
-- tài khoản không được lưu, và Supabase trả về
--     ?error=server_error&error_code=unexpected_failure
--      &error_description=Database+error+saving+new+user
-- — đúng chữ "server_error" mà người dùng nhìn thấy ở màn hình đăng nhập.
--
-- Bản vá này làm hai việc:
--   1. Không để email null làm vỡ ràng buộc NOT NULL (tài khoản Google hiếm khi
--      thiếu email, nhưng vẫn có thể).
--   2. Bọc exception: nếu tạo hồ sơ hỏng thì GHI CẢNH BÁO rồi cho đăng nhập đi
--      tiếp, thay vì huỷ luôn việc tạo tài khoản. Hồ sơ thiếu có thể vá sau
--      (xem phần backfill ở cuối file) — mất hồ sơ vẫn hơn mất tài khoản.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    -- profiles.email là NOT NULL; auth.users.email có thể null với một số
    -- provider, nên luôn có giá trị dự phòng.
    coalesce(new.email, new.raw_user_meta_data ->> 'email', new.id::text),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.email,
      ''
    ),
    'photographer',
    true   -- self-serve: new sign-ups (incl. Google) can create albums right away
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    -- KHÔNG raise lại: raise sẽ rollback cả việc tạo auth.users và biến thành
    -- "Database error saving new user" → server_error ở màn hình đăng nhập.
    raise warning 'handle_new_user failed for % : % (%)', new.id, sqlerrm, sqlstate;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Backfill: tạo hồ sơ cho các tài khoản đã đăng ký nhưng chưa có profile ────
-- (gồm cả những tài khoản từng bị lỗi trigger trước khi chạy bản vá này)
insert into public.profiles (id, email, full_name, role, is_active)
select
  u.id,
  coalesce(u.email, u.raw_user_meta_data ->> 'email', u.id::text),
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    u.email,
    ''
  ),
  'photographer',
  true
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ── Kiểm tra sau khi chạy: phải trả về 0 dòng ────────────────────────────────
-- select u.id, u.email
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- where p.id is null;
