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
  constructor(code: string) {
    super(code);
    this.code = code;
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
};

export function errorText(e: unknown): string {
  const code = e instanceof CollageApiError ? e.code : "";
  return MSG[code] ?? "Không kết nối được máy chủ — bạn kiểm tra mạng rồi thử lại.";
}

const headers = (c: Cred): Record<string, string> => ({
  ...(c.key ? { "x-collage-key": c.key } : {}),
  ...(c.access ? { "x-album-access": c.access } : {}),
});

async function json<T>(res: Response): Promise<T> {
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new CollageApiError((d as { error?: string }).error || (res.status === 429 ? "rate_limited" : `http_${res.status}`));
  return d as T;
}

export async function fetchPhotos(c: Cred): Promise<{ photos: PhotoLite[]; cats: PhotoCat[]; info: Record<string, PhotoInfo> }> {
  const res = await fetch(`/api/album/${c.slug}/collage/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: c.key, access: c.access }),
  });
  return json(res);
}

export async function fetchSets(c: Cred): Promise<SavedSet[]> {
  const res = await fetch(`/api/album/${c.slug}/collage`, { headers: headers(c), cache: "no-store" });
  return (await json<{ sets: SavedSet[] }>(res)).sets ?? [];
}

export async function saveSet(c: Cred, body: { id: string | null; title: string; doc: CollageDoc }): Promise<{ id: string; updatedAt: string; expiresAt: string }> {
  const res = await fetch(`/api/album/${c.slug}/collage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, key: c.key, access: c.access }),
  });
  return json(res);
}

export async function deleteSet(c: Cred, id: string): Promise<void> {
  const res = await fetch(`/api/album/${c.slug}/collage?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: headers(c) });
  await json(res);
}
