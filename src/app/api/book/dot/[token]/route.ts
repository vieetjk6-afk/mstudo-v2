import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwner } from "@/lib/push";
import { guardCaptcha } from "@/lib/captcha-guard";
import { limitByIp } from "@/lib/rate-limit";
import { newDepositCode, newDepositToken } from "@/lib/booking-deposit";
import { todayVN, fmtDate } from "@/lib/date";
import { HOLD_MINUTES, cleanCustomer, isValidSlot, lockLive, slotBookable } from "@/lib/mini-session";
import { locksOf, nowMinVN, sessionByToken } from "@/lib/mini-session-server";

export const dynamic = "force-dynamic";

/** Các khung đang có người — để form vẽ lại lưới sau khi đặt hụt. */
async function takenStarts(db: ReturnType<typeof createAdminClient>, sessionId: string): Promise<number[]> {
  const now = Date.now();
  return (await locksOf(db, sessionId)).filter((l) => lockLive(l, now)).map((l) => l.start_min);
}

/** Lưới hiện tại (khách bấm "tải lại" hoặc form tự làm mới). Không lộ tên ai. */
export async function GET(req: Request, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const limited = limitByIp(req, "book-dot-get", 60, 60_000);
  if (limited) return limited;
  const db = createAdminClient();
  const s = await sessionByToken(db, token);
  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, open: s.is_open, taken: await takenStarts(db, s.id) });
}

/**
 * Khách đặt MỘT khung của một đợt chụp (link công khai /book/dot/<token>).
 *
 * Trình duyệt chỉ gửi: khung, tên, SĐT, ghi chú. Giá, cọc, ngày, giờ đều đọc
 * từ đợt trong database. Việc "còn trống không" do hàm SQL mini_book_slot quyết
 * (UNIQUE) — kiểm ở đây chỉ để trả lời sớm và rõ.
 */
export async function POST(req: Request, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const limited = limitByIp(req, "book-dot", 8, 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { start?: unknown; name?: unknown; phone?: unknown; note?: unknown; captcha?: string };
  const captcha = await guardCaptcha(req, `book-dot:${token.slice(0, 40)}`, body.captcha);
  if (captcha) return captcha;

  const who = cleanCustomer(body);
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: 400 });
  const start = typeof body.start === "number" ? body.start : NaN;

  const db = createAdminClient();
  const s = await sessionByToken(db, token);
  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!isValidSlot(s, start)) return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
  if (!s.is_open) return NextResponse.json({ error: "closed" }, { status: 409 });
  if (!slotBookable(s, start, todayVN(), nowMinVN())) return NextResponse.json({ error: "past" }, { status: 409 });

  // Chỉ thu cọc khi studio ĐÃ khai tài khoản nhận tiền — không có thì khách
  // không có chỗ nào để chuyển, giữ chỗ 30 phút rồi nhả là mất khách oan.
  const { data: owner } = await db.from("profiles").select("pl_bank_bin, pl_bank_account").eq("id", s.owner_id).maybeSingle();
  const canDeposit = s.deposit > 0 && !!owner?.pl_bank_bin && !!owner?.pl_bank_account;

  const { data, error } = await db.rpc("mini_book_slot", {
    p_session: s.id,
    p_start: start,
    p_name: who.name,
    p_phone: who.phone,
    p_note: who.note,
    p_manual: false,
    p_deposit_code: canDeposit ? newDepositCode() : null,
    p_deposit_token: canDeposit ? newDepositToken() : null,
    p_hold_minutes: HOLD_MINUTES,
  });
  const r = (data ?? null) as {
    status?: string; booking_id?: string; deposit_amount?: number; hold_expires_at?: string | null; range?: string;
  } | null;
  if (error || !r?.status) return NextResponse.json({ error: "server_error" }, { status: 500 });
  if (r.status !== "ok") {
    const code = r.status === "taken" || r.status === "closed" || r.status === "past" ? 409 : 400;
    return NextResponse.json({ error: r.status, taken: await takenStarts(db, s.id) }, { status: code });
  }

  // Mã cọc đọc lại từ bản ghi (hàm SQL là nơi quyết có cọc hay không).
  let deposit: { amount: number; code: string; token: string; holdUntil: string | null } | null = null;
  if (r.booking_id && (r.deposit_amount ?? 0) > 0) {
    const { data: b } = await db
      .from("studio_bookings")
      .select("deposit_amount, deposit_code, deposit_token")
      .eq("id", r.booking_id)
      .maybeSingle();
    if (b?.deposit_token && b.deposit_code) {
      deposit = { amount: b.deposit_amount as number, code: b.deposit_code as string, token: b.deposit_token as string, holdUntil: r.hold_expires_at ?? null };
    }
  }

  const msg = `${who.name} đặt khung ${r.range} · ${fmtDate(s.session_date)}${s.title ? ` · ${s.title}` : ""}${deposit ? " · chờ cọc" : ""}`;
  await db.from("studio_notifications").insert({ owner_id: s.owner_id, contract_id: null, kind: "info", message: msg });
  await sendPushToOwner(s.owner_id, { title: "Đặt khung giờ mới", body: msg, url: `/dashboard/studio/dot-chup?dot=${s.id}`, tag: "booking" });

  return NextResponse.json({ ok: true, range: r.range, deposit });
}
