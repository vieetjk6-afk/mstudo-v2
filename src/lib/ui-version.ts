/* GIAO DIỆN MỚI (thử nghiệm) — công tắc giữa khung cũ và khung mới.
 *
 * Module THƯỜNG, cố ý KHÔNG "use client" (giống theme-boot.ts): layout.tsx là
 * server component đọc các hằng ở đây để quyết định vẽ khung nào ngay từ lần
 * render đầu — đọc ở client thì trang vẽ khung cũ rồi mới nháy sang khung mới.
 *
 * Hai giao diện dùng CHUNG dữ liệu, chung route, chung server action: công tắc
 * chỉ đổi lớp hiển thị (khung + bộ màu), nên chuyển qua lại không mất gì.
 *
 * Ai được dùng do cờ `ui_v2` trong site_settings.feature_flags quyết định
 * (Cấu hình mstudo → Tính năng):
 *   • (trống) / "admin" — chỉ tài khoản admin thấy công tắc. Mặc định.
 *   • "beta"    — mọi studio thấy gợi ý và tự bật nếu muốn.
 *   • "default" — mọi studio dùng giao diện mới, vẫn quay về bản cũ được.
 */

/** Cookie lưu lựa chọn của người dùng: "v2" = giao diện mới, "v1" = bản cũ. */
export const UI_COOKIE = "mstudo_ui";
/** Cookie lưu màu chủ đạo người dùng chọn (khoá trong ACCENTS, không phải mã màu). */
export const ACCENT_COOKIE = "mstudo_accent";
/** Một năm — lựa chọn giao diện là thứ chọn một lần rồi để đó. */
export const UI_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type UiMode = "admin" | "beta" | "default";

/** Đọc cờ `ui_v2` — giá trị lạ coi như chưa đặt (chỉ admin). */
export function uiV2Mode(flags: Record<string, string> | null | undefined): UiMode {
  const v = flags?.ui_v2;
  return v === "beta" || v === "default" ? v : "admin";
}

export type UiState = {
  /** Được phép dùng giao diện mới (thấy công tắc / gợi ý). */
  eligible: boolean;
  /** Đang vẽ giao diện mới. */
  active: boolean;
};

/**
 * Quyết định giao diện cho một người. Cookie chỉ là MONG MUỐN của người dùng —
 * không đủ quyền thì cookie "v2" cũng bị bỏ qua, nên tự gõ cookie không mở được
 * khung mới trước hạn.
 */
export function resolveUi(mode: UiMode, isAdmin: boolean, cookie: string | undefined): UiState {
  const eligible = isAdmin || mode !== "admin";
  if (!eligible) return { eligible, active: false };
  // "default": ai chưa từng chọn thì vào bản mới; đã chủ động chọn "v1" thì giữ.
  const active = mode === "default" ? cookie !== "v1" : cookie === "v2";
  return { eligible, active };
}

/**
 * Bảng màu chủ đạo người dùng tự chọn. Lưu KHOÁ chứ không lưu mã màu: giá trị
 * cookie đi thẳng vào style của khung, nên chỉ nhận đúng những khoá có ở đây —
 * cookie bị sửa tay thành chuỗi lạ cũng không chen được CSS nào vào trang.
 */
export const ACCENTS = [
  { key: "blue", label: "Xanh dương", hex: "#0b5cc4" },
  { key: "sky", label: "Xanh trời", hex: "#0284c7" },
  { key: "green", label: "Xanh ngọc", hex: "#1e9e72" },
  { key: "violet", label: "Tím", hex: "#7c3aed" },
  { key: "pink", label: "Hồng", hex: "#d63384" },
  { key: "red", label: "Đỏ đô", hex: "#b42335" },
  { key: "orange", label: "Cam", hex: "#d9580d" },
  { key: "slate", label: "Xanh than", hex: "#3b4a5e" },
] as const;

export type AccentKey = (typeof ACCENTS)[number]["key"];
export const DEFAULT_ACCENT: AccentKey = "blue";

export function accentKey(v: string | undefined | null): AccentKey {
  return (ACCENTS.find((a) => a.key === v)?.key ?? DEFAULT_ACCENT) as AccentKey;
}

export function accentHex(key: AccentKey): string {
  return ACCENTS.find((a) => a.key === key)!.hex;
}
