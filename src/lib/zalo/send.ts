import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadZalo, readPersonalSession, type ZaloRow } from "./config";
import { safeImageUrl } from "./image";
import { sendZNS, sendOAText } from "./oa";
import { sendPersonalText } from "./personal";
import { isMissingColumn } from "@/lib/missing-column";
import {
  isRecipientError,
  normalizePhone,
  resolveRecipient,
  shouldSave,
  type RecipientSource,
  type SavedZalo,
  type SiblingZalo,
} from "./recipient";

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
  /** Album đang gửi (nút "Gửi Zalo" trong album) — để nhớ người nhận cho album lẻ. */
  albumId?: string | null;
  /** Ảnh đính kèm (kênh cá nhân) — hiện chỉ dùng cho mã QR thanh toán. */
  imageUrl?: string | null;
  /** Ghi log vào zalo_messages (mặc định true). */
  log?: boolean;
}

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  /** Tin đã gửi nhưng KHÔNG kèm được ảnh (lý do) — giao diện phải nói ra. */
  imageError?: string;
  /** uid Zalo thực sự đã gửi tới (kênh cá nhân). */
  uid?: string | null;
  /** Tên người nhận (tên bạn Zalo đã chọn, hoặc tên khách). */
  name?: string | null;
  /** Người nhận đã được ghi nhớ lên hợp đồng/album → lần sau một cú bấm. */
  saved?: boolean;
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
    // Gửi được mà thiếu ảnh vẫn là "sent" — ghi lý do vào error để lịch sử tin
    // nhắn còn truy được, thay vì mỗi lần lại phải mò trong log máy chủ.
    error: res.error ?? (res.imageError ? `image:${res.imageError}` : null),
    attempts: res.skipped ? 0 : 1,
    sent_at: res.ok ? new Date().toISOString() : null,
  });
}

/* ── Nhớ người nhận (xem ./recipient.ts) ────────────────────────────────── */

type Target = { table: "studio_contracts" | "albums"; id: string; row: SavedZalo | null };

const ZALO_COLS = "zalo_uid, zalo_name, zalo_self";

/**
 * Đọc người nhận đã lưu trên hợp đồng/album (lọc theo owner_id — id đến từ trình
 * duyệt nên không tin). Trả null khi database CHƯA chạy migration
 * zalo_nguoi_nhan.sql → người gọi cư xử như trước, không nhớ gì.
 */
async function loadTargets(
  ownerId: string,
  contractId: string | null | undefined,
  albumId: string | null | undefined
): Promise<{ targets: Target[]; contractPhone: string | null } | null> {
  const db = createAdminClient();
  const targets: Target[] = [];
  let contractPhone: string | null = null;
  // Album trước hợp đồng: người chọn riêng cho album được ưu tiên.
  if (albumId) {
    const { data, error } = await db.from("albums").select(`id, ${ZALO_COLS}`).eq("id", albumId).eq("owner_id", ownerId).maybeSingle();
    if (error) {
      if (isMissingColumn(error, "zalo_")) return null;
    } else if (data) targets.push({ table: "albums", id: albumId, row: data as SavedZalo });
  }
  if (contractId) {
    const { data, error } = await db
      .from("studio_contracts")
      .select(`id, client_phone, ${ZALO_COLS}`)
      .eq("id", contractId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) {
      if (isMissingColumn(error, "zalo_")) return null;
    } else if (data) {
      targets.push({ table: "studio_contracts", id: contractId, row: data as SavedZalo });
      contractPhone = (data as { client_phone?: string | null }).client_phone ?? null;
    }
  }
  return { targets, contractPhone };
}

/** Hợp đồng khác của studio có người đã lưu cho tài khoản Zalo hiện tại (lọc SĐT ở JS — SĐT lưu đủ kiểu định dạng). */
async function loadSiblings(ownerId: string, selfId: string, excludeId: string | null | undefined): Promise<SiblingZalo[]> {
  let q = createAdminClient()
    .from("studio_contracts")
    .select(`id, client_phone, updated_at, ${ZALO_COLS}`)
    .eq("owner_id", ownerId)
    .eq("zalo_self", selfId)
    .not("zalo_uid", "is", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  return error ? [] : ((data ?? []) as SiblingZalo[]);
}

/** Ghi người nhận lên hợp đồng/album (chỉ khi khác cái đang lưu). */
async function saveTargets(
  ownerId: string,
  targets: Target[],
  source: RecipientSource,
  next: { uid: string; name: string | null; selfId: string }
): Promise<boolean> {
  const db = createAdminClient();
  let saved = false;
  for (const t of targets) {
    if (!shouldSave(source, t.row, next)) {
      if (t.row?.zalo_uid === next.uid && t.row?.zalo_self === next.selfId) saved = true;
      continue;
    }
    const { error } = await db
      .from(t.table)
      .update({ zalo_uid: next.uid, zalo_name: next.name, zalo_self: next.selfId })
      .eq("id", t.id)
      .eq("owner_id", ownerId);
    if (!error) saved = true;
  }
  return saved;
}

/** uid đã lưu không còn gửi được → xoá ở mọi chỗ đang lưu nó (cho tài khoản Zalo này). */
async function clearSaved(ownerId: string, uid: string, selfId: string, albumId: string | null | undefined) {
  const db = createAdminClient();
  const blank = { zalo_uid: null, zalo_name: null, zalo_self: null };
  await db.from("studio_contracts").update(blank).eq("owner_id", ownerId).eq("zalo_uid", uid).eq("zalo_self", selfId);
  if (albumId) await db.from("albums").update(blank).eq("id", albumId).eq("owner_id", ownerId).eq("zalo_uid", uid);
}

/**
 * Gửi một tin Zalo cho studio `ownerId`, tự chọn kênh (OA hay cá nhân) theo cấu
 * hình studio đã kết nối. Luôn ghi log vào zalo_messages (trừ khi log=false).
 *
 * Tin gửi KHÁCH qua kênh cá nhân có kèm contractId/albumId: dùng người nhận đã
 * nhớ trên hợp đồng/album (hoặc hợp đồng khác cùng SĐT) khi không có toUid, và
 * nhớ lại người studio vừa chọn tay — mọi chỗ gọi (nút bấm, autoNotify, cron)
 * đều được hưởng mà không phải sửa gì.
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
  let name: string | null | undefined = input.toName;

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
      const selfId = row.personal_self?.id ? String(row.personal_self.id) : null;
      const memory =
        input.audience === "client" && selfId && (input.contractId || input.albumId)
          ? await loadTargets(input.ownerId, input.contractId, input.albumId).catch(() => null)
          : null;

      const phone = input.toPhone || memory?.contractPhone || null;
      let pick = resolveRecipient({
        toUid: input.toUid,
        toName: input.toName,
        selfId,
        own: memory?.targets.map((t) => t.row) ?? [],
        phone,
      });
      // Bước 3 (hợp đồng khác cùng SĐT) chỉ tra khi hai bước đầu trống — một select.
      if (memory && selfId && pick.source === "phone" && normalizePhone(phone).length >= 9) {
        const siblings = await loadSiblings(input.ownerId, selfId, input.contractId).catch(() => []);
        pick = resolveRecipient({ toName: input.toName, selfId, siblings, phone });
      }

      const send = (target: { uid?: string | null; phone?: string | null }) =>
        sendPersonalText(session, target, input.body!, safeImageUrl(input.imageUrl));

      let r = await send({ uid: pick.uid, phone });
      // uid đã nhớ hỏng (khách đổi tài khoản, chặn studio…) → quên nó, thử lại theo SĐT đúng một lần.
      if (!r.ok && pick.uid && selfId && (pick.source === "saved" || pick.source === "sibling") && isRecipientError(r.error)) {
        await clearSaved(input.ownerId, pick.uid, selfId, input.albumId).catch(() => {});
        for (const t of memory?.targets ?? []) if (t.row?.zalo_uid === pick.uid) t.row = null;
        pick = { uid: null, name: input.toName ?? null, source: "phone" };
        r = phone ? await send({ phone }) : { ok: false, error: "recipient_not_found" };
      }

      uid = r.uid;
      name = pick.name;
      res = { ok: r.ok, error: r.error, imageError: r.imageError, uid: r.uid ?? null, name: pick.name };
      if (r.ok && r.uid && memory && selfId) {
        res.saved = await saveTargets(input.ownerId, memory.targets, pick.source, {
          uid: r.uid,
          name: pick.name ?? null,
          selfId,
        }).catch(() => false);
      }
    }
  }

  await logMessage({ ...input, toName: name ?? null }, row, res, uid);
  return res;
}
