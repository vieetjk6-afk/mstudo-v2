/**
 * ĐỌC BYTE ẢNH QUA MÁY MEDIA Ở NHÀ — và lùi về Vercel khi máy đó không trả lời.
 *
 * Vì sao: mỗi lượt đọc BYTE ảnh (`/api/img?…&raw=1` — watermark khi tải về,
 * xuất album in, nén ảnh, quét AI) là byte chảy qua Vercel và tính vào Fast
 * Origin Transfer. Máy ở nhà chạy đúng route /api/img đó, ra Internet qua
 * Cloudflare Tunnel ở NEXT_PUBLIC_MEDIA_ORIGIN (vd https://media.mstudo.com),
 * nên trình duyệt hỏi máy đó TRƯỚC.
 *
 * Quy tắc an toàn — máy ở nhà là thứ có thể tắt bất cứ lúc nào (mất điện, mất
 * mạng, đang cập nhật), nên:
 *   • chỉ ĐỔI ĐỊA CHỈ những URL cùng miền `/api/img` có `raw=1`. Route đó không
 *     đọc cookie, không phân quyền — chỉ tải ảnh Drive công khai theo id — nên
 *     gọi khác miền không mất gì (xem deploy/home-server/HUONG-DAN.md, mục CORS).
 *   • lỗi mạng / quá 8 giây chưa có phản hồi / mã lỗi → thử lại ĐÚNG URL cũ
 *     cùng miền. Người dùng chỉ thấy chậm hơn một nhịp, không thấy hỏng.
 *   • máy media đã hỏng một lần thì nghỉ hỏi nó 2 phút: quét AI 300 ảnh mà mỗi
 *     ảnh đều chờ 8 giây là 40 phút đứng hình.
 *   • NEXT_PUBLIC_MEDIA_ORIGIN trống → mọi hàm ở đây cư xử y hệt code cũ.
 *
 * Phần THUẦN (normalizeMediaOrigin, mediaBytePath, mediaCandidates) không đụng
 * tới trình duyệt — desktop/test/media-origin.mjs nạp thẳng để kiểm.
 */

/** Chờ máy media trả HEADER tối đa bấy nhiêu; thân ảnh tải bao lâu cũng được. */
export const MEDIA_CONNECT_TIMEOUT_MS = 8_000;
/** Máy media hỏng thì nghỉ hỏi bấy nhiêu lâu trước khi thử lại. */
export const MEDIA_COOLDOWN_MS = 2 * 60_000;

/**
 * Chuẩn hoá giá trị biến môi trường thành một origin (`https://host[:port]`),
 * hoặc "" nếu trống/sai dạng. Dán vào ô biến môi trường của Vercel rất dễ kèm
 * khoảng trắng hay dấu `/` cuối — đừng để một ký tự thừa làm hỏng mọi URL.
 */
export function normalizeMediaOrigin(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    return u.origin;
  } catch {
    return "";
  }
}

/**
 * Nếu `url` là một lượt đọc byte CÙNG MIỀN của /api/img (có raw=1) thì trả về
 * phần `/api/img?…` của nó; không thì null. `pageOrigin` là origin của trang
 * (location.origin) — URL tuyệt đối của chính trang này cũng tính là cùng miền.
 *
 * KHÔNG đổi: ảnh hiển thị (không raw=1 → /api/img chỉ 302 sang Google, không
 * byte nào qua Vercel), `dl=1` (302 sang Drive), mọi route khác.
 */
export function mediaBytePath(url: string, pageOrigin?: string): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url, pageOrigin || "http://cung-mien.invalid");
  } catch {
    return null;
  }
  const sameOrigin = url.startsWith("/") ? !url.startsWith("//") : !!pageOrigin && u.origin === pageOrigin;
  if (!sameOrigin) return null;
  if (u.pathname !== "/api/img") return null;
  if (u.searchParams.get("raw") !== "1" || u.searchParams.get("dl") === "1") return null;
  return u.pathname + u.search;
}

/**
 * Danh sách URL thử theo thứ tự: máy media trước, URL gốc cùng miền sau.
 * Chỉ một phần tử khi không có máy media, URL không thuộc diện đổi, hoặc trang
 * đang chạy NGAY TRÊN máy media.
 */
export function mediaCandidates(url: string, mediaOrigin: string, pageOrigin?: string): string[] {
  const origin = normalizeMediaOrigin(mediaOrigin);
  if (!origin || origin === pageOrigin) return [url];
  const path = mediaBytePath(url, pageOrigin);
  return path ? [origin + path, url] : [url];
}

/* ── Phần chạy trong trình duyệt ─────────────────────────────────────────── */

/** NEXT_PUBLIC_* được Next nhúng thẳng vào bundle lúc build. */
export function mediaOrigin(): string {
  return normalizeMediaOrigin(process.env.NEXT_PUBLIC_MEDIA_ORIGIN);
}

let downUntil = 0;
function mediaResting(): boolean {
  return Date.now() < downUntil;
}
function markMediaDown(): void {
  downUntil = Date.now() + MEDIA_COOLDOWN_MS;
}

function pageOrigin(): string | undefined {
  return typeof location !== "undefined" ? location.origin : undefined;
}

/**
 * fetch() một URL ảnh, đi qua máy media khi được. Trả về Response như fetch()
 * thường; thân của lượt qua máy media đã được đọc trọn (để đứt giữa chừng cũng
 * còn kịp lùi về cùng miền).
 */
export async function fetchMediaBytes(url: string, init?: RequestInit): Promise<Response> {
  const cands = mediaCandidates(url, mediaOrigin(), pageOrigin());
  if (cands.length === 1 || mediaResting()) return fetch(url, init);

  const callerSignal = init?.signal ?? undefined;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  callerSignal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => ctrl.abort(), MEDIA_CONNECT_TIMEOUT_MS);
  try {
    // credentials: "omit" — /api/img không cần cookie, và đừng gửi cookie phiên
    // `.mstudo.com` sang một máy chủ không cần nó.
    const res = await fetch(cands[0], { ...init, mode: "cors", credentials: "omit", signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const body = await res.blob();
      // Chỉ giữ Content-Type: thân đã giải nén rồi, chép nguyên bộ header (kèm
      // content-encoding/length cũ) là nói dối về chính cái thân này.
      const ct = res.headers.get("content-type");
      return new Response(body, { status: res.status, headers: ct ? { "content-type": ct } : undefined });
    }
    // 502 của /api/img = Google không trả ảnh; cùng miền nhiều khả năng cũng
    // vậy nhưng vẫn thử. Mã khác (404 của bản build cũ, 5xx của Cloudflare khi
    // tunnel đứt) = máy media có vấn đề → nghỉ hỏi nó một lúc.
    if (res.status !== 502) markMediaDown();
  } catch {
    clearTimeout(timer);
    if (callerSignal?.aborted) throw new DOMException("Aborted", "AbortError");
    markMediaDown();
  } finally {
    callerSignal?.removeEventListener("abort", onAbort);
  }
  return fetch(url, init);
}

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Nạp ảnh để VẼ LÊN CANVAS (watermark, xuất album). Có máy media thì tải byte
 * từ đó bằng fetch (có hạn chờ — thẻ <img> không có), rồi dựng ảnh từ blob URL
 * cùng miền nên canvas không bị "tainted". Hỏng → đúng đường cũ: <img
 * crossOrigin> trỏ thẳng URL cùng miền.
 */
export async function loadMediaImage(url: string): Promise<HTMLImageElement> {
  const cands = mediaCandidates(url, mediaOrigin(), pageOrigin());
  if (cands.length > 1 && !mediaResting()) {
    try {
      const res = await fetchMediaBytes(url);
      if (res.ok) {
        const blobUrl = URL.createObjectURL(await res.blob());
        try {
          return await loadImageEl(blobUrl);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      }
    } catch {
      /* lùi về đường cũ ngay dưới */
    }
  }
  return loadImageEl(url);
}

/**
 * URL máy media cho một thẻ <img> hiển thị (khung xem ảnh hỏng → thử byte),
 * hoặc null khi không có máy media / URL không thuộc diện / máy đang nghỉ.
 * Thẻ <img> không có hạn chờ, nhưng khi tunnel đứt Cloudflare trả lỗi ngay
 * (530/1033) nên onError tới nhanh và người gọi lùi về cùng miền.
 */
export function mediaImgSrc(url: string): string | null {
  if (mediaResting()) return null;
  const cands = mediaCandidates(url, mediaOrigin(), pageOrigin());
  return cands.length > 1 ? cands[0] : null;
}

/**
 * Danh sách nguồn cho ZoomHiRes: chèn bản máy media ngay TRƯỚC URL raw=1 cùng
 * miền. Cố ý không xét "máy đang nghỉ": ZoomHiRes dò danh sách theo chỉ số, nên
 * danh sách phải giữ nguyên giữa các lần render.
 */
export function withMediaFirst(srcs: string[], origin: string = mediaOrigin()): string[] {
  return srcs.flatMap((s) => mediaCandidates(s, origin, pageOrigin()));
}
