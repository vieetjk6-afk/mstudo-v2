import "server-only";
import { signOAuthState, verifyOAuthState } from "@/lib/oauth-state";
import { autoEventsOnConnect, loadZalo, saveZalo, type ZaloRow } from "./config";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Zalo Official Account (chính thống). Dùng chung MỘT Zalo App của nền tảng
 * (app_id/secret do bạn tạo ở developers.zalo.me), nhưng MỖI studio tự cấp quyền
 * OA CỦA HỌ qua OAuth → ta lưu access/refresh token RIÊNG cho từng studio.
 *
 * Gửi tin:
 *   • ZNS (business.openapi.zalo.me/message/template) — theo template đã duyệt,
 *     tới BẤT KỲ số điện thoại nào có Zalo (khách không cần follow OA). Tính phí.
 *   • Tin OA CS (openapi.zalo.me/v3.0/oa/message/cs) — tin văn bản tới user đã
 *     tương tác OA trong cửa sổ cho phép (dùng cho thợ đã follow OA).
 */

const APP_ID = process.env.ZALO_OA_APP_ID || "";
const APP_SECRET = process.env.ZALO_OA_APP_SECRET || "";
const REDIRECT = process.env.ZALO_OA_REDIRECT_URI || "";

const OAUTH_BASE = "https://oauth.zaloapp.com/v4/oa";
const ZNS_URL = "https://business.openapi.zalo.me/message/template";
const CS_URL = "https://openapi.zalo.me/v3.0/oa/message/cs";

export function oaConfigured(): boolean {
  return !!(APP_ID && APP_SECRET && REDIRECT);
}

/** URL đưa chủ studio sang Zalo để cấp quyền OA (state ký HMAC = ownerId). */
export function oaAuthUrl(ownerId: string): string {
  const state = signOAuthState(`zalo-oa:${ownerId}`);
  const p = new URLSearchParams({ app_id: APP_ID, redirect_uri: REDIRECT, state });
  return `${OAUTH_BASE}/permission?${p.toString()}`;
}

export function ownerFromState(state: string | null | undefined): string | null {
  const payload = verifyOAuthState(state);
  if (!payload || !payload.startsWith("zalo-oa:")) return null;
  return payload.slice("zalo-oa:".length) || null;
}

type TokenResp = { access_token?: string; refresh_token?: string; expires_in?: string | number; error?: any; message?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResp> {
  const res = await fetch(`${OAUTH_BASE}/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", secret_key: APP_SECRET },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });
  return (await res.json()) as TokenResp;
}

async function persistTokens(ownerId: string, t: TokenResp, oaId?: string | null, displayName?: string | null) {
  if (!t.access_token) throw new Error(t.message || "no_access_token");
  const expiresIn = Number(t.expires_in) || 90000; // Zalo OA access token ~ 25h
  await saveZalo(ownerId, {
    channel: "oa",
    status: "connected",
    oa_access_token: t.access_token,
    oa_refresh_token: t.refresh_token || null,
    oa_access_expires_at: new Date(Date.now() + (expiresIn - 300) * 1000).toISOString(),
    oa_id: oaId ?? undefined,
    display_name: displayName ?? undefined,
    last_error: null,
    connected_at: new Date().toISOString(),
  } as Partial<ZaloRow>);
}

/** Đổi `code` (callback) lấy token và lưu; sau đó nạp hồ sơ OA để lấy tên/oa_id. */
export async function connectOA(ownerId: string, code: string): Promise<void> {
  const before = await loadZalo(ownerId);
  const t = await tokenRequest({ code, app_id: APP_ID, grant_type: "authorization_code" });
  await persistTokens(ownerId, t);
  // Kết nối lần đầu thì mồi sẵn ba mốc an toàn — xem DEFAULT_AUTO_EVENTS.
  await saveZalo(ownerId, { auto_events: autoEventsOnConnect(before?.auto_events) });
  // Lấy thông tin OA để hiển thị (không chặn nếu lỗi).
  try {
    const info = await fetch("https://openapi.zalo.me/v2.0/oa/getoa", {
      headers: { access_token: t.access_token! },
      cache: "no-store",
    }).then((r) => r.json());
    const data = info?.data;
    if (data) await saveZalo(ownerId, { oa_id: String(data.oa_id ?? ""), display_name: data.name ?? null });
  } catch {
    /* bỏ qua — vẫn coi là đã kết nối */
  }
}

/** Trả access token còn hạn (tự refresh nếu sắp/đã hết hạn). */
export async function getValidOAToken(row: ZaloRow): Promise<string | null> {
  const notExpired =
    row.oa_access_token &&
    row.oa_access_expires_at &&
    new Date(row.oa_access_expires_at).getTime() > Date.now();
  if (notExpired) return row.oa_access_token;
  if (!row.oa_refresh_token) return row.oa_access_token; // hết cách refresh → dùng tạm (có thể lỗi)
  try {
    const t = await tokenRequest({
      refresh_token: row.oa_refresh_token,
      app_id: APP_ID,
      grant_type: "refresh_token",
    });
    await persistTokens(row.owner_id, t, row.oa_id, row.display_name);
    return t.access_token || null;
  } catch {
    await saveZalo(row.owner_id, { status: "expired", last_error: "refresh_failed" });
    return null;
  }
}

function toZaloPhone(phone: string): string {
  const digits = (phone || "").replace(/[^\d]/g, "");
  if (digits.startsWith("84")) return digits;
  if (digits.startsWith("0")) return `84${digits.slice(1)}`;
  return digits;
}

/** Gửi ZNS theo template đã duyệt tới một SĐT. */
export async function sendZNS(
  row: ZaloRow,
  phone: string,
  templateId: string,
  templateData: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const token = await getValidOAToken(row);
  if (!token) return { ok: false, error: "no_oa_token" };
  try {
    const res = await fetch(ZNS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: token },
      body: JSON.stringify({ phone: toZaloPhone(phone), template_id: templateId, template_data: templateData }),
      cache: "no-store",
    });
    const json: any = await res.json();
    if (json?.error === 0 || json?.error === undefined) return { ok: true };
    return { ok: false, error: json?.message || `zns_error_${json?.error}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "zns_request_failed" };
  }
}

/** Gửi tin OA văn bản (CS) tới một user đã tương tác OA (theo user_id). */
export async function sendOAText(
  row: ZaloRow,
  userId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const token = await getValidOAToken(row);
  if (!token) return { ok: false, error: "no_oa_token" };
  try {
    const res = await fetch(CS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: token },
      body: JSON.stringify({ recipient: { user_id: userId }, message: { text } }),
      cache: "no-store",
    });
    const json: any = await res.json();
    if (json?.error === 0 || json?.error === undefined) return { ok: true };
    return { ok: false, error: json?.message || `oa_cs_error_${json?.error}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "oa_cs_request_failed" };
  }
}
