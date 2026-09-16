-- ─────────────────────────────────────────────────────────────────────────
-- Lịch thợ: thôi cho MỌI tài khoản đọc toàn bảng
--
-- Policy cũ:
--     create policy crew_unavailable_read on public.crew_unavailable
--       for select using (auth.role() = 'authenticated');
--
-- Nó ra đời lúc bảng chỉ có (phone, date) — nghĩa là "ngày này thợ bận", và
-- đúng là nên cho studio nào cũng đọc: thợ freelance chạy nhiều studio, ai cũng
-- cần biết thợ kẹt ngày nào để khỏi đặt trùng. Comment trong schema ghi thẳng
-- lý do đó: "Low-sensitivity scheduling info → readable by any studio."
--
-- Nhưng crew_schedule.sql sau này MỞ RỘNG chính bảng ấy thêm `title` và
-- `owner_id`, mà policy thì không ai xem lại. `title` được ghi bằng
-- showLabel({ title: contract.title, ... }) ở src/app/api/studio/contract-crew
-- — tức TIÊU ĐỀ HỢP ĐỒNG, thường có tên khách. Cộng với owner_id (studio nào
-- đặt) và phone (số của thợ), bảng này thành ra để lộ cho BẤT KỲ tài khoản đã
-- đăng nhập nào: studio đối thủ đặt ai, ngày nào, mấy giờ, khách tên gì.
-- "Ít nhạy cảm" không còn đúng nữa.
--
-- Siết lại thành: chỉ đọc dòng của chính mình.
--
-- KHÔNG hỏng gì — đã soát mọi chỗ đọc bảng này:
--   • Trình duyệt (3 chỗ) đều ĐÃ tự lọc .eq("owner_id", profile.id):
--       dashboard/studio/calendar/StudioTab.tsx, TeamTab.tsx,
--       dashboard/studio/contracts/[id]/page.tsx
--     → dòng của studio khác vốn đã không hiện ra; policy cũ chỉ là cửa mở
--       sẵn cho ai gọi thẳng API Supabase bằng anon key.
--   • Mọi lượt đọc LIÊN STUDIO (cổng thợ, dò trùng lịch) đi qua service role
--     nên không chịu RLS: api/crew, api/crew-calendar/[token],
--     api/studio/crew-schedule, api/studio/contract-crew.
--     crew-schedule/route.ts còn ghi rõ trong comment là nó đi service role
--     CHÍNH VÌ bảng này chỉ mở policy đọc hẹp.
--
-- Dòng thợ tự khai (created_by = 'crew') có owner_id = null nên sau bản vá
-- không đọc được từ trình duyệt — nhưng ba chỗ đọc ở trên vốn đã lọc theo
-- owner_id nên cũng chưa bao giờ thấy chúng; studio vẫn xem qua
-- api/studio/crew-schedule như cũ.
--
-- Chạy trước khi deploy.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists crew_unavailable_read on public.crew_unavailable;
create policy crew_unavailable_read on public.crew_unavailable
  for select using (owner_id = auth.uid() or public.is_admin());

-- Lọc theo owner_id giờ là đường đi CHÍNH của mọi truy vấn từ trình duyệt.
create index if not exists crew_unavailable_owner_date_idx
  on public.crew_unavailable (owner_id, date);
