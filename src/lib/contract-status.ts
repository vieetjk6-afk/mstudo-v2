import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { autoCreateContractSelectionOnProduction } from "@/lib/studio-drive";
import { syncContractCalendar } from "@/lib/gcal-sync";

// Trạng thái được phép TỰ chuyển sang 'in_progress' khi tới ngày. Chỉ những HĐ
// đang hoạt động (đã gửi/đã duyệt) — KHÔNG đụng bản nháp (draft), đã hoàn tất
// (completed) hay đã huỷ (cancelled).
const ADVANCEABLE = ["sent", "approved"] as const;

/** Hôm nay theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD. */
export function vnToday(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Tự chuyển hợp đồng sang **'in_progress'** khi đã tới NGÀY SỚM NHẤT của hợp đồng.
 * Ngày sớm nhất = min(`studio_contracts.event_date`, mọi mốc `studio_events`
 * của HĐ — ví dụ *ngày đãi trước* thường sớm hơn ngày cưới chính).
 *
 * - `ownerId` có → chỉ xử lý HĐ của chủ đó (khi mở trang, phản hồi tức thì).
 * - `ownerId` rỗng → tất cả HĐ (dùng cho cron chạy hằng ngày).
 *
 * Trả về danh sách id HĐ vừa được đổi trạng thái. Idempotent: HĐ đã in_progress
 * không nằm trong diện xét nên gọi lại nhiều lần vẫn an toàn.
 */
export async function autoAdvanceContracts(db: SupabaseClient, ownerId?: string): Promise<string[]> {
  const today = vnToday();

  // 1) Ứng viên: HĐ đang hoạt động, chưa đang thực hiện/hoàn tất/huỷ.
  let q = db
    .from("studio_contracts")
    .select("id, owner_id, event_date, status")
    .in("status", ADVANCEABLE as unknown as string[]);
  if (ownerId) q = q.eq("owner_id", ownerId);
  const { data: contracts } = await q;
  if (!contracts?.length) return [];

  // 2) Mốc sớm nhất theo studio_events cho các HĐ ứng viên (vd ngày đãi trước).
  const ids = contracts.map((c) => c.id as string);
  const { data: events } = await db
    .from("studio_events")
    .select("contract_id, event_date")
    .in("contract_id", ids)
    .not("event_date", "is", null);
  const earliestMilestone = new Map<string, string>();
  for (const e of events ?? []) {
    const cid = e.contract_id as string | null;
    const d = e.event_date as string | null;
    if (!cid || !d) continue;
    const cur = earliestMilestone.get(cid);
    if (!cur || d < cur) earliestMilestone.set(cid, d);
  }

  // 3) Ngày sớm nhất của HĐ = min(event_date, mốc sớm nhất). Tới hạn → đổi.
  const toAdvance: string[] = [];
  for (const c of contracts) {
    const dates = [c.event_date as string | null, earliestMilestone.get(c.id as string) ?? null].filter(
      (d): d is string => !!d
    );
    if (!dates.length) continue;
    const earliest = dates.reduce((a, b) => (a < b ? a : b));
    if (earliest <= today) toAdvance.push(c.id as string);
  }
  if (!toAdvance.length) return [];

  await db.from("studio_contracts").update({ status: "in_progress" }).in("id", toAdvance);

  // Vừa sang "đang thực hiện" → giờ mới tạo album CHỌN ẢNH (trước mốc này album
  // được giữ chưa tạo). Idempotent, lỗi Drive không chặn việc chuyển trạng thái.
  const ownerById = new Map(contracts.map((c) => [c.id as string, c.owner_id as string]));
  for (const id of toAdvance) {
    const oid = ownerById.get(id);
    if (!oid) continue;
    try {
      await autoCreateContractSelectionOnProduction(oid, id);
    } catch {
      /* studio chưa nối Drive / lỗi tạm — desktop sẽ tạo bù khi đồng bộ */
    }
    // Hợp đồng vừa tự đổi trạng thái thì sự kiện trên Google Lịch cũng phải theo
    // — nhánh này chạy trong cron và khi mở danh sách hợp đồng, tức KHÔNG có
    // thao tác nào của người dùng để kích hoạt lối đồng bộ cũ từ trình duyệt.
    await syncContractCalendar(oid, id);
  }
  return toAdvance;
}
