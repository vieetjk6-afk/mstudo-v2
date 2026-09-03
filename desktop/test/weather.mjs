/* Kiểm thử THỜI TIẾT & ĐƯỜNG ĐI cho buổi chụp ngoại cảnh.
 *
 * Ba chỗ sai sẽ làm studio ra quyết định sai:
 *  1. Chấm rủi ro. Báo "ok" cho một ngày dông là để studio đưa cả ê-kíp và một
 *     cô dâu ra ngoài trời. Gió giật phải tính CÙNG HẠNG với mưa — studio ngoại
 *     cảnh mất buổi vì gió cũng nhiều như vì mưa.
 *  2. Cửa sổ 7 ngày. Ngoài tầm dự báo mà vẫn hiện số thì studio xếp lịch theo
 *     một con số bịa — tệ hơn không hiện gì.
 *  3. Đọc toạ độ. Đọc sai một link Maps là tra dự báo của một tỉnh khác.
 *
 * Nạp thẳng code thật ở src/lib/weather.ts.
 */
import {
  ROAD_FACTOR,
  WEATHER_RULES,
  coordsInText,
  distanceKm,
  goldenHour,
  hhmm,
  humanMinutes,
  inGoldenHour,
  isOutdoorKind,
  placeQuery,
  riskAdvice,
  riskOf,
  skyFromCode,
  summaryLine,
  travelEstimate,
  validLatLng,
  withinHorizon,
} from "../../src/lib/weather.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

/* ═══ Mã thời tiết ═══════════════════════════════════════════════════════════ */

check("mã 0 → trời quang", skyFromCode(0).tone, "clear");
check("mã 3 → nhiều mây", skyFromCode(3).tone, "cloud");
check("mã 63 → mưa", skyFromCode(63).tone, "rain");
check("mã 95 → dông", skyFromCode(95).tone, "storm");
check("mã 99 (dông kèm mưa đá) vẫn là dông", skyFromCode(99).tone, "storm");
check("mã lạ → không nổ, coi như chưa rõ", skyFromCode(1234).label, "Chưa rõ");
check("không có mã → nói thẳng là chưa có dự báo", skyFromCode(null).label, "Chưa có dự báo");
check("mã dạng chuỗi vẫn đọc được", skyFromCode("0").tone, "clear");

/* ═══ Chấm rủi ro ════════════════════════════════════════════════════════════ */

const day = (o = {}) => ({ rainChance: 0, code: 0, windMax: 5, ...o });

check("trời quang, không mưa, ít gió → ok", riskOf(day()), "ok");
check("mưa 39% → vẫn ok (dưới ngưỡng theo dõi)", riskOf(day({ rainChance: 39 })), "ok");
check("mưa 40% → đáng theo dõi", riskOf(day({ rainChance: 40 })), "watch");
check("mưa 69% → vẫn chỉ theo dõi", riskOf(day({ rainChance: 69 })), "watch");
check("mưa 70% → rủi ro cao", riskOf(day({ rainChance: 70 })), "high");

check(
  "DÔNG thì rủi ro cao dù xác suất mưa báo 0% — đây là ca không được sai",
  riskOf(day({ code: 95, rainChance: 0 })),
  "high"
);
check(
  "GIÓ GIẬT 45km/h → rủi ro cao dù trời quang: váy không giữ nếp, đèn đổ, phông bay",
  riskOf(day({ windMax: 45 })),
  "high"
);
check("gió 44km/h → chưa tới ngưỡng", riskOf(day({ windMax: 44 })), "ok");
check("thiếu số liệu (null) → không doạ oan, coi như ok", riskOf({ rainChance: null, code: null, windMax: null }), "ok");

ok("ok thì KHÔNG có câu nhắc nào", riskAdvice("ok") === "");
ok("dông → câu nhắc nói về phương án trong nhà", /dông/i.test(riskAdvice("high", day({ code: 95 }))));
ok("gió mạnh → câu nhắc nói về gió, không nói về mưa",
  /[Gg]ió/.test(riskAdvice("high", day({ windMax: 60 }))) && !/mưa cao/.test(riskAdvice("high", day({ windMax: 60 }))));
ok("mưa cao → câu nhắc bảo gọi khách", /gọi khách/.test(riskAdvice("high", day({ rainChance: 90 }))));
ok("theo dõi → câu nhắc bảo mang dù/bạt", /dù|bạt/.test(riskAdvice("watch", day({ rainChance: 50 }))));

/* ═══ Giờ vàng ═══════════════════════════════════════════════════════════════ */

check("lấy giờ phút từ ISO Open-Meteo", hhmm("2026-09-05T18:12"), "18:12");
check("ISO không có giờ → null", hhmm("2026-09-05"), null);
check("null → null", hhmm(null), null);

check("giờ vàng = 75→15 phút trước lúc lặn", goldenHour("2026-09-05T18:12"), { from: "16:57", to: "17:57" });
check("không có giờ lặn → không bịa giờ vàng", goldenHour(null), null);
{
  // Mặt trời lặn rất sớm (vùng cao, mùa đông): không được ra giờ âm.
  const g = goldenHour("2026-12-21T00:40");
  ok("lặn lúc 00:40 → giờ vàng bị kẹp ở 00:00, không ra số âm", g.from === "00:00", JSON.stringify(g));
}

{
  const g = goldenHour("2026-09-05T18:12"); // 16:57–17:57
  check("hẹn 17:30 → nằm trong giờ vàng", inGoldenHour("17:30", g), true);
  check("hẹn 11:00 → KHÔNG trong giờ vàng (nắng gắt, đổ bóng)", inGoldenHour("11:00", g), false);
  check("hẹn đúng mép đầu → tính là trong", inGoldenHour("16:57", g), true);
  check("hẹn đúng mép cuối → tính là trong", inGoldenHour("17:57", g), true);
  check("không có giờ hẹn → false", inGoldenHour(null, g), false);
  check("không có giờ vàng → false", inGoldenHour("17:30", null), false);
}

/* ═══ Cửa sổ dự báo ══════════════════════════════════════════════════════════ */

check("hôm nay → trong tầm", withinHorizon("2026-09-05", "2026-09-05"), true);
check("6 ngày tới → trong tầm", withinHorizon("2026-09-11", "2026-09-05"), true);
check("7 ngày tới → NGOÀI tầm (dự báo hết số thật)", withinHorizon("2026-09-12", "2026-09-05"), false);
check("hôm qua → ngoài tầm", withinHorizon("2026-09-04", "2026-09-05"), false);
check("buổi chụp tháng sau → ngoài tầm, tuyệt đối không hiện số", withinHorizon("2026-10-20", "2026-09-05"), false);
check("ngày rác → ngoài tầm, không nổ", withinHorizon("hôm nào đó", "2026-09-05"), false);
check("qua tháng vẫn tính đúng số ngày", withinHorizon("2026-10-01", "2026-09-28"), true);
check("hạn dự báo là 7 ngày", WEATHER_RULES.horizonDays, 7);

/* ═══ Loại lịch nào cần dự báo ═══════════════════════════════════════════════ */

check("chụp pre-wedding → cần", isOutdoorKind("pre"), true);
check("buổi chụp → cần", isOutdoorKind("shoot"), true);
check("trang điểm → KHÔNG (trong nhà, hiện mưa chỉ là nhiễu)", isOutdoorKind("makeup"), false);
check("thử đồ → không", isOutdoorKind("fitting"), false);
check("tư vấn → không", isOutdoorKind("consult"), false);
check("giao ảnh → không", isOutdoorKind("delivery"), false);

/* ═══ Toạ độ ═════════════════════════════════════════════════════════════════ */

check("link Maps dạng @lat,lng", coordsInText("https://www.google.com/maps/@10.7769,106.7009,17z"), { lat: 10.7769, lng: 106.7009 });
check("link Maps dạng ?q=lat,lng", coordsInText("https://www.google.com/maps?q=21.028511,105.804817"), { lat: 21.028511, lng: 105.804817 });
check("link Maps dạng !3d!4d", coordsInText("https://maps.google.com/x!3d16.0544!4d108.2022"), { lat: 16.0544, lng: 108.2022 });
check("chuỗi toạ độ trần", coordsInText("10.7769, 106.7009"), { lat: 10.7769, lng: 106.7009 });
check("địa chỉ chữ → không có toạ độ", coordsInText("Nhà thờ Đức Bà, Quận 1"), null);
check("chuỗi rỗng → null", coordsInText(""), null);
check("null → null", coordsInText(null), null);

check("toạ độ hợp lệ", validLatLng(10.77, 106.7), true);
check("vĩ độ 91 → không hợp lệ", validLatLng(91, 106), false);
check("kinh độ 181 → không hợp lệ", validLatLng(10, 181), false);
check("(0,0) bị loại — luôn là dữ liệu rỗng đọc thành số", validLatLng(0, 0), false);
check("chữ → không hợp lệ", validLatLng("abc", "def"), false);

/* ═══ Tên địa điểm để tra ════════════════════════════════════════════════════ */

check(
  "bỏ số nhà, giữ hai cụm hành chính cuối",
  placeQuery("Số 12 ngõ 34 Trần Duy Hưng, Cầu Giấy, Hà Nội"),
  "Cầu Giấy, Hà Nội"
);
check("địa danh ngắn giữ nguyên", placeQuery("Đà Lạt"), "Đà Lạt");
check("hai cụm giữ cả hai", placeQuery("Hồ Tây, Hà Nội"), "Hồ Tây, Hà Nội");
check("đã có toạ độ trong chuỗi → không cần tra tên", placeQuery("https://www.google.com/maps/@10.77,106.70,17z"), null);
check("chuỗi rỗng → null", placeQuery("   "), null);
ok("link còn sót bị bỏ khỏi tên tra",
  !/https?:/.test(placeQuery("Phim trường Smiley, Quận 9 https://example.com/x") ?? ""));

/* ═══ Đường đi ═══════════════════════════════════════════════════════════════ */

{
  // Hà Nội → TP.HCM đường chim bay ~1.140 km (mốc đã biết, để bắt lỗi công thức).
  const d = distanceKm({ lat: 21.0285, lng: 105.8048 }, { lat: 10.7769, lng: 106.7009 });
  ok("khoảng cách Hà Nội–TP.HCM ra đúng cỡ ~1140km", d > 1100 && d < 1180, `${d.toFixed(0)}km`);
}
check("cùng một điểm → 0 km", Math.round(distanceKm({ lat: 10, lng: 106 }, { lat: 10, lng: 106 })), 0);

check("hệ số đường bộ", ROAD_FACTOR, 1.35);
check("thiếu một đầu → không ước lượng (không bịa)", travelEstimate(null, { lat: 10, lng: 106 }), null);
check("cả hai đầu rỗng → null", travelEstimate(null, null), null);
check("toạ độ rác → null", travelEstimate({ lat: NaN, lng: 0 }, { lat: 10, lng: 106 }), null);
{
  const same = travelEstimate({ lat: 10.7769, lng: 106.7009 }, { lat: 10.7769, lng: 106.7009 });
  check("cùng chỗ → 0 phút, không ra '1 phút' vô nghĩa", same, { km: 0, minutes: 0 });
}
{
  // ~5km nội thành: hệ số 1,35 → ~6,7km ở 22km/h → ~18 phút.
  const t = travelEstimate({ lat: 10.7769, lng: 106.7009 }, { lat: 10.8, lng: 106.74 });
  ok("nội thành ~5km → khoảng 15–25 phút", t.minutes >= 12 && t.minutes <= 28, JSON.stringify(t));
}
{
  // Đường dài dùng tốc độ cao hơn, nên KHÔNG được ra thời gian tuyến tính theo km.
  const near = travelEstimate({ lat: 10.7, lng: 106.7 }, { lat: 10.76, lng: 106.75 }); // ~8km
  const far = travelEstimate({ lat: 10.7, lng: 106.7 }, { lat: 11.6, lng: 107.4 });    // ~130km
  ok("đường dài đi nhanh hơn mỗi km so với nội thành",
    far.minutes / far.km < near.minutes / near.km,
    `far=${far.minutes}/${far.km}km near=${near.minutes}/${near.km}km`);
}

check("dưới 1 giờ → chỉ nói phút", humanMinutes(25), "25 phút");
check("đúng tròn giờ → không thêm '0 phút'", humanMinutes(120), "2 giờ");
check("giờ lẻ phút", humanMinutes(80), "1 giờ 20 phút");

/* ═══ Dòng gọn cho thẻ lịch ══════════════════════════════════════════════════ */

{
  const line = summaryLine({
    date: "2026-09-05", tempMin: 24.4, tempMax: 31.2, rainChance: 20, rainMm: 0.2,
    code: 2, sunrise: "2026-09-05T05:40", sunset: "2026-09-05T18:12", windMax: 12,
  });
  check("dòng gọn đủ bốn thông tin studio cần", line, "⛅ Có mây · 24–31° · mưa 20% · giờ vàng 16:57–17:57");
}
{
  // Thiếu dữ liệu thì bỏ phần đó, KHÔNG hiện "undefined" hay "NaN°".
  const line = summaryLine({
    date: "2026-09-05", tempMin: null, tempMax: null, rainChance: null, rainMm: null,
    code: 0, sunrise: null, sunset: null, windMax: null,
  });
  check("thiếu dữ liệu → chỉ hiện phần có thật", line, "☀️ Trời quang");
  ok("không lọt undefined/NaN vào chữ hiện cho studio", !/undefined|NaN/.test(line));
}

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
