import "server-only";
import { signOAuthState, verifyOAuthState } from "@/lib/oauth-state";
import { packMetaSecret } from "./meta";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════════════
   NỐI FACEBOOK / INSTAGRAM BẰNG MỘT NÚT — OAuth cấp NỀN TẢNG.

   Trước đây mỗi studio phải tự: tạo Meta App → lấy App Secret → khai webhook →
   sinh Page Access Token → chép Page ID → dán vào MStudo → chờ Meta duyệt app
   của riêng họ. Bảy bước, trong đó có bước chờ vài ngày. Không chủ studio ảnh
   cưới nào làm nổi việc đó.

   Cách này giống hệt luồng Zalo OA đã có trong repo: MStudo sở hữu MỘT Meta App
   duy nhất và đi App Review MỘT LẦN cho cả nền tảng; studio chỉ bấm "Kết nối
   Facebook", chọn Trang của họ trong màn hình của chính Facebook, xong.

   Ba việc hệ thống tự làm sau khi studio bấm đồng ý:
     1. Đổi `code` lấy Page Access Token (loại KHÔNG hết hạn khi sinh từ token
        người dùng dài hạn).
     2. Gọi `POST /{page}/subscribed_apps` — nếu bỏ bước này thì token có mà
        webhook vẫn im, và đó là kiểu hỏng khó đoán nhất: mọi thứ "trông như đã
        nối" mà tin khách không bao giờ tới.
     3. Nối luôn tài khoản Instagram doanh nghiệp đã liên kết với Trang đó — tin
        nhắn IG dùng CHÍNH Page Access Token ấy, nên không có gì thêm để hỏi.

   Studio KHÔNG còn phải đụng tới: Meta App, App Secret, webhook, App Review.
   ═══════════════════════════════════════════════════════════════════════════ */

const GRAPH = process.env.META_GRAPH_BASE || "https://graph.facebook.com/v21.0";
const APP_ID = process.env.META_APP_ID || "";
const APP_SECRET = process.env.META_APP_SECRET || "";
const REDIRECT = process.env.META_REDIRECT_URI || "";
/** Tuỳ chọn: id cấu hình "Facebook Login for Business" (nếu đã dựng bên Meta). */
const CONFIG_ID = process.env.META_LOGIN_CONFIG_ID || "";

/**
 * Quyền xin của studio. Cố ý KHÔNG xin thừa: mỗi quyền dư là một câu hỏi thêm
 * lúc Meta duyệt app, và một dòng đáng sợ thêm trên màn hình đồng ý của studio.
 *   pages_show_list           — liệt kê Trang họ quản lý
 *   pages_messaging           — đọc & gửi tin nhắn của Trang
 *   pages_manage_metadata     — đăng ký webhook cho Trang (subscribed_apps)
 *   instagram_basic           — thấy tài khoản IG liên kết với Trang
 *   instagram_manage_messages — đọc & gửi DM Instagram
 */
const SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_manage_messages",
].join(",");

export function metaOAuthConfigured(): boolean {
  return !!(APP_ID && APP_SECRET && REDIRECT);
}

/** URL đưa chủ studio sang Facebook để chọn Trang và cấp quyền. */
export function metaAuthUrl(ownerId: string): string {
  const p = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT,
    // state ký HMAC + hạn 10 phút: state trần sẽ cho phép kẻ tấn công gắn Trang
    // CỦA MÌNH vào studio của nạn nhân (account-linking CSRF).
    state: signOAuthState(`meta:${ownerId}`),
    response_type: "code",
  });
  // Business Login (nếu đã dựng cấu hình) hiện màn chọn Trang gọn hơn nhiều so
  // với hộp thoại quyền cổ điển. Chưa dựng thì rơi về xin scope như thường.
  if (CONFIG_ID) p.set("config_id", CONFIG_ID);
  else p.set("scope", SCOPES);
  return `https://www.facebook.com/v21.0/dialog/oauth?${p.toString()}`;
}

export function ownerFromMetaState(state: string | null | undefined): string | null {
  const payload = verifyOAuthState(state);
  if (!payload || !payload.startsWith("meta:")) return null;
  return payload.slice("meta:".length) || null;
}

async function graph(path: string, params: Record<string, string>): Promise<any> {
  const url = `${GRAPH}${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `meta_${res.status}`);
  }
  return json;
}

/** Một Trang studio đã chọn, kèm tài khoản Instagram liên kết (nếu có). */
export interface GrantedPage {
  id: string;
  name: string;
  accessToken: string;
  instagram?: { id: string; username: string | null };
}

/**
 * Đổi `code` của callback lấy danh sách Trang studio ĐÃ CHỌN, kèm token.
 *
 * Chỉ trả về những Trang studio thực sự tích trong màn hình của Facebook —
 * `/me/accounts` sau Business Login chỉ liệt kê đúng chỗ họ đã cấp quyền. Nhờ
 * vậy ta nối được TẤT CẢ mà không sợ nối nhầm Trang họ không muốn, và không
 * phải dựng thêm một màn chọn Trang thứ hai của riêng mình.
 */
export async function exchangeCodeForPages(code: string): Promise<GrantedPage[]> {
  // 1) code → token người dùng (ngắn hạn).
  const short = await graph("/oauth/access_token", {
    client_id: APP_ID,
    client_secret: APP_SECRET,
    redirect_uri: REDIRECT,
    code,
  });
  const shortToken = String(short?.access_token || "");
  if (!shortToken) throw new Error("no_user_token");

  // 2) Đổi sang token DÀI HẠN. Bắt buộc: Page Access Token sinh từ token ngắn
  //    hạn cũng chỉ sống ~1 giờ, và studio sẽ thấy kênh tự chết sau bữa trưa.
  const long = await graph("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: APP_ID,
    client_secret: APP_SECRET,
    fb_exchange_token: shortToken,
  });
  const userToken = String(long?.access_token || shortToken);

  // 3) Các Trang studio quản lý + Page Access Token của từng Trang.
  const accounts = await graph("/me/accounts", {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "50",
    access_token: userToken,
  });

  const pages: GrantedPage[] = [];
  for (const p of accounts?.data ?? []) {
    const id = String(p?.id ?? "");
    const token = String(p?.access_token ?? "");
    if (!id || !token) continue;
    const ig = p?.instagram_business_account;
    pages.push({
      id,
      name: String(p?.name || "Trang Facebook"),
      accessToken: token,
      instagram: ig?.id ? { id: String(ig.id), username: ig.username ?? null } : undefined,
    });
  }
  return pages;
}

/**
 * Đăng ký webhook cho một Trang.
 *
 * Có token mà quên gọi cái này thì kênh "đã nối" nhưng tin khách không bao giờ
 * tới — hỏng im lặng, đúng kiểu tệ nhất. Vì vậy kết quả được trả về để phía gọi
 * ghi lại vào `last_error` thay vì nuốt.
 */
export async function subscribePageWebhook(
  pageId: string,
  pageToken: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps?${new URLSearchParams({
        subscribed_fields: "messages,messaging_postbacks",
        access_token: pageToken,
      }).toString()}`,
      { method: "POST", cache: "no-store" }
    );
    const json: any = await res.json().catch(() => null);
    if (!res.ok || json?.error) return { ok: false, error: json?.error?.message || `meta_${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "subscribe_failed" };
  }
}

/** Đóng gói Page Access Token để lưu (mã hoá) — dùng chung cho Facebook và IG. */
export function pageSecret(pageToken: string): string {
  return packMetaSecret(pageToken);
}
