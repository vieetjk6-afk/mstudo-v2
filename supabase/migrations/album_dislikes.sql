-- ============================================================================
-- Ảnh khách KHÔNG THÍCH trong album chọn ảnh.
-- Khách bấm "không thích" → ảnh bị ẩn khỏi lưới chọn và chuyển sang tab riêng;
-- studio xem danh sách đó rồi xoá thẳng các file trên link Drive gốc nếu khách
-- yêu cầu.
--
-- Bảng RIÊNG (không gộp vào public.selections) để danh sách "khách chọn" dùng ở
-- công cụ Lọc ảnh / ZIP / thông báo không bao giờ lẫn ảnh bị loại.
-- Chạy trên Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- ============================================================================
create table if not exists public.dislikes (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references public.albums (id) on delete cascade,
  photo_id     uuid not null references public.photos (id) on delete cascade,
  photo_name   text not null default '',
  session_id   text not null,
  client_note  text,           -- lý do khách không thích (tuỳ chọn)
  created_at   timestamptz not null default now(),
  unique (album_id, photo_id, session_id)
);
create index if not exists dislikes_album_idx on public.dislikes (album_id);
create index if not exists dislikes_session_idx on public.dislikes (album_id, session_id);

-- Realtime cho dashboard studio (giống selections) — chỉ thêm nếu chưa publish.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dislikes'
  ) then
    alter publication supabase_realtime add table public.dislikes;
  end if;
end $$;

-- RLS: chủ album (và admin) đọc/ghi; khách ghi qua service role trong API route.
alter table public.dislikes enable row level security;
drop policy if exists dislikes_owner_rw on public.dislikes;
create policy dislikes_owner_rw on public.dislikes
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  );
