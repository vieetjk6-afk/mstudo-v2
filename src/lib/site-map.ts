/* ─────────────────────────────────────────────────────────────────────────────
   Khối BẢN ĐỒ của website studio.

   Studio thường mở Google Maps, bấm "Chia sẻ" rồi dán link vào. Link đó có rất
   nhiều dạng khác nhau và KHÔNG nhúng trực tiếp được vào iframe, nên ở đây ta
   bóc toạ độ / từ khoá ra rồi dựng lại URL nhúng chuẩn.

   Các dạng đọc được:
     • Mã nhúng <iframe src="https://www.google.com/maps/embed?pb=…">
     • https://www.google.com/maps/embed?pb=…                (dùng nguyên)
     • https://www.google.com/maps/place/Tên/@10.77,106.70,17z/data=…!3d…!4d…
     • https://www.google.com/maps/search/?api=1&query=10.77,106.70
     • https://www.google.com/maps?q=…  /  ?ll=…  /  ?daddr=…
     • https://maps.app.goo.gl/… , https://goo.gl/maps/…     (link rút gọn —
       phải nhờ server mở ra link đầy đủ trước, xem /api/maps/resolve)
     • "10.7769, 106.7009"                                   (toạ độ dán tay)
     • Địa chỉ chữ thường ("24 Lê Lợi, Quận 1, TP.HCM")
   ───────────────────────────────────────────────────────────────────────────── */

const DEFAULT_ZOOM = 16;

/** Host của link Google Maps rút gọn — cần server mở ra mới biết vị trí thật. */
const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "maps.google.app.goo.gl"]);

/** Host được phép dùng làm src của iframe (chặn nhúng nội dung lạ). */
const EMBED_HOSTS = new Set(["www.google.com", "google.com", "maps.google.com"]);

const clean = (v: unknown) => String(v ?? "").trim();

function parseUrl(raw: string): URL | null {
  const s = clean(raw);
  if (!s) return null;
  try {
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
}

/** Link rút gọn của Google Maps (chưa nhúng được, cần mở ra link đầy đủ). */
export function isShortMapLink(raw: string): boolean {
  const u = parseUrl(raw);
  if (!u) return false;
  return SHORT_HOSTS.has(u.hostname.toLowerCase()) && u.pathname.length > 1;
}

/** Có phải người dùng đang dán một đường link (thay vì địa chỉ chữ) không. */
export function looksLikeUrl(raw: string): boolean {
  const s = clean(raw);
  return /^https?:\/\//i.test(s) || /^(www\.|maps\.)[a-z0-9-]+\./i.test(s) || /<iframe/i.test(s);
}

/** Toạ độ "lat,lng" dán tay. */
function parseLatLng(raw: string): { lat: number; lng: number } | null {
  const m = clean(raw).match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Lấy src từ mã nhúng <iframe …> nếu studio dán cả đoạn mã. */
function iframeSrc(raw: string): string | null {
  const m = clean(raw).match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

/** Mức phóng đọc được từ link (…,17z hoặc &z=17). */
function zoomOf(u: URL): number {
  const at = u.pathname.match(/@-?[\d.]+,-?[\d.]+,([\d.]+)z/);
  if (at) {
    const z = Math.round(Number(at[1]));
    if (Number.isFinite(z) && z >= 1 && z <= 21) return z;
  }
  const q = u.searchParams.get("z") || u.searchParams.get("zoom");
  if (q) {
    const z = Math.round(Number(q));
    if (Number.isFinite(z) && z >= 1 && z <= 21) return z;
  }
  return DEFAULT_ZOOM;
}

type MapTarget =
  | { kind: "embed"; src: string }
  | { kind: "coords"; lat: number; lng: number; zoom: number; label?: string }
  | { kind: "query"; q: string };

/**
 * Bóc vị trí từ dữ liệu studio nhập (link, mã nhúng, toạ độ hoặc địa chỉ chữ).
 * Trả về null nếu là link rút gọn chưa mở ra được, hoặc không nhận dạng nổi.
 */
export function parseMapInput(raw: string): MapTarget | null {
  const input = clean(raw);
  if (!input) return null;

  // 1) Mã nhúng dán nguyên đoạn → lấy src rồi xử lý tiếp như một URL.
  const fromIframe = iframeSrc(input);
  if (fromIframe) return parseMapInput(fromIframe);

  // 2) Toạ độ dán tay.
  const ll = parseLatLng(input);
  if (ll) return { kind: "coords", lat: ll.lat, lng: ll.lng, zoom: DEFAULT_ZOOM };

  // 3) Không phải link → coi là địa chỉ chữ.
  if (!looksLikeUrl(input)) return { kind: "query", q: input };

  const u = parseUrl(input);
  if (!u) return { kind: "query", q: input };

  // 4) Link rút gọn: chưa biết vị trí, phải gọi /api/maps/resolve trước.
  if (isShortMapLink(u.href)) return null;

  const host = u.hostname.toLowerCase();
  const path = decodeURIComponent(u.pathname);

  // 5) URL nhúng sẵn của Google (…/maps/embed?pb=…) → dùng nguyên.
  if (EMBED_HOSTS.has(host) && /^\/maps\/embed/.test(u.pathname)) {
    return { kind: "embed", src: u.href };
  }

  // Chỉ tin các host của Google cho những dạng bên dưới.
  if (!EMBED_HOSTS.has(host) && !host.endsWith(".google.com")) {
    return { kind: "query", q: input };
  }

  const zoom = zoomOf(u);
  // Tên địa điểm trong /maps/place/<tên>/… — dùng làm nhãn cho ghim.
  const placeName = path.match(/\/maps\/place\/([^/@]+)/)?.[1]?.replace(/\+/g, " ").trim();

  // 6) Toạ độ CHÍNH XÁC của địa điểm nằm ở !3d<lat>!4d<lng> trong phần data=…
  //    (khác với @lat,lng — đó chỉ là tâm khung nhìn khi chụp link).
  const d34 = (u.href.match(/!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/) ??
    u.href.match(/!8m2!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/));
  if (d34) {
    return { kind: "coords", lat: Number(d34[1]), lng: Number(d34[2]), zoom, label: placeName };
  }

  // 7) @lat,lng trong đường dẫn.
  const at = u.pathname.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (at) {
    return { kind: "coords", lat: Number(at[1]), lng: Number(at[2]), zoom, label: placeName };
  }

  // 8) Tham số truy vấn thường gặp.
  for (const key of ["q", "query", "daddr", "ll", "center", "sll", "destination"]) {
    const v = u.searchParams.get(key);
    if (!v) continue;
    const c = parseLatLng(v);
    if (c) return { kind: "coords", lat: c.lat, lng: c.lng, zoom };
    return { kind: "query", q: v };
  }

  // 9) Chỉ có tên địa điểm trong đường dẫn.
  if (placeName) return { kind: "query", q: placeName };

  return null;
}

/**
 * URL để nhúng vào iframe bản đồ. `fallbackAddress` dùng khi studio chỉ nhập
 * địa chỉ chữ (giữ nguyên cách hoạt động cũ của khối bản đồ).
 */
export function mapEmbedSrc(input: string, fallbackAddress = ""): string | null {
  const target = parseMapInput(input) ?? parseMapInput(fallbackAddress);
  if (!target) return null;
  if (target.kind === "embed") return target.src;
  if (target.kind === "coords") {
    // Dạng q=lat,lng(Nhãn): ghim ĐÚNG toạ độ, kèm tên địa điểm nếu đọc được.
    // Dấu phẩy và ngoặc để nguyên (đúng cú pháp Google), chỉ mã hoá phần nhãn.
    const label = target.label ? `(${encodeURIComponent(target.label)})` : "";
    return `https://www.google.com/maps?q=${target.lat},${target.lng}${label}&z=${target.zoom}&hl=vi&output=embed`;
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(target.q)}&hl=vi&output=embed`;
}

/** Link mở Google Maps trong tab mới (nút "Chỉ đường"). */
export function mapOpenHref(input: string, fallbackAddress = ""): string | null {
  const raw = clean(input);
  // Link gốc của studio mở đúng nhất — kể cả link rút gọn. Chỉ nhận link Google
  // (khỏi biến nút "Chỉ đường" thành link đi đâu đó khác).
  if (raw && looksLikeUrl(raw) && !iframeSrc(raw)) {
    const u = parseUrl(raw);
    const host = u?.hostname.toLowerCase() ?? "";
    const isGoogle = SHORT_HOSTS.has(host) || EMBED_HOSTS.has(host) || host.endsWith(".google.com");
    if (u && u.protocol === "https:" && isGoogle) return u.href;
  }
  const target = parseMapInput(raw) ?? parseMapInput(fallbackAddress);
  if (!target) return null;
  // Dạng Maps URLs (`search/?api=1`) — dạng `maps?q=` bị app Google Maps trên
  // iPhone từ chối ("Liên kết không được hỗ trợ").
  if (target.kind === "coords") return `https://www.google.com/maps/search/?api=1&query=${target.lat},${target.lng}`;
  if (target.kind === "query") return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target.q)}`;
  return null;
}
