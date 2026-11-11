"use client";

import type { CollageDoc } from "@/lib/collage/types";
import type { PhotoCat, PhotoInfo } from "@/lib/collage/categories";

/* Gọi các route /api/album/[slug]/collage/* — gom một chỗ để mọi lỗi "vé hết
   hiệu lực" (need_verify) đi về đúng một đường: hỏi lại SĐT. */

export interface Cred {
  slug: string;
  key: string | null;
  access?: string;
}

export interface PhotoLite {
  id: string;
  /** drive_file_id */
  d: string;
  /** source_id */
  s: string | null;
}

export interface SavedSet {
  id: string;
  title: string;
  data: CollageDoc;
  updated_at: string;
  expires_at: string;
}

export class CollageApiError extends Error {
  code: string;
  /** Lượt gọi nào hỏng ("photos", "sets"…) — hiện kèm mã lỗi cho dễ dò. */
  op: string;
  constructor(code: string, op = "") {
    super(code);
    this.code = code;
    this.op = op;
  }
}

const MSG: Record<string, string> = {
  not_enabled: "Album này chưa mở tính năng ghép ảnh. Bạn liên hệ studio nhé.",
  not_found: "Không tìm thấy album.",
  wrong_password: "Phiên xem album đã hết hạn — tải lại trang, nhập lại mật khẩu rồi thử lại.",
  not_ready: "Studio chưa cập nhật hệ thống cho tính năng ghép ảnh. Bạn liên hệ studio nhé.",
  too_many_sets: "Album đã có nhiều bộ ảnh ghép đang lưu — xoá bớt một bộ cũ rồi tạo bộ mới.",
  bad_photo: "Có ảnh không còn trong album (studio vừa cập nhật ảnh). Bỏ ảnh đó ra rồi thử lại.",
  rate_limited: "Bạn thao tác nhanh quá — đợi ít giây rồi thử lại.",
  too_large: "Bộ ảnh ghép quá lớn — bớt trang hoặc bớt chữ rồi thử lại.",
  timeout: "Máy chủ phản hồi chậm quá — bạn bấm Thử lại nhé.",
};

export function errorText(e: unknown): string {
  const code = e instanceof CollageApiError ? e.code : "";
  return MSG[code] ?? "Không kết nối được máy chủ — bạn kiểm tra mạng rồi thử lại.";
}

/** Mã lỗi ngắn ("photos · timeout") — hiện nhỏ dưới thông báo để khách chụp màn hình gửi studio. */
export function errorCode(e: unknown): string {
  if (e instanceof CollageApiError) return [e.op, e.code].filter(Boolean).join(" · ");
  return e instanceof Error ? e.name : "unknown";
}

/** Lỗi do máy chủ / mạng tạm thời (thử lại có thể được) — khác lỗi quyền / cấu hình. */
export function isTransient(e: unknown): boolean {
  if (!(e instanceof CollageApiError)) return true;
  return ["timeout", "network", "rate_limited", "bad_response"].includes(e.code) || /^http_5\d\d$/.test(e.code);
}

/* Mọi lượt gọi đều có HẠN GIỜ — tính cả lúc đọc thân phản hồi. fetch() của
   trình duyệt không tự bỏ cuộc: máy chủ treo là vòng quay "Đang mở album…" đứng
   mãi (lỗi thật, 11/2026). Hết giờ → CollageApiError("timeout") để màn ghép báo
   lỗi kèm nút thử lại, hoặc chạy tiếp bằng phần đã có. */
const TIMEOUT = { photos: 20_000, sets: 12_000, save: 20_000, del: 15_000 } as const;

const headers = (c: Cred): Record<string, string> => ({
  ...(c.key ? { "x-collage-key": c.key } : {}),
  ...(c.access ? { "x-album-access": c.access } : {}),
});

async function request<T>(op: keyof typeof TIMEOUT, url: string, init: RequestInit): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT[op]);
  try {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: ctl.signal });
    } catch {
      throw new CollageApiError(ctl.signal.aborted ? "timeout" : "network", op);
    }
    let d: unknown = null;
    try {
      d = await res.json();
    } catch {
      if (ctl.signal.aborted) throw new CollageApiError("timeout", op);
    }
    const err = (d as { error?: unknown } | null)?.error;
    if (!res.ok) throw new CollageApiError(typeof err === "string" && err ? err : res.status === 429 ? "rate_limited" : `http_${res.status}`, op);
    // 200 mà thân không phải JSON (trang lỗi của proxy / CDN chen giữa) — đừng coi là "không có ảnh".
    if (!d || typeof d !== "object") throw new CollageApiError("bad_response", op);
    return d as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface PhotosPayload {
  photos: PhotoLite[];
  cats: PhotoCat[];
  info: Record<string, PhotoInfo>;
  /** Máy chủ hết giờ giữa chừng phần gợi ý — nhóm ảnh có thể thiếu. */
  partial?: boolean;
}

export async function fetchPhotos(c: Cred): Promise<PhotosPayload> {
  const d = await request<Partial<PhotosPayload>>("photos", `/api/album/${c.slug}/collage/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: c.key, access: c.access }),
  });
  if (!Array.isArray(d.photos)) throw new CollageApiError("bad_response", "photos");
  return { photos: d.photos, cats: Array.isArray(d.cats) ? d.cats : [], info: d.info && typeof d.info === "object" ? d.info : {}, partial: !!d.partial };
}

export async function fetchSets(c: Cred): Promise<SavedSet[]> {
  const d = await request<{ sets?: SavedSet[] }>("sets", `/api/album/${c.slug}/collage`, { headers: headers(c), cache: "no-store" });
  return Array.isArray(d.sets) ? d.sets : [];
}

export function saveSet(c: Cred, body: { id: string | null; title: string; doc: CollageDoc }): Promise<{ id: string; updatedAt: string; expiresAt: string }> {
  return request("save", `/api/album/${c.slug}/collage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, key: c.key, access: c.access }),
  });
}

export async function deleteSet(c: Cred, id: string): Promise<void> {
  await request("del", `/api/album/${c.slug}/collage?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: headers(c) });
}
