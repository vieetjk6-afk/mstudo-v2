"use client";

/**
 * KHÁCH TỰ QUÉT ALBUM TRÊN MÁY MÌNH — không cần studio quét trước.
 *
 * Luồng: máy chủ (/api/album/[slug]/face-kho) trả những ảnh ĐÃ có dữ liệu mà
 * khớp mặt khách, kèm danh sách ảnh CHƯA ai quét. Hàm này quét lần lượt những
 * tấm còn lại ngay trong trình duyệt (cùng mô hình với studio — @/lib/face-
 * embed-browser), báo từng tấm khớp NGAY khi thấy, và cứ vài chục tấm lại gửi
 * kết quả lên kho để khách sau khỏi quét lại.
 *
 * Tốn gì: CPU/pin máy khách; ảnh tải THẲNG từ Google khi được (không qua
 * Vercel). Dừng lúc nào cũng được — phần đã gửi lên không mất.
 */

import { maHoaManh, coMatKhop, NGUON_KHACH, type AnhKho } from "./face-kho";
import { laLoiVinhVien } from "./face-scan-core";

/** Gửi lên sau mỗi ngần này ảnh (route nhận tối đa 40). */
const GUI_SAU = 20;

export type KetQuaTim = { photoIds: string[]; chuaQuet: string[] };

/** Hỏi máy chủ: ảnh nào (đã có dữ liệu) có tôi, và còn ảnh nào chưa ai quét. */
export async function timTrenKho(slug: string, descriptor: number[], password = ""): Promise<KetQuaTim | { error: string }> {
  const res = await fetch(`/api/album/${encodeURIComponent(slug)}/face-kho`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ descriptor, password: password || undefined }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<KetQuaTim> & { error?: string };
  if (!res.ok || !Array.isArray(data.photoIds)) return { error: data.error || `http-${res.status}` };
  return { photoIds: data.photoIds, chuaQuet: Array.isArray(data.chuaQuet) ? data.chuaQuet : [] };
}

async function guiManh(slug: string, password: string, anh: AnhKho[]): Promise<void> {
  if (!anh.length) return;
  const body = maHoaManh({ nguon: NGUON_KHACH, anh });
  await fetch(`/api/album/${encodeURIComponent(slug)}/face-kho`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", ...(password ? { "x-album-password": password } : {}) },
    body: body as BodyInit,
    keepalive: body.length < 60_000,
  }).catch(() => {
    /* gửi hỏng: chỉ mất phần "để dành cho khách sau", khách này vẫn có kết quả */
  });
}

export type TienDoTuQuet = { daQuet: number; tong: number; khop: number };

/**
 * Quét những ảnh `ids` (chỉ những tấm có trong `driveIdOf` — tức là khách nhìn
 * thấy được). Trả về khi xong hoặc khi `signal` bị huỷ.
 */
export async function tuQuetAlbum(opts: {
  slug: string;
  password?: string;
  ids: readonly string[];
  driveIdOf: ReadonlyMap<string, string>;
  /** Vector khuôn mặt của khách. */
  toi: readonly number[];
  onKhop: (photoId: string) => void;
  onTienDo: (t: TienDoTuQuet) => void;
  signal: AbortSignal;
}): Promise<TienDoTuQuet> {
  const { slug, password = "", driveIdOf, toi, signal } = opts;
  const embed = await import("./face-embed-browser");
  const viec = opts.ids.filter((id) => driveIdOf.has(id));
  const t: TienDoTuQuet = { daQuet: 0, tong: viec.length, khop: 0 };
  opts.onTienDo({ ...t });
  const cho: AnhKho[] = [];

  const tai = (id: string) => embed.taiAnhQuet(driveIdOf.get(id)!, signal).catch(() => ({ bytes: null, lyDo: "mang-loi" }) as const);
  // Tải tấm kế tiếp trong lúc nhận diện tấm hiện tại.
  let tiepTheo = viec.length ? tai(viec[0]) : null;
  for (let k = 0; k < viec.length; k++) {
    if (signal.aborted) break;
    const id = viec[k];
    const kq = await tiepTheo!;
    tiepTheo = k + 1 < viec.length ? tai(viec[k + 1]) : null;
    if (signal.aborted) break;
    if (kq.bytes) {
      try {
        const faces = await embed.scanJpegBrowser(kq.bytes);
        cho.push({ photoId: id, faces: faces.map((f) => ({ box: [f.box.x, f.box.y, f.box.w, f.box.h], descriptor: f.descriptor, sharpness: f.sharpness })) });
        if (coMatKhop(cho[cho.length - 1].faces, toi)) {
          t.khop++;
          opts.onKhop(id);
        }
      } catch {
        /* ảnh hỏng — bỏ qua, không gửi */
      }
    } else if (laLoiVinhVien(kq.lyDo)) {
      // File đã xoá / không phải JPEG: ghi "0 mặt" để không ai phải thử lại.
      cho.push({ photoId: id, faces: [] });
    }
    t.daQuet++;
    opts.onTienDo({ ...t });
    if (cho.length >= GUI_SAU) await guiManh(slug, password, cho.splice(0));
    // Nhường luồng chính một nhịp để trang không đơ.
    await new Promise((r) => setTimeout(r, 0));
  }
  await guiManh(slug, password, cho.splice(0));
  return t;
}
