import "server-only";
import { loadZalo } from "./config";
import { eventCfg } from "./events";
import { sendZalo, type SendResult } from "./send";

/**
 * Gửi tin theo MỐC vòng đời — chỉ khi studio đã bật mốc đó cho đúng đối tượng
 * (client/crew) trong `studio_zalo.auto_events`. Dùng bởi cron + các điểm móc.
 *
 * - Kênh cá nhân: gửi `body` (văn bản).
 * - Kênh OA: nếu mốc có cấu hình `templateId` → gửi ZNS với `templateData`;
 *   ngược lại bỏ qua (OA không gửi văn bản tự do tới khách chưa tương tác).
 */
export async function autoNotify(opts: {
  ownerId: string;
  event: string;
  audience: "client" | "crew";
  toPhone?: string | null;
  toName?: string | null;
  body: string;
  templateData?: Record<string, string>;
  contractId?: string | null;
}): Promise<SendResult> {
  const row = await loadZalo(opts.ownerId);
  if (!row || row.status !== "connected") return { ok: false, skipped: true, error: "not_connected" };

  const cfg = eventCfg(row.auto_events, opts.event);
  const enabled = opts.audience === "client" ? cfg?.client : cfg?.crew;
  if (!enabled) return { ok: false, skipped: true, error: "event_disabled" };
  if (!opts.toPhone) return { ok: false, skipped: true, error: "no_phone" };

  const templateId = row.channel === "oa" ? cfg?.templateId : undefined;
  if (row.channel === "oa" && !templateId) {
    return { ok: false, skipped: true, error: "no_template_for_event" };
  }

  return sendZalo({
    ownerId: opts.ownerId,
    toPhone: opts.toPhone,
    toName: opts.toName ?? null,
    body: opts.body,
    templateId,
    templateData: opts.templateData,
    kind: opts.event,
    audience: opts.audience,
    contractId: opts.contractId ?? null,
  });
}
