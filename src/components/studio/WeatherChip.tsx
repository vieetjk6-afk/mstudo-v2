"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CloudSun, Sunset, Wind, Car, TriangleAlert } from "lucide-react";
import {
  goldenHour,
  humanMinutes,
  inGoldenHour,
  isOutdoorKind,
  riskAdvice,
  riskOf,
  skyFromCode,
  travelEstimate,
  withinHorizon,
  type DayForecast,
  type LatLng,
  type RiskLevel,
} from "@/lib/weather";

/* ═══════════════════════════════════════════════════════════════════════════
   DỰ BÁO CHO BUỔI CHỤP NGOẠI CẢNH — hiện trên thẻ lịch và trong hộp thoại lịch.

   Luật (mã thời tiết, mức rủi ro, giờ vàng, ước lượng đường đi) nằm ở
   @/lib/weather — kiểm thử bằng node. Ở đây chỉ có phần GỌI API và VẼ.

   Ba điều cố ý:
    1. CHỈ hiện cho lịch ngoài trời và CHỈ trong 7 ngày tới. Hiện dự báo mưa cho
       buổi trang điểm trong phòng là nhiễu; hiện cho buổi chụp tháng sau là bịa
       (Open-Meteo không có số thật ngoài 7 ngày).
    2. MỘT lượt gọi cho cả tuần. Không phải mỗi thẻ một lượt — màn lịch có thể
       có mười mấy buổi, và route đã gộp các điểm cùng một ô ~1km lại.
    3. Thời gian di chuyển luôn kèm dấu "≈" và chữ "ước lượng". Nó là khoảng
       cách đường chim bay nhân hệ số, KHÔNG phải chỉ đường thật — xem
       `travelEstimate`. Bỏ dấu "≈" đi là biến một ước lượng thành một lời hứa.
   ═══════════════════════════════════════════════════════════════════════════ */

export type WeatherPlace = {
  key: string;
  kind: string;
  date: string;
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type Resolved = { coords: LatLng | null; days: DayForecast[] };

export type WeatherMap = {
  /** Dự báo đúng NGÀY của buổi đó; `null` khi không có. */
  dayOf: (key: string) => DayForecast | null;
  coordsOf: (key: string) => LatLng | null;
  loading: boolean;
};

const EMPTY: WeatherMap = { dayOf: () => null, coordsOf: () => null, loading: false };

/**
 * Nạp dự báo cho một danh sách buổi chụp.
 *
 * `today` truyền vào (không tự lấy `new Date()`) để cùng một mốc "hôm nay" với
 * màn lịch — màn đó đã tính giờ Việt Nam ở phía server, và hai chỗ lệch nhau
 * một ngày thì thẻ cuối tuần sẽ mất dự báo một cách khó hiểu.
 */
export function useShootWeather(places: WeatherPlace[], today: string): WeatherMap {
  const [data, setData] = useState<Record<string, Resolved>>({});
  const [loading, setLoading] = useState(false);
  const doneRef = useRef<string>("");

  // Chỉ lấy những buổi THẬT SỰ cần dự báo: ngoài trời, trong 7 ngày, có địa điểm.
  const wanted = useMemo(
    () =>
      places.filter(
        (p) =>
          isOutdoorKind(p.kind) &&
          withinHorizon(p.date, today) &&
          (!!p.location?.trim() || (p.lat != null && p.lng != null))
      ),
    [places, today]
  );

  // Chữ ký để biết khi nào phải gọi lại. Theo NỘI DUNG chứ không theo tham chiếu
  // mảng: màn lịch dựng lại mảng mỗi lần render, đi theo tham chiếu là gọi API
  // vô hạn.
  const sig = useMemo(
    () => wanted.map((p) => `${p.key}|${p.date}|${p.lat ?? ""},${p.lng ?? ""}|${p.location ?? ""}`).sort().join(";"),
    [wanted]
  );

  useEffect(() => {
    if (!sig) {
      doneRef.current = "";
      setData({});
      return;
    }
    if (doneRef.current === sig) return;
    doneRef.current = sig;
    let alive = true;
    setLoading(true);
    fetch("/api/studio/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        places: wanted.map((p) => ({ key: p.key, location: p.location ?? null, lat: p.lat ?? null, lng: p.lng ?? null })),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { results?: Record<string, Resolved> } | null) => {
        if (alive && j?.results) setData(j.results);
      })
      .catch(() => {
        /* Open-Meteo lỗi / mất mạng → không có dự báo. Màn lịch vẫn dùng được. */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return useMemo(() => {
    if (!sig) return EMPTY;
    const byKey = new Map(wanted.map((p) => [p.key, p.date]));
    return {
      loading,
      dayOf: (key: string) => {
        const date = byKey.get(key);
        const r = data[key];
        if (!date || !r) return null;
        return r.days.find((d) => d.date === date) ?? null;
      },
      coordsOf: (key: string) => data[key]?.coords ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading, sig]);
}

const RISK_COLOR: Record<RiskLevel, string> = {
  ok: "var(--gn, #1e9e72)",
  watch: "var(--am, #a9740a)",
  high: "var(--rd, #c0392b)",
};

/**
 * Viên gọn cho thẻ lịch trên lưới tuần. Cột lịch chỉ rộng ~146px nên đây phải
 * là MỘT dòng: biểu tượng trời, khoảng nhiệt, xác suất mưa. Chi tiết còn lại
 * (giờ vàng, gió, đường đi) để trong hộp thoại — xem <WeatherDetail/>.
 */
export default function WeatherChip({ day }: { day: DayForecast | null }) {
  if (!day) return null;
  const sky = skyFromCode(day.code);
  const level = riskOf(day);
  return (
    <p
      className="tnum mt-1 flex items-center gap-1 text-[10px] font-semibold"
      style={{ color: RISK_COLOR[level] }}
      title={`${sky.label}${day.rainChance != null ? ` · khả năng mưa ${Math.round(day.rainChance)}%` : ""}${
        day.windMax != null ? ` · gió tới ${Math.round(day.windMax)} km/h` : ""
      }`}
    >
      <span aria-hidden>{sky.emoji}</span>
      {day.tempMin != null && day.tempMax != null && (
        <span>{Math.round(day.tempMin)}–{Math.round(day.tempMax)}°</span>
      )}
      {day.rainChance != null && <span>· mưa {Math.round(day.rainChance)}%</span>}
      {level !== "ok" && <TriangleAlert size={10} style={{ flex: "none" }} />}
    </p>
  );
}

/**
 * Khối đầy đủ cho hộp thoại lịch: trời, nhiệt, mưa, gió, giờ vàng, câu nhắc
 * việc phải làm, và ước lượng đường đi từ studio.
 */
export function WeatherDetail({
  day,
  startTime,
  from,
  to,
}: {
  day: DayForecast | null;
  startTime?: string | null;
  /** Toạ độ studio — điểm xuất phát để ước lượng đường đi. */
  from?: LatLng | null;
  /** Toạ độ điểm chụp. */
  to?: LatLng | null;
}) {
  if (!day) return null;
  const sky = skyFromCode(day.code);
  const level = riskOf(day);
  const g = goldenHour(day.sunset);
  const advice = riskAdvice(level, day);
  const travel = travelEstimate(from, to);
  const golden = inGoldenHour(startTime, g);

  return (
    <div
      className="rounded-[10px] px-3 py-2.5"
      style={{ background: "var(--sf2)", border: `1px solid ${level === "ok" ? "var(--bd)" : RISK_COLOR[level]}` }}
    >
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] font-semibold">
        <span className="flex items-center gap-1.5" style={{ color: RISK_COLOR[level] }}>
          <CloudSun size={14} /> {sky.emoji} {sky.label}
        </span>
        {day.tempMin != null && day.tempMax != null && (
          <span className="tnum" style={{ color: "var(--tx2)" }}>
            {Math.round(day.tempMin)}–{Math.round(day.tempMax)}°C
          </span>
        )}
        {day.rainChance != null && (
          <span className="tnum" style={{ color: "var(--tx2)" }}>mưa {Math.round(day.rainChance)}%</span>
        )}
        {day.windMax != null && (
          <span className="tnum flex items-center gap-1" style={{ color: "var(--tx2)" }}>
            <Wind size={13} /> {Math.round(day.windMax)} km/h
          </span>
        )}
      </p>

      {g && (
        <p className="tnum mt-1.5 flex items-center gap-1.5 text-[11.5px]" style={{ color: golden ? "var(--gn)" : "var(--tx2)" }}>
          <Sunset size={13} style={{ flex: "none" }} />
          Giờ vàng {g.from}–{g.to}
          {startTime ? (golden ? " · buổi này nằm trong giờ vàng" : " · buổi này ngoài giờ vàng") : ""}
        </p>
      )}

      {travel && travel.minutes > 0 && (
        <p className="tnum mt-1 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--tx2)" }}>
          <Car size={13} style={{ flex: "none" }} />
          {/* Dấu "≈" và chữ "ước lượng" KHÔNG được bỏ: đây là đường chim bay
              nhân hệ số, không phải chỉ đường thật (xem travelEstimate). */}
          ≈ {travel.km} km · {humanMinutes(travel.minutes)} từ studio <span style={{ color: "var(--tx3)" }}>(ước lượng)</span>
        </p>
      )}

      {advice && (
        <p className="mt-1.5 text-[11.5px] font-semibold leading-relaxed" style={{ color: RISK_COLOR[level], textWrap: "pretty" }}>
          {advice}
        </p>
      )}
    </div>
  );
}
