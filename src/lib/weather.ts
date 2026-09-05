/**
 * THỜI TIẾT & ĐƯỜNG ĐI CHO BUỔI CHỤP NGOẠI CẢNH.
 *
 * Rủi ro lớn nhất của studio ngoại cảnh là mưa: một buổi chụp cưới huỷ vì mưa
 * kéo theo đổi lịch ê-kíp, đổi lịch phòng váy, và một khách đang lo. App trước
 * đây không nói gì về chuyện đó, dù đã lưu ngày giờ và địa điểm của từng buổi.
 *
 * File này là phần LUẬT THUẦN: đổi mã thời tiết thành lời người đọc, chấm mức
 * rủi ro, tính giờ vàng từ giờ mặt trời lặn, và ước lượng thời gian di chuyển.
 * Không gọi mạng, không phụ thuộc gì — kiểm thử bằng node (`npm run test:weather`).
 * Phần gọi API nằm ở `src/app/api/studio/weather/route.ts`.
 *
 * NGUỒN DỮ LIỆU: Open-Meteo — miễn phí, KHÔNG cần khoá API, không cần tài khoản.
 * Chọn nó chính vì thế: studio không phải đăng ký gì, và không có khoá nào để
 * hết hạn giữa mùa cưới. Dự báo chỉ đi được 7 ngày nên mọi thứ ở đây bó trong
 * cửa sổ đó — xa hơn thì con số là bịa.
 */

/* ─────────────────────────────────────────────────────────────────────────────
   Mã thời tiết (WMO) → lời người đọc
   ───────────────────────────────────────────────────────────────────────────── */

export type SkyTone = "clear" | "cloud" | "rain" | "storm";

export type Sky = { label: string; tone: SkyTone; emoji: string };

/**
 * Bảng mã WMO của Open-Meteo, gom về 4 nhóm mà studio thật sự cần phân biệt:
 * quang · nhiều mây · mưa · dông. Chi tiết hơn (mưa phùn nhẹ vs mưa phùn dày)
 * không đổi được quyết định nào của studio, nên gộp lại cho dòng chữ ngắn.
 */
export function skyFromCode(code: number | null | undefined): Sky {
  // `code == null` phải xét TRƯỚC Number(): `Number(null)` ra 0, mà 0 là mã
  // "trời quang" — thiếu dự báo sẽ bị đọc thành "trời quang" và studio yên tâm
  // đưa ê-kíp ra ngoài trời. Bẫy này do kiểm thử bắt được.
  if (code == null) return { label: "Chưa có dự báo", tone: "cloud", emoji: "·" };
  const c = Number(code);
  if (!Number.isFinite(c)) return { label: "Chưa có dự báo", tone: "cloud", emoji: "·" };
  if (c === 0) return { label: "Trời quang", tone: "clear", emoji: "☀️" };
  if (c === 1) return { label: "Ít mây", tone: "clear", emoji: "🌤️" };
  if (c === 2) return { label: "Có mây", tone: "cloud", emoji: "⛅" };
  if (c === 3) return { label: "Nhiều mây", tone: "cloud", emoji: "☁️" };
  if (c === 45 || c === 48) return { label: "Sương mù", tone: "cloud", emoji: "🌫️" };
  if (c >= 51 && c <= 57) return { label: "Mưa phùn", tone: "rain", emoji: "🌦️" };
  if (c >= 61 && c <= 65) return { label: "Mưa", tone: "rain", emoji: "🌧️" };
  if (c === 66 || c === 67) return { label: "Mưa lạnh", tone: "rain", emoji: "🌧️" };
  if (c >= 71 && c <= 77) return { label: "Tuyết", tone: "rain", emoji: "🌨️" };
  if (c >= 80 && c <= 82) return { label: "Mưa rào", tone: "rain", emoji: "🌧️" };
  if (c === 85 || c === 86) return { label: "Mưa tuyết", tone: "rain", emoji: "🌨️" };
  // Chặn CẢ HAI đầu: mã WMO cao nhất là 99. Không chặn trên thì mọi số rác
  // (dữ liệu hỏng, API đổi định dạng) đều thành "dông" và studio huỷ buổi oan.
  if (c >= 95 && c <= 99) return { label: "Dông", tone: "storm", emoji: "⛈️" };
  return { label: "Chưa rõ", tone: "cloud", emoji: "·" };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Chấm mức rủi ro
   ───────────────────────────────────────────────────────────────────────────── */

/** Một ngày dự báo, đúng những trường route đọc từ Open-Meteo. */
export type DayForecast = {
  /** 'YYYY-MM-DD' */
  date: string;
  tempMin: number | null;
  tempMax: number | null;
  /** Xác suất mưa cao nhất trong ngày, 0–100. */
  rainChance: number | null;
  /** Lượng mưa, mm. */
  rainMm: number | null;
  code: number | null;
  /** ISO có giờ, theo giờ địa phương của điểm chụp. */
  sunrise: string | null;
  sunset: string | null;
  /** Gió giật mạnh nhất, km/h. */
  windMax: number | null;
};

export type RiskLevel = "ok" | "watch" | "high";

export const WEATHER_RULES = {
  /** Từ mức này coi là ĐÁNG THEO DÕI (chuẩn bị dù, bạt, phương án trong nhà). */
  watchRain: 40,
  /** Từ mức này coi là RỦI RO CAO — nên gọi khách bàn phương án hai. */
  highRain: 70,
  /** Dông thì rủi ro cao bất kể xác suất mưa. */
  stormIsHigh: true,
  /** Gió giật từ mức này (km/h) cũng là rủi ro cao: hỏng váy, đổ đèn, bay phông. */
  highWind: 45,
  /** Chỉ dự báo trong 7 ngày; xa hơn thì Open-Meteo không có số thật. */
  horizonDays: 7,
};

/**
 * Mức rủi ro của một buổi chụp ngoại cảnh.
 *
 * Gió được tính CÙNG HẠNG với mưa, không phải phụ: studio ngoại cảnh mất buổi vì
 * gió giật cũng nhiều như vì mưa — váy không giữ được nếp, đèn đổ, phông bay. Đó
 * là thứ studio biết mà một bảng dự báo thông thường không nói.
 */
export function riskOf(d: Pick<DayForecast, "rainChance" | "code" | "windMax">): RiskLevel {
  const sky = skyFromCode(d.code);
  if (WEATHER_RULES.stormIsHigh && sky.tone === "storm") return "high";
  if ((d.windMax ?? 0) >= WEATHER_RULES.highWind) return "high";
  const p = d.rainChance ?? 0;
  if (p >= WEATHER_RULES.highRain) return "high";
  if (p >= WEATHER_RULES.watchRain) return "watch";
  return "ok";
}

/** Câu nhắc đi kèm mức rủi ro — nói VIỆC PHẢI LÀM, không chỉ nói con số. */
export function riskAdvice(level: RiskLevel, d?: Pick<DayForecast, "windMax" | "code">): string {
  if (level === "ok") return "";
  const sky = skyFromCode(d?.code);
  if (sky.tone === "storm") return "Dự báo có dông — nên chuẩn bị phương án trong nhà và báo khách trước.";
  if ((d?.windMax ?? 0) >= WEATHER_RULES.highWind) return "Gió giật mạnh — cân nhắc đổi điểm chụp kín gió, cố định đèn và phông.";
  if (level === "high") return "Khả năng mưa cao — nên gọi khách bàn phương án hai ngay từ hôm nay.";
  return "Có thể mưa — mang dù, bạt và tính sẵn một điểm chụp có mái.";
}

/* ─────────────────────────────────────────────────────────────────────────────
   Giờ vàng
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * "Giờ vàng" chiều: khoảng một tiếng trước lúc mặt trời lặn, tính từ giờ lặn mà
 * Open-Meteo trả về (đã theo giờ địa phương của điểm chụp).
 *
 * Trả lại đúng chuỗi 'HH:MM' để mọi màn định dạng giờ theo một cách duy nhất —
 * cùng kiểu với `studio_appointments.start_time` (xem migration đó).
 */
export function goldenHour(sunsetIso: string | null | undefined): { from: string; to: string } | null {
  const hm = hhmm(sunsetIso);
  if (!hm) return null;
  const [h, m] = hm.split(":").map(Number);
  const total = h * 60 + m;
  // 75 phút trước lặn tới 15 phút trước lặn: nắng đã ngả vàng mà chưa tắt hẳn.
  const from = clampMinutes(total - 75);
  const to = clampMinutes(total - 15);
  return { from: minutesToHm(from), to: minutesToHm(to) };
}

/** Lấy 'HH:MM' từ chuỗi ISO Open-Meteo ('2026-09-05T18:12'). */
export function hhmm(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

const clampMinutes = (v: number) => Math.max(0, Math.min(24 * 60 - 1, v));
const minutesToHm = (v: number) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;

/**
 * Buổi chụp có nằm trong giờ vàng không? Dùng để nhắc studio dời giờ khi họ hẹn
 * khách lúc 11 giờ trưa ngoài trời — nắng gắt, đổ bóng, ai cũng nhăn mặt.
 */
export function inGoldenHour(startTime: string | null | undefined, g: { from: string; to: string } | null): boolean {
  if (!startTime || !g) return false;
  return startTime >= g.from && startTime <= g.to;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Đường đi
   ───────────────────────────────────────────────────────────────────────────── */

/** Khoảng cách đường chim bay, km (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * ƯỚC LƯỢNG thời gian di chuyển — và chữ "ước lượng" ở đây là nghiêm túc.
 *
 * Repo KHÔNG gọi API chỉ đường (Google Directions / Mapbox đều cần khoá và tính
 * tiền theo lượt, mà tính năng này chỉ để xếp lịch trong ngày). Nên đây là
 * khoảng cách đường chim bay nhân hệ số đường bộ, chia tốc độ trung bình theo
 * quãng đường:
 *
 *   - dưới 15 km  → coi là nội thành: 22 km/h (đèn đỏ, giờ tan tầm)
 *   - 15–60 km    → ven đô: 35 km/h
 *   - trên 60 km  → quốc lộ/cao tốc: 50 km/h
 *
 * Hệ số đường bộ 1,35: đường thật luôn dài hơn đường chim bay.
 *
 * Con số này ĐỦ để trả lời "sáng chụp chỗ này, chiều kịp chỗ kia không" — và
 * KHÔNG đủ để hẹn giờ chính xác với khách. Màn hình phải luôn hiện kèm dấu "≈"
 * và chữ "ước lượng"; đừng bao giờ bỏ hai thứ đó đi.
 */
export const ROAD_FACTOR = 1.35;

export function travelEstimate(
  from: { lat: number; lng: number } | null | undefined,
  to: { lat: number; lng: number } | null | undefined
): { km: number; minutes: number } | null {
  if (!from || !to) return null;
  if (!Number.isFinite(from.lat) || !Number.isFinite(to.lat)) return null;
  const straight = distanceKm(from, to);
  const km = straight * ROAD_FACTOR;
  if (km < 0.3) return { km: 0, minutes: 0 }; // cùng một chỗ
  const kmh = km < 15 ? 22 : km < 60 ? 35 : 50;
  return { km: Math.round(km * 10) / 10, minutes: Math.max(1, Math.round((km / kmh) * 60)) };
}

/** "1 giờ 20 phút" / "25 phút" — đọc được, không phải "80 min". */
export function humanMinutes(min: number): string {
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Toạ độ
   ───────────────────────────────────────────────────────────────────────────── */

export type LatLng = { lat: number; lng: number };

/**
 * Đọc toạ độ nằm sẵn trong một chuỗi địa điểm: link Google Maps studio dán vào,
 * hoặc chuỗi "10.7769,106.7009".
 *
 * Đây là đường RẺ NHẤT và chính xác nhất, nên thử trước khi đi tra tên địa danh:
 * `LocationPicker` (form khách điền) đã lưu link Maps vào chính ô địa điểm, và
 * một link Maps thì không thể tra sai.
 */
export function coordsInText(input: string | null | undefined): LatLng | null {
  const s = String(input ?? "");
  if (!s) return null;
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,        // .../maps/@10.77,106.70,17z
    /[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, // ...maps?q=10.77,106.70
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,    // ...!3d10.77!4d106.70
    /(^|\s)(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})(\s|$)/, // "10.7769, 106.7009"
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    // Mẫu cuối có nhóm bọc ở đầu nên toạ độ lùi một bậc.
    const lat = parseFloat(m.length > 3 ? m[2] : m[1]);
    const lng = parseFloat(m.length > 3 ? m[3] : m[2]);
    if (validLatLng(lat, lng)) return { lat, lng };
  }
  return null;
}

export function validLatLng(lat: unknown, lng: unknown): boolean {
  const a = Number(lat);
  const b = Number(lng);
  return (
    Number.isFinite(a) && Number.isFinite(b) &&
    Math.abs(a) <= 90 && Math.abs(b) <= 180 &&
    // (0,0) là giữa Vịnh Guinea — thực tế luôn là dữ liệu rỗng bị đọc thành số,
    // và một buổi chụp ở đó thì dự báo mưa vô nghĩa.
    !(a === 0 && b === 0)
  );
}

/**
 * Tên địa điểm để đi tra toạ độ. Bỏ phần số nhà/ngõ ở đầu và cắt về cụm cuối:
 * bộ tra tên địa danh của Open-Meteo tra ĐỊA DANH (phường, quận, thành phố), nó
 * không hiểu "Số 12 ngõ 34 Trần Duy Hưng" — mà "Trần Duy Hưng, Hà Nội" thì tra
 * ra. Thà lấy toạ độ của cả phường (dự báo mưa như nhau trong bán kính vài km)
 * còn hơn không có dự báo nào.
 */
export function placeQuery(location: string | null | undefined): string | null {
  let s = String(location ?? "").trim();
  if (!s) return null;
  if (coordsInText(s)) return null; // đã có toạ độ, không cần tra
  s = s.replace(/https?:\/\/\S+/g, " ").trim(); // bỏ link còn sót
  // Bỏ tiền tố số nhà / ngõ / ngách / hẻm / tổ.
  s = s.replace(/^(số|so)?\s*\d+[a-zA-Z]?\s*(\/\s*\d+)*\s*,?\s*/i, "");
  s = s.replace(/\b(ngõ|ngach|ngách|hẻm|hem|tổ|to)\s*\d+[^,]*,?/gi, " ");
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  // Hai cụm CUỐI là cụm hành chính lớn nhất (quận, thành phố) — tra chính xác nhất.
  const tail = parts.slice(-2).join(", ");
  return tail.slice(0, 120) || null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Cửa sổ dự báo
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Ngày này có dự báo được không? Ngoài 7 ngày thì Open-Meteo không có số thật —
 * và hiện một con số bịa cho buổi chụp tháng sau còn tệ hơn không hiện gì, vì
 * studio sẽ xếp lịch theo nó.
 */
export function withinHorizon(dateYmd: string, todayYmd: string, days = WEATHER_RULES.horizonDays): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) return false;
  if (dateYmd < todayYmd) return false;
  const diff = (Date.parse(`${dateYmd}T00:00:00Z`) - Date.parse(`${todayYmd}T00:00:00Z`)) / 86_400_000;
  return diff >= 0 && diff < days;
}

/** Loại lịch hẹn có ra ngoài trời — chỉ những loại này cần dự báo. */
export function isOutdoorKind(kind: string | null | undefined): boolean {
  // 'pre' (chụp pre-wedding) và 'shoot' là buổi chụp thật; 'other' để ngỏ vì
  // studio dùng nó cho những buổi không có loại riêng. Trang điểm, thử đồ, tư
  // vấn, giao ảnh đều trong nhà — hiện dự báo mưa ở đó chỉ là nhiễu.
  return kind === "pre" || kind === "shoot" || kind === "other";
}

/** Một dòng gọn cho thẻ lịch: "⛅ 24–31° · mưa 20% · vàng 17:05–18:05". */
export function summaryLine(d: DayForecast): string {
  const sky = skyFromCode(d.code);
  const parts: string[] = [`${sky.emoji} ${sky.label}`];
  if (d.tempMin != null && d.tempMax != null) parts.push(`${Math.round(d.tempMin)}–${Math.round(d.tempMax)}°`);
  if (d.rainChance != null) parts.push(`mưa ${Math.round(d.rainChance)}%`);
  const g = goldenHour(d.sunset);
  if (g) parts.push(`giờ vàng ${g.from}–${g.to}`);
  return parts.join(" · ");
}
