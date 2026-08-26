import "server-only";
import { imageDims } from "./image";
import type { PersonalSession } from "./config";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Kênh Zalo CÁ NHÂN qua thư viện KHÔNG chính thức `zca-js` (mô phỏng Zalo Web).
 *
 * ⚠️ RỦI RO: tự động hoá tài khoản cá nhân VI PHẠM điều khoản Zalo và có thể bị
 *    KHOÁ tài khoản. UI phải cảnh báo studio trước khi bật. Chỉ nên dùng để nhắn
 *    cho người ĐÃ là bạn bè (khách/thợ đã kết bạn).
 *
 * ⚠️ HẠ TẦNG: đăng nhập QR cần giữ tiến trình sống trong lúc quét (route đặt
 *    maxDuration cao). Việc GỬI thì khôi phục phiên từ cookie đã lưu rồi gọi API
 *    (không cần giữ websocket). Toàn bộ phụ thuộc zca-js CÔ LẬP trong file này.
 *
 * zca-js là optionalDependency + đánh dấu serverComponentsExternalPackages (không
 * bundle, trace vào serverless). API dùng theo zca-js v2 (đã đối chiếu type defs).
 */

async function loadZca(): Promise<any | null> {
  try {
    return await import("zca-js");
  } catch {
    return null;
  }
}

function makeZalo(mod: any): any {
  const Zalo = mod.Zalo || mod.default?.Zalo || mod.default;
  return new Zalo({ checkUpdate: false, logging: false });
}

/** zca-js đã được cài trên máy chủ chưa? */
export async function personalAvailable(): Promise<boolean> {
  return (await loadZca()) !== null;
}

/**
 * Đăng nhập bằng QR. `onQR` được gọi với chuỗi ảnh QR (data URL hoặc base64) để
 * hiển thị cho studio quét. `onScanned` (tuỳ chọn) báo khi khách đã quét. Promise
 * resolve khi đăng nhập hoàn tất (đã nhận thông tin phiên).
 */
export async function loginPersonalQR(
  onQR: (image: string) => void,
  onScanned?: (info: { display_name?: string; avatar?: string }) => void
): Promise<{ session: PersonalSession; self: { id: string; name?: string; avatar?: string } | null }> {
  const mod = await loadZca();
  if (!mod) throw new Error("zca_js_not_installed");
  const EventType = mod.LoginQRCallbackEventType ?? {
    QRCodeGenerated: 0,
    QRCodeExpired: 1,
    QRCodeScanned: 2,
    QRCodeDeclined: 3,
    GotLoginInfo: 4,
  };
  const zalo = makeZalo(mod);

  // Holder object: các trường được gán TRONG closure callback. Dùng object (thay
  // vì biến let) để TypeScript nới lại kiểu property sau await, không thu hẹp về null.
  const captured: {
    creds: PersonalSession | null;
    scanned: { display_name?: string; avatar?: string } | null;
  } = { creds: null, scanned: null };

  const api = await zalo.loginQR(undefined, (event: any) => {
    switch (event?.type) {
      case EventType.QRCodeGenerated:
        if (event.data?.image) onQR(String(event.data.image));
        break;
      case EventType.QRCodeScanned:
        captured.scanned = { display_name: event.data?.display_name, avatar: event.data?.avatar };
        onScanned?.(captured.scanned);
        break;
      case EventType.GotLoginInfo:
        if (event.data) {
          captured.creds = {
            cookie: event.data.cookie,
            imei: event.data.imei,
            userAgent: event.data.userAgent,
          };
        }
        break;
      default:
        break;
    }
  });

  if (!captured.creds) throw new Error("no_session_after_login");
  let id = "";
  try {
    id = api?.getOwnId ? String(api.getOwnId()) : "";
  } catch {
    /* bỏ qua */
  }
  const self = { id, name: captured.scanned?.display_name, avatar: captured.scanned?.avatar };
  return { session: captured.creds, self };
}

/**
 * Chuẩn hoá SĐT về dạng Zalo hiểu được: bỏ ký tự thừa; số VN bắt đầu bằng "0"
 * → "84…". findUser của zca-js chỉ tự đổi 0→84 khi ngôn ngữ tài khoản là "vi",
 * nên ta tự đổi trước để không phụ thuộc cấu hình ngôn ngữ.
 */
function normalizeZaloPhone(phone: string): string {
  let d = (phone || "").replace(/[^\d]/g, "");
  if (d.startsWith("0")) d = "84" + d.slice(1);
  return d;
}

/** Tìm uid theo SĐT; ném lỗi có thông điệp nếu Zalo trả lỗi khác "không tìm thấy". */
async function findUid(api: any, phone: string): Promise<string | null> {
  const found = await api.findUser(normalizeZaloPhone(phone));
  return String(found?.uid ?? "") || null;
}

/** Dò uid trong danh sách BẠN BÈ theo SĐT (bạn bè có kèm phoneNumber trong API,
 *  nên gửi được kể cả khi họ TẮT "cho phép tìm bằng SĐT"). */
async function findUidInFriends(api: any, phone: string): Promise<string | null> {
  try {
    const norm = normalizeZaloPhone(phone);
    if (!norm) return null;
    const friends = await api.getAllFriends(1000, 1);
    const hit = (friends || []).find(
      (u: any) => u?.phoneNumber && normalizeZaloPhone(String(u.phoneNumber)) === norm
    );
    return hit ? String(hit.userId ?? "") || null : null;
  } catch {
    return null;
  }
}

/** Liệt kê bạn bè Zalo của tài khoản studio (để chọn tay người nhận). */
export async function listFriends(
  session: PersonalSession
): Promise<Array<{ uid: string; name: string; avatar: string }>> {
  const { api } = await apiFromSession(session);
  const friends = await api.getAllFriends(1000, 1);
  return (friends || [])
    .map((u: any) => ({
      uid: String(u?.userId ?? ""),
      name: u?.displayName || u?.zaloName || u?.username || "(không tên)",
      avatar: u?.avatar || "",
    }))
    .filter((f: { uid: string }) => f.uid);
}

/** Khôi phục instance api từ phiên đã lưu. */
async function apiFromSession(session: PersonalSession): Promise<any> {
  const mod = await loadZca();
  if (!mod) throw new Error("zca_js_not_installed");
  const zalo = makeZalo(mod);
  const api = await zalo.login({
    cookie: session.cookie,
    imei: session.imei,
    userAgent: session.userAgent,
  });
  return { api, ThreadType: mod.ThreadType ?? { User: 0 } };
}

/** Tối đa 4MB cho ảnh đính kèm — mã QR chỉ vài chục KB, vượt xa là bất thường. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

type ImageAttachment = {
  data: Buffer;
  filename: `${string}.${string}`;
  metadata: { totalSize: number; width: number; height: number };
};

/**
 * Tải ảnh về BỘ NHỚ rồi đóng gói đúng dạng zca-js cần.
 *
 * Vì sao là buffer chứ không phải tệp tạm: đưa đường dẫn tệp thì zca-js đòi
 * `imageMetadataGetter` (thư viện đo kích thước ảnh do người dùng tự cắm) để
 * lấy width/height, không có là ném lỗi ngay — đó chính là lý do bản đầu chỉ
 * gửi được link. Tự đo kích thước rồi đưa buffer kèm metadata thì không cần
 * thư viện nào, cũng không đụng tới đĩa.
 *
 * Tải hỏng / quá nặng / không đọc được kích thước thì trả `error` để người gọi
 * còn nói được vì sao thiếu ảnh; khi đó tin vẫn gửi dạng văn bản (link ảnh đã
 * nằm sẵn trong nội dung).
 */
async function fetchImageAttachment(
  url: string
): Promise<{ attachment: ImageAttachment } | { error: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: "no-store" });
    if (!res.ok) return { error: `http_${res.status}` };
    const data = Buffer.from(await res.arrayBuffer());
    if (!data.length) return { error: "empty" };
    if (data.length > MAX_IMAGE_BYTES) return { error: "too_large" };
    const dims = imageDims(data);
    if (!dims) return { error: "unreadable_image" };
    return {
      attachment: {
        data,
        filename: `qr.${dims.ext}`,
        metadata: { totalSize: data.length, width: dims.width, height: dims.height },
      },
    };
  } catch (e: any) {
    return { error: e?.name === "AbortError" ? "timeout" : e?.message || "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gửi tin văn bản tới một người. `target.uid` nếu biết, hoặc `target.phone`
 * (tự tìm uid — chỉ được nếu người đó tìm thấy/đã kết bạn).
 *
 * `imageUrl` (tuỳ chọn) được tải về rồi đính kèm vào chính tin đó — dùng cho mã
 * QR thanh toán. Đính kèm hỏng thì LÙI về gửi văn bản, vì tin nhắc thanh toán
 * đến được khách vẫn hơn là không gửi gì — nhưng trả kèm `imageError` để giao
 * diện nói thẳng "đã gửi, thiếu ảnh QR" thay vì im lặng như không có gì.
 */
export async function sendPersonalText(
  session: PersonalSession,
  target: { uid?: string | null; phone?: string | null },
  text: string,
  imageUrl?: string | null
): Promise<{ ok: boolean; uid?: string; error?: string; imageError?: string }> {
  let api: any;
  let ThreadType: any;
  try {
    ({ api, ThreadType } = await apiFromSession(session));
  } catch (e: any) {
    return { ok: false, error: e?.message || "login_failed" };
  }

  let uid = target.uid || null;
  if (!uid && target.phone) {
    // 1) Tra theo SĐT (chỉ được nếu người đó cho phép tìm bằng SĐT).
    try {
      uid = await findUid(api, target.phone);
    } catch {
      uid = null;
    }
    // 2) Fallback: dò trong danh sách BẠN BÈ theo SĐT (gửi được dù tắt tìm-bằng-SĐT).
    if (!uid) uid = await findUidInFriends(api, target.phone);
  }
  if (!uid) return { ok: false, error: "recipient_not_found" };

  let imageError: string | undefined;
  if (imageUrl) {
    const img = await fetchImageAttachment(imageUrl);
    if ("attachment" in img) {
      try {
        await api.sendMessage({ msg: text, attachments: [img.attachment] }, uid, ThreadType.User);
        return { ok: true, uid };
      } catch (e: any) {
        imageError = e?.message || "attach_failed";
      }
    } else {
      imageError = img.error;
    }
  }

  try {
    await api.sendMessage({ msg: text }, uid, ThreadType.User);
    return { ok: true, uid, imageError };
  } catch (e: any) {
    return { ok: false, error: e?.message || "personal_send_failed", imageError };
  }
}
