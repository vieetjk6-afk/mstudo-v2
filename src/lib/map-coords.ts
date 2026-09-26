/* ─────────────────────────────────────────────────────────────────────────────
   TOẠ ĐỘ từ link Google Maps / chuỗi "lat,lng" — dùng chung cho form khách
   (LocationPicker, chạy ở trình duyệt) và API lưu form (server).

   Không import gì: file phải chạy được ở cả client lẫn server.
   ───────────────────────────────────────────────────────────────────────────── */

export type Coords = { lat: number; lng: number };

/**
 * Link Google Maps mở đúng toạ độ (studio/thợ bấm là có chỉ đường).
 *
 * Dùng dạng "Maps URLs" chính thức (`/maps/search/?api=1&query=`) — dạng DUY
 * NHẤT Google cam kết mở được ở mọi nơi: trình duyệt, app Google Maps Android
 * VÀ iOS. Dạng cũ `google.com/maps?q=lat,lng` bị app Google Maps trên iPhone
 * chặn với lỗi "Liên kết không được hỗ trợ" khi bấm từ app khác (Zalo, mstudo).
 */
export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Link mở thẳng chế độ CHỈ ĐƯỜNG tới toạ độ (cùng chuẩn Maps URLs). */
export function directionsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * Toạ độ hợp lệ: là SỐ thật, trong phạm vi, và không phải (0,0).
 *
 * Phải kiểm kiểu chứ không `Number(v)`: `Number(null)` và `Number("")` đều ra 0,
 * từng biến mọi link rút gọn khách dán (lat/lng = null) thành "0,0" — một điểm
 * giữa Đại Tây Dương — và làm mất luôn link thật. (0,0) cũng là giá trị rác khi
 * thiết bị chưa bắt được GPS, không ai tổ chức cưới ở đó.
 */
export function validCoords(lat: unknown, lng: unknown): Coords | null {
  const toNum = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
  const a = toNum(lat);
  const b = toNum(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  if (Math.abs(a) < 1e-6 && Math.abs(b) < 1e-6) return null;
  return { lat: a, lng: b };
}

/**
 * Trích toạ độ từ link Google Maps (nhiều định dạng) hoặc chuỗi "lat,lng".
 * Ưu tiên `!3d…!4d…` (toạ độ CHÍNH XÁC của địa điểm) hơn `@lat,lng` (chỉ là
 * tâm khung nhìn bản đồ lúc copy, có thể lệch vài trăm mét).
 */
export function parseLatLng(input: string): Coords | null {
  let s = (input || "").trim();
  if (!s) return null;
  try {
    s = decodeURIComponent(s);
  } catch {
    /* giữ nguyên nếu không giải mã được */
  }
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // ...!3d10.77!4d106.70
    /[?&](?:q|ll|query|destination|daddr|center|sll)=(?:loc:)?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i, // ?q=10.77,106.70
    /\/(?:search|place|dir)\/(?:[^/]*\/)?(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)/, // /search/10.77,+106.70
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // .../@10.77,106.70,15z
    /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/, // dán thẳng "10.762, 106.660"
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const c = validCoords(parseFloat(m[1]), parseFloat(m[2]));
      if (c) return c;
    }
  }
  return null;
}

/** Link Google Maps rút gọn (maps.app.goo.gl/…) — phải nhờ server mở ra mới có toạ độ. */
export function isShortMapsUrl(input: string): boolean {
  try {
    const u = new URL((input || "").trim());
    const h = u.hostname.toLowerCase();
    return (h === "maps.app.goo.gl" || h === "goo.gl" || h === "maps.google.app.goo.gl") && u.pathname.length > 1;
  } catch {
    return false;
  }
}
