import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertGCalEvent, contractToGCal, GCAL_CONTRACT_STATUSES } from "@/lib/gcal";
import { SHOOT_TYPE_LABEL, type ShootType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
// Dừng sớm hơn trần để luôn trả được kết quả thay vì chết giữa chừng.
const TIME_BUDGET_MS = 260_000;

/**
 * Đẩy TẤT CẢ lịch đã có lên Google Lịch một lượt.
 *
 * Vì sao cần: đồng bộ thường chỉ chạy lúc lưu một hợp đồng/ghi chú. Mọi thứ tạo
 * TRƯỚC khi studio nối Google Lịch không có gì kích hoạt, nên lịch cũ nằm im
 * mãi. Đây là nút "đồng bộ lại từ đầu".
 *
 * An toàn khi bấm nhiều lần: bản ghi nào đã có gcal_event_id thì cập nhật đúng
 * sự kiện đó chứ không tạo trùng.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;

  let contracts = 0;
  let events = 0;
  let failed = 0;
  let done = true;
  let firstError: string | null = null;

  try {
    // ── Hợp đồng đã chốt và có ngày chụp ───────────────────────────────
    const { data: cts } = await db
      .from("studio_contracts")
      .select("id, title, client_name, shoot_type, event_date, event_time, location, gcal_event_id")
      .eq("owner_id", user.id)
      .not("event_date", "is", null)
      .in("status", GCAL_CONTRACT_STATUSES)
      .order("event_date", { ascending: false });

    for (const ct of cts ?? []) {
      if (outOfTime()) { done = false; break; }
      try {
        const payload = contractToGCal(ct, SHOOT_TYPE_LABEL[ct.shoot_type as ShootType] ?? "");
        const gid = await upsertGCalEvent(user.id, payload, ct.gcal_event_id as string | null);
        if (!gid) {
          // null ⇒ chưa nối Google Lịch: đi tiếp cũng vô ích.
          return NextResponse.json({ ok: false, reason: "chưa kết nối Google Lịch" }, { status: 400 });
        }
        if (gid !== ct.gcal_event_id) {
          await db.from("studio_contracts").update({ gcal_event_id: gid }).eq("id", ct.id);
        }
        contracts++;
      } catch (e) {
        failed++;
        firstError ??= (e as Error)?.message || String(e);
      }
    }

    // ── Ghi chú lịch ───────────────────────────────────────────────────
    if (done) {
      const { data: evs } = await db
        .from("studio_events")
        .select("id, title, event_date, event_time, note, gcal_event_id")
        .eq("owner_id", user.id)
        .order("event_date", { ascending: false });

      for (const ev of evs ?? []) {
        if (outOfTime()) { done = false; break; }
        try {
          const gid = await upsertGCalEvent(
            user.id,
            { summary: ev.title, description: ev.note ?? undefined, date: ev.event_date, time: ev.event_time, duration: 60 },
            ev.gcal_event_id as string | null,
          );
          if (gid && gid !== ev.gcal_event_id) {
            await db.from("studio_events").update({ gcal_event_id: gid }).eq("id", ev.id);
          }
          events++;
        } catch (e) {
          failed++;
          firstError ??= (e as Error)?.message || String(e);
        }
      }
    }
  } catch (e) {
    return NextResponse.json({ ok: false, reason: (e as Error)?.message || String(e) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, contracts, events, failed, done, firstError });
}
