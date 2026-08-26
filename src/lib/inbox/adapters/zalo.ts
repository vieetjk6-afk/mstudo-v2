import "server-only";
import crypto from "crypto";
import { loadZalo, readPersonalSession } from "@/lib/zalo/config";
import { getValidOAToken, sendOAText } from "@/lib/zalo/oa";
import { sendPersonalText } from "@/lib/zalo/personal";
import type { ChannelRow } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════════════
   ZALO — hai kênh, hai cách gửi, nhưng cùng lấy thông tin đăng nhập từ bảng
   `studio_zalo` đã có sẵn (studio nối Zalo một lần, dùng cho cả nhắc lịch tự
   động lẫn hộp thư này). Vì vậy `inbox_channels.secret` của Zalo để trống.

   • OA: tin CS (openapi.zalo.me) — chỉ gửi được trong 48 giờ kể từ tương tác
     cuối của khách. Cửa sổ đó do platforms.ts canh trước khi tới đây.
   • Cá nhân: zca-js khôi phục phiên từ cookie rồi gọi API — GỬI thì không cần
     giữ tiến trình sống, chỉ NHẬN mới cần (xem scripts/zalo-inbox-worker.mjs).
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Kiểm chữ ký webhook của Zalo OA.
 *
 * Zalo ký bằng SHA-256 của chuỗi nối: appId + data + timestamp + OASecretKey,
 * gửi kèm trong header `X-ZEvent-Signature` dạng "mac=<hex>". Giống Meta, đây
 * là hàng rào duy nhất giữa hộp thư của studio và bất kỳ ai biết URL webhook.
 */
export function verifyZaloSignature(
  rawBody: string,
  header: string | null,
  appId: string,
  oaSecret: string,
  timestamp: string | null
): boolean {
  if (!header || !appId || !oaSecret || !timestamp) return false;
  const mac = header.startsWith("mac=") ? header.slice(4) : header;
  const expected = crypto
    .createHash("sha256")
    .update(`${appId}${rawBody}${timestamp}${oaSecret}`)
    .digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Gửi tin cho khách qua Zalo OA (tin CS). */
export async function sendZaloOAText(
  channel: ChannelRow,
  userId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const row = await loadZalo(channel.owner_id);
  if (!row) return { ok: false, error: "zalo_not_connected" };
  return sendOAText(row, userId, text);
}

/**
 * Tên + ảnh của người đang nhắn OA. Webhook Zalo chỉ đưa `sender.id`, nên phải
 * hỏi thêm — nhưng KHÔNG bắt buộc: hỏng thì hội thoại vẫn chạy với tên mặc định.
 */
export async function fetchZaloOAProfile(
  ownerId: string,
  userId: string
): Promise<{ name: string | null; avatarUrl: string | null }> {
  try {
    const row = await loadZalo(ownerId);
    if (!row) return { name: null, avatarUrl: null };
    const token = await getValidOAToken(row);
    if (!token) return { name: null, avatarUrl: null };
    const url = `https://openapi.zalo.me/v3.0/oa/user/detail?data=${encodeURIComponent(
      JSON.stringify({ user_id: userId })
    )}`;
    const json: any = await fetch(url, { headers: { access_token: token }, cache: "no-store" }).then((r) => r.json());
    const d = json?.data;
    if (!d) return { name: null, avatarUrl: null };
    return { name: d.display_name ?? null, avatarUrl: d.avatar ?? null };
  } catch {
    return { name: null, avatarUrl: null };
  }
}

/** Gửi tin cho khách qua tài khoản Zalo cá nhân của studio. */
export async function sendZaloPersonal(
  channel: ChannelRow,
  uid: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const row = await loadZalo(channel.owner_id);
  const session = readPersonalSession(row);
  if (!session) return { ok: false, error: "zalo_personal_not_connected" };
  const res = await sendPersonalText(session, { uid }, text);
  return { ok: res.ok, error: res.error };
}
