import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudioBrand } from "@/lib/studio-brand";
import { studioShareMetadata } from "@/lib/studio-share-meta";
import { todayVN, fmtDate } from "@/lib/date";
import { lockLive, slotDeposit } from "@/lib/mini-session";
import { locksOf, nowMinVN, releaseExpired, sessionByToken } from "@/lib/mini-session-server";
import SlotBooking from "./SlotBooking";

export const dynamic = "force-dynamic";

/* Trang công khai của MỘT đợt chụp theo khung giờ: /book/dot/<token>.
   Nằm dưới /book/ nên proxy coi là trang khách (không đọc phiên, chạy được trên
   tên miền riêng của studio). Đọc bằng service-role sau khi tra token; chỉ đưa
   xuống trình duyệt GIỜ của khung đã có người, không bao giờ tên hay SĐT. */

export async function generateMetadata(props: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await props.params;
  const s = await sessionByToken(createAdminClient(), token);
  return studioShareMetadata({
    ownerId: s?.owner_id,
    title: s ? `${s.title} · ${fmtDate(s.session_date)}` : "Chọn khung giờ chụp",
    description: (studio) => `Chọn khung giờ chụp với ${studio} — xem khung còn trống và đặt ngay.`,
    path: `/book/dot/${token}`,
    // Link gửi riêng cho khách của một đợt, không phải trang để Google lập chỉ mục.
    noindex: true,
  });
}

export default async function MiniSessionPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const db = createAdminClient();
  const s = await sessionByToken(db, token);
  if (!s) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Không tìm thấy</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Link đợt chụp không hợp lệ hoặc đã bị xoá.</p>
        </div>
      </div>
    );
  }

  await releaseExpired(db, s.id);
  const [brand, locks, { data: owner }] = await Promise.all([
    getStudioBrand(db, s.owner_id),
    locksOf(db, s.id),
    db.from("profiles").select("pl_bank_bin, pl_bank_account, pl_bank_holder, pl_bank_name").eq("id", s.owner_id).maybeSingle(),
  ]);
  const now = Date.now();
  const hasBank = !!owner?.pl_bank_bin && !!owner?.pl_bank_account;

  return (
    <SlotBooking
      token={token}
      brand={brand}
      session={{
        title: s.title,
        session_date: s.session_date,
        start_min: s.start_min,
        end_min: s.end_min,
        slot_minutes: s.slot_minutes,
        gap_minutes: s.gap_minutes,
        price: s.price,
        // Không có tài khoản nhận tiền thì không có bước cọc (khớp route đặt).
        deposit: hasBank ? slotDeposit(s.price, s.deposit) : 0,
        location: s.location,
        note: s.note,
        is_open: s.is_open,
      }}
      taken={locks.filter((l) => lockLive(l, now)).map((l) => l.start_min)}
      today={todayVN()}
      nowMin={nowMinVN()}
      bank={
        hasBank
          ? {
              bin: (owner!.pl_bank_bin as string | null) ?? null,
              account: (owner!.pl_bank_account as string | null) ?? null,
              holder: (owner!.pl_bank_holder as string | null) ?? null,
              name: (owner!.pl_bank_name as string | null) ?? null,
            }
          : null
      }
    />
  );
}
