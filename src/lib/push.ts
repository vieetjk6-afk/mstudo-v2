import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { motThietBiMoiNguoi } from "@/lib/push-chon-thiet-bi";

// VAPID keys — set on Vercel. The public key is also exposed to the client as
// NEXT_PUBLIC_VAPID_PUBLIC_KEY for subscribing.
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:hello@mstudo.com";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
};

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };
/** Như SubRow nhưng kèm cột để chọn "mỗi người một thiết bị". */
type SubRowChon = SubRow & { user_id: string; created_at: string | null };

/** Kết quả gửi tới MỘT thiết bị. `service` là tên dịch vụ push, không phải URL
 *  đầy đủ — endpoint là bí mật của thiết bị đó, đừng ghi ra log hay trả về UI. */
export type PushResult = {
  service: string;
  ok: boolean;
  /** Mã HTTP của dịch vụ push khi gửi hỏng (403 = sai khoá VAPID, 410 = đã huỷ…). */
  statusCode?: number;
  message?: string;
  /** Đăng ký đã chết và vừa bị xoá khỏi bảng. */
  pruned?: boolean;
};

/** VAPID đã cấu hình chưa. Dùng cho màn chẩn đoán — thiếu khoá thì mọi lệnh gửi
 *  đều lặng lẽ không làm gì, và đó là thứ đầu tiên cần loại trừ. */
export function pushConfigured(): boolean {
  return ensureConfigured();
}

/** Tên dịch vụ push từ endpoint, để hiện cho người dùng mà không lộ endpoint. */
function serviceOf(endpoint: string): string {
  try {
    const h = new URL(endpoint).hostname;
    if (/googleapis|google/i.test(h)) return "Chrome / Android";
    if (/mozilla/i.test(h)) return "Firefox";
    if (/apple/i.test(h)) return "Safari / iPhone";
    if (/windows/i.test(h)) return "Windows";
    return h;
  } catch {
    return "không rõ";
  }
}

/**
 * Gửi payload tới một danh sách subscription, tự dọn subscription đã chết.
 *
 * Trả về CHI TIẾT từng thiết bị chứ không chỉ đếm số: trước đây hàm này nuốt
 * sạch mọi lỗi trừ 404/410, nên một khoá VAPID sai (403) hay một payload quá to
 * (413) biểu hiện y hệt "không có thiết bị nào" — studio bảo "không nhận được
 * thông báo" mà log không có lấy một dòng. Giờ mọi lỗi đều ghi log, và màn
 * "Gửi thử" ở trang Thông báo đọc được đúng danh sách này.
 */
async function deliver(subs: SubRow[], payload: PushPayload): Promise<PushResult[]> {
  if (subs.length === 0) return [];
  const db = createAdminClient();
  const body = JSON.stringify(payload);
  return Promise.all(
    subs.map(async (s): Promise<PushResult> => {
      const service = serviceOf(s.endpoint);
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        return { service, ok: true };
      } catch (err: unknown) {
        const e = err as { statusCode?: number; body?: string; message?: string };
        const code = e?.statusCode;
        // 404/410 = subscription expired/unsubscribed → remove it.
        const pruned = code === 404 || code === 410;
        if (pruned) await db.from("push_subscriptions").delete().eq("id", s.id);
        else console.error(`[push] ${service} trả ${code ?? "?"}: ${e?.body || e?.message || "lỗi không rõ"}`);
        return { service, ok: false, statusCode: code, message: e?.body || e?.message, pruned };
      }
    })
  );
}

/** Gửi tới đúng một danh sách subscription đã biết (dùng cho màn "Gửi thử"). */
export async function sendPushToSubscriptions(subs: SubRow[], payload: PushPayload): Promise<PushResult[]> {
  if (!ensureConfigured()) return [];
  return deliver(subs, payload);
}

/**
 * Gửi thông báo đẩy cho studio: MỖI NGƯỜI trong studio đúng MỘT tin.
 *
 * Không gửi tới mọi đăng ký nữa. Một người bật thông báo ở nhiều chỗ (Safari,
 * app đã thêm vào màn hình chính, máy tính, hay cài lại app) là mỗi chỗ một
 * đăng ký, và trình duyệt chỉ gộp được tin trong CÙNG một đăng ký — nên studio
 * nhận hai ba tin liên tiếp cho cùng một việc. Chọn đăng ký mới nhất của từng
 * tài khoản (xem @/lib/push-chon-thiet-bi) thì mỗi người nhận đúng một tin, trên
 * thiết bị họ bật thông báo gần đây nhất.
 *
 * Chưa cấu hình VAPID thì lặng lẽ không làm gì — tạo thông báo không được phép
 * hỏng chỉ vì push chưa bật. Đăng ký chết (404/410) tự bị dọn khi gửi.
 */
export async function sendPushToOwner(ownerId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  const db = createAdminClient();
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id, created_at")
    .eq("owner_id", ownerId);

  await deliver(motThietBiMoiNguoi((subs ?? []) as SubRowChon[]), payload);
}

/**
 * Gửi push tới NHIỀU chủ studio cùng lúc (dùng cho thông báo hệ thống). Lấy toàn
 * bộ subscription trong một truy vấn thay vì mỗi owner một truy vấn. Trả về số
 * thiết bị đã gửi thành công. No-op nếu chưa cấu hình VAPID.
 */
export async function sendPushToOwners(ownerIds: string[], payload: PushPayload): Promise<number> {
  if (!ensureConfigured() || ownerIds.length === 0) return 0;

  const db = createAdminClient();
  let total = 0;
  // Chia lô owner_id để câu IN không quá dài.
  const CHUNK = 200;
  for (let i = 0; i < ownerIds.length; i += CHUNK) {
    const ids = ownerIds.slice(i, i + CHUNK);
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id, created_at")
      .in("owner_id", ids);
    // Cùng luật "mỗi người một tin" như sendPushToOwner — thông báo hệ thống mà
    // nhân đôi nhân ba thì còn khó chịu hơn, vì nó tới cùng lúc cho mọi studio.
    total += (await deliver(motThietBiMoiNguoi((subs ?? []) as SubRowChon[]), payload)).filter((r) => r.ok).length;
  }
  return total;
}
