import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailClient } from "@/lib/client-email";
import { DEFAULT_AUTO_EVENTS, loadZalo, type ZaloRow } from "./config";
import { eventCfg } from "./events";
import { sendZalo, type SendResult } from "./send";

/**
 * Mốc KHÔNG gửi email từ đây vì đã có đường email riêng:
 *  • portal_link — notifyPortalOnComplete tự gửi email kèm nút "Mở trang".
 *  • quote_expiring — tin về BÁO GIÁ, không gắn hợp đồng nên không có chỗ ghi
 *    dấu chống gửi trùng cho email (cột contract_id khoá ngoại tới hợp đồng).
 */
const EMAIL_ELSEWHERE = new Set(["portal_link", "quote_expiring"]);

/**
 * Gửi tin theo MỐC vòng đời — chỉ khi studio đã bật mốc đó cho đúng đối tượng
 * (client/crew) trong `studio_zalo.auto_events`. Dùng bởi cron + các điểm móc.
 *
 * - Kênh cá nhân: gửi `body` (văn bản).
 * - Kênh OA: nếu mốc có cấu hình `templateId` → gửi ZNS với `templateData`;
 *   ngược lại bỏ qua (OA không gửi văn bản tự do tới khách chưa tương tác).
 * - Tin gửi KHÁCH: khách có email thì gửi THÊM email cùng nội dung (xem
 *   @/lib/client-email). Có cả Zalo và email → nhận cả hai. Studio chưa nối
 *   Zalo vẫn gửi email, theo bộ mốc mặc định.
 *
 * Kết quả `ok` = đã tới khách qua ÍT NHẤT một kênh.
 */
export async function autoNotify(opts: {
  ownerId: string;
  event: string;
  audience: "client" | "crew";
  toPhone?: string | null;
  toName?: string | null;
  /** Email khách nếu nơi gọi đã có sẵn; không có thì đọc từ hợp đồng. */
  toEmail?: string | null;
  body: string;
  templateData?: Record<string, string>;
  contractId?: string | null;
}): Promise<SendResult & { email?: { ok: boolean; skipped?: boolean; error?: string } }> {
  const row = await loadZalo(opts.ownerId);
  const zalo = await viaZalo(row, opts);

  if (opts.audience !== "client" || EMAIL_ELSEWHERE.has(opts.event)) return zalo;
  if (!opts.contractId && !opts.toEmail) return zalo;

  // Mốc có bật cho khách không: studio đã có cấu hình Zalo thì theo đúng cấu
  // hình đó (tắt Zalo mốc nào là tắt cả email mốc đó); chưa từng nối Zalo thì
  // theo bộ mốc mặc định an toàn.
  const events = row && Object.keys(row.auto_events || {}).length ? row.auto_events : DEFAULT_AUTO_EVENTS;
  if (!eventCfg(events, opts.event).client) return zalo;

  // Nhắc lịch chụp: cron nhắc việc (07:00) đã email khách khi studio bật "Tự
  // động email cho khách" — khi đó đừng gửi lần hai.
  if (opts.event === "shoot_reminder") {
    const { data } = await createAdminClient().from("profiles").select("auto_client_emails").eq("id", opts.ownerId).maybeSingle();
    if (data?.auto_client_emails) return zalo;
  }

  const email = await emailClient({
    ownerId: opts.ownerId,
    kind: opts.event,
    body: opts.body,
    contractId: opts.contractId,
    toEmail: opts.toEmail,
    toName: opts.toName,
  }).catch((e) => ({ ok: false, error: String(e) }));

  if (email.ok && !zalo.ok) return { ok: true, email };
  return { ...zalo, email };
}

async function viaZalo(
  row: ZaloRow | null,
  opts: Parameters<typeof autoNotify>[0]
): Promise<SendResult> {
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
