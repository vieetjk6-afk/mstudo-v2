-- ============================================================================
-- Hạng mục CHÍNH / PHỤ và gắn hạng mục vào MỐC LỊCH
--
-- tier: 'main' = hạng mục chính (vd: Chụp phóng sự ngày cưới), 'sub' = hạng
--       mục phụ đi kèm (album, ảnh phóng, đãi trước…). NULL = chưa phân loại —
--       hợp đồng cũ giữ nguyên như trước.
--
-- event_id: hạng mục này đã được thêm thành một mốc trong studio_events (vd:
--       hạng mục "Đãi trước" → mốc "Đãi trước" ngày 18/10). Xoá mốc thì hạng
--       mục vẫn còn, chỉ mất liên kết (on delete set null).
--
-- Idempotent, chạy lại nhiều lần vô hại.
-- ============================================================================

alter table public.contract_items add column if not exists tier text;
alter table public.contract_items
  add column if not exists event_id uuid references public.studio_events (id) on delete set null;
create index if not exists contract_items_event_idx on public.contract_items (event_id);

comment on column public.contract_items.tier is
  'main = hạng mục chính, sub = hạng mục phụ; NULL = chưa phân loại.';
comment on column public.contract_items.event_id is
  'Mốc lịch (studio_events) tạo từ hạng mục này; NULL = không gắn mốc.';

-- Nhớ: Supabase → Settings → API → Reload schema cache sau khi chạy.
