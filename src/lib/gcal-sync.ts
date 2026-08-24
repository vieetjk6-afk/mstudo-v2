import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertGCalEvent, deleteGCalEvent, contractToGCal } from "@/lib/gcal";
import { gcalPlan } from "@/lib/gcal-plan";
import { SHOOT_TYPE_LABEL } from "@/lib/types";
import type { ShootType } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   ĐẨY LỊCH LÊN GOOGLE — phía SERVER, không cần ai đang mở trình duyệt.

   VÌ SAO TỒN TẠI: trước đây mọi lượt đồng bộ đều bắt đầu bằng một `fetch` từ
   trình duyệt của chủ studio (ContractEditor, CalendarView) tới /api/gcal/sync,
   mà route đó lại đòi phiên đăng nhập. Nghĩa là ĐÚNG KHOẢNH KHẮC quan trọng
   nhất — khách bấm ký ở cổng /c/[token], không có ai đăng nhập cả — chẳng có gì
   chạy. Hợp đồng chuyển sang "đã duyệt" nhưng Google Lịch trống trơn, và chủ
   studio phải mở lại hợp đồng, sửa một ô bất kỳ cho autosave chạy thì lịch mới
   lên. Đó chính là "phải cập nhật tay mới được".

   Các hàm ở đây chạy bằng service-role và nhận `ownerId` tường minh, nên gọi
   được từ mọi luồng KHÔNG có phiên: khách ký, cron tự chuyển trạng thái, app
   máy tính ghi qua /api/desktop/mutate.

   QUY TẮC AN TOÀN: `syncContractCalendar` — cửa duy nhất mà các luồng nghiệp vụ
   gọi — KHÔNG BAO GIỜ ném lỗi. Google hết quota hay token bị thu hồi thì việc KÝ
   HỢP ĐỒNG vẫn phải thành công: lịch lên trễ là phiền, ký hỏng là mất khách. Các
   hàm lẻ bên dưới thì có thể ném (lỗi mạng, lỗi Google) và trả về `reason` đọc
   được khi chỉ là "chưa lên được"; nơi gọi chúng là /api/gcal/sync, đã bọc
   try/catch sẵn để trả lý do về cho trình duyệt.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Một lượt đồng bộ: đã lên Google chưa, và nếu chưa thì vì sao. */
export type GCalSyncResult = {
  synced: boolean;
  /** Lý do đọc được cho người dùng khi `synced` = false. */
  reason?: string;
  gcalEventId?: string | null;
};

const NOT_CONNECTED = "chưa kết nối Google Lịch";

const CONTRACT_COLS =
  "id, owner_id, title, client_name, shoot_type, event_date, event_time, location, status, gcal_event_id";

/**
 * Đưa MỘT hợp đồng lên (hoặc gỡ khỏi) Google Lịch cho đúng trạng thái hiện tại.
 *
 * Idempotent — gọi bao nhiêu lần cũng chỉ có một sự kiện trên Google, vì
 * `gcal_event_id` được ghi ngược lại vào hàng hợp đồng.
 *
 * Nhánh "không lên lịch" luôn DỌN sự kiện cũ nếu có: hợp đồng bị lùi về nháp,
 * bị huỷ, hay bị xoá ngày chụp mà vẫn còn trên lịch Google là kiểu sai nguy hiểm
 * hơn cả không đồng bộ — thợ vẫn thấy buổi chụp và vẫn tới.
 */
export async function syncContractToGCal(ownerId: string, contractId: string): Promise<GCalSyncResult> {
  const db = createAdminClient();
  const { data: ct } = await db
    .from("studio_contracts")
    .select(CONTRACT_COLS)
    .eq("id", contractId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!ct) return { synced: false, reason: "không tìm thấy hợp đồng" };

  const gid = ct.gcal_event_id as string | null;

  // Luật "có lên lịch không" nằm ở lib/gcal-plan.ts — nhánh `drop` lo cả hợp
  // đồng chưa ký lẫn hợp đồng vừa bị xoá ngày chụp / lùi về nháp / huỷ.
  const plan = gcalPlan(ct as { status?: string | null; event_date?: string | null });
  if (plan.action === "drop") return await drop(db, ownerId, contractId, gid, plan.reason);

  const newId = await upsertGCalEvent(
    ownerId,
    contractToGCal(
      ct as Parameters<typeof contractToGCal>[0],
      SHOOT_TYPE_LABEL[ct.shoot_type as ShootType] ?? "",
    ),
    gid,
  );
  if (!newId) return { synced: false, reason: NOT_CONNECTED };
  if (newId !== gid) await db.from("studio_contracts").update({ gcal_event_id: newId }).eq("id", contractId);
  return { synced: true, gcalEventId: newId };
}

/** Gỡ sự kiện cũ (nếu có) và XOÁ luôn id đã lưu, rồi trả về lý do không lên lịch. */
async function drop(
  db: ReturnType<typeof createAdminClient>,
  ownerId: string,
  contractId: string,
  gid: string | null,
  reason: string,
): Promise<GCalSyncResult> {
  if (gid) {
    await deleteGCalEvent(ownerId, gid);
    // Phải xoá cả cột: giữ lại id của một sự kiện đã bị xoá thì lần đồng bộ sau
    // gọi events.update lên một id chết, Google trả 404 và ta lại đi vòng qua
    // nhánh insert — thà để trống cho rõ.
    await db.from("studio_contracts").update({ gcal_event_id: null }).eq("id", contractId);
  }
  return { synced: false, reason };
}

/** Gỡ hẳn hợp đồng khỏi Google Lịch (dùng khi xoá hợp đồng). */
export async function removeContractFromGCal(ownerId: string, contractId: string): Promise<void> {
  const db = createAdminClient();
  const { data: ct } = await db
    .from("studio_contracts")
    .select("gcal_event_id")
    .eq("id", contractId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  const gid = ct?.gcal_event_id as string | null | undefined;
  if (!gid) return;
  await deleteGCalEvent(ownerId, gid);
  await db.from("studio_contracts").update({ gcal_event_id: null }).eq("id", contractId);
}

/** Đưa MỘT mốc lịch (studio_events) lên Google Lịch. */
export async function syncStudioEventToGCal(ownerId: string, eventId: string): Promise<GCalSyncResult> {
  const db = createAdminClient();
  const { data: ev } = await db
    .from("studio_events")
    .select("id, title, event_date, event_time, note, gcal_event_id")
    .eq("id", eventId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!ev) return { synced: false, reason: "không tìm thấy mốc lịch" };

  const gid = ev.gcal_event_id as string | null;
  const newId = await upsertGCalEvent(
    ownerId,
    {
      summary: (ev.title as string) || "Mốc lịch",
      description: (ev.note as string) ?? undefined,
      date: ev.event_date as string,
      time: ev.event_time as string | null,
      duration: 60,
    },
    gid,
  );
  if (!newId) return { synced: false, reason: NOT_CONNECTED };
  if (newId !== gid) await db.from("studio_events").update({ gcal_event_id: newId }).eq("id", eventId);
  return { synced: true, gcalEventId: newId };
}

/** Gỡ một mốc lịch khỏi Google Lịch (gọi TRƯỚC khi xoá hàng ở DB). */
export async function removeStudioEventFromGCal(ownerId: string, eventId: string): Promise<void> {
  const db = createAdminClient();
  const { data: ev } = await db
    .from("studio_events")
    .select("gcal_event_id")
    .eq("id", eventId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  const gid = ev?.gcal_event_id as string | null | undefined;
  if (!gid) return;
  await deleteGCalEvent(ownerId, gid);
  await db.from("studio_events").update({ gcal_event_id: null }).eq("id", eventId);
}

/**
 * Buổi chụp CHÍNH + mọi mốc lịch của hợp đồng, trong một lượt.
 *
 * Đây là hàm mà các luồng "vừa xảy ra chuyện quan trọng với hợp đồng này" nên
 * gọi (khách ký, đổi trạng thái, cron tự chuyển sang đang-thực-hiện). Mốc lịch
 * đi kèm vì đám cưới hay có *ngày đãi trước*, *ngày thử đồ* — ký xong mà Google
 * chỉ hiện đúng ngày cưới thì vẫn là lịch thiếu.
 *
 * KHÔNG BAO GIỜ NÉM LỖI: nơi gọi là đường ký hợp đồng và đổi trạng thái.
 */
export async function syncContractCalendar(
  ownerId: string,
  contractId: string,
): Promise<{ contract: GCalSyncResult; milestones: number }> {
  // Studio chưa nối Google Lịch (đa số) thì dừng ngay ở một truy vấn. Không có
  // cửa này, mỗi lần app máy tính ghi một hợp đồng là thêm vài lượt đọc DB và
  // vài lượt dựng client OAuth chỉ để rốt cuộc nhận về "chưa kết nối".
  if (!(await hasGoogleCalendar(ownerId))) {
    return { contract: { synced: false, reason: NOT_CONNECTED }, milestones: 0 };
  }

  let contract: GCalSyncResult = { synced: false, reason: "lỗi không rõ" };
  try {
    contract = await syncContractToGCal(ownerId, contractId);
  } catch (e) {
    contract = { synced: false, reason: (e as Error)?.message || String(e) };
  }

  // Hợp đồng không lên lịch được vì CHƯA kết nối Google thì các mốc cũng thế —
  // khỏi gọi thêm chục lượt API chỉ để nhận cùng một câu trả lời.
  if (!contract.synced && contract.reason === NOT_CONNECTED) return { contract, milestones: 0 };

  let milestones = 0;
  try {
    const db = createAdminClient();
    const { data: evs } = await db
      .from("studio_events")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("contract_id", contractId)
      .not("event_date", "is", null);
    for (const ev of evs ?? []) {
      const r = await syncStudioEventToGCal(ownerId, ev.id as string);
      if (r.synced) milestones++;
    }
  } catch {
    /* mốc lịch lên trễ không đáng chặn việc đang làm ở nơi gọi */
  }
  return { contract, milestones };
}

/** Studio này đã nối Google Lịch chưa — một truy vấn, không gọi ra Google. */
async function hasGoogleCalendar(ownerId: string): Promise<boolean> {
  try {
    const { data } = await createAdminClient()
      .from("profiles")
      .select("google_refresh_token")
      .eq("id", ownerId)
      .maybeSingle();
    return !!data?.google_refresh_token;
  } catch {
    // Không đọc được thì cứ thử đồng bộ: thà tốn một lượt gọi thừa còn hơn im
    // lặng bỏ qua lịch của studio đã kết nối.
    return true;
  }
}
