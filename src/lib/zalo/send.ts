import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadZalo, readPersonalSession, type ZaloRow } from "./config";
import { safeImageUrl } from "./image";
import { sendZNS, sendOAText } from "./oa";
import { sendPersonalText } from "./personal";

export interface SendInput {
  ownerId: string;
  toPhone?: string | null;
  toUid?: string | null;
  toName?: string | null;
  /** Tin văn bản (kênh cá nhân, hoặc tin OA CS). */
  body?: string;
  /** ZNS (kênh OA): template đã duyệt + dữ liệu điền. */
  templateId?: string;
  templateData?: Record<string, string>;
  kind?: string;
  audience?: "client" | "crew";
  contractId?: string | null;
  /** Ảnh đính kèm (kênh cá nhân) — hiện chỉ dùng cho mã QR thanh toán. */
  imageUrl?: string | null;
  /** Ghi log vào zalo_messages (mặc định true). */
  log?: boolean;
}

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

async function logMessage(input: SendInput, row: ZaloRow | null, res: SendResult, uid?: string | null) {
  if (input.log === false) return;
  const db = createAdminClient();
  await db.from("zalo_messages").insert({
    owner_id: input.ownerId,
    channel: row?.channel ?? "personal",
    audience: input.audience ?? null,
    to_phone: input.toPhone ?? null,
    to_uid: uid ?? input.toUid ?? null,
    to_name: input.toName ?? null,
    body: input.body ?? "",
    template_id: input.templateId ?? null,
    kind: input.kind ?? null,
    contract_id: input.contractId ?? null,
    status: res.skipped ? "skipped" : res.ok ? "sent" : "failed",
    error: res.error ?? null,
    attempts: res.skipped ? 0 : 1,
    sent_at: res.ok ? new Date().toISOString() : null,
  });
}

/**
 * Gửi một tin Zalo cho studio `ownerId`, tự chọn kênh (OA hay cá nhân) theo cấu
 * hình studio đã kết nối. Luôn ghi log vào zalo_messages (trừ khi log=false).
 */
export async function sendZalo(input: SendInput): Promise<SendResult> {
  const row = await loadZalo(input.ownerId);
  if (!row || row.status !== "connected") {
    const res: SendResult = { ok: false, skipped: true, error: "not_connected" };
    await logMessage(input, row, res);
    return res;
  }

  let res: SendResult;
  let uid: string | null | undefined = input.toUid;

  if (row.channel === "oa") {
    if (input.templateId && input.toPhone) {
      res = await sendZNS(row, input.toPhone, input.templateId, input.templateData ?? {});
    } else if (input.toUid && input.body) {
      res = await sendOAText(row, input.toUid, input.body);
    } else {
      res = { ok: false, error: "oa_needs_template_or_uid" };
    }
  } else {
    const session = readPersonalSession(row);
    if (!session) {
      res = { ok: false, error: "no_personal_session" };
    } else if (!input.body) {
      res = { ok: false, error: "personal_needs_body" };
    } else {
      const r = await sendPersonalText(
        session,
        { uid: input.toUid, phone: input.toPhone },
        input.body,
        safeImageUrl(input.imageUrl)
      );
      uid = r.uid;
      res = { ok: r.ok, error: r.error };
    }
  }

  await logMessage(input, row, res, uid);
  return res;
}
