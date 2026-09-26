import "server-only";
import type { IntakeLocation } from "@/lib/types";
import { isShortMapsUrl, mapsLink, parseLatLng, validCoords } from "@/lib/map-coords";
import { resolveShortMapUrl } from "@/lib/map-resolve";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Chuẩn hoá vị trí khách gửi trong form thông tin buổi chụp.
 *
 * Thứ tự ưu tiên:
 *   1. Toạ độ (ghim bản đồ / GPS) — phải là số thật, khác (0,0).
 *   2. Link khách dán: đọc toạ độ trong link; link RÚT GỌN thì server mở ra
 *      link đầy đủ rồi đọc → studio luôn nhận link `?q=lat,lng` mở đúng điểm.
 *   3. Không đọc được toạ độ → giữ NGUYÊN link khách dán (chỉ http/https, chống
 *      chèn javascript:) để studio vẫn bấm mở được.
 */
export async function normalizeIntakeLocation(v: any): Promise<IntakeLocation | null> {
  if (!v || typeof v !== "object") return null;
  const c = validCoords(v.lat, v.lng);
  if (c) return { lat: c.lat, lng: c.lng, mapUrl: mapsLink(c.lat, c.lng) };

  const url = typeof v.mapUrl === "string" ? v.mapUrl.trim().slice(0, 500) : "";
  if (!/^https?:\/\//i.test(url)) return null;
  return (await locationFromUrl(url)) ?? { lat: null, lng: null, mapUrl: url };
}

/** Toạ độ từ một link Google Maps (kể cả link rút gọn). null = không đọc được. */
export async function locationFromUrl(url: string): Promise<IntakeLocation | null> {
  let coords = parseLatLng(url);
  if (!coords && isShortMapsUrl(url)) {
    const r = await resolveShortMapUrl(url).catch(() => null);
    if (r && "url" in r) coords = parseLatLng(r.url);
  }
  return coords ? { lat: coords.lat, lng: coords.lng, mapUrl: mapsLink(coords.lat, coords.lng) } : null;
}

export type PlaceHit = { name: string; lat: number; lng: number };

/**
 * Tìm địa chỉ chữ ("12 Lê Lợi, Huế") → toạ độ, qua Nominatim (OpenStreetMap —
 * cùng nguồn với bản đồ trong form, miễn phí, không cần API key). Gọi từ server
 * để gắn User-Agent đúng chính sách của Nominatim và không phải mở CSP.
 */
export async function searchPlaces(q: string): Promise<PlaceHit[]> {
  const query = q.trim().slice(0, 200);
  if (query.length < 3) return [];
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("q", query);
  u.searchParams.set("countrycodes", "vn");
  u.searchParams.set("limit", "6");
  u.searchParams.set("accept-language", "vi");
  try {
    const res = await fetch(u, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "MStudo/1.0 (intake form location search)", "Accept-Language": "vi" },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as any[];
    return (Array.isArray(rows) ? rows : [])
      .map((r) => {
        const c = validCoords(r?.lat, r?.lon);
        return c && typeof r?.display_name === "string" ? { name: r.display_name as string, lat: c.lat, lng: c.lng } : null;
      })
      .filter((x): x is PlaceHit => !!x);
  } catch {
    return [];
  }
}
