import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import {
  coordsInText,
  placeQuery,
  validLatLng,
  type DayForecast,
  type LatLng,
} from "@/lib/weather";

export const dynamic = "force-dynamic";

/**
 * DỰ BÁO THỜI TIẾT cho các buổi chụp ngoại cảnh trong 7 ngày tới.
 *
 * Nguồn: Open-Meteo — miễn phí, KHÔNG cần khoá API. Chọn nó chính vì thế:
 * studio không phải đăng ký gì, và không có khoá nào để hết hạn giữa mùa cưới.
 *
 * Gọi từ SERVER, không phải từ trình duyệt studio. Ba lý do:
 *   1. Một màn lịch có thể có 10 buổi ở 10 nơi; gọi từ client là 10 lượt đi
 *      thẳng ra Open-Meteo từ mỗi máy, mỗi lần mở trang.
 *   2. Có chỗ để CACHE dùng chung (bên dưới) — dự báo theo ngày thì 30 phút mới
 *      đổi một lần, không cần gọi lại mỗi lần studio bấm sang tuần khác.
 *   3. Không rò địa điểm buổi chụp của khách qua Referer của trình duyệt.
 *
 * Đầu vào: POST { places: [{ key, location?, lat?, lng? }] }
 * Đầu ra:  { results: { [key]: { coords, days } } }
 *
 * Cố ý KHÔNG nhận thẳng danh sách toạ độ tuỳ ý từ client mà không đăng nhập:
 * route này là một cầu nối ra ngoài, để mở thì thành nơi ai cũng dùng để gọi
 * Open-Meteo bằng hạn mức của mstudo.
 */

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** Số điểm tối đa mỗi lượt gọi — một màn lịch tuần không bao giờ cần hơn. */
const MAX_PLACES = 24;

/* ─────────────────────────────────────────────────────────────────────────────
   Cache trong tiến trình
   ─────────────────────────────────────────────────────────────────────────────
   Dự báo theo NGÀY chỉ đổi vài lần mỗi ngày, còn toạ độ của một địa danh thì
   gần như không đổi. Cache ngay trong tiến trình (không phải Redis): tính năng
   này chịu được cache lạnh sau mỗi lần deploy, và thêm một hạ tầng chỉ để nhớ
   dự báo mưa là không đáng.

   Có TRẦN số bản ghi: serverless function sống lâu và một studio nhiều chi
   nhánh có thể tra hàng trăm địa danh — không chặn thì Map này phình mãi.
   ───────────────────────────────────────────────────────────────────────────── */

const FORECAST_TTL = 30 * 60_000; // 30 phút
const GEO_TTL = 30 * 24 * 3600_000; // 30 ngày — toạ độ một địa danh không đổi
const CACHE_MAX = 300;

type Entry<T> = { at: number; value: T };
const forecastCache = new Map<string, Entry<DayForecast[]>>();
const geoCache = new Map<string, Entry<LatLng | null>>();

function cacheGet<T>(m: Map<string, Entry<T>>, key: string, ttl: number): T | undefined {
  const hit = m.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > ttl) {
    m.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet<T>(m: Map<string, Entry<T>>, key: string, value: T): void {
  if (m.size >= CACHE_MAX) {
    // Map giữ thứ tự chèn → bỏ bản cũ nhất. Đủ tốt cho một cache dự báo mưa;
    // không cần LRU thật.
    const oldest = m.keys().next().value;
    if (oldest !== undefined) m.delete(oldest);
  }
  m.set(key, { at: Date.now(), value });
}

/* ─────────────────────────────────────────────────────────────────────────────
   Gọi Open-Meteo
   ───────────────────────────────────────────────────────────────────────────── */

/** Bọc fetch có hạn giờ: Open-Meteo treo thì màn lịch vẫn phải vẽ xong. */
async function fetchJson(url: string, ms = 6000): Promise<unknown | null> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    const res = await fetch(url, { signal: ac.signal, headers: { accept: "application/json" } });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Tra toạ độ từ tên địa danh. `null` = không tra được (không phải lỗi). */
async function geocode(query: string): Promise<LatLng | null> {
  const key = query.toLowerCase();
  const hit = cacheGet(geoCache, key, GEO_TTL);
  if (hit !== undefined) return hit;

  // count=1 + language=vi + country=VN: nghiệp vụ của app là studio ảnh Việt
  // Nam (VietQR, âm lịch, Zalo), nên ghim quốc gia làm kết quả chính xác hơn
  // hẳn — "Hòa Bình" ở VN chứ không phải một thành phố trùng tên ở nước khác.
  const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=1&language=vi&format=json&countryCode=VN`;
  const json = (await fetchJson(url)) as { results?: { latitude?: number; longitude?: number }[] } | null;
  const first = json?.results?.[0];
  const out =
    first && validLatLng(first.latitude, first.longitude)
      ? { lat: Number(first.latitude), lng: Number(first.longitude) }
      : null;
  cacheSet(geoCache, key, out);
  return out;
}

/** Dự báo 7 ngày cho một toạ độ. */
async function forecast(c: LatLng): Promise<DayForecast[]> {
  // Làm tròn toạ độ về 2 chữ số (~1km) khi làm khoá cache: dự báo mưa giống
  // nhau trong bán kính vài km, nên hai buổi chụp cùng phường dùng chung một
  // lượt gọi thay vì mỗi buổi một lượt.
  const key = `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`;
  const hit = cacheGet(forecastCache, key, FORECAST_TTL);
  if (hit !== undefined) return hit;

  const params = new URLSearchParams({
    latitude: String(c.lat),
    longitude: String(c.lng),
    daily: [
      "weather_code",
      "temperature_2m_min",
      "temperature_2m_max",
      "precipitation_probability_max",
      "precipitation_sum",
      "wind_speed_10m_max",
      "sunrise",
      "sunset",
    ].join(","),
    // Giờ mọc/lặn phải theo giờ ĐỊA PHƯƠNG của điểm chụp, nếu không "giờ vàng"
    // sẽ lệch 7 tiếng và thành vô nghĩa.
    timezone: "auto",
    forecast_days: "7",
  });
  const json = (await fetchJson(`${FORECAST_URL}?${params}`)) as
    | {
        daily?: {
          time?: string[];
          weather_code?: (number | null)[];
          temperature_2m_min?: (number | null)[];
          temperature_2m_max?: (number | null)[];
          precipitation_probability_max?: (number | null)[];
          precipitation_sum?: (number | null)[];
          wind_speed_10m_max?: (number | null)[];
          sunrise?: (string | null)[];
          sunset?: (string | null)[];
        };
      }
    | null;

  const d = json?.daily;
  const days: DayForecast[] = (d?.time ?? []).map((date, i) => ({
    date,
    code: d?.weather_code?.[i] ?? null,
    tempMin: d?.temperature_2m_min?.[i] ?? null,
    tempMax: d?.temperature_2m_max?.[i] ?? null,
    rainChance: d?.precipitation_probability_max?.[i] ?? null,
    rainMm: d?.precipitation_sum?.[i] ?? null,
    windMax: d?.wind_speed_10m_max?.[i] ?? null,
    sunrise: d?.sunrise?.[i] ?? null,
    sunset: d?.sunset?.[i] ?? null,
  }));

  // Chỉ cache khi CÓ dữ liệu. Cache một mảng rỗng vì Open-Meteo vừa lỗi nghĩa là
  // 30 phút sau studio vẫn không thấy dự báo dù mạng đã ổn.
  if (days.length > 0) cacheSet(forecastCache, key, days);
  return days;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Route
   ───────────────────────────────────────────────────────────────────────────── */

type PlaceIn = { key?: string; location?: string | null; lat?: number | null; lng?: number | null };

export async function POST(req: Request) {
  const profile = await requireStudio("booking");
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { places?: PlaceIn[] };
  const places = (Array.isArray(body.places) ? body.places : []).slice(0, MAX_PLACES);

  const results: Record<string, { coords: LatLng | null; days: DayForecast[] }> = {};

  // Giải toạ độ trước cho TẤT CẢ, rồi gộp các điểm cùng một ô ~1km lại: mười
  // buổi chụp trong cùng một quận chỉ tốn MỘT lượt gọi dự báo.
  const resolved: { key: string; coords: LatLng | null }[] = [];
  for (const p of places) {
    const key = String(p.key ?? "").slice(0, 120);
    if (!key) continue;
    let coords: LatLng | null = null;
    // Thứ tự: toạ độ đã lưu → toạ độ nằm trong chuỗi địa điểm (link Maps) →
    // tra tên địa danh. Rẻ và chính xác trước, đắt và hay sai sau.
    if (validLatLng(p.lat, p.lng)) coords = { lat: Number(p.lat), lng: Number(p.lng) };
    if (!coords) coords = coordsInText(p.location);
    if (!coords) {
      const q = placeQuery(p.location);
      if (q) coords = await geocode(q);
    }
    resolved.push({ key, coords });
  }

  const byCell = new Map<string, LatLng>();
  for (const r of resolved) {
    if (r.coords) byCell.set(`${r.coords.lat.toFixed(2)},${r.coords.lng.toFixed(2)}`, r.coords);
  }
  const forecasts = new Map<string, DayForecast[]>();
  await Promise.all(
    [...byCell.entries()].map(async ([cell, c]) => {
      forecasts.set(cell, await forecast(c));
    })
  );

  for (const r of resolved) {
    const cell = r.coords ? `${r.coords.lat.toFixed(2)},${r.coords.lng.toFixed(2)}` : "";
    results[r.key] = { coords: r.coords, days: r.coords ? forecasts.get(cell) ?? [] : [] };
  }

  return NextResponse.json({ results });
}
