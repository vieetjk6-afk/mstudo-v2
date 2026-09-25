-- ============================================================================
-- HUỶ HỢP ĐỒNG (HOÀN / GIỮ CỌC) + DỜI LỊCH HỢP ĐỒNG
--
-- Khách huỷ cưới, dời ngày là chuyện hằng tuần của studio ảnh cưới. Trước đây
-- app chỉ có trạng thái "Đã huỷ" mà KHÔNG có chỗ ghi tiền trả lại khách, nên
-- hoàn 50% cọc thì báo cáo vẫn đếm đủ 100% doanh thu. Dời ngày thì chỉ sửa ô
-- ngày, không ai biết ngày cũ là gì, lịch thợ và hạn thu không đổi theo.
--
--  1) contract_payments.kind thêm 'refund': một lần thu mang số ÂM. Mọi chỗ
--     cộng tiền (công nợ, báo cáo, két tiền mặt, xuất kế toán) tự trừ đúng mà
--     không phải sửa từng nơi.
--  2) Chính sách huỷ của studio (profiles): huỷ trước ≥ N ngày hoàn X% số đã
--     thu, muộn hơn hoàn Y%. App chỉ GỢI Ý số hoàn, studio sửa được.
--  3) studio_contracts.cancelled_at / cancel_reason: huỷ khi nào, vì sao.
--  4) contract_reschedules: lịch sử dời ngày (ngày cũ → ngày mới, lý do, phí).
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'contract_payments')
  then missing := missing || 'contract_payments'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_contracts')
  then missing := missing || 'studio_contracts'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

-- ── 1) Khoản hoàn tiền ──────────────────────────────────────────────────────
alter table public.contract_payments drop constraint if exists contract_payments_kind_check;
alter table public.contract_payments add constraint contract_payments_kind_check
  check (kind in ('deposit', 'installment', 'final', 'other', 'refund'));

-- ── 2) Chính sách huỷ ───────────────────────────────────────────────────────
alter table public.profiles add column if not exists cancel_early_days smallint not null default 30;
alter table public.profiles add column if not exists cancel_early_refund_pct smallint not null default 50;
alter table public.profiles add column if not exists cancel_late_refund_pct smallint not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_cancel_policy_check') then
    alter table public.profiles
      add constraint profiles_cancel_policy_check
      check (cancel_early_days between 0 and 365
             and cancel_early_refund_pct between 0 and 100
             and cancel_late_refund_pct between 0 and 100);
  end if;
end $$;

-- c1_profiles_column_grants.sql thu hồi UPDATE toàn bảng profiles, chỉ cấp lại
-- theo cột. Thiếu dòng này thì thẻ chính sách lưu im lặng không đổi gì.
grant update (cancel_early_days, cancel_early_refund_pct, cancel_late_refund_pct)
  on public.profiles to authenticated;

-- ── 3) Huỷ khi nào, vì sao ──────────────────────────────────────────────────
alter table public.studio_contracts add column if not exists cancelled_at timestamptz;
alter table public.studio_contracts add column if not exists cancel_reason text;

-- ── 4) Lịch sử dời lịch ─────────────────────────────────────────────────────
create table if not exists public.contract_reschedules (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  old_date    date,
  old_time    text,
  new_date    date not null,
  new_time    text,
  reason      text,
  fee         integer not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists contract_reschedules_contract_idx
  on public.contract_reschedules (contract_id, created_at desc);

alter table public.contract_reschedules enable row level security;
-- Đọc: chủ hợp đồng + admin. Ghi đi qua /api/studio/contracts/[id]/reschedule
-- (service-role) vì một lần dời còn kéo theo lịch thợ, hạn thu, lịch hẹn.
drop policy if exists contract_reschedules_owner_read on public.contract_reschedules;
create policy contract_reschedules_owner_read on public.contract_reschedules
  for select using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  );

notify pgrst, 'reload schema';
