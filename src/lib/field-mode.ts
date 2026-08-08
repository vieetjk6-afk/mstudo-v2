/**
 * CHẾ ĐỘ NGÀY CHỤP — dữ liệu cho màn hình dùng khi đang ở hiện trường.
 *
 * Bản thiết kế (README, mục "Chế độ ngày chụp") quy định:
 *   • Lịch trình SINH RA TỪ giờ của chính hợp đồng — bước đầu = `t1 − 30 phút`,
 *     các bước sau chia đều tới `t2`. Không phải một bảng giờ cố định.
 *   • Checklist ảnh chọn theo LOẠI BUỔI, nhận diện bằng regex trên tên dịch vụ
 *     cộng tiêu đề hợp đồng: cưới / sơ sinh / kỷ yếu / doanh nghiệp / chân dung.
 *
 * File này chỉ tính toán thuần — không đụng React, không đụng Supabase — để màn
 * hình chỉ còn việc vẽ, và để logic giờ giấc kiểm chứng được bằng test.
 */

export type ShootKind = "wedding" | "newborn" | "yearbook" | "corp" | "portrait";

export const SHOOT_KIND_LABEL: Record<ShootKind, string> = {
  wedding: "Buổi chụp cưới",
  newborn: "Buổi chụp sơ sinh",
  yearbook: "Buổi chụp kỷ yếu",
  corp: "Buổi chụp doanh nghiệp",
  portrait: "Buổi chụp chân dung",
};

/** Buổi chụp kéo dài bao lâu khi hợp đồng không ghi giờ kết thúc (giờ). */
const DEFAULT_HOURS: Record<ShootKind, number> = {
  wedding: 10,
  newborn: 3,
  yearbook: 5,
  corp: 6,
  portrait: 3,
};

/** Các chặng của buổi chụp, theo đúng thứ tự chạy show. */
const RUN_SHEET: Record<ShootKind, string[]> = {
  wedding: [
    "Có mặt, dựng đèn & kiểm tra máy",
    "Chụp chuẩn bị — cô dâu, chú rể",
    "Nghi lễ chính",
    "Ảnh nhóm hai bên gia đình",
    "Chụp đôi ngoài trời",
    "Tiệc & khoảnh khắc tự nhiên",
  ],
  newborn: [
    "Có mặt, làm ấm phòng",
    "Setup 1 — bé ngủ, nền trắng",
    "Setup 2 — bé cùng bố mẹ",
    "Setup 3 — chi tiết tay chân",
    "Chụp bổ sung theo yêu cầu",
  ],
  yearbook: [
    "Có mặt, khảo sát địa điểm",
    "Ảnh tập thể toàn lớp",
    "Ảnh nhóm nhỏ theo tổ",
    "Ảnh cá nhân từng bạn",
    "Ảnh concept tự do",
  ],
  corp: [
    "Có mặt, dựng phông & đèn",
    "Chân dung ban lãnh đạo",
    "Chân dung toàn bộ nhân sự",
    "Ảnh không gian làm việc",
    "Ảnh nhóm phòng ban",
  ],
  portrait: [
    "Có mặt, dựng đèn",
    "Khách tới, makeup",
    "Set 1 — phông chính",
    "Set 2 — ánh sáng tự nhiên",
    "Chụp bổ sung theo yêu cầu",
  ],
};

/** Ảnh bắt buộc phải có — [việc, số lượng tối thiểu]. */
const SHOT_LIST: Record<ShootKind, [string, string][]> = {
  wedding: [
    ["Ảnh chuẩn bị cô dâu", "≥ 20 tấm"],
    ["Nghi lễ trao nhẫn", "≥ 15 tấm"],
    ["Ảnh gia đình hai bên", "≥ 12 tấm"],
    ["Ảnh đôi ngoài trời", "≥ 25 tấm"],
    ["Chi tiết nhẫn, hoa, thiệp", "≥ 10 tấm"],
    ["Ảnh dọc để in khổ lớn", "3 tấm"],
  ],
  newborn: [
    ["Bé ngủ nền trắng", "≥ 15 tấm"],
    ["Bé cùng bố mẹ", "≥ 12 tấm"],
    ["Chi tiết tay, chân, tóc", "≥ 10 tấm"],
    ["Ảnh dọc để in khổ lớn", "3 tấm"],
  ],
  yearbook: [
    ["Ảnh tập thể toàn lớp", "≥ 8 tấm"],
    ["Ảnh nhóm theo tổ", "≥ 20 tấm"],
    ["Ảnh cá nhân từng bạn", "1 tấm/người"],
    ["Ảnh concept tự do", "≥ 30 tấm"],
  ],
  corp: [
    ["Chân dung ban lãnh đạo", "≥ 10 tấm"],
    ["Chân dung nhân sự", "1 tấm/người"],
    ["Không gian làm việc", "≥ 20 tấm"],
    ["Ảnh nhóm phòng ban", "≥ 8 tấm"],
  ],
  portrait: [
    ["Ảnh chính diện phông nền", "≥ 15 tấm"],
    ["Ảnh nửa người", "≥ 10 tấm"],
    ["Ảnh ánh sáng tự nhiên", "≥ 15 tấm"],
    ["Ảnh dọc để in khổ lớn", "3 tấm"],
  ],
};

/**
 * Nhận diện loại buổi chụp từ tên dịch vụ + tiêu đề hợp đồng (+ shoot_type cũ).
 * Thứ tự kiểm tra có ý nghĩa: "kỷ yếu" phải đứng trước "chân dung", và
 * prewedding vẫn tính là buổi cưới vì chạy show giống nhau.
 */
export function detectShootKind(...parts: (string | null | undefined)[]): ShootKind {
  const hay = parts.filter(Boolean).join(" ");
  if (/cưới|wedding|psc|đón dâu|rước dâu|vu quy|tân hôn|thành hôn/i.test(hay)) return "wedding";
  if (/sơ sinh|newborn|baby|đầy tháng|thôi nôi/i.test(hay)) return "newborn";
  if (/kỷ yếu|yearbook|tốt nghiệp|lớp/i.test(hay)) return "yearbook";
  if (/doanh nghiệp|corporate|profile|sản phẩm|sự kiện|event/i.test(hay)) return "corp";
  return "portrait";
}

/** "08:30" / "08:30:00" → số phút từ nửa đêm. Chuỗi hỏng → null. */
export function toMinutes(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((hhmm ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** Số phút từ nửa đêm → "08:30". Qua nửa đêm thì quay vòng về 00:xx. */
export function toHhmm(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export type RunStep = {
  /** Giờ để hiện, "07:30". */
  at: string;
  /**
   * Cùng mốc đó tính bằng phút từ nửa đêm NGÀY CHỤP — buổi qua đêm sẽ vượt quá
   * 1440 (01:00 hôm sau = 1500). Giữ số chưa quay vòng để so sánh được thứ tự;
   * `at` mới là bản đã quay vòng để hiện lên màn hình.
   */
  atMin: number;
  label: string;
};
export type ShotItem = { label: string; count: string };

export type FieldPlan = {
  kind: ShootKind;
  kindLabel: string;
  /** Giờ bắt đầu — giờ hợp đồng, KHÔNG phải giờ bước đầu tiên. */
  start: string;
  end: string;
  /** Cùng hai mốc trên, tính bằng phút chưa quay vòng (xem `RunStep.atMin`). */
  startMin: number;
  endMin: number;
  /** Nhãn khoảng thời gian hiện ở đầu thẻ: "08:00 – 18:00". */
  timeLabel: string;
  run: RunStep[];
  shots: ShotItem[];
};

/**
 * Dựng lịch trình + checklist cho một buổi chụp.
 *
 * `startTime` / `endTime` là giờ lấy từ hợp đồng (xem `page.tsx` để biết thứ tự
 * ưu tiên nguồn giờ). Thiếu giờ kết thúc thì suy ra theo độ dài mặc định của
 * loại buổi; thiếu cả giờ bắt đầu thì lấy 08:00 để màn hình vẫn dùng được.
 */
export function buildFieldPlan({
  kind,
  startTime,
  endTime,
}: {
  kind: ShootKind;
  startTime: string | null;
  endTime: string | null;
}): FieldPlan {
  const t1 = toMinutes(startTime) ?? 8 * 60;
  const rawEnd = toMinutes(endTime);
  // Tiệc cưới tan lúc 01:00 là chuyện thường: giờ kết thúc nhỏ hơn giờ bắt đầu
  // được hiểu là RẠNG SÁNG HÔM SAU (cộng 24h) chứ không phải dữ liệu hỏng.
  const endSameDayOrNext = rawEnd === null ? null : rawEnd >= t1 ? rawEnd : rawEnd + 1440;
  // Vẫn cần chặn dưới: kết thúc cách bắt đầu chưa tới 1 tiếng thì lấy độ dài
  // mặc định của loại buổi, không thì lịch trình dồn thành một cục.
  const t2 =
    endSameDayOrNext !== null && endSameDayOrNext >= t1 + 60
      ? endSameDayOrNext
      : t1 + DEFAULT_HOURS[kind] * 60;

  const labels = RUN_SHEET[kind];
  const span = t2 - t1;
  const run: RunStep[] = labels.map((label, i) => {
    // Bước đầu là khâu chuẩn bị: có mặt trước giờ hợp đồng 30 phút.
    const atMin = i === 0 ? t1 - 30 : t1 + Math.round((span * (i - 1)) / Math.max(1, labels.length - 1));
    return { at: toHhmm(atMin), atMin, label };
  });

  return {
    kind,
    kindLabel: SHOOT_KIND_LABEL[kind],
    start: toHhmm(t1),
    end: toHhmm(t2),
    startMin: t1,
    endMin: t2,
    timeLabel: `${toHhmm(t1)} – ${toHhmm(t2)}`,
    run,
    shots: SHOT_LIST[kind].map(([label, count]) => ({ label, count })),
  };
}

/**
 * Chặng đang chạy = chặng cuối cùng đã tới giờ. Chưa tới giờ bước đầu thì trả 0
 * (đang trên đường); quá giờ chặng cuối thì dừng ở chặng cuối.
 *
 * `nowMinutes` là giờ hiện tại tính từ nửa đêm. Với buổi qua đêm, 00:30 rạng
 * sáng phải được hiểu là 24:30 của ngày chụp — nếu không, một giờ sáng lại bị
 * coi là "chưa tới giờ có mặt" và lịch trình nhảy ngược về chặng đầu.
 */
export function currentStepIndex(plan: FieldPlan, nowMinutes: number): number {
  const { run, endMin } = plan;
  if (!run.length) return 0;
  // Buổi vắt qua nửa đêm (endMin > 1440) và đồng hồ đang ở rạng sáng TRƯỚC giờ
  // tan → đó vẫn là buổi chụp hôm nay, cộng 24h để so cho đúng thứ tự.
  const now = endMin > 1440 && nowMinutes + 1440 <= endMin ? nowMinutes + 1440 : nowMinutes;
  let idx = 0;
  for (let i = 0; i < run.length; i++) {
    if (run[i].atMin <= now) idx = i;
  }
  return idx;
}
