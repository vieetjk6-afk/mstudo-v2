import { requireStudio } from "@/lib/auth-guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudioHost } from "@/lib/studio-site";
import { getUiState } from "@/lib/ui-server";
import { todayVN } from "@/lib/date";
import StudioDenied from "@/components/StudioDenied";
import type { MiniSession, MiniSlotLock } from "@/lib/mini-session";
import { LOCK_COLS, MINI_ROLES, SESSION_COLS, releaseExpired } from "@/lib/mini-session-server";
import DotChupView from "./DotChupView";
import type { LockDeposit } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   ĐỢT CHỤP THEO KHUNG GIỜ — /dashboard/studio/dot-chup

   Studio mở một đợt (ngày + giờ + độ dài khung + giá + cọc), gửi link cho
   khách tự chọn khung. CHỈ có ở giao diện mới: bản cũ hiện lời nhắn kèm nút
   chuyển (DotChupView). Mô hình: supabase/migrations/chup_theo_khung_gio.sql.
   ═══════════════════════════════════════════════════════════════════════════ */

export default async function DotChupPage(props: { searchParams?: Promise<{ dot?: string }> }) {
  const searchParams = await props.searchParams;
  const profile = await requireStudio("booking");
  if (!profile) return <StudioDenied title="Cần gói Photographer trở lên" message="Chụp theo khung giờ dành cho tài khoản có gói đặt lịch." />;
  if (!MINI_ROLES.includes(profile.actingRole as string)) return <StudioDenied />;

  const ui = await getUiState();
  const supabase = await createClient();
  const ownerId = profile.id as string;

  // Nhả khung hết hạn giữ trước khi đọc, để lịch làm việc không còn dòng thừa.
  await releaseExpired(createAdminClient(), null);

  const { data: sessions, error } = await supabase
    .from("studio_mini_sessions")
    .select(SESSION_COLS)
    .eq("owner_id", ownerId)
    .order("session_date", { ascending: true })
    .limit(500);
  const list = (sessions ?? []) as unknown as MiniSession[];

  let locks: MiniSlotLock[] = [];
  const deposits: Record<string, LockDeposit> = {};
  if (!error && list.length) {
    const { data: lk } = await supabase.from("studio_mini_slots").select(LOCK_COLS).eq("owner_id", ownerId).limit(5000);
    locks = (lk ?? []) as unknown as MiniSlotLock[];
    const ids = locks.map((l) => l.booking_id).filter((x): x is string => !!x);
    if (ids.length) {
      const { data: bk } = await supabase
        .from("studio_bookings")
        .select("id, deposit_amount, deposit_status, deposit_code, deposit_proof_url")
        .in("id", ids);
      for (const b of (bk ?? []) as (LockDeposit & { id: string })[]) deposits[b.id] = b;
    }
  }

  const studioHost = await getStudioHost(supabase, ownerId);
  return (
    <DotChupView
      sessions={list}
      locks={locks}
      deposits={deposits}
      migrated={!error}
      studioHost={studioHost}
      today={todayVN()}
      canSwitchUi={ui.eligible}
      openId={searchParams?.dot ?? null}
      defaults={{
        deposit: Math.max(0, Math.round((profile.booking_deposit as number | null) ?? 0)),
        hasBank: !!profile.pl_bank_bin && !!profile.pl_bank_account,
        location: null,
      }}
    />
  );
}

