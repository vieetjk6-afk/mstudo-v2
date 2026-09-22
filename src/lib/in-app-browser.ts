/**
 * Nhận diện TRÌNH DUYỆT TRONG ỨNG DỤNG (in-app browser).
 *
 * Khách bấm link album từ Zalo / Messenger là trang mở trong webview của chính
 * app đó chứ không phải Safari/Chrome. Webview này thiếu đúng những thứ album
 * cần nhất: tải ảnh về máy, "Thêm vào màn hình chính" (PWA), đăng nhập Google,
 * đôi khi cả trình phát video.
 *
 * KHÔNG có cách nào để trang web TỰ nhảy ra trình duyệt trên iPhone: webview do
 * app chủ quản lý, web không có API nào bắt iOS mở Safari (và không nên tự nhảy
 * kể cả khi làm được — iOS hiện hộp lỗi "Cannot open page" nếu app không hiểu).
 * Thứ gần nhất là lược đồ riêng `x-safari-https://`: gặp lược đồ lạ, webview
 * thường chuyển cho hệ thống và iOS giao việc mở cho Safari. Nó chỉ chạy khi có
 * CỬ CHỈ của khách (bấm nút) và không phải app/phiên bản nào cũng chịu → luôn
 * kèm đường lùi: hướng dẫn menu ⋯ + copy link.
 *
 * Android dễ hơn hẳn: `intent://…#Intent;scheme=https;…;end` mở đúng trình
 * duyệt mặc định, và `S.browser_fallback_url` lo nốt trường hợp máy không hiểu.
 */

export type InAppApp = "zalo" | "messenger" | "facebook" | "instagram" | "tiktok" | "line" | "other";
export type MobileOs = "ios" | "android" | "other";

export interface InAppBrowser {
  app: InAppApp;
  os: MobileOs;
}

/** Tên app hiện cho khách đọc. */
export function inAppName(app: InAppApp): string {
  switch (app) {
    case "zalo": return "Zalo";
    case "messenger": return "Messenger";
    case "facebook": return "Facebook";
    case "instagram": return "Instagram";
    case "tiktok": return "TikTok";
    case "line": return "LINE";
    default: return "ứng dụng";
  }
}

/** Trình duyệt thật của máy — đích ta muốn đẩy khách sang. */
export function nativeBrowserName(os: MobileOs): string {
  return os === "ios" ? "Safari" : os === "android" ? "Chrome" : "trình duyệt";
}

/**
 * `null` = đang ở trình duyệt thật (hoặc không phải điện thoại) → không làm phiền.
 *
 * `standalone`: trang đang chạy dạng app đã thêm vào màn hình chính. Phải truyền
 * vào vì UA của PWA trên iOS cũng KHÔNG có chuỗi "Safari/" y như webview —
 * thiếu cờ này là banner hiện nhầm ngay trong app khách đã cài.
 */
export function detectInAppBrowser(
  ua: string,
  opts: { standalone?: boolean } = {},
): InAppBrowser | null {
  if (!ua || opts.standalone) return null;

  const isIos = /iphone|ipod|ipad/i.test(ua);
  const isAndroid = /android/i.test(ua);
  if (!isIos && !isAndroid) return null; // máy tính: link mở thẳng ở trình duyệt
  const os: MobileOs = isIos ? "ios" : "android";

  // Nhận diện theo dấu hiệu RIÊNG của từng app trước — chắc chắn nhất.
  if (/\bzalo/i.test(ua)) return { app: "zalo", os };
  if (/messenger|orca-android|FB_IAB\/MESSENGER/i.test(ua)) return { app: "messenger", os };
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) return { app: "facebook", os };
  if (/instagram/i.test(ua)) return { app: "instagram", os };
  if (/musical_ly|bytedance|tiktok/i.test(ua)) return { app: "tiktok", os };
  if (/\bline\//i.test(ua)) return { app: "line", os };

  // Webview chung của các app khác (app ngân hàng, ví điện tử, mail…).
  // iOS: mọi trình duyệt thật đều để lại "Safari/", "CriOS/", "FxIOS/"… trong UA.
  if (isIos && !/safari\//i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua)) {
    return { app: "other", os };
  }
  // Android: webview nhúng tự khai bằng token "; wv".
  if (isAndroid && /;\s*wv[;)]/i.test(ua)) return { app: "other", os };

  return null;
}

/**
 * Link để nhảy ra trình duyệt thật, hoặc `null` khi hệ điều hành không có đường
 * nào. Phải gọi TỪ CỬ CHỈ của khách (trong handler của nút bấm).
 */
export function browserEscapeUrl(url: string, os: MobileOs): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  // iOS: lược đồ riêng của Safari. Webview không hiểu → giao cho hệ thống.
  if (os === "ios") return `x-safari-${u.protocol === "https:" ? "https" : "http"}://${u.host}${u.pathname}${u.search}`;

  // Android: intent hệ thống. Bỏ phần #hash của link gốc vì `#Intent;…` chính là
  // chỗ Android đọc tham số — nhét hash vào là hỏng cả chuỗi.
  if (os === "android") {
    const scheme = u.protocol.replace(":", "");
    const fallback = encodeURIComponent(`${u.origin}${u.pathname}${u.search}`);
    return (
      `intent://${u.host}${u.pathname}${u.search}` +
      `#Intent;scheme=${scheme};action=android.intent.action.VIEW;` +
      `S.browser_fallback_url=${fallback};end`
    );
  }

  return null;
}

/** Các bước khách tự làm khi nút bấm không ăn (menu mỗi app mỗi khác nên nói gọn). */
export function openInBrowserSteps(b: InAppBrowser, lang: "vi" | "en" = "vi"): string[] {
  const app = inAppName(b.app);
  const browser = nativeBrowserName(b.os);
  if (lang === "en") {
    return b.os === "ios"
      ? [`Tap the ⋯ button in the ${app} bar`, `Choose “Open in ${browser}”`]
      : [`Tap the ⋮ button in the ${app} bar`, `Choose “Open in browser” / “Open in ${browser}”`];
  }
  return b.os === "ios"
    ? [`Bấm nút ⋯ trên thanh ${app}`, `Chọn “Mở trong ${browser}” / “Mở bằng trình duyệt”`]
    : [`Bấm nút ⋮ trên thanh ${app}`, `Chọn “Mở bằng trình duyệt” / “Mở trong ${browser}”`];
}
