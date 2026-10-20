import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwners } from "@/lib/push";
import { keyAlert, type ProviderFailure } from "./provider-alert-rules";

export type { ProviderFailure };

/**
 * Mỗi key hỏng báo tối đa một lần trong khoảng này. Key chung hết tiền thì MỌI
 * lượt chat của MỌI studio đều gặp lỗi — không chặn là admin nhận cả trăm tin.
 */
const REPEAT_MS = 12 * 60 * 60 * 1000;

/** Chặn nhanh trong cùng một máy chủ, khỏi hỏi DB mỗi lượt chat. Giữa các máy chủ thì DB lo. */
const lastSent = new Map<string, number>();

/** Thân phản hồi lỗi của nhà cung cấp, cắt ngắn — đủ để đọc mã lỗi. */
export async function readErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 4000);
  } catch {
    return "";
  }
}

/**
 * Báo cho người trả tiền khi một key AI hết tiền / hỏng (xem
 * provider-alert-rules): key chung → mọi admin, key riêng → chủ studio đó. Ghi
 * vào chuông thông báo + gửi push. Lỗi thoáng qua thì bỏ qua.
 *
 * Gọi SAU khi đã trả lời khách. Không bao giờ ném lỗi.
 */
export async function alertProviderFailures(failures: ProviderFailure[], ownerId: string | null): Promise<void> {
  for (const f of failures) {
    try {
      const a = keyAlert(f);
      if (!a || (a.audience === "studio" && !ownerId)) continue;

      const memo = `${a.audience === "studio" ? ownerId : "admins"}|${a.message}`;
      const now = Date.now();
      if (now - (lastSent.get(memo) ?? 0) < REPEAT_MS) continue;
      lastSent.set(memo, now);

      const db = createAdminClient();
      let ids: string[];
      if (a.audience === "studio") {
        ids = [ownerId as string];
      } else {
        const { data } = await db.from("profiles").select("id").eq("role", "admin").eq("is_active", true);
        ids = (data ?? []).map((r) => r.id as string);
      }
      if (!ids.length) continue;

      // Máy chủ khác (hoặc lần khởi động trước) đã báo đúng câu này gần đây chưa.
      const { data: dup } = await db
        .from("studio_notifications")
        .select("id")
        .in("owner_id", ids)
        .eq("kind", a.kind)
        .eq("message", a.message)
        .gte("created_at", new Date(now - REPEAT_MS).toISOString())
        .limit(1);
      if (dup?.length) continue;

      await db
        .from("studio_notifications")
        .insert(ids.map((owner_id) => ({ owner_id, contract_id: null, kind: a.kind, message: a.message })));
      await sendPushToOwners(ids, { title: a.title, body: a.message, url: a.url, tag: a.kind });
    } catch (e) {
      console.warn("[ai-key-alert] không gửi được thông báo:", (e as Error)?.message);
    }
  }
}
