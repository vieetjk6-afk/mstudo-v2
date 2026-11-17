"use client";

import DotChupV2, { SessionFields } from "@/app/dashboard/studio/dot-chup/DotChupV2";
import { Card } from "@/components/v2/kit";
import SlotBooking from "@/app/book/dot/[token]/SlotBooking";
import type { MiniSession, MiniSlotLock } from "@/lib/mini-session";
import { PreviewV2 } from "./shell";

const TODAY = "2027-01-10";
const ses = (id: string, title: string, date: string, extra: Partial<MiniSession> = {}): MiniSession => ({
  id, owner_id: "o", token: `tok${id}`, title, session_date: date, start_min: 540, end_min: 720, slot_minutes: 20, gap_minutes: 5,
  price: 350_000, deposit: 100_000, location: "Mây Studio — tầng 2, 12 Lê Lợi, Quận 1", note: "Đến trước 10 phút. Mang theo áo dài nếu có.",
  is_open: true, created_at: "2027-01-01T00:00:00Z", ...extra,
});
const SESSIONS = [
  ses("s1", "Chụp áo dài Tết 2027", "2027-01-16"),
  ses("s2", "Chụp gia đình đón Tết", "2027-01-23", { is_open: false, location: null }),
  ses("s0", "Chụp Noel cho bé", "2026-12-20"),
];
const lock = (id: string, start: number, name: string, extra: Partial<MiniSlotLock> = {}): MiniSlotLock => ({
  id, session_id: "s1", start_min: start, booking_id: `b${id}`, customer_name: name, customer_phone: "0901 234 567", note: null,
  hold_expires_at: null, source: "online", created_at: "2027-01-09T02:00:00Z", ...extra,
});
const LOCKS = [
  lock("1", 540, "Nguyễn Thị Minh Anh"),
  lock("2", 565, "Trần Hoàng Bảo Ngọc Khánh Linh", { hold_expires_at: new Date(Date.now() + 18 * 60_000).toISOString() }),
  lock("3", 615, "Lê Văn Cường", { source: "manual", booking_id: null, note: "Khách quen, gọi điện đặt" }),
  lock("4", 665, "Phạm Thu Hà"),
  { ...lock("5", 540, "Đỗ Gia Hân"), session_id: "s0" },
];
const DEPOSITS = {
  b1: { deposit_amount: 100_000, deposit_status: "confirmed" as const, deposit_code: "COC-7F3A", deposit_proof_url: null },
  b2: { deposit_amount: 100_000, deposit_status: "awaiting" as const, deposit_code: "COC-K9PM", deposit_proof_url: null },
  b4: { deposit_amount: 100_000, deposit_status: "paid" as const, deposit_code: "COC-2WXY", deposit_proof_url: "#" },
};

export function DotChupDemo({ open, create, empty }: { open?: boolean; create?: boolean; empty?: boolean }) {
  // Hộp thoại chỉ dựng ở trình duyệt; vẽ thẳng các ô nhập để ảnh chụp thấy được form.
  if (create) {
    return (
      <PreviewV2 path="/dashboard/studio/dot-chup">
        <Card className="mx-auto w-full max-w-[560px]">
          <h3 className="mb-4 text-[17px] font-semibold">Tạo đợt chụp</h3>
          <SessionFields
            draft={{ id: null, title: "Chụp áo dài Tết 2027", session_date: "2027-01-16", start: "09:00", end: "12:00", slot_minutes: 20, gap_minutes: 5, price: 350_000, deposit: 100_000, location: "Mây Studio — tầng 2", note: "", is_open: true }}
            setDraft={() => {}}
            err={null}
            hasBank
          />
        </Card>
      </PreviewV2>
    );
  }
  return (
    <PreviewV2 path="/dashboard/studio/dot-chup">
      <DotChupV2
        sessions={empty ? [] : SESSIONS}
        locks={empty ? [] : LOCKS}
        deposits={DEPOSITS}
        migrated={!empty}
        studioHost={null}
        today={TODAY}
        canSwitchUi
        openId={open ? "s1" : null}
        defaults={{ deposit: 100_000, hasBank: !empty, location: null }}
      />
    </PreviewV2>
  );
}

export function SlotBookingDemo({ step }: { step?: "deposit" | "done" }) {
  const dep = { amount: 100_000, code: "COC-K9PM", token: "demo", holdUntil: new Date(Date.now() + 27 * 60_000).toISOString() };
  return (
    <SlotBooking
      token="demo"
      brand={{ name: "Mây Studio", logoUrl: null }}
      session={SESSIONS[0]}
      taken={[540, 565, 615, 665]}
      today={TODAY}
      nowMin={600}
      bank={{ bin: "970436", account: "0123456789", holder: "NGUYEN VAN MAY", name: "Vietcombank" }}
      preview={step === "deposit" ? { pick: 590, deposit: dep } : step === "done" ? { pick: 590, done: true } : { pick: 590 }}
    />
  );
}
