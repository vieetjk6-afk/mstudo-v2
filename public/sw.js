// mstudo Web Push service worker.
// Receives push events and shows a notification, even when the app/tab is closed.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "mstudo", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "mstudo";
  const options = {
    body: data.body || "",
    icon: data.icon || "/logo-mark.svg",
    badge: "/favicon.svg",
    tag: data.tag || undefined,
    data: { url: data.url || "/dashboard/studio/notifications" },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard/studio/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab if one is open, otherwise open a new one.
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// ---------------------------------------------------------------------------
// Offline support. Conservative on purpose: this is a data-driven app, so we
// never cache API responses or dynamic HTML (that would serve stale data).
// We only (a) cache-first the immutable build assets for instant repeat loads,
// and (b) network-first navigations with an offline fallback page.
// ---------------------------------------------------------------------------
// Bumped to v2: drop the old cache-first behaviour for build assets that could
// pin stale app code. We now only keep an offline fallback page.
//
// v3 — ỨNG DỤNG KHÁCH. Hai ngoại lệ được thêm vào, chỉ cho các TRANG CỦA KHÁCH
// (album chọn ảnh, album giao khách, cổng hợp đồng). Khách chọn ảnh trên điện
// thoại, ngồi lâu, mạng chập chờn — và nay cài trang album lên màn hình chính
// như một app; mở app ra mà thấy "Mất kết nối mạng" thì app đó vô dụng.
//
//   1. Ảnh (`/api/img?id=…&w=…`): cache-first. Địa chỉ ảnh gắn theo file id +
//      chiều rộng nên trên thực tế là bất biến. KHÔNG làm mới ngầm: album vài
//      nghìn ảnh mà cứ xem là gọi lại thì đốt hạn mức, đúng cái bẫy vòng poll 5
//      giây trước đây đã sa vào. Studio thay file trên Drive giữ nguyên id là
//      trường hợp hiếm; đường thoát là tăng số phiên bản IMG_CACHE.
//   2. HTML trang khách: network-first, nhưng bản tải THÀNH CÔNG được giữ lại để
//      lần mất mạng sau còn cái mà mở. Lựa chọn ảnh nhúng trong HTML đó có thể
//      cũ — không sao, sổ trên máy (@/lib/album-offline) hoà giải theo từng ảnh
//      nên thay đổi khách chưa gửi lên KHÔNG bị bản HTML cũ đè.
//
// Mọi đường dẫn khác giữ nguyên như trước: không cache API, không cache HTML khu
// quản lý (studio phải luôn thấy số liệu thật).
const CACHE = "mstudo-v3";
const IMG_CACHE = "mstudo-img-v1";
const PAGE_CACHE = "mstudo-page-v1";
const KEEP = [CACHE, IMG_CACHE, PAGE_CACHE];

const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/logo-mark.svg", "/favicon.svg"];

// Trần số ảnh giữ lại. ~600 ảnh cỡ thumbnail ≈ 25–30 MB: đủ cho một album giao
// khách bình thường, và không ăn hết hạn mức lưu trữ của điện thoại khi album có
// vài nghìn tấm (lúc đó phần xem gần nhất được giữ, phần cũ bị dọn).
const IMG_MAX = 600;
const PAGE_MAX = 12;

/** Trang của KHÁCH — nơi được phép giữ lại HTML để mở khi mất mạng. */
function isClientPage(pathname) {
  return (
    /^\/a\/[^/]+\/?$/.test(pathname) ||
    /^\/album\/[^/]+\/?$/.test(pathname) ||
    /^\/portal\/[^/]+\/?$/.test(pathname) ||
    /^\/c\/[^/]+\/?$/.test(pathname)
  );
}

/** Dọn bớt cache khi vượt trần. `cache.keys()` trả theo thứ tự đưa vào → bỏ từ đầu. */
async function trim(name, max) {
  try {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (keys.length <= max) return;
    await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
  } catch {
    /* hết quota / bị chặn — chỉ mất phần dọn dẹp */
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Ảnh đã xem rồi thì lấy ngay từ máy, chưa có thì tải và giữ lại. */
async function imageFirst(req) {
  try {
    const cache = await caches.open(IMG_CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    // Chỉ giữ ảnh thật: /api/img trả JSON lỗi khi thiếu quyền hoặc file đã xoá,
    // giữ lại bản đó là đóng đinh một ô ảnh trắng cho khách.
    if (res && res.ok && (res.headers.get("content-type") || "").startsWith("image/")) {
      await cache.put(req, res.clone());
      trim(IMG_CACHE, IMG_MAX);
    }
    return res;
  } catch (err) {
    const cache = await caches.open(IMG_CACHE).catch(() => null);
    const hit = cache && (await cache.match(req));
    if (hit) return hit;
    throw err;
  }
}

/** Trang khách: mạng trước (dữ liệu luôn mới), mất mạng thì mở bản đã lưu. */
async function clientPage(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(req, res.clone());
      trim(PAGE_CACHE, PAGE_MAX);
    }
    return res;
  } catch (err) {
    const cache = await caches.open(PAGE_CACHE).catch(() => null);
    const hit = cache && (await cache.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    const fallback = await caches.match(OFFLINE_URL);
    return fallback || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (Supabase, Google)

  // Ảnh của album — ngoại lệ duy nhất trong /api/.
  if (url.pathname === "/api/img") {
    event.respondWith(imageFirst(req));
    return;
  }
  if (url.pathname.startsWith("/api/")) return; // never cache API

  // Build assets are content-hashed and served with immutable cache headers, so
  // we let the browser's HTTP cache handle them. We do NOT cache them in the SW
  // anymore — caching them risked pinning an old app build.

  // Page navigations: network-first so data is always fresh; fall back to the
  // offline page only when the network is unreachable.
  if (req.mode === "navigate") {
    if (isClientPage(url.pathname)) {
      event.respondWith(clientPage(req));
      return;
    }
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error()))
    );
  }
});
