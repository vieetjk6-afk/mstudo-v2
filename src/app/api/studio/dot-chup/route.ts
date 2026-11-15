import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanCustomer, cleanSessionInput, isValidSlot, lockLive, orphanedLocks, slotRange, type MiniSession } from "@/lib/mini-session";
import { LOCK_COLS, MINI_ROLES, SESSION_COLS, locksOf, newSessionToken, releaseExpired } from "@/lib/mini-session-server";

export const dynamic = "force-dynamic";

/**
 * Mọi thao tác GHI của màn Đợt chụp. Bảng đợt / khoá không có policy ghi cho
 * người dùng (xem migration), nên đây là đường duy nhất — và nó tự kiểm gói,
 * vai trò, và "đợt này có phải của studio đang thao tác không" trước khi ghi
 * bằng service-role.
 */
export async function POST(req: Request) {
  const profile = await requireStudio("booking");
  if (!profile || !MINI_ROLES.includes(profile.actingRole as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const ownerId = profile.id as string;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const db = createAdminClient();
  const fail = (error: string, status = 400, message?: string) => NextResponse.json({ error, message }, { status });

  const ownSession = async (id: unknown): Promise<MiniSession | null> => {
    if (typeof id !== "string") return null;
    const { data } = await db.from("studio_mini_sessions").select(SESSION_COLS).eq("id", id).eq("owner_id", ownerId).maybeSingle();
    return (data as unknown as MiniSession | null) ?? null;
  };
  const snapshot = async (s: MiniSession) => NextResponse.json({ ok: true, session: s, locks: await locksOf(db, s.id) });

  if (action === "create") {
    const c = cleanSessionInput(body.session);
    if (!c.ok) return fail("invalid", 400, c.error);
    const { data, error } = await db
      .from("studio_mini_sessions")
      .insert({ ...c.value, owner_id: ownerId, token: newSessionToken() })
      .select(SESSION_COLS)
      .single();
    if (error || !data) return fail("server_error", 500, error?.message);
    return NextResponse.json({ ok: true, session: data, locks: [] });
  }

  const s = await ownSession(body.id);
  if (!s) return fail("not_found", 404);

  if (action === "update") {
    const c = cleanSessionInput(body.session);
    if (!c.ok) return fail("invalid", 400, c.error);
    await releaseExpired(db, s.id);
    const hit = orphanedLocks(s, c.value, await locksOf(db, s.id), Date.now());
    if (hit.length) {
      return fail(
        "has_bookings",
        409,
        `Đợt đã có ${hit.length} khách đặt (${hit.slice(0, 3).map((l) => `${l.customer_name || "khách"} ${slotRange(l.start_min, s.slot_minutes)}`).join(", ")}${hit.length > 3 ? "…" : ""}). Huỷ các chỗ đó trước, hoặc giữ nguyên ngày / giờ / độ dài khung.`,
      );
    }
    const { data, error } = await db.from("studio_mini_sessions").update(c.value).eq("id", s.id).select(SESSION_COLS).single();
    // Trigger mini_session_guard là chốt cuối (khách vừa đặt chen vào giữa hai câu).
    if (error || !data) {
      return /mini_session_has_bookings/.test(error?.message ?? "")
        ? fail("has_bookings", 409, "Vừa có khách đặt vào đợt này — tải lại rồi thử lại.")
        : fail("server_error", 500, error?.message);
    }
    return snapshot(data as unknown as MiniSession);
  }

  if (action === "set_open") {
    const { data, error } = await db.from("studio_mini_sessions").update({ is_open: body.open === true }).eq("id", s.id).select(SESSION_COLS).single();
    if (error || !data) return fail("server_error", 500, error?.message);
    return snapshot(data as unknown as MiniSession);
  }

  if (action === "delete") {
    await releaseExpired(db, s.id);
    const live = (await locksOf(db, s.id)).filter((l) => lockLive(l, Date.now()));
    if (live.length && body.force !== true) {
      return fail("has_bookings", 409, `Đợt còn ${live.length} khách đã đặt. Xoá đợt là huỷ luôn các chỗ đó.`);
    }
    const { error } = await db.from("studio_mini_sessions").delete().eq("id", s.id);
    if (error) return fail("server_error", 500, error.message);
    return NextResponse.json({ ok: true, deleted: true });
  }

  if (action === "book") {
    const who = cleanCustomer(body);
    if (!who.ok) return fail(who.error, 400, who.error === "phone" ? "Số điện thoại chưa đúng." : "Nhập tên và số điện thoại.");
    const start = typeof body.start === "number" ? body.start : NaN;
    if (!isValidSlot(s, start)) return fail("invalid_slot");
    const { data, error } = await db.rpc("mini_book_slot", {
      p_session: s.id, p_start: start, p_name: who.name, p_phone: who.phone, p_note: who.note, p_manual: true,
    });
    const st = (data as { status?: string } | null)?.status;
    if (error || !st) return fail("server_error", 500, error?.message);
    if (st !== "ok") return fail(st, 409, st === "taken" ? "Khung này vừa có người đặt." : "Không đặt được khung này.");
    return snapshot(s);
  }

  // Hai thao tác còn lại làm trên MỘT khoá của đợt này.
  const { data: lockRow } = await db
    .from("studio_mini_slots")
    .select(LOCK_COLS)
    .eq("id", typeof body.slotId === "string" ? body.slotId : "")
    .eq("session_id", s.id)
    .maybeSingle();
  const lock = lockRow as unknown as { id: string; booking_id: string | null; start_min: number } | null;
  if (!lock) return fail("not_found", 404, "Chỗ này không còn — tải lại trang.");

  if (action === "cancel") {
    const { error } = await db.from("studio_mini_slots").delete().eq("id", lock.id);
    if (error) return fail("server_error", 500, error.message);
    if (lock.booking_id) {
      // Yêu cầu đặt lịch ở lại làm dấu vết (khách có thể đã chuyển cọc), nhưng
      // ghi rõ đã huỷ và đưa khỏi danh sách cần xử lý. 'declined' đúng nghĩa
      // hơn; database cũ chỉ nhận new/handled/archived thì lùi về 'archived'.
      const { data: b } = await db.from("studio_bookings").select("note").eq("id", lock.booking_id).maybeSingle();
      const note = [`✖ Studio đã huỷ khung ${slotRange(lock.start_min, s.slot_minutes)}.`, b?.note].filter(Boolean).join("\n");
      const r = await db.from("studio_bookings").update({ status: "declined", note }).eq("id", lock.booking_id);
      if (r.error) await db.from("studio_bookings").update({ status: "archived", note }).eq("id", lock.booking_id);
    }
    return snapshot(s);
  }

  if (action === "confirm_deposit") {
    if (!lock.booking_id) return fail("no_deposit", 400, "Chỗ này không có khoản cọc nào.");
    // Cùng câu UPDATE với nút xác nhận ở màn Đặt lịch khách và với SePay
    // (applyToBooking) — trigger mini_booking_sync lo việc chốt chỗ.
    const { data: b } = await db.from("studio_bookings").select("deposit_paid_at").eq("id", lock.booking_id).eq("owner_id", ownerId).maybeSingle();
    if (!b) return fail("not_found", 404);
    const { error } = await db
      .from("studio_bookings")
      .update({ deposit_status: "confirmed", deposit_paid_at: b.deposit_paid_at ?? new Date().toISOString() })
      .eq("id", lock.booking_id);
    if (error) return fail("server_error", 500, error.message);
    return snapshot(s);
  }

  return fail("unknown_action");
}
