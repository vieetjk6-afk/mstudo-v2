-- ============================================================================
-- MStudo — HỘP THƯ HỢP NHẤT (một chỗ trả lời khách từ mọi mạng xã hội).
--
-- Khách nhắn từ Zalo OA, Zalo cá nhân, Facebook Messenger, Instagram DM hay
-- chatbox website đều đổ về cùng một hộp thư. AI trả lời trước; nhân viên bấm
-- "Tôi tiếp quản" thì AI im, người trả lời tiếp trong cùng khung chat đó.
--
-- BỐN BẢNG, đọc theo thứ tự phễu:
--   inbox_channels      — studio đã nối những kênh nào (1 dòng = 1 trang/OA/tài khoản)
--   inbox_contacts      — người nhắn, định danh theo (kênh, id trên nền tảng đó)
--   inbox_conversations — một cuộc trò chuyện với một người trên một kênh
--   inbox_messages      — từng tin, cả tin vào lẫn tin ra
--
-- PHÂN QUYỀN
--   Ba bảng sau: RLS `is_studio_member(owner_id)` — cả studio đọc/ghi được, vì
--   trực điện thoại là việc tập thể (khác `studio_zalo` chỉ chủ studio).
--   `inbox_channels` thì KHOÁ hẳn anon/authenticated: mỗi dòng chứa page access
--   token của Facebook/Instagram → chỉ service-role đọc. Dashboard xem trạng
--   thái kênh qua API (đã lọc bí mật), không đọc thẳng bảng.
--
-- Chạy được nhiều lần (idempotent).
-- ============================================================================

-- Hàm kiểm tra thành viên studio (khai lại cho chắc — DB cũ có thể chưa có).
create or replace function public.is_studio_member(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select
    target = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and studio_owner_id = target)
    or public.is_admin();
$$;

-- ── 1. KÊNH ĐÃ NỐI ─────────────────────────────────────────────────────────
-- `external_id` là định danh của kênh trên nền tảng đó: page_id của Facebook,
-- ig business id của Instagram, oa_id của Zalo OA, uid của tài khoản Zalo cá
-- nhân. Với chatbox website thì dùng chính owner_id (mỗi studio một widget).
--
-- `unique (platform, external_id)` là CỐ Ý ở phạm vi toàn hệ thống, không phải
-- theo từng studio: webhook Facebook chỉ đưa page_id, ta phải tra ngược ra chủ
-- studio từ đó. Một page thuộc về đúng một studio — studio thứ hai nối cùng
-- page sẽ bị chặn ngay ở đây thay vì âm thầm cướp tin của nhau.
create table if not exists public.inbox_channels (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  platform      text not null
                  check (platform in ('website', 'zalo_oa', 'zalo_personal', 'facebook', 'instagram')),
  external_id   text not null default 'default',
  name          text,                         -- tên hiển thị (tên page/OA) cho UI
  status        text not null default 'connected'
                  check (status in ('connected', 'disconnected', 'error')),

  -- Bí mật của kênh — AES-256-GCM (src/lib/zalo/crypto.ts), KHÔNG bao giờ lưu thô.
  -- Facebook/Instagram: { pageAccessToken }. Zalo OA/cá nhân đọc lại từ
  -- studio_zalo nên để null.
  secret        text,

  -- Chế độ AI của kênh: 'auto' = bot tự trả lời, 'off' = chỉ người trả lời.
  -- Từng hội thoại còn công tắc riêng (inbox_conversations.ai_enabled) đè lên đây.
  ai_mode       text not null default 'auto' check (ai_mode in ('auto', 'off')),

  last_error    text,
  connected_at  timestamptz default now(),
  updated_at    timestamptz not null default now(),
  unique (platform, external_id)
);
create index if not exists inbox_channels_owner_idx on public.inbox_channels (owner_id);

-- Token page nằm trong bảng này ⇒ khoá trước, rồi cấp lại ĐÚNG những cột không
-- bí mật. Không thể khoá sạch như `studio_zalo`: màn hộp thư join sang đây để
-- lấy tên kênh và nền tảng của từng hội thoại, khoá hết thì câu join bị từ chối
-- quyền và cả danh sách trống. RLS lọc theo DÒNG, grant lọc theo CỘT — cần cả
-- hai: policy cho thành viên studio đọc dòng của mình, grant để `secret` không
-- bao giờ nằm trong tập cột đọc được, kể cả khi ai đó gọi thẳng PostgREST.
-- GHI vẫn chỉ service-role: không cấp insert/update/delete cho ai.
revoke all on public.inbox_channels from anon, authenticated;
grant select (
  id, owner_id, platform, external_id, name, status, ai_mode,
  last_error, connected_at, updated_at
) on public.inbox_channels to authenticated;

alter table public.inbox_channels enable row level security;
drop policy if exists inbox_channels_member_read on public.inbox_channels;
create policy inbox_channels_member_read on public.inbox_channels
  for select using (public.is_studio_member(owner_id));

-- ── 2. NGƯỜI NHẮN ──────────────────────────────────────────────────────────
create table if not exists public.inbox_contacts (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  channel_id       uuid not null references public.inbox_channels (id) on delete cascade,
  -- Id của người này trên nền tảng đó (psid Facebook, uid Zalo, sessionId website).
  external_user_id text not null,
  name             text,
  avatar_url       text,
  phone            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (channel_id, external_user_id)
);
create index if not exists inbox_contacts_owner_idx on public.inbox_contacts (owner_id);

alter table public.inbox_contacts enable row level security;
drop policy if exists inbox_contacts_member_all on public.inbox_contacts;
create policy inbox_contacts_member_all on public.inbox_contacts
  for all using (public.is_studio_member(owner_id))
  with check (public.is_studio_member(owner_id));

-- ── 3. HỘI THOẠI ───────────────────────────────────────────────────────────
-- Một người trên một kênh = một hội thoại chạy dài (không cắt theo phiên), để
-- lần sau khách nhắn lại thì nhân viên còn thấy nguyên lịch sử đã tư vấn.
create table if not exists public.inbox_conversations (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  channel_id     uuid not null references public.inbox_channels (id) on delete cascade,
  contact_id     uuid not null references public.inbox_contacts (id) on delete cascade,

  status         text not null default 'open' check (status in ('open', 'closed')),
  -- Công tắc AI của RIÊNG hội thoại này. Nhân viên bấm "Tôi tiếp quản" → false,
  -- AI ngừng trả lời cho tới khi bật lại. Đây là lời hứa quan trọng nhất của
  -- màn hình: đã có người vào thì bot không được chen ngang.
  ai_enabled     boolean not null default true,
  -- Ai đang phụ trách (tài khoản nhân viên). null = chưa ai nhận.
  assignee_id    uuid references public.profiles (id) on delete set null,

  -- Bản xem trước cho danh sách bên trái — nhân đôi dữ liệu có chủ đích, để vẽ
  -- danh sách 300 hội thoại bằng MỘT truy vấn thay vì 300 lần lấy tin cuối.
  last_message      text,
  last_message_at   timestamptz not null default now(),
  last_direction    text check (last_direction in ('in', 'out')),
  -- Mốc tin CUỐI CÙNG của khách. Tách riêng khỏi last_message_at vì nó quyết
  -- định chuyện khác hẳn: Facebook cho nhắn lại trong 24 giờ, Zalo OA 48 giờ,
  -- tính từ tin của KHÁCH — chứ không phải từ tin studio vừa gửi. Nhân đôi ở
  -- đây để danh sách hội thoại biết ngay ô soạn tin còn mở hay đã khoá, khỏi
  -- phải quét bảng tin cho từng dòng.
  last_inbound_at   timestamptz,
  -- Số tin của khách chưa ai đọc. Nhân viên mở hội thoại → về 0.
  unread            int not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (contact_id)
);
create index if not exists inbox_conversations_owner_idx
  on public.inbox_conversations (owner_id, last_message_at desc);
create index if not exists inbox_conversations_unread_idx
  on public.inbox_conversations (owner_id) where unread > 0;

alter table public.inbox_conversations enable row level security;
drop policy if exists inbox_conversations_member_all on public.inbox_conversations;
create policy inbox_conversations_member_all on public.inbox_conversations
  for all using (public.is_studio_member(owner_id))
  with check (public.is_studio_member(owner_id));

-- ── 4. TIN NHẮN ────────────────────────────────────────────────────────────
-- `sender` phân biệt AI với người: khách phải biết mình đang nói với ai, và
-- studio phải xem lại được bot đã hứa gì với khách.
create table if not exists public.inbox_messages (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.inbox_conversations (id) on delete cascade,
  direction       text not null check (direction in ('in', 'out')),
  sender          text not null check (sender in ('customer', 'ai', 'staff', 'system')),
  -- Nhân viên nào gửi (khi sender = 'staff').
  sender_id       uuid references public.profiles (id) on delete set null,
  sender_name     text,
  body            text not null default '',
  -- [{ type: 'image'|'file'|'sticker', url, name }, ...]
  attachments     jsonb not null default '[]'::jsonb,
  -- Id tin trên nền tảng gốc — chống ghi trùng khi webhook bắn lại.
  external_id     text,
  status          text not null default 'sent' check (status in ('sent', 'failed')),
  error           text,
  created_at      timestamptz not null default now()
);
create index if not exists inbox_messages_conv_idx
  on public.inbox_messages (conversation_id, created_at);
-- Webhook của Facebook/Zalo bắn lại tin cũ khi ta trả lời chậm → khoá theo id gốc.
create unique index if not exists inbox_messages_external_uidx
  on public.inbox_messages (conversation_id, external_id) where external_id is not null;

alter table public.inbox_messages enable row level security;
drop policy if exists inbox_messages_member_all on public.inbox_messages;
create policy inbox_messages_member_all on public.inbox_messages
  for all using (public.is_studio_member(owner_id))
  with check (public.is_studio_member(owner_id));

-- ── Realtime: khung chat tự chạy khi có tin mới ─────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inbox_messages'
    ) then
      alter publication supabase_realtime add table public.inbox_messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inbox_conversations'
    ) then
      alter publication supabase_realtime add table public.inbox_conversations;
    end if;
  end if;
end $$;
