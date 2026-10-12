-- ════════════════════════════════════════════════════════════════════════════
-- Hạn mức album: bỏ qua khi album được tạo PHÍA MÁY CHỦ (service_role).
--
-- Vì sao: luồng hợp đồng (khách ký → đang thực hiện → hoàn thành, app desktop,
-- cron) tạo album "Chọn ảnh · …" / "Giao khách · …" bằng service-role key ở máy
-- chủ (src/lib/studio-drive.ts → createAlbumFromFolder). Trigger
-- enforce_album_quota chặn mọi album is_gallery khi profiles.can_galleries tắt
-- — cột cũ, chỉ được đồng bộ từ gói khi admin gán gói — nên studio đã trả tiền
-- gói Studio vẫn có thể bị chặn ÂM THẦM: hợp đồng hoàn thành mà không có album
-- giao khách, màn hợp đồng còn báo nhầm "chưa có thư mục Drive".
--
-- Có mở lỗ hổng không: KHÔNG. `auth.role()` đọc claim `role` của JWT mà
-- PostgREST đã kiểm chữ ký; chỉ service-role key (chỉ nằm ở máy chủ, không bao
-- giờ xuống trình duyệt) mới mang role 'service_role'. Người dùng đăng nhập
-- (authenticated) và khách (anon) vẫn qua đủ hai chốt: quyền gallery + hạn mức
-- album/tháng. Máy chủ đã tự chốt quyền ở tầng ứng dụng trước khi tới đây
-- (requireStudio, xác thực desktop). Cùng cách nhận diện service-role với
-- accounting.sql / bao_mat_quyen_rpc_storage.sql.
--
-- Trigger albums_log_creation KHÔNG đổi: album tạo phía máy chủ vẫn được ghi
-- vào album_creations như cũ.
-- Chạy lại nhiều lần an toàn (create or replace).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.enforce_album_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lim   integer;
  isadm boolean;
  cangal boolean;
  used  integer;
begin
  -- Album do máy chủ tạo (service-role) — quyền đã chốt ở tầng ứng dụng.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  select monthly_album_limit, (role = 'admin'), can_galleries
    into lim, isadm, cangal
    from public.profiles where id = new.owner_id;

  if coalesce(new.is_gallery, false) then
    -- Only admins / permitted accounts may create delivery galleries.
    if not (coalesce(isadm, false) or coalesce(cangal, false)) then
      raise exception 'Tài khoản chưa được cấp quyền tạo gallery khách.'
        using errcode = 'P0001';
    end if;
    return new; -- galleries don't use the selection quota
  end if;
  if coalesce(isadm, false) then return new; end if;
  if lim is null then return new; end if;

  select count(*) into used
    from public.album_creations
    where user_id = new.owner_id
      and created_at >= date_trunc('month', now());

  if used >= lim then
    raise exception 'Đã đạt giới hạn % album trong tháng này.', lim
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
