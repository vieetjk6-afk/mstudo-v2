import "server-only";

/**
 * Lấy byte ảnh từ Google Drive.
 *
 * Tách riêng khỏi `/api/img` để `/api/img/watermark` dùng chung — trước đây hai
 * nơi cùng cần logic "thử lần lượt vài endpoint của Google", và chép đôi thì
 * sớm muộn cũng lệch nhau.
 */

// User-Agent của trình duyệt thật — một vài endpoint của Google từ chối UA lạ.
export const DRIVE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Ảnh của một file Drive ở một bề rộng cho trước không bao giờ đổi → cache cứng. */
export const DRIVE_CACHE_OK =
  "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400, immutable";
/** Đừng ghim lỗi lâu — file có thể vừa được chia sẻ công khai xong. */
export const DRIVE_CACHE_ERR = "public, max-age=0, s-maxage=60";

async function tryFetch(url: string, timeoutMs: number): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: { "User-Agent": DRIVE_UA },
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok || !ct.startsWith("image/")) return null;
    const len = Number(res.headers.get("content-length") || "0");
    if (len && len < 100) return null; // quá nhỏ = ảnh giữ chỗ, thử nguồn khác
    return res;
  } catch {
    return null;
  }
}

/** Lấy ảnh ở một bề rộng cụ thể, thử lần lượt các endpoint của Google. */
export async function fetchDriveImage(id: string, width: number): Promise<Response | null> {
  const thumb = `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;
  const lh3 = `https://lh3.googleusercontent.com/d/${id}=w${width}`;
  const dl = `https://drive.usercontent.google.com/download?id=${id}&export=view`;
  // Endpoint thumbnail dựng được cả ảnh lẫn khung hình video; lh3 cho chất
  // lượng tốt hơn ở các bề rộng lớn.
  const sources =
    width <= 1024
      ? [thumb, lh3, dl]
      : [lh3, thumb, dl, `https://drive.google.com/uc?export=download&id=${id}`];

  for (const url of sources) {
    const res = await tryFetch(url, 7000);
    if (res) return res;
  }
  return null;
}

/** Lấy file GỐC full-resolution (không thu nhỏ). Timeout dài hơn vì file to. */
export async function fetchDriveOriginal(id: string): Promise<Response | null> {
  const sources = [
    `https://lh3.googleusercontent.com/d/${id}=s0`, // s0 = kích thước gốc
    `https://drive.usercontent.google.com/download?id=${id}&export=download`,
    `https://drive.google.com/uc?export=download&id=${id}`,
  ];
  for (const url of sources) {
    const res = await tryFetch(url, 25000);
    if (res) return res;
  }
  return null;
}
