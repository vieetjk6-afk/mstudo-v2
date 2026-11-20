import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { withPasscodeHint } from "@/lib/portal-key";
import { bodyToHtml, emailSubject, isEmail } from "@/lib/client-email-format";

/**
 * EMAIL GỬI KHÁCH, SONG SONG VỚI ZALO.
 *
 * Khách có email thì nhận qua email ĐÚNG nội dung tin Zalo (nhắc lịch, nhắc
 * tiền, đã nhận cọc, mời chọn ảnh…). Khách có cả Zalo lẫn email thì nhận cả
 * hai; khách chỉ có email (không dùng điện thoại) vẫn nhận được.
 *
 * Ghi vào `zalo_messages` với channel = 'email' — cùng bảng nhật ký tin, để
 * hàng rào chống gửi trùng của cron (kiểm "đã có tin 'sent' cùng kind cho hợp
 * đồng này chưa") cũng chặn được email lặp lại mỗi ngày với khách chỉ có email.
 */
export type ClientEmailResult = { ok: boolean; skipped?: boolean; error?: string };

type ContractBits = {
  client_email: string | null;
  client_phone: string | null;
  client_name: string | null;
  passcode: string | null;
};

async function loadContract(contractId: string, ownerId: string): Promise<ContractBits | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("studio_contracts")
    .select("client_email, client_phone, client_name")
    .eq("id", contractId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!data) return null;
  // Mã số mở hợp đồng: cột mới — chưa chạy migration thì coi như không có.
  const pc = await db.from("studio_contracts").select("client_passcode").eq("id", contractId).maybeSingle();
  const passcode = pc.error ? null : ((pc.data as { client_passcode?: string | null } | null)?.client_passcode ?? null);
  return { ...(data as Omit<ContractBits, "passcode">), passcode };
}

export async function emailClient(opts: {
  ownerId: string;
  /** Mốc / loại tin — dùng làm tiêu đề và khoá chống trùng (cột kind). */
  kind: string;
  body: string;
  /** Hợp đồng (hoặc id báo giá khi gửi về báo giá — chỉ dùng để ghi log). */
  contractId?: string | null;
  /** Email đã biết. Không có thì đọc từ hợp đồng `contractId`. */
  toEmail?: string | null;
  toName?: string | null;
  /** Tên studio cho tiêu đề; không có thì đọc từ hồ sơ. */
  studio?: string | null;
}): Promise<ClientEmailResult> {
  const db = createAdminClient();
  let to = (opts.toEmail || "").trim();
  let body = opts.body;
  let name = opts.toName ?? null;
  let isContract = false;

  if (opts.contractId) {
    const c = await loadContract(opts.contractId, opts.ownerId).catch(() => null);
    if (c) {
      isContract = true;
      if (!to) to = (c.client_email || "").trim();
      name = name ?? c.client_name;
      // Khách không có SĐT mà có mã số → câu "(mật khẩu là SĐT…)" đổi thành mã.
      body = withPasscodeHint(body, c.client_phone, c.passcode);
    }
  }
  if (!isEmail(to)) return { ok: false, skipped: true, error: "no_email" };

  let studio = opts.studio ?? null;
  if (!studio) {
    const { data } = await db.from("profiles").select("full_name").eq("id", opts.ownerId).maybeSingle();
    studio = (data?.full_name as string | null) || "Studio";
  }

  const r = await sendEmail({ to, subject: emailSubject(opts.kind, studio), html: bodyToHtml(body, studio), fromName: studio });
  const res: ClientEmailResult = r.ok ? { ok: true } : r.error === "not_configured" ? { ok: false, skipped: true, error: "email_not_configured" } : { ok: false, error: r.error };

  await db
    .from("zalo_messages")
    .insert({
      owner_id: opts.ownerId,
      channel: "email",
      audience: "client",
      to_phone: null,
      to_uid: null,
      to_name: name,
      body,
      kind: opts.kind,
      // contract_id có khoá ngoại tới studio_contracts — id báo giá không ghi vào đây.
      contract_id: isContract ? opts.contractId : null,
      status: res.skipped ? "skipped" : res.ok ? "sent" : "failed",
      error: res.error ? `email:${to.replace(/^(.).*(@.*)$/, "$1…$2")} ${res.error}`.slice(0, 500) : null,
      attempts: res.skipped ? 0 : 1,
      sent_at: res.ok ? new Date().toISOString() : null,
    })
    .then(() => undefined, () => undefined);

  return res;
}
