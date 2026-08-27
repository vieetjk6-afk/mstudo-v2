-- ============================================================================
-- MStudo — Thêm kênh TIKTOK vào hộp thư hợp nhất.
--
-- TikTok nối qua CẦU NỐI chứ không phải webhook thẳng: TikTok Business
-- Messaging API còn ở giai đoạn beta và trên thực tế đi qua các đối tác nhắn
-- tin được TikTok công nhận. Cầu nối đẩy tin vào /api/inbox/ingest; MStudo gửi
-- ra bằng cách POST tới URL cầu nối (lưu mã hoá trong inbox_channels.secret,
-- không cần cột mới).
--
-- Vì vậy migration này chỉ phải nới ĐÚNG MỘT ràng buộc: danh sách nền tảng hợp
-- lệ. Toàn bộ bảng, RLS và chỉ mục của hộp thư giữ nguyên.
--
-- Chạy SAU inbox_unified.sql. Chạy được nhiều lần (idempotent) — và nếu bạn cài
-- mới hoàn toàn thì inbox_unified.sql đã có sẵn 'tiktok', migration này chỉ dựng
-- lại đúng ràng buộc đó, không đổi gì.
-- ============================================================================

do $$
begin
  if to_regclass('public.inbox_channels') is null then
    raise notice 'bỏ qua: chưa có bảng inbox_channels — chạy inbox_unified.sql trước';
    return;
  end if;

  -- Ràng buộc inline trong `create table` được Postgres tự đặt tên
  -- <bảng>_<cột>_check. Bỏ rồi tạo lại với danh sách đã có 'tiktok'.
  alter table public.inbox_channels drop constraint if exists inbox_channels_platform_check;
  alter table public.inbox_channels add constraint inbox_channels_platform_check
    check (platform in ('website', 'zalo_oa', 'zalo_personal', 'facebook', 'instagram', 'tiktok'));

  raise notice 'inbox_channels: đã cho phép platform = tiktok';
end $$;
